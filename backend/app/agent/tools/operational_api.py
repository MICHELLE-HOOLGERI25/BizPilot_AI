
from __future__ import annotations

from collections.abc import Callable
from typing import Any

from app.agent.tools.revenue import (
    REVENUE_TOOL_ID,
    validate_revenue_response,
)

REPLENISHMENT_TOOL_ID = "person2.replenishment_recommendations"


def replenishment_handler(
    provider: Callable[[float], dict[str, Any]],
) -> Callable[[float], dict[str, Any]]:
    """Bind the authenticated replenishment provider."""

    def invoke(max_days_of_cover: float) -> dict[str, Any]:
        if not 0 < max_days_of_cover <= 365:
            raise ValueError("max_days_of_cover must be in (0, 365]")

        response = provider(max_days_of_cover)

        if not isinstance(response, dict):
            raise ValueError("Operational API response must be an object")

        data = response.get("data")
        total = response.get("total")

        if (
            not isinstance(data, list)
            or isinstance(total, bool)
            or not isinstance(total, int)
            or total != len(data)
        ):
            raise ValueError(
                "Operational API response has an invalid data/total contract"
            )

        if any(not isinstance(row, dict) for row in data):
            raise ValueError("Every recommendation must be an object")

        return response

    return invoke


def revenue_handler(
    provider: Callable[[dict[str, Any]], dict[str, Any]],
) -> Callable[[dict[str, Any]], dict[str, Any]]:
    """Bind the authenticated sales provider to the revenue contract."""

    def invoke(arguments: dict[str, Any]) -> dict[str, Any]:
        if not isinstance(arguments, dict):
            raise ValueError("Revenue arguments must be an object")

        required = (
            "date_from",
            "date_to",
            "comparison_from",
            "comparison_to",
        )
        if any(
            not isinstance(arguments.get(key), str)
            for key in required
        ):
            raise ValueError("Revenue comparison periods are required")

        response = provider(arguments)
        validate_revenue_response(response)
        return response

    return invoke
