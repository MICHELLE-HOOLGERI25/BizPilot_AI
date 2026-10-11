from dataclasses import dataclass
from typing import Literal

from app.agent.schemas import AgentPlan


PolicyDecision = Literal["allow", "clarify", "confirm", "block"]


@dataclass(frozen=True)
class PolicyResult:
    decision: PolicyDecision
    reason: str


def evaluate_plan(plan: AgentPlan) -> PolicyResult:
    if plan.intent == "unsupported":
        return PolicyResult(
            "block",
            "The requested capability is not registered.",
        )

    if plan.requires_write:
        return PolicyResult(
            "confirm",
            "Write operations require explicit backend confirmation and are not executed by this read-only workflow.",
        )

    if plan.intent in {
        "replenishment_recommendations",
        "revenue_investigation",
    }:
        return PolicyResult(
            "allow",
            "The requested investigation is read-only.",
        )

    return PolicyResult("block", "No policy permits this operation.")