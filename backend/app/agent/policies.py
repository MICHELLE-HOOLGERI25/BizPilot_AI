from dataclasses import dataclass
from typing import Literal

from app.agent.schemas import AgentPlan


PolicyDecision = Literal["allow", "clarify", "confirm", "block"]


@dataclass(frozen=True)
class PolicyResult:
    decision: PolicyDecision
    reason: str


def evaluate_plan(plan: AgentPlan) -> PolicyResult:
    """Fail-closed policy for the capabilities currently implemented."""
    if plan.intent == "unsupported":
        return PolicyResult(
            "block",
            "The requested capability is not registered.",
        )

    if plan.requires_write:
        return PolicyResult(
            "confirm",
            "Write operations require explicit backend confirmation "
            "and are not executed by this read-only workflow.",
        )

    if plan.intent == "replenishment_recommendations":
        return PolicyResult(
            "allow",
            "Replenishment recommendations are read-only.",
        )

    return PolicyResult("block", "No policy permits this operation.")