
from decimal import Decimal

import pytest

from app.agent.tools.revenue import (
    resolve_comparison_period,
    validate_revenue_response,
)


def test_resolves_equal_length_comparison_period():
    periods = resolve_comparison_period(
        "2026-09-01",
        "2026-09-30",
    )

    assert periods == {
        "date_from": "2026-09-01",
        "date_to": "2026-09-30",
        "comparison_from": "2026-08-02",
        "comparison_to": "2026-08-31",
    }


def test_calculates_revenue_change():
    result = validate_revenue_response(
        {
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
        }
    )

    assert Decimal(str(result["absolute_change"])) == Decimal("-100")
    assert Decimal(str(result["percentage_change"])) == Decimal("-10")
    assert result["currency"] == "EUR"
    assert result["measure"] == "net_revenue"


def test_rejects_mismatched_revenue_currencies():
    with pytest.raises((ValueError, TypeError)):
        validate_revenue_response(
            {
                "current": {
                    "currency": "EUR",
                    "measure": "net_revenue",
                    "revenue": "900",
                },
                "previous": {
                    "currency": "USD",
                    "measure": "net_revenue",
                    "revenue": "1000",
                },
            }
        )


def test_rejects_invalid_date_range():
    with pytest.raises((ValueError, TypeError)):
        resolve_comparison_period(
            "2026-09-30",
            "2026-09-01",
        )
