from __future__ import annotations

import re

from langgraph.graph import END, START, StateGraph

from app.agent.capability_provider import (
    default_capability_provider,
)
from app.agent.executor import execute_read_only_plan
from app.agent.policies import evaluate_plan
from app.agent.schemas import AgentPlan, AgentResult, PlanStep
from app.agent.state import HostAgentState, RecommendationsProvider


def interpret_request(state: HostAgentState) -> dict:
    request = state["request"].strip()
    normalized = request.lower()

    days = 7.0
    match = re.search(
        r"(?:within|in|next|over)\s+(\d+(?:\.\d+)?)\s+days?",
        normalized,
    )

    if match:
        days = min(365.0, max(0.1, float(match.group(1))))

    terms = (
        "replenishment",
        "days of cover",
        "run out",
        "running out",
        "stockout",
        "stock out",
        "low stock",
        "purchase order",
        "purchase orders",
        "out of stock",
        "reorder",
    )

    if any(term in normalized for term in terms):
        capability = default_capability_provider().get(
            "person2.replenishment_recommendations"
        )

        plan = AgentPlan(
            intent="replenishment_recommendations",
            max_days_of_cover=days,
            requires_write=False,
            explanation=(
                "Read-only replenishment lookup. "
                "This request will not create, approve, "
                "or submit a purchase order."
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

    else:
        plan = AgentPlan(
            intent="unsupported",
            explanation=(
                "This request is not supported by the current HostAgent."
            ),
        )

    return {"plan": plan}


def apply_policy(state: HostAgentState) -> dict:
    decision = evaluate_plan(state["plan"])

    # Unsupported requests continue to the executor so that they
    # return the explicit "unsupported" status.
    return {
        "policy_decision": (
            "allow"
            if state["plan"].intent == "unsupported"
            else decision.decision
        ),
        "policy_reason": decision.reason,
    }


def execute_plan(state: HostAgentState) -> dict:
    return {
        "result": execute_read_only_plan(
            state["plan"],
            state.get("recommendations_provider"),
        )
    }


def block_plan(state: HostAgentState) -> dict:
    from app.agent.schemas import AgentError

    return {
        "result": AgentResult(
            status="blocked",
            message=state.get(
                "policy_reason",
                "Policy blocked this operation.",
            ),
            plan=state["plan"],
            errors=[
                AgentError(
                    code="POLICY_BLOCKED",
                    message=(
                        "The request did not pass "
                        "the HostAgent policy."
                    ),
                )
            ],
        )
    }


def verify_result(state: HostAgentState) -> dict:
    result = state["result"]

    # Response validation is not independent persisted-state verification.
    result.verified = False

    return {"result": result}


def build_host_agent():
    builder = StateGraph(HostAgentState)

    builder.add_node("interpret", interpret_request)
    builder.add_node("policy", apply_policy)
    builder.add_node("execute", execute_plan)
    builder.add_node("block", block_plan)
    builder.add_node("verify", verify_result)

    builder.add_edge(START, "interpret")
    builder.add_edge("interpret", "policy")

    builder.add_conditional_edges(
        "policy",
        lambda state: (
            "execute"
            if state["policy_decision"] == "allow"
            else "block"
        ),
        {
            "execute": "execute",
            "block": "block",
        },
    )

    builder.add_edge("execute", "verify")
    builder.add_edge("block", "verify")
    builder.add_edge("verify", END)

    return builder.compile()


host_agent = build_host_agent()


def run_host_agent(
    request: str,
    recommendations_provider: RecommendationsProvider | None = None,
) -> AgentResult:
    clean_request = request.strip()

    if not clean_request:
        raise ValueError("Request cannot be empty.")

    state = host_agent.invoke(
        {
            "request": clean_request,
            "recommendations_provider": recommendations_provider,
        }
    )

    return state["result"]