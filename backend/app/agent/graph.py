
from __future__ import annotations

import re

from langgraph.graph import END, START, StateGraph

from app.agent.capability_provider import default_capability_provider
from app.agent.executor import execute_read_only_plan
from app.agent.policies import evaluate_plan
from app.agent.schemas import AgentError, AgentPlan, AgentResult, PlanStep
from app.agent.state import HostAgentState, RecommendationsProvider


def interpret_request(state: HostAgentState) -> dict:
    request = state["request"].strip()
    normalized = request.lower()

    # Fail safely: purchase-order write requests never enter the
    # read-only replenishment execution path.
    write_action = re.search(
        r"\b(create|draft|generate|place|submit|approve|cancel|"
        r"delete|update|edit|modify)\b",
        normalized,
    )
    order_reference = re.search(
        r"\b(purchase[\s-]*orders?|pos?)\b",
        normalized,
    )

    if write_action and order_reference:
        plan = AgentPlan(
            intent="unsupported",
            requires_write=True,
            explanation=(
                "This request appears to modify a purchase order. "
                "The current workflow is read-only, so no write "
                "operation will be executed."
            ),
        )
        return {"plan": plan}

    days = 7.0
    match = re.search(
        r"(?:within|in|next|over)\s+(\d+(?:\.\d+)?)\s+days?",
        normalized,
    )
    if match:
        days = min(365.0, max(0.1, float(match.group(1))))

    replenishment_terms = (
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

    if any(term in normalized for term in replenishment_terms):
        capability = default_capability_provider().get(
            "person2.replenishment_recommendations"
        )

        plan = AgentPlan(
            intent="replenishment_recommendations",
            max_days_of_cover=days,
            requires_write=False,
            explanation=(
                "Read-only replenishment lookup. "
                "No purchase order will be created or submitted."
            ),
            steps=[
                PlanStep(
                    step_id="read_recommendations",
                    description=(
                        "Retrieve live replenishment recommendations"
                    ),
                    tool_id=capability.tool_id if capability else None,
                ),
                PlanStep(
                    step_id="validate_response",
                    description=(
                        "Validate the operational response contract"
                    ),
                ),
            ],
        )
        return {"plan": plan}

    # Discover registered pages, widgets, filters, schemas,
    # navigation entries, and capabilities.
    provider = default_capability_provider()
    matches = provider.discover(request, limit=10)

    if matches:
        plan = AgentPlan(
            intent="metadata_discovery",
            requires_write=False,
            explanation=(
                "Read-only metadata discovery. "
                "No tools or business operations are executed."
            ),
            steps=[
                PlanStep(
                    step_id="discover_metadata",
                    description="Find matching registered metadata",
                )
            ],
        )
        return {
            "plan": plan,
            "metadata_matches": matches,
        }

    plan = AgentPlan(
        intent="unsupported",
        explanation=(
            "No matching registered capability was found."
        ),
    )
    return {"plan": plan}


def apply_policy(state: HostAgentState) -> dict:
    plan = state["plan"]

    # Metadata discovery only reads registered metadata.
    if plan.intent == "metadata_discovery":
        return {
            "policy_decision": "discover",
            "policy_reason": "Read-only metadata discovery.",
        }

    # Unsupported requests must not enter execution.
    if plan.intent == "unsupported":
        return {
            "policy_decision": "unsupported",
            "policy_reason": (
                "The requested capability is not registered."
            ),
        }

    decision = evaluate_plan(plan)
    return {
        "policy_decision": decision.decision,
        "policy_reason": decision.reason,
    }


def execute_plan(state: HostAgentState) -> dict:
    return {
        "result": execute_read_only_plan(
            state["plan"],
            state.get("recommendations_provider"),
        )
    }


def metadata_discovery_result(state: HostAgentState) -> dict:
    matches = state.get("metadata_matches", [])

    return {
        "result": AgentResult(
            status="completed",
            message=f"Found {len(matches)} matching metadata entries.",
            plan=state["plan"],
            data_source="none",
            actions_taken=[
                "Interpreted request",
                "Discovered metadata",
            ],
            metadata_matches=matches,
        )
    }


def block_plan(state: HostAgentState) -> dict:
    return {
        "result": AgentResult(
            status="blocked",
            message=state.get(
                "policy_reason",
                "Policy blocked this operation.",
            ),
            plan=state["plan"],
            actions_taken=[
                "Interpreted request",
                "Applied read-only policy",
            ],
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


def unsupported_plan(state: HostAgentState) -> dict:
    return {
        "result": AgentResult(
            status="unsupported",
            message=(
                "The current HostAgent does not support this request."
            ),
            plan=state["plan"],
        )
    }


def verify_result(state: HostAgentState) -> dict:
    result = state["result"]

    # This workflow does not independently verify persisted state.
    result.verified = False

    return {"result": result}


def route_after_policy(state: HostAgentState) -> str:
    decision = state["policy_decision"]

    if decision == "allow":
        return "execute"

    if decision == "discover":
        return "metadata_discovery"

    if decision == "unsupported":
        return "unsupported"

    return "block"


def build_host_agent():
    builder = StateGraph(HostAgentState)

    builder.add_node("interpret", interpret_request)
    builder.add_node("policy", apply_policy)
    builder.add_node("execute", execute_plan)
    builder.add_node("metadata_discovery", metadata_discovery_result)
    builder.add_node("block", block_plan)
    builder.add_node("unsupported_plan", unsupported_plan)
    builder.add_node("verify", verify_result)

    builder.add_edge(START, "interpret")
    builder.add_edge("interpret", "policy")

    builder.add_conditional_edges(
        "policy",
        route_after_policy,
        {
            "execute": "execute",
            "metadata_discovery": "metadata_discovery",
            "block": "block",
            "unsupported": "unsupported_plan",
        },
    )

    builder.add_edge("execute", "verify")
    builder.add_edge("metadata_discovery", "verify")
    builder.add_edge("block", "verify")
    builder.add_edge("unsupported_plan", "verify")
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