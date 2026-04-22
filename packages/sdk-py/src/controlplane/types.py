from dataclasses import dataclass, field
from typing import Any


@dataclass
class ToolInvocation:
    tool_name: str
    status: str
    latency_ms: int | None = None
    input: dict[str, Any] = field(default_factory=dict)
    output: dict[str, Any] | None = None


@dataclass
class StepCheckpoint:
    step_id: str
    step_name: str | None = None
    state: dict[str, Any] = field(default_factory=dict)
    output: dict[str, Any] = field(default_factory=dict)
    tool_events: list[ToolInvocation] = field(default_factory=list)
    idempotent: bool = True


@dataclass
class FailureEvent:
    failure_type: str
    severity: str = "medium"
    message: str = ""
    checkpoint_id: str | None = None
    payload: dict[str, Any] = field(default_factory=dict)

