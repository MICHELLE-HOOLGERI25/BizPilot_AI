from __future__ import annotations

from collections.abc import Callable
from typing import Any

from app.agent.schemas import (
    AgentError,
    AgentPlan,
    AgentResult,
    ConversationContext,
    EvidenceItem,
)
from app.agent.tools.operational_api import (
    REPLENISHMENT_TOOL_ID,
    replenishment_handler,
)
from app.agent.tools.revenue import (
    REVENUE_TOOL_ID,
    validate_revenue_response,
)

MAX_READ_ATTEMPTS = 2


def _step(plan: AgentPlan, step_id: str):
    return next(
        (item for item in plan.steps if item.step_id == step_id),
        None,
    )


def _set_step(
    plan: AgentPlan,
    step_id: str,
    status: str,
    summary: str | None = None,
    error_code: str | None = None,
) -> None:
    item = _step(plan, step_id)
    if item is not None:
        item.status = status
        item.safe_result_summary = summary
        item.error_code = error_code


def execute_read_only_plan(
    plan: AgentPlan,
    provider: Callable[[float], dict[str, Any]] | None,
    revenue_provider: Callable[[dict[str, Any]], dict[str, Any]] | None = None,
    context: ConversationContext | None = None,
) -> AgentResult:
    if plan.intent == "unsupported":
        return AgentResult(
            status="unsupported",
            message="The current HostAgent does not support this request.",
            plan=plan,
            context=context,
        )

    if plan.requires_write:
        return AgentResult(
            status="blocked",
            message="Write operations are not executed by this read-only HostAgent path.",
            plan=plan,
            context=context,
            errors=[
                AgentError(
                    code="WRITE_NOT_ENABLED",
                    message="A separate confirmation-bound write workflow is required.",
                )
            ],
        )

    if plan.intent == "replenishment_recommendations":
        if provider is None:
            _set_step(
                plan, "read_recommendations", "blocked",
                error_code="PROVIDER_NOT_CONFIGURED",
            )
            _set_step(
                plan, "validate_response", "blocked",
                error_code="PROVIDER_NOT_CONFIGURED",
            )
            return AgentResult(
                status="blocked",
                message="No live recommendations provider is configured. No inventory lookup was performed.",
                plan=plan,
                context=context,
                errors=[
                    AgentError(
                        code="PROVIDER_NOT_CONFIGURED",
                        message="The operational recommendations provider is missing.",
                    )
                ],
            )

        _set_step(plan, "read_recommendations", "running")
        last_error: Exception | None = None

        for _attempt in range(1, MAX_READ_ATTEMPTS + 1):
            try:
                response = replenishment_handler(provider)(
                    plan.max_days_of_cover
                )
                data = response["data"]

                _set_step(
                    plan, "read_recommendations", "completed",
                    summary=f"Retrieved {len(data)} recommendations.",
                )
                _set_step(
                    plan, "validate_response", "completed",
                    summary="Response structure validated.",
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
                    context=context,
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

        _set_step(
            plan, "read_recommendations", "failed",
            error_code="RECOMMENDATION_LOOKUP_FAILED",
        )
        _set_step(
            plan, "validate_response", "blocked",
            error_code="UPSTREAM_LOOKUP_FAILED",
        )
        return AgentResult(
            status="failed",
            message=f"Replenishment lookup failed after {MAX_READ_ATTEMPTS} attempts. No successful live result can be reported.",
            plan=plan,
            context=context,
            errors=[
                AgentError(
                    code="RECOMMENDATION_LOOKUP_FAILED",
                    message=(
                        "The operational provider failed or returned invalid data "
                        f"({type(last_error).__name__})."
                    ),
                    retryable=False,
                )
            ],
        )

    if plan.intent == "revenue_investigation":
        if revenue_provider is None:
            _set_step(
                plan, "read_revenue", "blocked",
                error_code="PROVIDER_NOT_CONFIGURED",
            )
            _set_step(
                plan, "validate_revenue", "blocked",
                error_code="PROVIDER_NOT_CONFIGURED",
            )
            return AgentResult(
                status="blocked",
                message="Revenue investigation is unavailable because no authenticated sales provider is configured.",
                plan=plan,
                context=context,
                errors=[
                    AgentError(
                        code="PROVIDER_NOT_CONFIGURED",
                        message="The sales aggregate provider is missing.",
                    )
                ],
            )

        _set_step(plan, "read_revenue", "running")
        last_error: Exception | None = None

        arguments = {
            "date_from": plan.date_from,
            "date_to": plan.date_to,
            "comparison_from": plan.comparison_from,
            "comparison_to": plan.comparison_to,
            "region": plan.region,
        }

        for _attempt in range(1, MAX_READ_ATTEMPTS + 1):
            try:
                raw = revenue_provider(arguments)
                comparison = validate_revenue_response(raw)

                _set_step(
                    plan, "read_revenue", "completed",
                    summary="Retrieved current and comparison-period aggregates.",
                )
                _set_step(
                    plan, "validate_revenue", "completed",
                    summary="Validated revenue measures, currencies, and totals.",
                )

                evidence = [
                    EvidenceItem(
                        label="Current-period revenue",
                        value=(
                            f'{comparison["current_revenue"]} '
                            f'{comparison["currency"]}'
                        ),
                        timestamp=comparison["current_source_timestamp"],
                        source=REVENUE_TOOL_ID,
                    ),
                    EvidenceItem(
                        label="Comparison-period revenue",
                        value=(
                            f'{comparison["previous_revenue"]} '
                            f'{comparison["currency"]}'
                        ),
                        timestamp=comparison["previous_source_timestamp"],
                        source=REVENUE_TOOL_ID,
                    ),
                    EvidenceItem(
                        label="Absolute revenue change",
                        value=(
                            f'{comparison["absolute_change"]} '
                            f'{comparison["currency"]}'
                        ),
                        source=REVENUE_TOOL_ID,
                    ),
                ]

                pct = comparison["percentage_change"]
                if pct is not None:
                    evidence.append(
                        EvidenceItem(
                            label="Percentage revenue change",
                            value=f"{pct:.2f}%",
                            source=REVENUE_TOOL_ID,
                        )
                    )

                return AgentResult(
                    status="completed",
                    message="Retrieved and compared revenue for the two requested periods. The comparison describes the observed change and does not establish causation.",
                    plan=plan,
                    data_source="backend_api",
                    actions_taken=[
                        "Interpreted request",
                        "Applied read-only policy",
                        "Retrieved current and comparison-period sales data",
                        "Validated revenue response",
                        "Calculated revenue change",
                    ],
                    verified=False,
                    evidence=evidence,
                    revenue_comparison=comparison,
                    context=context,
                )
            except Exception as exc:
                last_error = exc

        _set_step(
            plan, "read_revenue", "failed",
            error_code="REVENUE_LOOKUP_FAILED",
        )
        _set_step(
            plan, "validate_revenue", "blocked",
            error_code="UPSTREAM_LOOKUP_FAILED",
        )
        return AgentResult(
            status="failed",
            message=f"Revenue investigation failed after {MAX_READ_ATTEMPTS} attempts. No successful comparison can be reported.",
            plan=plan,
            context=context,
            errors=[
                AgentError(
                    code="REVENUE_LOOKUP_FAILED",
                    message=(
                        "The sales provider failed or returned invalid data "
                        f"({type(last_error).__name__})."
                    ),
                    retryable=False,
                )
            ],
        )

    return AgentResult(
        status="unsupported",
        message="No registered read-only executor supports this intent.",
        plan=plan,
        context=context,
    )