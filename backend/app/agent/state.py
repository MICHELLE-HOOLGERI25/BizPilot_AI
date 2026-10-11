from __future__ import annotations

from collections.abc import Callable
from typing import Any, TypedDict

from app.agent.schemas import (
    AgentPlan,
    AgentResult,
    ConversationContext,
)

RecommendationsProvider = Callable[[float], dict[str, Any]]

# The provider receives validated period/filter arguments and returns the
# actual backend sales aggregates for both comparison periods.
RevenueProvider = Callable[[dict[str, Any]], dict[str, Any]]


class HostAgentState(TypedDict, total=False):
    request: str
    context: ConversationContext
    plan: AgentPlan
    policy_decision: str
    policy_reason: str
    recommendations_provider: RecommendationsProvider
    revenue_provider: RevenueProvider
    result: AgentResult