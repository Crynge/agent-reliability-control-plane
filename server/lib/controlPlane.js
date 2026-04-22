const crypto = require("node:crypto");

function now() {
  return new Date().toISOString();
}

function makeId(prefix) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

class ControlPlaneService {
  constructor(store) {
    this.store = store;
  }

  listRuns() {
    return this.store.read().runs;
  }

  getRun(runId) {
    const data = this.store.read();
    return data.runs.find((run) => run.id === runId) || null;
  }

  getPolicies() {
    return this.store.read().policies;
  }

  getEvalScenarios() {
    return this.store.read().evalScenarios;
  }

  startRun({ workflowId, input = {}, metadata = {} }) {
    const data = this.store.read();
    const run = {
      id: makeId("run"),
      workflowId,
      status: "running",
      createdAt: now(),
      updatedAt: now(),
      metadata,
      input,
      checkpoints: [],
      failures: [],
      approvals: [],
      replays: [],
      metrics: {
        tokenBurn: 0,
        totalLatencyMs: 0,
        recoveryCount: 0
      }
    };

    data.runs.unshift(run);
    this.store.write(data);
    return run;
  }

  checkpoint(runId, payload) {
    const data = this.store.read();
    const run = this.requireRun(data, runId);
    const checkpoint = {
      id: payload.id || makeId("chk"),
      stepId: payload.stepId,
      stepName: payload.stepName || payload.stepId,
      state: payload.state || {},
      output: payload.output || {},
      toolEvents: payload.toolEvents || [],
      idempotent: payload.idempotent !== false,
      createdAt: now()
    };

    run.checkpoints.push(checkpoint);
    run.updatedAt = now();

    for (const toolEvent of checkpoint.toolEvents) {
      if (typeof toolEvent.latencyMs === "number") {
        run.metrics.totalLatencyMs += toolEvent.latencyMs;
      }
      if (toolEvent.output && typeof toolEvent.output.tokens === "number") {
        run.metrics.tokenBurn += toolEvent.output.tokens;
      }
    }

    this.store.write(data);
    return checkpoint;
  }

  recordFailure(runId, payload) {
    const data = this.store.read();
    const run = this.requireRun(data, runId);
    const failure = {
      id: makeId("fail"),
      type: payload.failureType,
      severity: payload.severity || "medium",
      message: payload.message || "Failure recorded.",
      createdAt: now(),
      checkpointId: payload.checkpointId || this.lastCheckpointId(run),
      payload: payload.payload || {}
    };

    run.failures.push(failure);
    run.status = "failed";
    run.updatedAt = now();
    this.store.write(data);
    return failure;
  }

  requestApproval(runId, payload) {
    const data = this.store.read();
    const run = this.requireRun(data, runId);
    const approval = {
      id: makeId("approval"),
      stepId: payload.stepId,
      status: payload.status || "pending",
      requestedAt: now(),
      resolvedAt: payload.status === "approved" || payload.status === "rejected" ? now() : null,
      action: payload.diffOrAction || {}
    };

    run.approvals.push(approval);
    run.status = approval.status === "approved" ? run.status : "paused";
    run.updatedAt = now();
    this.store.write(data);
    return approval;
  }

  resumeRun(runId, payload = {}) {
    const data = this.store.read();
    const run = this.requireRun(data, runId);
    const fromCheckpointId = payload.fromCheckpointId || this.lastCheckpointId(run);

    run.status = "recovered";
    run.updatedAt = now();
    run.metrics.recoveryCount += 1;
    run.replays.push({
      id: makeId("resume"),
      scenario: "manual_resume",
      createdAt: now(),
      fromCheckpointId
    });

    this.store.write(data);
    return {
      runId: run.id,
      resumedFromCheckpointId: fromCheckpointId,
      status: run.status
    };
  }

  replayRun(runId, payload = {}) {
    const data = this.store.read();
    const run = this.requireRun(data, runId);
    const replay = {
      id: makeId("replay"),
      scenario: payload.scenario || "custom",
      createdAt: now(),
      fromCheckpointId: payload.fromCheckpointId || this.lastCheckpointId(run)
    };

    run.replays.push(replay);
    run.updatedAt = now();
    this.store.write(data);
    return replay;
  }

  analyticsSummary() {
    const data = this.store.read();
    const runs = data.runs;
    const totals = {
      totalRuns: runs.length,
      completionRate: 0,
      recoveryRate: 0,
      failedRuns: 0,
      runningRuns: 0,
      avgTokenBurn: 0,
      avgLatencyMs: 0,
      humanOverrideRate: 0,
      failureTypes: {}
    };

    let completedish = 0;
    let recovered = 0;
    let humanOverrides = 0;
    let tokenBurnTotal = 0;
    let latencyTotal = 0;

    for (const run of runs) {
      if (["completed", "recovered"].includes(run.status)) {
        completedish += 1;
      }
      if (run.status === "recovered") {
        recovered += 1;
      }
      if (run.status === "failed") {
        totals.failedRuns += 1;
      }
      if (run.status === "running") {
        totals.runningRuns += 1;
      }
      if (run.approvals.some((approval) => approval.status === "approved")) {
        humanOverrides += 1;
      }
      tokenBurnTotal += run.metrics.tokenBurn;
      latencyTotal += run.metrics.totalLatencyMs;

      for (const failure of run.failures) {
        totals.failureTypes[failure.type] = (totals.failureTypes[failure.type] || 0) + 1;
      }
    }

    const divisor = runs.length || 1;
    totals.completionRate = Math.round((completedish / divisor) * 100);
    totals.recoveryRate = Math.round((recovered / divisor) * 100);
    totals.avgTokenBurn = Math.round(tokenBurnTotal / divisor);
    totals.avgLatencyMs = Math.round(latencyTotal / divisor);
    totals.humanOverrideRate = Math.round((humanOverrides / divisor) * 100);

    return totals;
  }

  requireRun(data, runId) {
    const run = data.runs.find((item) => item.id === runId);
    if (!run) {
      const error = new Error(`Run ${runId} not found.`);
      error.statusCode = 404;
      throw error;
    }
    return run;
  }

  lastCheckpointId(run) {
    return run.checkpoints.length ? run.checkpoints[run.checkpoints.length - 1].id : null;
  }
}

module.exports = {
  ControlPlaneService
};

