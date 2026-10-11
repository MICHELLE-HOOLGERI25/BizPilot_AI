
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

MAX_READ_ATTEMPTS = 2


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
                    message="The operational recommendations provider is missing.",
                )
            ],
        )

    step = next(
        (
            item
            for item in plan.steps
            if item.step_id == "read_recommendations"
        ),
        None,
    )
    if step is not None:
        step.status = "running"

    last_error: Exception | None = None

    for attempt in range(1, MAX_READ_ATTEMPTS + 1):
        try:
            response = replenishment_handler(provider)(
                plan.max_days_of_cover
            )

            if not isinstance(response, dict):
                raise ValueError("Provider response must be an object.")

            data = response.get("data")
            if not isinstance(data, list):
                raise ValueError("Provider response data must be a list.")

            if step is not None:
                step.status = "completed"
                step.safe_result_summary = (
                    f"Retrieved {len(data)} recommendations."
                )

            validation_step = next(
                (
                    item
                    for item in plan.steps
                    if item.step_id == "validate_response"
                ),
                None,
            )
            if validation_step is not None:
                validation_step.status = "completed"
                validation_step.safe_result_summary = (
                    "Response structure validated."
                )

            return AgentResult(
                status="completed",
                message=f"Retrieved {len(data)} replenishment recommendations.",
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

        except Exception as exc:
            last_error = exc

    if step is not None:
        step.status = "failed"
        step.error_code = "RECOMMENDATION_LOOKUP_FAILED"

    validation_step = next(
        (
            item
            for item in plan.steps
            if item.step_id == "validate_response"
        ),
        None,
    )
    if validation_step is not None:
        validation_step.status = "blocked"

    return AgentResult(
        status="failed",
        message=(
            f"Replenishment lookup failed after {MAX_READ_ATTEMPTS} "
            "attempts. No successful live result can be reported."
        ),
        plan=plan,
        data_source="none",
        actions_taken=[
            "Interpreted request",
            "Applied read-only policy",
            f"Attempted read-only lookup {MAX_READ_ATTEMPTS} times",
        ],
        errors=[
            AgentError(
                code="RECOMMENDATION_LOOKUP_FAILED",
                message=(
                    f"The operational provider failed or returned invalid "
                    f"data ({type(last_error).__name__})."
                ),
                retryable=False,
            )
        ],
    )
