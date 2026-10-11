from app.agent.graph import interpret_request


def test_replenishment_plan_defaults_to_seven_days():
    result = interpret_request(
        {"request": "Which products may run out?"}
    )["plan"]

    assert result.intent == "replenishment_recommendations"
    assert result.max_days_of_cover == 7
    assert result.requires_write is False
    assert (
        result.steps[0].tool_id
        == "person2.replenishment_recommendations"
    )


def test_explicit_days_are_extracted():
    result = interpret_request(
        {
            "request": (
                "Find products likely to run out within 14 days"
            )
        }
    )["plan"]

    assert result.max_days_of_cover == 14


def test_unregistered_intent_is_unsupported():
    result = interpret_request(
        {"request": "Write a poem"}
    )["plan"]

    assert result.intent == "unsupported"

def test_create_purchase_order_is_not_treated_as_read_only():
    result = interpret_request(
        {"request": "Create a purchase order for low-stock products"}
    )["plan"]

    assert result.intent == "unsupported"
    assert result.requires_write is True


def test_cancel_purchase_order_is_not_treated_as_read_only():
    result = interpret_request(
        {"request": "Cancel purchase order PO-123"}
    )["plan"]

    assert result.intent == "unsupported"
    assert result.requires_write is True


def test_read_only_replenishment_request_still_works():
    result = interpret_request(
        {"request": "Which products may run out within 7 days?"}
    )["plan"]

    assert result.intent == "replenishment_recommendations"
    assert result.requires_write is False
    assert result.max_days_of_cover == 7