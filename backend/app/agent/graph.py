from __future__ import annotations

import re
from typing import Any

from langgraph.graph import END, START, StateGraph

from app.agent.capability_provider import default_capability_provider
from app.agent.executor import execute_read_only_plan
from app.agent.policies import evaluate_plan
from app.agent.schemas import (
    AgentError,
    AgentPlan,
    AgentResult,
    ConversationContext,
    PlanStep,
)
from app.agent.state import (
    HostAgentState,
    RecommendationsProvider,
    RevenueProvider,
)
from app.agent.tools.revenue import resolve_comparison_period


REVENUE_TOOL_ID = "person3.revenue_investigation"

REVENUE_PATTERN = re.compile(
    r"\b(revenue|sales|turnover)\b",
    re.IGNORECASE,
)

REVENUE_FOLLOW_UP_PATTERN = re.compile(
    r"\b(products?|items?)\b.*\b(contributed|contribution|decline|"
    r"drop|change|drivers?)\b"
    r"|\b(why|what caused)\b.*\b(decline|drop|change)\b",
    re.IGNORECASE,
)

DATE_RANGE_PATTERN = re.compile(
    r"\bfrom\s+(\d{4}-\d{2}-\d{2})\s+"
    r"(?:to|through|until)\s+(\d{4}-\d{2}-\d{2})\b",
    re.IGNORECASE,
)

REGION_PATTERN = re.compile(
    r"\b(?:in|for)\s+(?:the\s+)?"
    r"(north|south|east|west|central)\s+region\b",
    re.IGNORECASE,
)

WRITE_ACTION_PATTERN = re.compile(
    r"\b(create|draft|generate|place|submit|approve|cancel|"
    r"delete|update|edit|modify|prepare)\b",
    re.IGNORECASE,
)

ORDER_REFERENCE_PATTERN = re.compile(
    r"\b(purchase[\s-]*orders?|pos?)\b",
    re.IGNORECASE,
)

REPLENISHMENT_TERMS = (
    "replenishment",
    "days of cover",
    "run out",
    "running out",
    "stockout",
    "stock out",
    "low stock",
    "out of stock",
    "reorder",
)


def build_revenue_plan(
    request: str,
    context: ConversationContext | None = None,
) -> tuple[AgentPlan, ConversationContext | None]:
    """Build a revenue comparison plan from explicit or inherited filters."""

    date_match = DATE_RANGE_PATTERN.search(request)
    region_match = REGION_PATTERN.search(request)

    date_from = (
        date_match.group(1)
        if date_match
        else (context.date_from if context else None)
    )
    date_to = (
        date_match.group(2)
        if date_match
        else (context.date_to if context else None)
    )
    region = (
        region_match.group(1).lower()
        if region_match
        else (context.region if context else None)
    )

    if not date_from or not date_to:
        return (
            AgentPlan(
                intent="revenue_investigation",
                region=region,
                explanation=(
                    "A date range is required. Specify "
                    "'from YYYY-MM-DD to YYYY-MM-DD', or provide "
                    "the previous conversation context."
                ),
                steps=[
                    PlanStep(
                        step_id="read_revenue",
                        description=(
                            "Retrieve current and comparison-period revenue"
                        ),
                        status="blocked",
                        tool_id=REVENUE_TOOL_ID,
                        error_code="DATE_RANGE_REQUIRED",
                    ),
                    PlanStep(
                        step_id="validate_revenue",
                        description="Validate revenue aggregates",
                        status="blocked",
                        error_code="DATE_RANGE_REQUIRED",
                    ),
                ],
            ),
            context,
        )

    try:
        periods = resolve_comparison_period(date_from, date_to)
    except (TypeError, ValueError):
        return (
            AgentPlan(
                intent="revenue_investigation",
                region=region,
                explanation=(
                    "The date range is invalid. Use ISO dates and ensure "
                    "the end date is not earlier than the start date."
                ),
                steps=[
                    PlanStep(
                        step_id="read_revenue",
                        description="Retrieve revenue aggregates",
                        status="blocked",
                        tool_id=REVENUE_TOOL_ID,
                        error_code="INVALID_DATE_RANGE",
                    ),
                    PlanStep(
                        step_id="validate_revenue",
                        description="Validate revenue aggregates",
                        status="blocked",
                        error_code="INVALID_DATE_RANGE",
                    ),
                ],
            ),
            context,
        )

    updated_context = ConversationContext(
        region=region,
        date_from=periods["date_from"],
        date_to=periods["date_to"],
        last_intent="revenue_investigation",
    )

    plan = AgentPlan(
        intent="revenue_investigation",
        region=region,
        date_from=periods["date_from"],
        date_to=periods["date_to"],
        comparison_from=periods["comparison_from"],
        comparison_to=periods["comparison_to"],
        explanation=(
            "Compare the requested revenue period with the immediately "
            "preceding period of equal length."
        ),
        steps=[
            PlanStep(
                step_id="read_revenue",
                description=(
                    "Retrieve current and comparison-period sales "
                    "aggregates from the backend"
                ),
                tool_id=REVENUE_TOOL_ID,
            ),
            PlanStep(
                step_id="validate_revenue",
                description=(
                    "Validate metrics and calculate revenue change"
                ),
                tool_id=REVENUE_TOOL_ID,
            ),
        ],
    )

    return plan, updated_context


