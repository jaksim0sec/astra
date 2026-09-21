(() => {
  'use strict';

  function clone(value) {
    if (value === undefined) {
      return undefined;
    }

    return JSON.parse(
      JSON.stringify(value)
    );
  }

  function parseWorkflowEndpoint(
    value
  ) {
    if (
      typeof value !== 'string'
    ) {
      throw new Error(
        'Workflow endpoint가 문자열이 아닙니다.'
      );
    }

    const dot =
      value.lastIndexOf('.');

    if (
      dot <= 0 ||
      dot === value.length - 1
    ) {
      throw new Error(
        `잘못된 Workflow endpoint입니다: ${value}`
      );
    }

    return {
      node:
        value.slice(
          0,
          dot
        ),

      port:
        value.slice(
          dot + 1
        )
    };
  }

  function normalizeWorkflowIR(
    ir
  ) {
    if (
      !ir ||
      typeof ir !== 'object' ||
      Array.isArray(ir)
    ) {
      throw new Error(
        'Workflow IR이 없습니다.'
      );
    }

    if (
      !Array.isArray(
        ir.nodes
      )
    ) {
      throw new Error(
        'Workflow IR의 nodes가 배열이 아닙니다.'
      );
    }

    if (
      !Array.isArray(
        ir.links
      )
    ) {
      throw new Error(
        'Workflow IR의 links가 배열이 아닙니다.'
      );
    }

    if (
      !Array.isArray(
        ir.data
      )
    ) {
      throw new Error(
        'Workflow IR의 data가 배열이 아닙니다.'
      );
    }

    const ids =
      new Set();

    const nodes =
      ir.nodes.map(
        node => {
          if (
            !node ||
            typeof node !== 'object' ||
            typeof node.id !== 'string' ||
            typeof node.type !== 'string'
          ) {
            throw new Error(
              '잘못된 Workflow node입니다.'
            );
          }

          if (
            ids.has(
              node.id
            )
          ) {
            throw new Error(
              `중복된 Workflow node ID입니다: ${node.id}`
            );
          }

          ids.add(
            node.id
          );

          return {
            id:
              node.id,

            type:
              node.type,

            params:
              clone(
                node.params || {}
              )
          };
        }
      );

    const starts =
      nodes.filter(
        node =>
          node.type === 'start'
      );

    if (
      starts.length !== 1
    ) {
      throw new Error(
        'start node는 정확히 하나 있어야 합니다.'
      );
    }

    function normalizeEdges(
      list,
      kind
    ) {
      return list.map(
        (
          edge,
          index
        ) => {
          if (
            !Array.isArray(edge) ||
            edge.length !== 2
          ) {
            throw new Error(
              `잘못된 ${kind} 연결입니다: #${index + 1}`
            );
          }

          const from =
            parseWorkflowEndpoint(
              edge[0]
            );

          const to =
            parseWorkflowEndpoint(
              edge[1]
            );

          if (
            !ids.has(
              from.node
            ) ||
            !ids.has(
              to.node
            )
          ) {
            throw new Error(
              `${kind} 연결에 존재하지 않는 node가 있습니다: ${edge[0]} → ${edge[1]}`
            );
          }

          return {
            id:
              `${kind}-${index + 1}`,

            kind,

            from,

            to
          };
        }
      );
    }

    return {
      nodes,

      links:
        normalizeEdges(
          ir.links,
          'flow'
        ),

      data:
        normalizeEdges(
          ir.data,
          'data'
        )
    };
  }

  function buildWorkflowPlan(
    ir
  ) {
    const workflow =
      normalizeWorkflowIR(
        ir
      );

    const nodes =
      new Map(
        workflow.nodes.map(
          node => [
            node.id,
            node
          ]
        )
      );

    const flowEdges =
      workflow.links;

    const dataEdges =
      workflow.data;

    const edges =
      [
        ...flowEdges,
        ...dataEdges
      ];

    const dependents =
      new Map();

    const indegree =
      new Map();

    const originalIndex =
      new Map();

    workflow.nodes.forEach(
      (
        node,
        index
      ) => {
        dependents.set(
          node.id,
          []
        );

        indegree.set(
          node.id,
          0
        );

        originalIndex.set(
          node.id,
          index
        );
      }
    );

    /*
      실행 순서는 flow(link)만 사용한다.
      data는 실행 순서가 아니라 결과 전달이다.
    */
    for (
      const edge
        of flowEdges
    ) {
      dependents
        .get(
          edge.from.node
        )
        .push(
          edge.to.node
        );

      indegree.set(
        edge.to.node,
        indegree.get(
          edge.to.node
        ) + 1
      );
    }

    const queue =
      workflow.nodes
        .filter(
          node =>
            indegree.get(
              node.id
            ) === 0
        )
        .map(
          node =>
            node.id
        );

    const order =
      [];

    while (
      queue.length
    ) {
      queue.sort(
        (
          a,
          b
        ) =>
          originalIndex.get(a) -
          originalIndex.get(b)
      );

      const nodeId =
        queue.shift();

      order.push(
        nodeId
      );

      for (
        const nextId
          of dependents.get(
            nodeId
          )
      ) {
        indegree.set(
          nextId,
          indegree.get(
            nextId
          ) - 1
        );

        if (
          indegree.get(
            nextId
          ) === 0
        ) {
          queue.push(
            nextId
          );
        }
      }
    }

    if (
      order.length !==
      workflow.nodes.length
    ) {
      throw new Error(
        'Workflow에 순환 구조가 있어 실행 순서를 만들 수 없습니다.'
      );
    }

    return {
      nodes,

      edges,

      flowEdges,

      dataEdges,

      startId:
        workflow.nodes.find(
          node =>
            node.type === 'start'
        ).id,

      order
    };
  }

  async function runWorkflow(
    ir,
    options = {}
  ) {
    const plan =
      buildWorkflowPlan(
        ir
      );

    const executor =
      options.executor &&
      typeof options.executor.run === 'function'
        ? options.executor
        : new window.WorkflowExecutor(
            options.executorOptions || {}
          );

    const scheduler =
      new window.WorkflowScheduler(
        plan,
        executor,
        options
      );

    const execution =
      await scheduler.run();

    return {
      plan,
      execution
    };
  }

  window.parseWorkflowEndpoint =
    parseWorkflowEndpoint;

  window.normalizeWorkflowIR =
    normalizeWorkflowIR;

  window.buildWorkflowPlan =
    buildWorkflowPlan;

  window.runWorkflow =
    runWorkflow;
})();
