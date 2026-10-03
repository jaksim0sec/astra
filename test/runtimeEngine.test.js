import test from "node:test";
import assert from "node:assert/strict";

globalThis.window = globalThis;
await import("../front/js/runtimeEngine.js");

const { RuntimeEngine, normalizeWorkflow } =
  globalThis.OvllExecutionEngine;

function node(id, type = "step") {
  return { id, type, data: {} };
}

function edge(id, from, to, options = {}) {
  return {
    id,
    from: {
      node: from,
      port: options.fromPort || "result"
    },
    to: {
      node: to,
      port: options.toPort || "in"
    },
    data: {
      kind: options.kind || "flow"
    }
  };
}

function workflow(nodes, connections) {
  return {
    revision: "test",
    nodes,
    connections
  };
}

function executor(log, decisions = {}, failures = new Set()) {
  return {
    async run(current, inputs) {
      log.push(current.id);

      if (failures.has(current.id)) {
        throw new Error(`failed:${current.id}`);
      }

      if (current.type === "judge") {
        const decision = decisions[current.id] ?? true;
        return {
          decision,
          outputs: {
            true: decision ? current.id : undefined,
            false: decision ? undefined : current.id
          }
        };
      }

      return {
        outputs: {
          out: current.id,
          result: current.id
        },
        inputs
      };
    }
  };
}

test("target executes only the pivot and every required ancestor", async () => {
  const log = [];
  const engine = new RuntimeEngine({ executor: executor(log) });
  const graph = workflow(
    [node("a"), node("b"), node("c"), node("d")],
    [
      edge("ab", "a", "b"),
      edge("bc", "b", "c"),
      edge("cd", "c", "d")
    ]
  );

  const result = await engine.run(graph, "c", { mode: "target" });

  assert.deepEqual(new Set(log), new Set(["a", "b", "c"]));
  assert.equal(result.nodes.a.status, "SUCCESS");
  assert.equal(result.nodes.b.status, "SUCCESS");
  assert.equal(result.nodes.c.status, "SUCCESS");
  assert.equal(result.nodes.d.status, "IDLE");
});

test("spread expands through parents and back out through their other children", async () => {
  const log = [];
  const engine = new RuntimeEngine({ executor: executor(log) });
  const graph = workflow(
    [node("root"), node("pivot"), node("sibling"), node("child")],
    [
      edge("root-pivot", "root", "pivot"),
      edge("root-sibling", "root", "sibling"),
      edge("pivot-child", "pivot", "child")
    ]
  );

  const result = await engine.run(graph, "pivot", { mode: "spread" });

  assert.deepEqual(
    new Set(log),
    new Set(["root", "pivot", "sibling", "child"])
  );
  assert.equal(result.nodes.sibling.status, "SUCCESS");
});

test("spread executes a merge node once even when multiple branches reach it", async () => {
  const log = [];
  const engine = new RuntimeEngine({ executor: executor(log) });
  const graph = workflow(
    [node("root"), node("left"), node("right"), node("merge")],
    [
      edge("root-left", "root", "left"),
      edge("root-right", "root", "right"),
      edge("left-merge", "left", "merge"),
      edge("right-merge", "right", "merge")
    ]
  );

  await engine.run(graph, "root", { mode: "spread" });

  assert.equal(log.filter(id => id === "merge").length, 1);
});

test("judge activates only the selected flow branch", async () => {
  const log = [];
  const engine = new RuntimeEngine({
    executor: executor(log, { judge: true })
  });
  const graph = workflow(
    [node("judge", "judge"), node("yes"), node("no")],
    [
      edge("judge-yes", "judge", "yes", { fromPort: "true" }),
      edge("judge-no", "judge", "no", { fromPort: "false" })
    ]
  );

  const result = await engine.run(graph, "judge", { mode: "spread" });

  assert.equal(result.nodes.yes.status, "SUCCESS");
  assert.equal(result.nodes.no.status, "SKIPPED");
  assert.equal(log.includes("yes"), true);
  assert.equal(log.includes("no"), false);
});

test("workflow cycles are rejected before execution", () => {
  assert.throws(
    () =>
      normalizeWorkflow(
        workflow(
          [node("a"), node("b")],
          [
            edge("ab", "a", "b"),
            edge("ba", "b", "a")
          ]
        )
      ),
    /cycle/
  );
});

test("a parent failure rejects the run and records FAILED state", async () => {
  const log = [];
  const engine = new RuntimeEngine({
    executor: executor(log, {}, new Set(["parent"]))
  });
  const graph = workflow(
    [node("parent"), node("pivot")],
    [edge("parent-pivot", "parent", "pivot")]
  );

  await assert.rejects(
    engine.run(graph, "pivot", { mode: "target" }),
    /failed:parent/
  );

  assert.equal(engine.getLastRun().status, "FAILED");
  assert.equal(engine.getLastRun().nodes.parent.status, "FAILED");
});

test("dependency edges emit balanced active and inactive events", async () => {
  const events = [];
  const engine = new RuntimeEngine({
    executor: executor([]),
    onEvent(event) {
      if (event.type === "edge:state") events.push(event);
    }
  });
  const graph = workflow(
    [node("a"), node("b")],
    [edge("ab", "a", "b")]
  );

  await engine.run(graph, "b", { mode: "target" });

  assert.deepEqual(
    events.map(event => [event.edgeId, event.active]),
    [["ab", true], ["ab", false]]
  );
});