def interpret_request(state: HostAgentState) -> dict[str, Any]:
    request = state["request"].strip()
    normalized = request.lower()
    context = state.get("context")

    mentions_replenishment = any(
        term in normalized for term in REPLENISHMENT_TERMS
    )
    mentions_purchase_order = (
        ORDER_REFERENCE_PATTERN.search(normalized) is not None
    )

    # Block replenishment requests involving purchase orders first.
    # Preserve the existing contract: requires_write=False for this case.
    if mentions_replenishment and mentions_purchase_order:
        return {
            "plan": AgentPlan(
                intent="unsupported",
                requires_write=False,
                explanation=(
                    "Purchase-order preparation is not supported by the "
                    "read-only HostAgent."
                ),
            )
        }

    # Block other explicit purchase-order write requests.
    if (
        WRITE_ACTION_PATTERN.search(normalized)
        and mentions_purchase_order
    ):
        return {
            "plan": AgentPlan(
                intent="unsupported",
                requires_write=True,
                explanation=(
                    "This request appears to modify a purchase order. "
                    "The read-only HostAgent will not perform that operation."
                ),
            )
        }

    # Recognize follow-up questions using the prior revenue conversation.
    is_revenue_follow_up = (
        context is not None
        and context.last_intent == "revenue_investigation"
        and REVENUE_FOLLOW_UP_PATTERN.search(normalized) is not None
    )

    # Revenue is a separate read-only capability.
    if REVENUE_PATTERN.search(normalized) or is_revenue_follow_up:
        plan, updated_context = build_revenue_plan(request, context)
        return {
            "plan": plan,
            "context": updated_context,
        }

    # Existing replenishment intent and days-of-cover behavior.
    match = re.search(
        r"(?:within|in|next|over)\s+(\d+(?:\.\d+)?)\s+days?",
        normalized,
    )
    days = 7.0
    if match:
        days = min(365.0, max(0.1, float(match.group(1))))

    if mentions_replenishment:
        capability = default_capability_provider().get(
            "person2.replenishment_recommendations"
        )

        return {
            "plan": AgentPlan(
                intent="replenishment_recommendations",
                max_days_of_cover=days,
                requires_write=False,
                explanation=(
                    "Read-only replenishment lookup. No purchase order "
                    "will be created or submitted."
                ),
                steps=[
                    PlanStep(
                        step_id="read_recommendations",
                        description=(
                            "Retrieve live replenishment recommendations"
                        ),
                        tool_id=(
                            capability.tool_id if capability else None
                        ),
                    ),
                    PlanStep(
                        step_id="validate_response",
                        description=(
                            "Validate the operational response contract"
                        ),
                    ),
                ],
            )
        }

    return {
        "plan": AgentPlan(
            intent="unsupported",
            explanation=(
                "This request is not supported by the current HostAgent."
            ),
        )
    }


