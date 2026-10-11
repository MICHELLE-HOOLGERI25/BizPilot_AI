from typing import Any, Literal

from pydantic import BaseModel, Field


class ConversationContext(BaseModel):
    """Filters carried between related requests, not cached business results."""

    region: str | None = None
    date_from: str | None = None
    date_to: str | None = None
    last_intent: str | None = None


class AgentRequest(BaseModel):
    request: str = Field(min_length=1, max_length=2000)
    context: ConversationContext | None = None


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
        "revenue_investigation",
        "unsupported",
    ]
    max_days_of_cover: float = Field(default=7, gt=0, le=365)
    requires_write: bool = False
    explanation: str
    steps: list[PlanStep] = Field(default_factory=list)
    date_from: str | None = None
    date_to: str | None = None
    comparison_from: str | None = None
    comparison_to: str | None = None
    region: str | None = None


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
    context: ConversationContext | None = None
    revenue_comparison: dict[str, Any] | None = None