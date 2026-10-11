from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal, InvalidOperation
from typing import Any


REVENUE_TOOL_ID = "person3.revenue_investigation"


def resolve_comparison_period(
    date_from: str,
    date_to: str,
) -> dict[str, str]:
    """Resolve an inclusive date range and an equal-length preceding range."""
    try:
        start = date.fromisoformat(date_from)
        end = date.fromisoformat(date_to)
    except (TypeError, ValueError) as exc:
        raise ValueError("Dates must use YYYY-MM-DD format.") from exc

    if end < start:
        raise ValueError("date_to must be on or after date_from.")

    days = (end - start).days + 1
    previous_end = start - timedelta(days=1)
    previous_start = previous_end - timedelta(days=days - 1)

    return {
        "date_from": start.isoformat(),
        "date_to": end.isoformat(),
        "comparison_from": previous_start.isoformat(),
        "comparison_to": previous_end.isoformat(),
    }


def _decimal(value: Any, field: str) -> Decimal:
    if isinstance(value, bool) or value is None:
        raise ValueError(f"Invalid numeric field: {field}.")
    try:
        number = Decimal(str(value))
    except (InvalidOperation, ValueError) as exc:
        raise ValueError(f"Invalid numeric field: {field}.") from exc
    if not number.is_finite():
        raise ValueError(f"Invalid numeric field: {field}.")
    return number


def validate_revenue_response(
    response: dict[str, Any],
) -> dict[str, Any]:
    """Validate two actual aggregate totals returned by the sales adapter."""
    if not isinstance(response, dict):
        raise ValueError("Revenue provider must return an object.")

    current = response.get("current")
    previous = response.get("previous")

    if not isinstance(current, dict) or not isinstance(previous, dict):
        raise ValueError(
            "Revenue provider must return current and previous aggregate objects."
        )

    for label, period in (("current", current), ("previous", previous)):
        if not isinstance(period.get("currency"), str) or not period["currency"]:
            raise ValueError(f"{label} period is missing currency.")
        if not isinstance(period.get("measure"), str) or not period["measure"]:
            raise ValueError(f"{label} period is missing measure.")
        _decimal(period.get("revenue"), f"{label}.revenue")

    if current["currency"] != previous["currency"]:
        raise ValueError("Cannot compare periods with different currencies.")
    if current["measure"] != previous["measure"]:
        raise ValueError("Cannot compare periods with different revenue measures.")

    current_value = _decimal(current["revenue"], "current.revenue")
    previous_value = _decimal(previous["revenue"], "previous.revenue")
    delta = current_value - previous_value

    percentage = None
    if previous_value != 0:
        percentage = float((delta / abs(previous_value)) * Decimal("100"))

    return {
        "currency": current["currency"],
        "measure": current["measure"],
        "current_revenue": str(current_value),
        "previous_revenue": str(previous_value),
        "absolute_change": str(delta),
        "percentage_change": percentage,
        "current_source_timestamp": current.get("source_timestamp"),
        "previous_source_timestamp": previous.get("source_timestamp"),
        "product_contributions": _validate_contributions(
            response.get("product_contributions")
        ),
    }


def _validate_contributions(value: Any) -> list[dict[str, Any]]:
    """Only pass through contributions with explicit comparable numeric values."""
    if value is None:
        return []
    if not isinstance(value, list):
        raise ValueError("product_contributions must be a list.")

    result: list[dict[str, Any]] = []
    for row in value:
        if not isinstance(row, dict):
            raise ValueError("Each product contribution must be an object.")
        if not isinstance(row.get("sku"), str) or not row["sku"].strip():
            raise ValueError("Each product contribution needs a SKU.")
        delta = _decimal(row.get("revenue_change"), "revenue_change")
        result.append({
            "sku": row["sku"],
            "revenue_change": str(delta),
        })

    # Most negative changes first; these are contributions, not proven causes.
    return sorted(result, key=lambda row: Decimal(row["revenue_change"]))