# Architecture

## Core loop

1. A client starts an `AgentRun`.
2. Each workflow step writes a `StepCheckpoint`.
3. Tool activity is attached as structured `ToolInvocation` records.
4. Validation and retry policies determine whether the run can continue.
5. Failures create typed `FailureEvent` objects.
6. Operators can replay or resume from the latest safe checkpoint.

## Product slices

### Durable runtime

- JSON persistence for runs, checkpoints, failures, approvals, and policies
- explicit run statuses: `running`, `paused`, `failed`, `recovered`, `completed`
- replay and resume modeled as first-class actions

### Trace and observability

- every step keeps state snapshot, outputs, tool events, and latency
- failures are classified so the dashboard can separate context issues from tool issues
- approvals and replays are attached to the run instead of being hidden in logs

### Guardrails

- retry policy types: `safe`, `guarded`, `manual-only`
- validation policy coverage for schema, freshness, and idempotency
- approval gates for non-idempotent steps or sensitive tool actions

### Eval suite

- stale context
- malformed model output
- partial tool outage
- duplicate webhook
- delayed resume after crash

## Why this structure

The prototype is intentionally not an agent framework. It is a control layer that can sit beside existing frameworks and custom orchestration code.

