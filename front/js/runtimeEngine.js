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
      const spreadJobs = new Map();
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

                  throw error;
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

      const spreadFrom =
        nodeId => {
          if (spreadJobs.has(nodeId)) {
            return spreadJobs.get(nodeId);
          }

          const job =
            (async () => {
              await resolveNode(nodeId);

              if (
                states.get(nodeId)?.status !==
                "SUCCESS"
              ) {
                return;
              }

              const childEdges =
                (outgoing.get(nodeId) || [])
                  .filter(edgeIsActive);

              const children =
                [
                  ...new Set(
                    childEdges.map(
                      connection =>
                        connection.to.node
                    )
                  )
                ];

              await Promise.all(
                children.map(
                  childId =>
                    spreadFrom(childId)
                )
              );
            })();

          spreadJobs.set(nodeId, job);

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
          await spreadFrom(pivot);
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
    normalizeWorkflow
  };
})(window);
