from __future__ import annotations

from collections.abc import Callable
from typing import Any

from app.agent.schemas import (
    AgentError,
    AgentPlan,
    AgentResult,
    EvidenceItem,
)
from app.agent.tools.operational_api import (
    REPLENISHMENT_TOOL_ID,
    replenishment_handler,
)


def execute_read_only_plan(
    plan: AgentPlan,
    provider: Callable[[float], dict[str, Any]] | None,
) -> AgentResult:
    if plan.intent == "unsupported":
        return AgentResult(
            status="unsupported",
            message="The current HostAgent does not support this request.",
            plan=plan,
        )

    if plan.requires_write:
        return AgentResult(
            status="blocked",
            message=(
                "Write operations are not executed by this "
                "read-only HostAgent path."
            ),
            plan=plan,
            errors=[
                AgentError(
                    code="WRITE_NOT_ENABLED",
                    message=(
                        "A separate confirmation-bound write "
                        "workflow is required."
                    ),
                )
            ],
        )

    if provider is None:
        return AgentResult(
            status="blocked",
            message=(
                "No live recommendations provider is configured. "
                "No inventory lookup was performed."
            ),
            plan=plan,
            actions_taken=[
                "Interpreted request",
                "Applied read-only policy",
            ],
            errors=[
                AgentError(
                    code="PROVIDER_NOT_CONFIGURED",
                    message=(
                        "The operational recommendations "
                        "provider is missing."
                    ),
                )
            ],
        )

    try:
        response = replenishment_handler(provider)(
            plan.max_days_of_cover
        )
        data = response["data"]

        return AgentResult(
            status="completed",
            message=(
                f"Retrieved {len(data)} "
                "replenishment recommendations."
            ),
            plan=plan,
            data_source="backend_api",
            actions_taken=[
                "Interpreted request",
                "Applied read-only policy",
                "Retrieved replenishment recommendations",
                "Validated response structure",
            ],
            verified=False,
            recommendations=data,
            evidence=[
                EvidenceItem(
                    label="Recommendation count",
                    value=str(len(data)),
                    source=REPLENISHMENT_TOOL_ID,
                )
            ],
        )

    except Exception:
        return AgentResult(
            status="failed",
            message=(
                "The replenishment lookup failed. "
                "No successful live result can be reported."
            ),
            plan=plan,
            data_source="none",
            errors=[
                AgentError(
                    code="RECOMMENDATION_LOOKUP_FAILED",
                    message=(
                        "The operational provider failed "
                        "or returned invalid data."
                    ),
                )
            ],
        )