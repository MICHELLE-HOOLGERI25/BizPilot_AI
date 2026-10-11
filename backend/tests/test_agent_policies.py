from app.agent.policies import evaluate_plan
from app.agent.schemas import AgentPlan


def test_read_only_replenishment_is_allowed():
    plan = AgentPlan(
        intent="replenishment_recommendations",
        explanation="read only",
    )

    assert evaluate_plan(plan).decision == "allow"


def test_write_plan_requires_confirmation():
    plan = AgentPlan(
        intent="replenishment_recommendations",
        requires_write=True,
        explanation="write",
    )

    assert evaluate_plan(plan).decision == "confirm"


def test_unknown_intent_is_blocked():
    plan = AgentPlan(
        intent="unsupported",
        explanation="unknown",
    )

    assert evaluate_plan(plan).decision == "block"