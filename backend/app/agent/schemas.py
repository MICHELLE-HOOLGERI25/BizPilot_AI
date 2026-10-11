from typing import Any, Literal

from pydantic import BaseModel, Field


class AgentRequest(BaseModel):
    request: str = Field(min_length=1, max_length=2000)


class PlanStep(BaseModel):
    step_id: str
    description: str
    status: Literal[
        "pending", "running", "completed", "failed", "blocked"
    ] = "pending"
    tool_id: str | None = None
    safe_result_summary: str | None = None
    error_code: str | None = None


class AgentPlan(BaseModel):
    intent: Literal[
        "replenishment_recommendations",
        "unsupported",
    ]
    max_days_of_cover: float = Field(default=7, gt=0, le=365)
    requires_write: bool = False
    explanation: str
    steps: list[PlanStep] = Field(default_factory=list)


class EvidenceItem(BaseModel):
    label: str
    value: str
    record_id: str | None = None
    timestamp: str | None = None
    source: str | None = None


class AgentError(BaseModel):
    code: str
    message: str
    retryable: bool = False


class AgentResult(BaseModel):
    status: Literal[
        "completed", "blocked", "unsupported", "failed", "partial"
    ]
    message: str
    plan: AgentPlan
    data_source: Literal["mock", "backend_api", "none"] = "none"
    actions_taken: list[str] = Field(default_factory=list)
    verified: bool = False
    recommendations: list[dict[str, Any]] = Field(default_factory=list)
    evidence: list[EvidenceItem] = Field(default_factory=list)
    errors: list[AgentError] = Field(default_factory=list)