def apply_policy(state: HostAgentState) -> dict[str, Any]:
    plan = state["plan"]

    # Explicit write requests must always be blocked.
    if plan.requires_write:
        return {
            "policy_decision": "block",
            "policy_reason": (
                "This operation is not permitted by the read-only HostAgent."
            ),
        }

    # Block the special purchase-order preparation case while keeping
    # ordinary unsupported requests on their existing route.
    if plan.intent == "unsupported":
        if (
            "Purchase-order preparation is not supported"
            in plan.explanation
        ):
            return {
                "policy_decision": "block",
                "policy_reason": plan.explanation,
            }

        return {
            "policy_decision": "unsupported",
            "policy_reason": (
                "The requested capability is not registered."
            ),
        }

    # Missing or invalid dates need clarification, not a provider retry.
    if plan.intent == "revenue_investigation":
        step = next(
            (
                item
                for item in plan.steps
                if item.error_code in {
                    "DATE_RANGE_REQUIRED",
                    "INVALID_DATE_RANGE",
                }
            ),
            None,
        )
        if step is not None:
            return {
                "policy_decision": "clarify",
                "policy_reason": plan.explanation,
            }

    decision = evaluate_plan(plan)
    return {
        "policy_decision": decision.decision,
        "policy_reason": decision.reason,
    }



def execute_plan(state: HostAgentState) -> dict[str, Any]:
    result = execute_read_only_plan(
        state["plan"],
        state.get("recommendations_provider"),
        revenue_provider=state.get("revenue_provider"),
        context=state.get("context"),
    )
    return {"result": result}


def block_plan(state: HostAgentState) -> dict[str, Any]:
    return {
        "result": AgentResult(
            status="blocked",
            message=state.get(
                "policy_reason",
                "Policy blocked this operation.",
            ),
            plan=state["plan"],
            context=state.get("context"),
            actions_taken=[
                "Interpreted request",
                "Applied read-only policy",
            ],
            errors=[
                AgentError(
                    code="POLICY_BLOCKED",
                    message=(
                        "The request did not pass the HostAgent policy."
                    ),
                )
            ],
        )
    }


def clarify_plan(state: HostAgentState) -> dict[str, Any]:
    plan = state["plan"]
    missing_date_range = any(
        step.error_code == "DATE_RANGE_REQUIRED"
        for step in plan.steps
    )
    code = (
        "DATE_RANGE_REQUIRED"
        if missing_date_range
        else "INVALID_DATE_RANGE"
    )

    return {
        "result": AgentResult(
            status="blocked",
            message=plan.explanation,
            plan=plan,
            context=state.get("context"),
            errors=[
                AgentError(
                    code=code,
                    message=plan.explanation,
                    retryable=False,
                )
            ],
        )
    }


def unsupported_plan(state: HostAgentState) -> dict[str, Any]:
    return {
        "result": AgentResult(
            status="unsupported",
            message=(
                "The current HostAgent does not support this request."
            ),
            plan=state["plan"],
            context=state.get("context"),
        )
    }


def verify_result(state: HostAgentState) -> dict[str, Any]:
    result = state["result"]

    # This graph does not independently verify persisted state.
    result.verified = False

    # Preserve context when returning the result.
    if result.context is None:
        result.context = state.get("context")

    return {"result": result}


def route_after_policy(state: HostAgentState) -> str:
    decision = state["policy_decision"]

    if decision == "allow":
        return "execute"
    if decision == "unsupported":
        return "unsupported"
    if decision == "clarify":
        return "clarify"

    return "block"


def build_host_agent():
    builder = StateGraph(HostAgentState)

    builder.add_node("interpret", interpret_request)
    builder.add_node("policy", apply_policy)
    builder.add_node("execute", execute_plan)
    builder.add_node("block", block_plan)
    builder.add_node("clarify", clarify_plan)
    builder.add_node("unsupported_plan", unsupported_plan)
    builder.add_node("verify", verify_result)

    builder.add_edge(START, "interpret")
    builder.add_edge("interpret", "policy")

    builder.add_conditional_edges(
        "policy",
        route_after_policy,
        {
            "execute": "execute",
            "block": "block",
            "clarify": "clarify",
            "unsupported": "unsupported_plan",
        },
    )

    builder.add_edge("execute", "verify")
    builder.add_edge("block", "verify")
    builder.add_edge("clarify", "verify")
    builder.add_edge("unsupported_plan", "verify")
    builder.add_edge("verify", END)

    return builder.compile()


host_agent = build_host_agent()


def run_host_agent(
    request: str,
    recommendations_provider: RecommendationsProvider | None = None,
    revenue_provider: RevenueProvider | None = None,
    context: ConversationContext | None = None,
) -> AgentResult:
    clean_request = request.strip()
    if not clean_request:
        raise ValueError("Request cannot be empty.")

    state = host_agent.invoke(
        {
            "request": clean_request,
            "recommendations_provider": recommendations_provider,
            "revenue_provider": revenue_provider,
            "context": context,
        }
    )

    return state["result"]