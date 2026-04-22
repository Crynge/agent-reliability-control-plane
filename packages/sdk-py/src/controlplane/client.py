from __future__ import annotations

import json
from dataclasses import asdict, is_dataclass
from urllib.request import Request, urlopen


class ControlPlaneClient:
    def __init__(self, base_url: str) -> None:
        self.base_url = base_url.rstrip("/")

    def start_run(self, workflow_id: str, input: dict, metadata: dict | None = None) -> dict:
        return self._post("/api/runs/start", {"workflowId": workflow_id, "input": input, "metadata": metadata or {}})

    def checkpoint(self, run_id: str, checkpoint) -> dict:
        return self._post(f"/api/runs/{run_id}/checkpoints", self._encode(checkpoint))

    def resume_run(self, run_id: str, from_checkpoint_id: str | None = None) -> dict:
        return self._post(f"/api/runs/{run_id}/resume", {"fromCheckpointId": from_checkpoint_id})

    def record_failure(self, run_id: str, failure) -> dict:
        return self._post(f"/api/runs/{run_id}/failures", self._encode(failure))

    def request_approval(self, run_id: str, step_id: str, diff_or_action: dict, status: str = "pending") -> dict:
        return self._post(f"/api/runs/{run_id}/approvals", {"stepId": step_id, "diffOrAction": diff_or_action, "status": status})

    def replay_run(self, run_id: str, scenario: str, from_checkpoint_id: str | None = None) -> dict:
        return self._post(f"/api/runs/{run_id}/replay", {"scenario": scenario, "fromCheckpointId": from_checkpoint_id})

    def list_runs(self) -> dict:
        return self._get("/api/runs")

    def get_run(self, run_id: str) -> dict:
        return self._get(f"/api/runs/{run_id}")

    def _get(self, path: str) -> dict:
        request = Request(f"{self.base_url}{path}", headers={"Content-Type": "application/json"})
        with urlopen(request) as response:
            return json.loads(response.read().decode("utf-8"))

    def _post(self, path: str, payload: dict) -> dict:
        encoded = json.dumps(payload).encode("utf-8")
        request = Request(
            f"{self.base_url}{path}",
            data=encoded,
            method="POST",
            headers={"Content-Type": "application/json"},
        )
        with urlopen(request) as response:
            return json.loads(response.read().decode("utf-8"))

    def _encode(self, value):
        if is_dataclass(value):
            data = asdict(value)
            if "tool_events" in data:
                for item in data["tool_events"]:
                    if "tool_name" in item:
                        item["toolName"] = item.pop("tool_name")
                    if "latency_ms" in item:
                        item["latencyMs"] = item.pop("latency_ms")
            if "step_id" in data:
                data["stepId"] = data.pop("step_id")
            if "step_name" in data:
                data["stepName"] = data.pop("step_name")
            if "failure_type" in data:
                data["failureType"] = data.pop("failure_type")
            if "checkpoint_id" in data:
                data["checkpointId"] = data.pop("checkpoint_id")
            return data
        return value

