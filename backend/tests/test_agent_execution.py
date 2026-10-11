from app.agent.executor import execute_read_only_plan
from app.agent.schemas import AgentPlan


def plan():
    return AgentPlan(
        intent="replenishment_recommendations",
        explanation="read only",
    )


def test_missing_provider_blocks_without_claiming_success():
    result = execute_read_only_plan(plan(), None)

    assert result.status == "blocked"
    assert result.verified is False


def test_valid_provider_returns_structured_evidence():
    result = execute_read_only_plan(
        plan(),
        lambda days: {
            "total": 1,
            "data": [{"sku": "A"}],
        },
    )

    assert result.status == "completed"
    assert result.data_source == "backend_api"
    assert result.evidence[0].value == "1"
    assert result.verified is False


def test_invalid_provider_contract_fails_safely():
    result = execute_read_only_plan(
        plan(),
        lambda days: {
            "total": 2,
            "data": [],
        },
    )

    assert result.status == "failed"
    assert (
        result.errors[0].code
        == "RECOMMENDATION_LOOKUP_FAILED"
    )


def test_provider_exception_fails_safely():
    def fail(days):
        raise RuntimeError("backend unavailable")

    result = execute_read_only_plan(plan(), fail)

    assert result.status == "failed"