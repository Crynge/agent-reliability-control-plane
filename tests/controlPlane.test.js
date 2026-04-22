const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { JSONStore } = require("../server/lib/store");
const { ControlPlaneService } = require("../server/lib/controlPlane");

function makeService() {
  const filePath = path.join(os.tmpdir(), `control-plane-test-${Date.now()}-${Math.random()}.json`);
  const store = new JSONStore(filePath);
  return {
    service: new ControlPlaneService(store),
    filePath
  };
}

test("start_run creates a new running run", () => {
  const { service, filePath } = makeService();
  const result = service.startRun({
    workflowId: "test-workflow",
    input: { recordId: "123" },
    metadata: { customer: "TestCo" }
  });

  assert.equal(result.workflowId, "test-workflow");
  assert.equal(result.status, "running");
  assert.equal(result.input.recordId, "123");
  fs.rmSync(filePath, { force: true });
});

test("checkpoint and failure can be resumed from latest safe checkpoint", () => {
  const { service, filePath } = makeService();
  const run = service.startRun({
    workflowId: "resume-test",
    input: {},
    metadata: {}
  });

  const checkpoint = service.checkpoint(run.id, {
    stepId: "fetch_context",
    output: { ok: true },
    toolEvents: []
  });

  service.recordFailure(run.id, {
    failureType: "tool_timeout",
    checkpointId: checkpoint.id,
    message: "Timed out"
  });

  const resume = service.resumeRun(run.id);
  assert.equal(resume.resumedFromCheckpointId, checkpoint.id);
  assert.equal(resume.status, "recovered");
  fs.rmSync(filePath, { force: true });
});

test("analytics summary includes failure breakdown", () => {
  const { service, filePath } = makeService();
  const summary = service.analyticsSummary();

  assert.ok(summary.totalRuns >= 1);
  assert.ok(typeof summary.failureTypes === "object");
  fs.rmSync(filePath, { force: true });
});

