from __future__ import annotations

from collections.abc import Callable
from typing import Any


REPLENISHMENT_TOOL_ID = "person2.replenishment_recommendations"


def replenishment_handler(
    provider: Callable[[float], dict[str, Any]],
) -> Callable[[float], dict[str, Any]]:
    """Bind Person 2's authenticated operational function to a tool contract.

    The provider must enforce tenant scope and permissions. This adapter
    never accepts tenant IDs from a natural-language request and never
    executes SQL.
    """

    def invoke(max_days_of_cover: float) -> dict[str, Any]:
        if not 0 < max_days_of_cover <= 365:
            raise ValueError(
                "max_days_of_cover must be in (0, 365]"
            )

        response = provider(max_days_of_cover)

        if not isinstance(response, dict):
            raise ValueError(
                "Operational API response must be an object"
            )

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
            raise ValueError(
                "Every recommendation must be an object"
            )

        return response

    return invoke