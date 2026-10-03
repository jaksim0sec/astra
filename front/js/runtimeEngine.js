/* =========================================================
   ovll
   Demo execution engine
   ========================================================= */
(function (global) {
  "use strict";

  function clone(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
  }

  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function connectionKind(connection) {
    return connection?.data?.kind === "data"
      ? "data"
      : "flow";
  }

  function normalizeWorkflow(input) {
    if (!input || typeof input !== "object") {
      throw new TypeError("workflow가 필요합니다.");
    }

    const nodes = Array.isArray(input.nodes)
      ? input.nodes.map(node => clone(node))
      : [];

    const ids = new Set();

    for (const node of nodes) {
      if (!node || typeof node.id !== "string" || !node.id) {
        throw new Error("올바르지 않은 node가 있습니다.");
      }

      if (ids.has(node.id)) {
        throw new Error(`중복 node ID입니다: ${node.id}`);
      }

      ids.add(node.id);
    }

    const connections = Array.isArray(input.connections)
      ? input.connections
          .map(connection => clone(connection))
          .filter(connection =>
            connection &&
            ids.has(String(connection.from?.node || "")) &&
            ids.has(String(connection.to?.node || ""))
          )
      : [];

    const graph = new Map(
      nodes.map(node => [node.id, []])
    );

    for (const connection of connections) {
      graph.get(connection.from.node)?.push(connection.to.node);
    }

    const visiting = new Set();
    const visited = new Set();

    function visit(nodeId) {
      if (visiting.has(nodeId)) {
        throw new Error("실행 workflow에 cycle이 있습니다.");
      }

      if (visited.has(nodeId)) return;

      visiting.add(nodeId);

      for (const childId of graph.get(nodeId) || []) {
        visit(childId);
      }

      visiting.delete(nodeId);
      visited.add(nodeId);
    }

    for (const node of nodes) {
      visit(node.id);
    }

    return {
      revision: input.revision ?? null,
      nodes,
      connections
    };
  }

  function inputValues(inputs) {
    return Object.values(inputs || {})
      .flatMap(value =>
        Array.isArray(value)
          ? value
          : [value]
      )
      .map(item => item?.value)
      .filter(value => value !== undefined);
  }

  function demoDelayFor(nodeId, min, max) {
    const text = String(nodeId || "");
    let hash = 0;

    for (let index = 0; index < text.length; index++) {
      hash =
        (
          hash * 31 +
          text.charCodeAt(index)
        ) >>> 0;
    }

    const span = Math.max(0, max - min);

    return min + (span ? hash % (span + 1) : 0);
  }


  const GEMINI_NODE_TYPES =
    new Set([
      "research",
      "organize",
      "judge",
      "write",
      "convert"
    ]);

  function isGeminiNode(node) {
    return (
      !!node &&
      GEMINI_NODE_TYPES.has(
        String(node.type || "")
      )
    );
  }

  function nodeParams(node) {
    if (
      node?.data?.params &&
      typeof node.data.params === "object" &&
      !Array.isArray(node.data.params)
    ) {
      return clone(node.data.params);
    }

    if (
      node?.params &&
      typeof node.params === "object" &&
      !Array.isArray(node.params)
    ) {
      return clone(node.params);
    }

    return {};
  }

  function planExecutionGroups(
    workflow,
    pivotId,
    mode = "spread",
    maxGroupNodes = 6
  ) {
    const nodes =
      new Map(
        workflow.nodes.map(
          node => [node.id, node]
        )
      );

    const incoming =
      new Map(
        workflow.nodes.map(
          node => [node.id, []]
        )
      );

    const outgoing =
      new Map(
        workflow.nodes.map(
          node => [node.id, []]
        )
      );

    for (
      const connection
        of workflow.connections
    ) {
      incoming
        .get(connection.to.node)
        ?.push(connection);

      outgoing
        .get(connection.from.node)
        ?.push(connection);
    }

    const pivot =
      String(pivotId || "");

    const scope =
      new Set();

    if (mode === "target") {
      const queue = [pivot];

      while (queue.length) {
        const current =
          queue.shift();

        if (
          !current ||
          scope.has(current)
        ) {
          continue;
        }

        scope.add(current);

        for (
          const connection
            of incoming.get(current) || []
        ) {
          queue.push(
            connection.from.node
          );
        }
      }
    } else {
      const queue = [pivot];

      while (queue.length) {
        const current =
          queue.shift();

        if (
          !current ||
          scope.has(current)
        ) {
          continue;
        }

        scope.add(current);

        for (
          const connection
            of incoming.get(current) || []
        ) {
          queue.push(
            connection.from.node
          );
        }

        for (
          const connection
            of outgoing.get(current) || []
        ) {
          queue.push(
            connection.to.node
          );
        }
      }
    }

    const scopedIncoming =
      new Map();

    const scopedOutgoing =
      new Map();

    for (const nodeId of scope) {
      scopedIncoming.set(
        nodeId,
        (incoming.get(nodeId) || [])
          .filter(connection =>
            scope.has(
              connection.from.node
            )
          )
      );

      scopedOutgoing.set(
        nodeId,
        (outgoing.get(nodeId) || [])
          .filter(connection =>
            scope.has(
              connection.to.node
            )
          )
      );
    }

    const indegree =
      new Map(
        [...scope].map(
          nodeId => [
            nodeId,
            (
              scopedIncoming.get(nodeId) ||
              []
            ).length
          ]
        )
      );

    const queue =
      workflow.nodes
        .map(node => node.id)
        .filter(nodeId =>
          scope.has(nodeId) &&
          indegree.get(nodeId) === 0
        );

    const topological = [];

    while (queue.length) {
      const current =
        queue.shift();

      topological.push(current);

      for (
        const connection
          of scopedOutgoing.get(current) ||
          []
      ) {
        const next =
          connection.to.node;

        const count =
          (indegree.get(next) || 0) - 1;

        indegree.set(
          next,
          count
        );

        if (count === 0) {
          queue.push(next);
        }
      }
    }

    for (
      const node
        of workflow.nodes
    ) {
      if (
        scope.has(node.id) &&
        !topological.includes(node.id)
      ) {
        topological.push(node.id);
      }
    }

    const groups = [];
    const assigned =
      new Set();
    const limit =
      Math.max(
        1,
        Number(maxGroupNodes) || 6
      );

    for (
      const startId
        of topological
    ) {
      if (assigned.has(startId)) {
        continue;
      }

      const startNode =
        nodes.get(startId);

      if (!isGeminiNode(startNode)) {
        continue;
      }

      const nodeIds =
        [startId];

      assigned.add(startId);

      if (startNode.type !== "judge") {
        let current =
          startId;

        while (
          nodeIds.length < limit
        ) {
          const outEdges =
            scopedOutgoing.get(current) ||
            [];

          if (outEdges.length !== 1) {
            break;
          }

          const next =
            outEdges[0].to.node;

          const inEdges =
            scopedIncoming.get(next) ||
            [];

          const currentNode =
            nodes.get(current);

          const nextNode =
            nodes.get(next);

          if (
            inEdges.length !== 1 ||
            assigned.has(next) ||
            !isGeminiNode(nextNode) ||
            currentNode?.type === "judge" ||
            nextNode?.type === "judge"
          ) {
            break;
          }

          nodeIds.push(next);
          assigned.add(next);
          current = next;
        }
      }

      groups.push({
        id:
          `gemini:${nodeIds.join(">")}`,
        nodeIds
      });
    }

    return {
      scope:
        topological,
      groups
    };
  }

  class DemoNodeExecutor {
    constructor(options = {}) {
      this.minDelay =
        Math.max(
          0,
          Number(options.minDelay ?? 420) || 0
        );

      this.maxDelay =
        Math.max(
          this.minDelay,
          Number(options.maxDelay ?? 1050) ||
            this.minDelay
        );
    }

    async run(node, inputs = {}, context = {}) {
      await wait(
        demoDelayFor(
          node.id,
          this.minDelay,
          this.maxDelay
        )
      );

      const params =
        node.data?.params &&
        typeof node.data.params === "object"
          ? node.data.params
          : node.params &&
            typeof node.params === "object"
            ? node.params
            : {};

      const values = inputValues(inputs);

      switch (node.type) {
        case "start":
          return {
            outputs: { out: true },
            report: { title: "시작 준비 완료" }
          };

        case "file": {
          const file = {
            kind: "demo-file",
            id: `demo-file:${node.id}`,
            name: node.data?.name || "예시 파일",
            mime:
              node.data?.mime ||
              "application/octet-stream",
            size: Number(node.data?.size || 0)
          };

          return {
            outputs: { file },
            report: {
              title: `${file.name} 준비 완료`
            }
          };
        }

        case "research":
          return {
            outputs: {
              result: {
                kind: "demo-research",
                topic: params.topic || "지정된 주제",
                filter: params.filter || "",
                inputCount: values.length,
                items: [
                  "시연 자료 A",
                  "시연 자료 B",
                  "시연 자료 C"
                ]
              }
            },
            report: {
              title: "시연 자료 3개 탐색 완료"
            }
          };

        case "organize":
          return {
            outputs: {
              result: {
                kind: "demo-structured",
                criteria:
                  params.criteria || "기본 기준",
                format:
                  params.format || "목록",
                sources: clone(values)
              }
            },
            report: {
              title: "자료 정리 완료"
            }
          };

        case "judge": {
          const condition =
            String(params.condition || "")
              .trim()
              .toLowerCase();

          const decision =
            !(
              condition === "false" ||
              condition.includes("거짓") ||
              condition.includes("아니")
            );

          return {
            decision,
            outputs: {
              true:
                decision
                  ? clone(values)
                  : undefined,
              false:
                decision
                  ? undefined
                  : clone(values)
            },
            report: {
              title:
                decision
                  ? "조건을 참으로 판단"
                  : "조건을 거짓으로 판단"
            }
          };
        }

        case "write":
          return {
            outputs: {
              result: {
                kind: "demo-document",
                title:
                  params.title || "예시 문서",
                style:
                  params.style || "일반",
                length:
                  params.length || "기본 분량",
                sources: clone(values),
                text:
                  "시연 실행기가 만든 임시 결과입니다."
              }
            },
            report: {
              title:
                `${params.title || "문서"} 작성 완료`
            }
          };

        case "createFile": {
          const filename =
            params.filename || "결과물";
          const format =
            params.format || "PDF";

          return {
            outputs: {},
            artifact: {
              kind: "demo-artifact",
              id:
                `demo-artifact:${context.runId}:${node.id}`,
              name:
                `${filename}.${String(format).toLowerCase()}`,
              format,
              sources: clone(values)
            },
            report: {
              title: `${filename} 생성 완료`
            }
          };
        }

        default:
          return {
            outputs: {
              result: {
                kind: "demo-value",
                sources: clone(values)
              }
            },
            report: {
              title: `${node.type} 실행 완료`
            }
          };
      }
    }
  }

  class RuntimeEngine {
    constructor(options = {}) {
      this.executor =
        options.executor &&
        typeof options.executor.run === "function"
          ? options.executor
          : new DemoNodeExecutor(
              options.executorOptions || {}
            );

      this.onEvent =
        typeof options.onEvent === "function"
          ? options.onEvent
          : null;

      this.running = false;
      this.runCounter = 0;
      this.lastRun = null;

      this.maxGroupNodes =
        Math.max(
          1,
          Number(
            options.maxGroupNodes ??
            6
          ) || 6
        );

      this.maxGroupInputChars =
        Math.max(
          1000,
          Number(
            options.maxGroupInputChars ??
            60000
          ) || 60000
        );
    }

    isRunning() {
      return this.running;
    }

    emit(type, payload = {}) {
      const event = {
        type,
        at: Date.now(),
        ...clone(payload)
      };

      try {
        this.onEvent?.(event);
      } catch (error) {
        console.error(
          "ovll runtime event subscriber error:",
          error
        );
      }

      return event;
    }

    async run(inputWorkflow, pivotId, options = {}) {
      if (this.running) {
        throw new Error(
          "이미 demo run이 실행 중입니다."
        );
      }

      const workflow =
        normalizeWorkflow(inputWorkflow);

      const pivot =
        String(pivotId || "");

      const mode =
        options.mode === "target"
          ? "target"
          : "spread";

      const nodes =
        new Map(
          workflow.nodes.map(
            node => [node.id, node]
          )
        );

      if (!nodes.has(pivot)) {
        throw new Error(
          `실행 기준 node가 없습니다: ${pivot}`
        );
      }

      const incoming =
        new Map(
          workflow.nodes.map(
            node => [node.id, []]
          )
        );

      const outgoing =
        new Map(
          workflow.nodes.map(
            node => [node.id, []]
          )
        );

      for (const connection of workflow.connections) {
        incoming
          .get(connection.to.node)
          ?.push(connection);

        outgoing
          .get(connection.from.node)
          ?.push(connection);
      }


      const executionPlan =
        planExecutionGroups(
          workflow,
          pivot,
          mode,
          this.maxGroupNodes
        );

      const executionScope =
        new Set(
          executionPlan.scope
        );

      const groupByNode =
        new Map();

      for (
        const group
          of executionPlan.groups
      ) {
        for (
          const nodeId
            of group.nodeIds
        ) {
          groupByNode.set(
            nodeId,
            group
          );
        }
      }

      const runId =
        `demo-run-${Date.now().toString(36)}-${++this.runCounter}`;

      const states =
        new Map(
          workflow.nodes.map(
            node => [
              node.id,
              {
                id: node.id,
                type: node.type,
                status: "IDLE",
                inputs: {},
                result: null,
                error: null,
                startedAt: null,
                finishedAt: null
              }
            ]
          )
        );

      const nodeJobs = new Map();
      const groupJobs = new Map();
      const edgeRefs = new Map();

      const setState = (
        nodeId,
        status,
        extra = {}
      ) => {
        const state =
          states.get(nodeId);

        if (!state) return;

        Object.assign(
          state,
          extra,
          { status }
        );

        this.emit(
          "node:state",
          {
            runId,
            nodeId,
            status,
            report:
              extra.report ||
              extra.result?.report ||
              null
          }
        );
      };

      const acquireEdge =
        connection => {
          const id =
            String(connection?.id || "");

          if (!id) {
            return () => {};
          }

          const count =
            edgeRefs.get(id) || 0;

          edgeRefs.set(
            id,
            count + 1
          );

          if (count === 0) {
            this.emit(
              "edge:state",
              {
                runId,
                edgeId: id,
                active: true
              }
            );
          }

          let released = false;

          return () => {
            if (released) return;
            released = true;

            const next =
              Math.max(
                0,
                (edgeRefs.get(id) || 1) - 1
              );

            if (next === 0) {
              edgeRefs.delete(id);

              this.emit(
                "edge:state",
                {
                  runId,
                  edgeId: id,
                  active: false
                }
              );
            } else {
              edgeRefs.set(id, next);
            }
          };
        };

      const edgeIsActive =
        connection => {
          const sourceState =
            states.get(connection.from.node);

          if (
            sourceState?.status ===
            "SKIPPED"
          ) {
            return false;
          }

          const sourceNode =
            nodes.get(connection.from.node);

          if (sourceNode?.type !== "judge") {
            return (
              sourceState?.status ===
              "SUCCESS"
            );
          }

          const decision =
            sourceState?.result?.decision;

          if (typeof decision !== "boolean") {
            return false;
          }

          if (connection.from.port === "true") {
            return decision;
          }

          if (connection.from.port === "false") {
            return !decision;
          }

          return (
            sourceState?.status ===
            "SUCCESS"
          );
        };

      const collectInputs =
        nodeId => {
          const inputs = {};

          for (
            const connection
              of incoming.get(nodeId) || []
          ) {
            if (!edgeIsActive(connection)) {
              continue;
            }

            const source =
              states.get(connection.from.node);

            const value =
              source?.result?.outputs?.[
                connection.from.port
              ];

            if (value === undefined) {
              continue;
            }

            const port =
              String(connection.to.port);

            const item = {
              edgeId:
                String(connection.id || ""),
              kind:
                connectionKind(connection),
              fromNode:
                connection.from.node,
              fromPort:
                connection.from.port,
              value:
                clone(value)
            };

            if (!inputs[port]) {
              inputs[port] = [];
            }

            inputs[port].push(item);
          }

          return inputs;
        };

      const resolveNode =
        nodeId => {
          const group =
            groupByNode.get(nodeId);

          if (
            group &&
            typeof this.executor.runGroup ===
              "function"
          ) {
            return resolveGroup(group);
          }

          if (nodeJobs.has(nodeId)) {
            return nodeJobs.get(nodeId);
          }

          const job =
            (async () => {
              const node =
                nodes.get(nodeId);

              if (!node) {
                throw new Error(
                  `node를 찾을 수 없습니다: ${nodeId}`
                );
              }

              const parentEdges =
                incoming.get(nodeId) || [];

              if (parentEdges.length) {
                setState(
                  nodeId,
                  "WAITING"
                );
              }

              const releaseParentEdges =
                parentEdges.map(
                  connection =>
                    acquireEdge(connection)
                );

              try {
                await Promise.all(
                  parentEdges.map(
                    connection =>
                      resolveNode(
                        connection.from.node
                      )
                  )
                );

                const failedDependencies =
                  parentEdges
                    .map(connection => {
                      const state =
                        states.get(
                          connection.from.node
                        );

                      if (
                        state?.status ===
                        "FAILED"
                      ) {
                        return {
                          nodeId:
                            connection.from.node,
                          blockedBy: [
                            connection.from.node
                          ]
                        };
                      }

                      if (
                        state?.status ===
                          "SKIPPED" &&
                        state?.skipReason ===
                          "dependency_failed"
                      ) {
                        return {
                          nodeId:
                            connection.from.node,
                          blockedBy:
                            Array.isArray(
                              state.blockedBy
                            ) &&
                            state.blockedBy.length
                              ? state.blockedBy
                              : [
                                  connection
                                    .from.node
                                ]
                        };
                      }

                      return null;
                    })
                    .filter(Boolean);

                if (
                  failedDependencies.length
                ) {
                  const blockedBy =
                    [
                      ...new Set(
                        failedDependencies
                          .flatMap(
                            item =>
                              item.blockedBy
                          )
                      )
                    ];

                  setState(
                    nodeId,
                    "SKIPPED",
                    {
                      skipReason:
                        "dependency_failed",
                      blockedBy,
                      finishedAt:
                        Date.now()
                    }
                  );

                  return null;
                }

                const flowIncoming =
                  parentEdges.filter(
                    connection =>
                      connectionKind(connection) ===
                      "flow"
                  );

                if (
                  flowIncoming.length &&
                  !flowIncoming.some(
                    edgeIsActive
                  )
                ) {
                  setState(
                    nodeId,
                    "SKIPPED",
                    {
                      finishedAt:
                        Date.now()
                    }
                  );

                  return null;
                }

                const inputs =
                  collectInputs(nodeId);

                setState(
                  nodeId,
                  "RUNNING",
                  {
                    inputs: clone(inputs),
                    startedAt: Date.now()
                  }
                );

                try {
                  const result =
                    await this.executor.run(
                      clone(node),
                      clone(inputs),
                      {
                        runId,
                        nodeId,
                        pivot,
                        mode
                      }
                    );

                  setState(
                    nodeId,
                    "SUCCESS",
                    {
                      result:
                        clone(result),
                      finishedAt:
                        Date.now(),
                      report:
                        result?.report ||
                        null
                    }
                  );

                  return result;
                } catch (error) {
                  const failure = {
                    message:
                      error?.message ||
                      String(error)
                  };

                  setState(
                    nodeId,
                    "FAILED",
                    {
                      error: failure,
                      finishedAt:
                        Date.now()
                    }
                  );

                  return null;
                }
              } finally {
                releaseParentEdges
                  .forEach(
                    release =>
                      release()
                  );
              }
            })();

          nodeJobs.set(nodeId, job);

          return job;
        };

      const resolveGroup =
        group => {
          if (groupJobs.has(group.id)) {
            return groupJobs.get(group.id);
          }

          const job =
            (async () => {
              const nodeIds =
                group.nodeIds.slice();

              const groupSet =
                new Set(nodeIds);

              const allEdges =
                workflow.connections
                  .filter(connection =>
                    groupSet.has(
                      connection.to.node
                    ) ||
                    groupSet.has(
                      connection.from.node
                    )
                  );

              const externalParentEdges =
                allEdges.filter(
                  connection =>
                    groupSet.has(
                      connection.to.node
                    ) &&
                    !groupSet.has(
                      connection.from.node
                    )
                );

              const internalEdges =
                allEdges.filter(
                  connection =>
                    groupSet.has(
                      connection.from.node
                    ) &&
                    groupSet.has(
                      connection.to.node
                    )
                );

              for (
                const nodeId
                  of nodeIds
              ) {
                if (
                  (incoming.get(nodeId) || [])
                    .length
                ) {
                  setState(
                    nodeId,
                    "WAITING"
                  );
                }
              }

              const releases =
                [
                  ...externalParentEdges,
                  ...internalEdges
                ].map(
                  connection =>
                    acquireEdge(connection)
                );

              try {
                const externalParents =
                  [
                    ...new Set(
                      externalParentEdges
                        .map(
                          connection =>
                            connection.from.node
                        )
                    )
                  ];

                await Promise.all(
                  externalParents.map(
                    parentId =>
                      resolveNode(parentId)
                  )
                );

                const failedDependencies =
                  externalParentEdges
                    .map(connection => {
                      const state =
                        states.get(
                          connection.from.node
                        );

                      if (
                        state?.status ===
                        "FAILED"
                      ) {
                        return [
                          connection.from.node
                        ];
                      }

                      if (
                        state?.status ===
                          "SKIPPED" &&
                        state?.skipReason ===
                          "dependency_failed"
                      ) {
                        return (
                          Array.isArray(
                            state.blockedBy
                          ) &&
                          state.blockedBy.length
                            ? state.blockedBy
                            : [
                                connection
                                  .from.node
                              ]
                        );
                      }

                      return [];
                    })
                    .flat();

                if (
                  failedDependencies.length
                ) {
                  const blockedBy =
                    [
                      ...new Set(
                        failedDependencies
                      )
                    ];

                  for (
                    const nodeId
                      of nodeIds
                  ) {
                    setState(
                      nodeId,
                      "SKIPPED",
                      {
                        skipReason:
                          "dependency_failed",
                        blockedBy,
                        finishedAt:
                          Date.now()
                      }
                    );
                  }

                  return null;
                }

                const headId =
                  nodeIds[0];

                const headFlowEdges =
                  externalParentEdges
                    .filter(
                      connection =>
                        connection.to.node ===
                          headId &&
                        connectionKind(
                          connection
                        ) === "flow"
                    );

                if (
                  headFlowEdges.length &&
                  !headFlowEdges.some(
                    edgeIsActive
                  )
                ) {
                  for (
                    const nodeId
                      of nodeIds
                  ) {
                    setState(
                      nodeId,
                      "SKIPPED",
                      {
                        finishedAt:
                          Date.now()
                      }
                    );
                  }

                  return null;
                }

                const buildRequest =
                  ids => ({
                    nodes:
                      ids.map(
                        nodeId => {
                          const node =
                            nodes.get(nodeId);

                          return {
                            id: node.id,
                            type: node.type,
                            params:
                              nodeParams(node),
                            inputs:
                              collectInputs(
                                nodeId
                              )
                          };
                        }
                      ),
                    internalConnections:
                      internalEdges
                        .filter(
                          connection =>
                            ids.includes(
                              connection.from.node
                            ) &&
                            ids.includes(
                              connection.to.node
                            )
                        )
                        .map(
                          connection =>
                            clone(connection)
                        )
                  });

                const normalizeResults =
                  (ids, response) => {
                    const results =
                      Array.isArray(response)
                        ? response
                        : response?.results;

                    if (
                      !Array.isArray(results) ||
                      results.length !==
                        ids.length
                    ) {
                      throw new Error(
                        "그룹 실행 결과 개수가 올바르지 않습니다."
                      );
                    }

                    for (
                      let index = 0;
                      index < ids.length;
                      index++
                    ) {
                      if (
                        String(
                          results[index]
                            ?.nodeId || ""
                        ) !==
                        ids[index]
                      ) {
                        throw new Error(
                          "그룹 실행 결과 순서가 올바르지 않습니다."
                        );
                      }
                    }

                    return results;
                  };

                const commitResults =
                  (ids, results) => {
                    for (
                      let index = 0;
                      index < ids.length;
                      index++
                    ) {
                      const nodeId =
                        ids[index];

                      const item =
                        results[index];

                      const result = {
                        outputs:
                          item?.outputs &&
                          typeof item.outputs ===
                            "object"
                            ? clone(
                                item.outputs
                              )
                            : {},
                        decision:
                          typeof item?.decision ===
                            "boolean"
                            ? item.decision
                            : null,
                        report:
                          item?.report ??
                          null
                      };

                      setState(
                        nodeId,
                        "SUCCESS",
                        {
                          inputs:
                            clone(
                              collectInputs(
                                nodeId
                              )
                            ),
                          result,
                          finishedAt:
                            Date.now(),
                          report:
                            result.report
                        }
                      );
                    }
                  };

                const executeIds =
                  async ids => {
                    for (
                      const nodeId
                        of ids
                    ) {
                      setState(
                        nodeId,
                        "RUNNING",
                        {
                          inputs:
                            clone(
                              collectInputs(
                                nodeId
                              )
                            ),
                          startedAt:
                            Date.now()
                        }
                      );
                    }

                    const request =
                      buildRequest(ids);

                    const response =
                      await this.executor
                        .runGroup(
                          clone(request),
                          {
                            runId,
                            pivot,
                            mode,
                            groupId:
                              group.id
                          }
                        );

                    const results =
                      normalizeResults(
                        ids,
                        response
                      );

                    commitResults(
                      ids,
                      results
                    );
                  };

                const fullRequest =
                  buildRequest(nodeIds);

                const serializedSize =
                  JSON.stringify(
                    fullRequest
                  ).length;

                if (
                  serializedSize >
                    this
                      .maxGroupInputChars &&
                  nodeIds.length > 1
                ) {
                  for (
                    let index = 0;
                    index < nodeIds.length;
                    index++
                  ) {
                    const nodeId =
                      nodeIds[index];

                    try {
                      await executeIds([
                        nodeId
                      ]);
                    } catch (error) {
                      const failure = {
                        message:
                          error?.message ||
                          String(error)
                      };

                      setState(
                        nodeId,
                        "FAILED",
                        {
                          error: failure,
                          finishedAt:
                            Date.now()
                        }
                      );

                      for (
                        const laterId
                          of nodeIds.slice(
                            index + 1
                          )
                      ) {
                        setState(
                          laterId,
                          "SKIPPED",
                          {
                            skipReason:
                              "dependency_failed",
                            blockedBy: [
                              nodeId
                            ],
                            finishedAt:
                              Date.now()
                          }
                        );
                      }

                      return null;
                    }
                  }

                  return true;
                }

                try {
                  await executeIds(
                    nodeIds
                  );

                  return true;
                } catch (error) {
                  const failedId =
                    nodeIds[0];

                  const failure = {
                    message:
                      error?.message ||
                      String(error)
                  };

                  setState(
                    failedId,
                    "FAILED",
                    {
                      error: failure,
                      finishedAt:
                        Date.now()
                    }
                  );

                  for (
                    const nodeId
                      of nodeIds.slice(1)
                  ) {
                    setState(
                      nodeId,
                      "SKIPPED",
                      {
                        skipReason:
                          "dependency_failed",
                        blockedBy: [
                          failedId
                        ],
                        finishedAt:
                          Date.now()
                      }
                    );
                  }

                  return null;
                }
              } finally {
                releases.forEach(
                  release =>
                    release()
                );
              }
            })();

          groupJobs.set(
            group.id,
            job
          );

          return job;
        };

      this.running = true;

      this.emit(
        "run:start",
        {
          runId,
          pivot,
          mode
        }
      );

      try {
        if (mode === "target") {
          await resolveNode(pivot);
        } else {
          await Promise.all(
            executionPlan.scope.map(
              nodeId =>
                resolveNode(nodeId)
            )
          );
        }

        const snapshot =
          Object.fromEntries(
            [...states.entries()].map(
              ([id, state]) => [
                id,
                clone(state)
              ]
            )
          );

        const touched =
          Object.values(snapshot)
            .filter(
              state =>
                state.status !== "IDLE"
            );

        const status =
          touched.some(
            state =>
              state.status === "FAILED"
          )
            ? "FAILED"
            : "SUCCESS";

        const result = {
          runId,
          pivot,
          mode,
          status,
          workflow:
            clone(workflow),
          nodes:
            snapshot
        };

        this.lastRun =
          clone(result);

        this.emit(
          "run:finish",
          {
            runId,
            pivot,
            mode,
            status,
            result
          }
        );

        return result;
      } catch (error) {
        const result = {
          runId,
          pivot,
          mode,
          status: "FAILED",
          workflow:
            clone(workflow),
          nodes:
            Object.fromEntries(
              [...states.entries()].map(
                ([id, state]) => [
                  id,
                  clone(state)
                ]
              )
            ),
          error: {
            message:
              error?.message ||
              String(error)
          }
        };

        this.lastRun =
          clone(result);

        this.emit(
          "run:finish",
          {
            runId,
            pivot,
            mode,
            status: "FAILED",
            result
          }
        );

        throw error;
      } finally {
        for (
          const edgeId
            of [...edgeRefs.keys()]
        ) {
          this.emit(
            "edge:state",
            {
              runId,
              edgeId,
              active: false
            }
          );
        }

        edgeRefs.clear();
        this.running = false;
      }
    }

    getLastRun() {
      return this.lastRun
        ? clone(this.lastRun)
        : null;
    }
  }

  global.OvllExecutionEngine = {
    RuntimeEngine,
    DemoNodeExecutor,
    normalizeWorkflow,
    planExecutionGroups
  };
})(window);
