from app.agent.graph import run_host_agent
from app.agent.schemas import ConversationContext

def test_revenue_follow_up_reuses_context_and_fetches_again():
    calls = []

    def revenue_provider(arguments):
        calls.append(arguments)
        return {
            "current": {
                "currency": "EUR",
                "measure": "net_revenue",
                "revenue": "900",
                "source_timestamp": "2026-10-01T00:00:00Z",
            },
            "previous": {
                "currency": "EUR",
                "measure": "net_revenue",
                "revenue": "1000",
                "source_timestamp": "2026-09-01T00:00:00Z",
            },
            "product_contributions": [],
        }

    context = ConversationContext(
        date_from="2026-09-01",
        date_to="2026-09-30",
        last_intent="revenue_investigation",
    )

    first = run_host_agent(
        "Investigate revenue from 2026-09-01 to 2026-09-30",
        revenue_provider=revenue_provider,
        context=context,
    )

    second = run_host_agent(
        "What caused the decline?",
        revenue_provider=revenue_provider,
        context=first.context,
    )

    assert len(calls) == 2
    assert second.plan.intent == "revenue_investigation"



def test_replenishment_without_provider_is_blocked():
    result = run_host_agent(
        "Find products likely to run out in seven days"
    )

    assert result.status == "blocked"
    assert result.plan.intent == "replenishment_recommendations"
    assert result.plan.requires_write is False
    assert result.data_source == "none"
    assert result.verified is False
    assert result.errors[0].code == "PROVIDER_NOT_CONFIGURED"


def test_purchase_order_request_does_not_create_an_order():
    result = run_host_agent(
        "Find products likely to run out and prepare purchase orders"
    )

    assert result.status == "blocked"
    assert result.plan.requires_write is False
    assert result.data_source == "none"
    assert result.verified is False
    assert result.actions_taken == [
        "Interpreted request",
        "Applied read-only policy",
    ]


def test_unsupported_request_is_reported():
    result = run_host_agent("Write a poem about the moon")

    assert result.status == "unsupported"
    assert result.plan.intent == "unsupported"
    assert result.data_source == "none"


def test_empty_request_is_rejected():
    try:
        run_host_agent("   ")
    except ValueError as exc:
        assert "cannot be empty" in str(exc)
    else:
        raise AssertionError("Expected empty request to be rejected")

def test_provider_success_returns_recommendations():
    sample = {
        "total": 1,
        "data": [
            {"product_id": "p-1", "suggested_qty": 4}
        ],
    }

    result = run_host_agent(
        "Find products likely to run out in seven days",
        recommendations_provider=lambda days: sample,
    )

    assert result.status == "completed"
    assert result.data_source == "backend_api"
    assert result.verified is False
    assert len(result.recommendations) == 1
    assert result.evidence[0].value == "1"


def test_invalid_provider_response_fails_safely():
    result = run_host_agent(
        "Find products likely to run out in seven days",
        recommendations_provider=lambda days: {"total": 2, "data": []},
    )

    assert result.status == "failed"
    assert result.data_source == "none"
    assert result.verified is False
    assert result.errors[0].code == "RECOMMENDATION_LOOKUP_FAILED"


def test_provider_exception_fails_safely():
    def failing_provider(days):
        raise RuntimeError("simulated provider outage")

    result = run_host_agent(
        "Find products likely to run out in seven days",
        recommendations_provider=failing_provider,
    )

    assert result.status == "failed"
    assert result.data_source == "none"
    assert result.verified is False
    assert result.errors[0].code == "RECOMMENDATION_LOOKUP_FAILED"