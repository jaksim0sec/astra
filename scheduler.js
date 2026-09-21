(() => {
  'use strict';

  const TERMINAL =
    new Set([
      'SUCCESS',
      'FAILED',
      'SKIPPED'
    ]);

  function clone(value) {
    if (value === undefined) {
      return undefined;
    }

    return JSON.parse(
      JSON.stringify(value)
    );
  }

  class WorkflowScheduler {
    constructor(
      plan,
      executor,
      options = {}
    ) {
      if (
        !plan ||
        typeof plan !== 'object'
      ) {
        throw new TypeError(
          'Workflow plan이 필요합니다.'
        );
      }

      if (
        !executor ||
        typeof executor.run !== 'function'
      ) {
        throw new TypeError(
          'Workflow executor가 필요합니다.'
        );
      }

      this.plan =
        plan;

      this.executor =
        executor;

      this.onEvent =
        typeof options.onEvent === 'function'
          ? options.onEvent
          : null;

      this.failFast =
        options.failFast === true;

      this.state =
        new Map();

      this.edgeState =
        new Map();

      this.log =
        [];

      this.running =
        false;

      for (
        const nodeId
          of plan.order
      ) {
        this.state.set(
          nodeId,
          {
            id: nodeId,
            status: 'WAITING',
            inputs: {},
            result: null,
            error: null,
            startedAt: null,
            finishedAt: null,
            nextRunAt: null
          }
        );
      }

      for (
        const edge
          of plan.edges
      ) {
        this.edgeState.set(
          edge.id,
          null
        );
      }

      this.markReady(
        plan.startId
      );
    }

    emit(
      type,
      payload = {}
    ) {
      const event = {
        type,
        timestamp:
          Date.now(),
        ...clone(payload)
      };

      this.log.push(
        event
      );

      if (
        this.onEvent
      ) {
        this.onEvent(
          event
        );
      }
    }

    stateOf(nodeId) {
      return (
        this.state.get(
          nodeId
        ) || null
      );
    }

    incoming(
      nodeId,
      kind
    ) {
      return this.plan.edges.filter(
        edge =>
          edge.to.node === nodeId &&
          edge.kind === kind
      );
    }

    activeIncoming(
      nodeId,
      kind
    ) {
      return this.incoming(
        nodeId,
        kind
      ).filter(
        edge =>
          this.edgeState.get(
            edge.id
          ) === true
      );
    }

    unknownIncoming(
      nodeId,
      kind
    ) {
      return this.incoming(
        nodeId,
        kind
      ).some(
        edge =>
          this.edgeState.get(
            edge.id
          ) === null
      );
    }

    markReady(nodeId) {
      const state =
        this.stateOf(
          nodeId
        );

      if (
        !state ||
        state.status !== 'WAITING'
      ) {
        return false;
      }

      state.status =
        'READY';

      this.emit(
        'node:state',
        {
          nodeId,
          status: 'READY'
        }
      );

      return true;
    }

    markSkipped(
      nodeId,
      reason
    ) {
      const state =
        this.stateOf(
          nodeId
        );

      if (
        !state ||
        TERMINAL.has(
          state.status
        )
      ) {
        return false;
      }

      state.status =
        'SKIPPED';

      state.error = {
        message:
          reason
      };

      state.finishedAt =
        Date.now();

      this.emit(
        'node:state',
        {
          nodeId,
          status: 'SKIPPED',
          reason
        }
      );

      return true;
    }

    resolveOutgoing(
      nodeId,
      result
    ) {
      const node =
        this.plan.nodes.get(
          nodeId
        );

      if (!node) {
        return;
      }

      const decision =
        typeof result.decision === 'boolean'
          ? result.decision
          : null;

      for (
        const edge
          of this.plan.edges
      ) {
        if (
          edge.from.node !== nodeId
        ) {
          continue;
        }

        let active = true;

        if (
          node.type === 'judge' &&
          decision !== null
        ) {
          if (
            edge.from.port === 'true'
          ) {
            active =
              decision;
          }

          if (
            edge.from.port === 'false'
          ) {
            active =
              !decision;
          }
        }

        this.edgeState.set(
          edge.id,
          active
        );
      }
    }

    dataReady(nodeId) {
      const edges =
        this.incoming(
          nodeId,
          'data'
        );

      for (
        const edge
          of edges
      ) {
        const active =
          this.edgeState.get(
            edge.id
          );

        if (
          active === null
        ) {
          return false;
        }

        if (
          active === false
        ) {
          continue;
        }

        const source =
          this.stateOf(
            edge.from.node
          );

        if (
          !source ||
          source.status !==
            'SUCCESS'
        ) {
          return false;
        }
      }

      return true;
    }

    canRun(nodeId) {
      const node =
        this.plan.nodes.get(
          nodeId
        );

      const state =
        this.stateOf(
          nodeId
        );

      if (
        !node ||
        !state ||
        (
          state.status !== 'WAITING' &&
          state.status !== 'READY'
        )
      ) {
        return false;
      }

      if (
        node.type === 'start'
      ) {
        return true;
      }

      const flow =
        this.incoming(
          nodeId,
          'flow'
        );

      if (
        !flow.length
      ) {
        return false;
      }

      if (
        this.unknownIncoming(
          nodeId,
          'flow'
        )
      ) {
        return false;
      }

      const activeFlow =
        this.activeIncoming(
          nodeId,
          'flow'
        );

      if (
        !activeFlow.length
      ) {
        this.markSkipped(
          nodeId,
          '활성화된 flow 경로가 없습니다.'
        );

        return false;
      }

      for (
        const edge
          of activeFlow
      ) {
        const source =
          this.stateOf(
            edge.from.node
          );

        if (
          !source ||
          source.status !==
            'SUCCESS'
        ) {
          return false;
        }
      }

      return this.dataReady(
        nodeId
      );
    }

    collectInputs(nodeId) {
      const inputs = {};

      for (
        const edge
          of this.activeIncoming(
            nodeId,
            'data'
          )
      ) {
        const source =
          this.stateOf(
            edge.from.node
          );

        const value =
          source?.result?.outputs?.[
            edge.from.port
          ];

        if (
          value === undefined
        ) {
          continue;
        }

        if (
          Object.prototype.hasOwnProperty.call(
            inputs,
            edge.to.port
          )
        ) {
          if (
            !Array.isArray(
              inputs[edge.to.port]
            )
          ) {
            inputs[edge.to.port] =
              [
                inputs[edge.to.port]
              ];
          }

          inputs[
            edge.to.port
          ].push(
            clone(value)
          );
        } else {
          inputs[
            edge.to.port
          ] =
            clone(value);
        }
      }

      return inputs;
    }

    findReady() {
      for (
        const nodeId
          of this.plan.order
      ) {
        if (
          this.canRun(
            nodeId
          )
        ) {
          return nodeId;
        }
      }

      return null;
    }

    async executeNode(
      nodeId
    ) {
      const node =
        this.plan.nodes.get(
          nodeId
        );

      const state =
        this.stateOf(
          nodeId
        );

      const inputs =
        this.collectInputs(
          nodeId
        );

      state.status =
        'RUNNING';

      state.inputs =
        inputs;

      state.startedAt =
        Date.now();

      this.emit(
        'node:state',
        {
          nodeId,
          status: 'RUNNING'
        }
      );

      try {
        const result =
          await this.executor.run(
            node,
            clone(inputs),
            {
              nodeId,
              plan: this.plan,
              scheduler: this
            }
          );

        state.result =
          result;

        state.status =
          'SUCCESS';

        state.finishedAt =
          Date.now();

        this.resolveOutgoing(
          nodeId,
          result
        );

        this.emit(
          'node:state',
          {
            nodeId,
            status: 'SUCCESS',
            result
          }
        );

        return result;
      } catch (error) {
        state.status =
          'FAILED';

        state.error = {
          message:
            error?.message ||
            String(error)
        };

        state.finishedAt =
          Date.now();

        this.emit(
          'node:state',
          {
            nodeId,
            status: 'FAILED',
            error:
              state.error
          }
        );

        if (
          this.failFast
        ) {
          throw error;
        }

        return null;
      }
    }

    async run() {
      if (
        this.running
      ) {
        throw new Error(
          '이미 Workflow가 실행 중입니다.'
        );
      }

      this.running =
        true;

      this.emit(
        'execution:start',
        {
          order:
            this.plan.order
        }
      );

      try {
        while (true) {
          const nodeId =
            this.findReady();

          if (
            nodeId
          ) {
            await this.executeNode(
              nodeId
            );

            continue;
          }

          const unresolved =
            this.plan.order.filter(
              id => {
                const status =
                  this.stateOf(
                    id
                  )?.status;

                return (
                  status &&
                  !TERMINAL.has(
                    status
                  )
                );
              }
            );

          if (
            !unresolved.length
          ) {
            break;
          }

          let changed =
            false;

          for (
            const id
              of unresolved
          ) {
            const node =
              this.plan.nodes.get(
                id
              );

            if (
              node?.type === 'start'
            ) {
              continue;
            }

            const flow =
              this.incoming(
                id,
                'flow'
              );

            if (
              !flow.length ||
              !this.unknownIncoming(
                id,
                'flow'
              )
            ) {
              const activeFlow =
                this.activeIncoming(
                  id,
                  'flow'
                );

              if (
                !activeFlow.length
              ) {
                changed =
                  this.markSkipped(
                    id,
                    '활성화된 실행 경로가 없어 실행하지 않았습니다.'
                  ) ||
                  changed;
              }
            }
          }

          if (
            changed
          ) {
            continue;
          }

          for (
            const id
              of this.plan.order
          ) {
            const state =
              this.stateOf(
                id
              );

            if (
              state &&
              !TERMINAL.has(
                state.status
              )
            ) {
              this.markSkipped(
                id,
                '선행 node 결과 또는 실행 경로를 결정할 수 없습니다.'
              );
            }
          }

          break;
        }

        const execution =
          this.getExecution();

        this.emit(
          'execution:finish',
          execution
        );

        return execution;
      } finally {
        this.running =
          false;
      }
    }

    getExecution() {
      const nodes = {};

      for (
        const [id, state]
          of this.state
      ) {
        nodes[id] =
          clone(state);
      }

      const statuses =
        Object.values(
          nodes
        ).map(
          node =>
            node.status
        );

      const status =
        statuses.includes(
          'FAILED'
        )
          ? 'FAILED'
          : statuses.every(
              value =>
                TERMINAL.has(
                  value
                )
            )
            ? 'SUCCESS'
            : 'RUNNING';

      return {
        status,
        order:
          this.plan.order.slice(),
        nodes,
        log:
          clone(
            this.log
          )
      };
    }
  }

  window.WorkflowScheduler =
    WorkflowScheduler;
})();
