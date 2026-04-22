export type RetryClass = "safe" | "guarded" | "manual-only";

export interface ToolInvocation {
  id?: string;
  toolName: string;
  status: "success" | "timeout" | "error" | "blocked";
  latencyMs?: number;
  input?: Record<string, unknown>;
  output?: Record<string, unknown> | null;
}

export interface StepCheckpoint {
  id?: string;
  stepId: string;
  stepName?: string;
  state?: Record<string, unknown>;
  output?: Record<string, unknown>;
  toolEvents?: ToolInvocation[];
  idempotent?: boolean;
}

export interface FailureEvent {
  failureType: string;
  severity?: "low" | "medium" | "high";
  message?: string;
  checkpointId?: string;
  payload?: Record<string, unknown>;
}

export interface ApprovalGate {
  stepId: string;
  status?: "pending" | "approved" | "rejected";
  diffOrAction?: Record<string, unknown>;
}

export interface ReplaySession {
  scenario: string;
  fromCheckpointId?: string | null;
}

export interface AgentRun {
  id: string;
  workflowId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
  input: Record<string, unknown>;
  checkpoints: StepCheckpoint[];
  failures: Array<FailureEvent & { id: string }>;
}

export class ControlPlaneClient {
  constructor(private readonly baseUrl: string) {}

  async startRun(workflowId: string, input: Record<string, unknown>, metadata: Record<string, unknown> = {}) {
    return this.post("/api/runs/start", { workflowId, input, metadata });
  }

  async checkpoint(runId: string, checkpoint: StepCheckpoint) {
    return this.post(`/api/runs/${runId}/checkpoints`, checkpoint);
  }

  async resumeRun(runId: string, fromCheckpointId?: string) {
    return this.post(`/api/runs/${runId}/resume`, { fromCheckpointId });
  }

  async recordFailure(runId: string, failure: FailureEvent) {
    return this.post(`/api/runs/${runId}/failures`, failure);
  }

  async requestApproval(runId: string, approval: ApprovalGate) {
    return this.post(`/api/runs/${runId}/approvals`, approval);
  }

  async replayRun(runId: string, replay: ReplaySession) {
    return this.post(`/api/runs/${runId}/replay`, replay);
  }

  async listRuns() {
    return this.get("/api/runs");
  }

  async getRun(runId: string) {
    return this.get(`/api/runs/${runId}`);
  }

  private async get(path: string) {
    const response = await fetch(`${this.baseUrl}${path}`);
    if (!response.ok) {
      throw new Error(`GET ${path} failed with ${response.status}`);
    }
    return response.json();
  }

  private async post(path: string, body: unknown) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      throw new Error(`POST ${path} failed with ${response.status}`);
    }
    return response.json();
  }
}
