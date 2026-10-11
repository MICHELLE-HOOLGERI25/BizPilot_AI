from __future__ import annotations

from collections.abc import Callable
from typing import Any, TypedDict

from app.agent.schemas import AgentPlan, AgentResult


RecommendationsProvider = Callable[[float], dict[str, Any]]


class HostAgentState(TypedDict, total=False):
    request: str
    plan: AgentPlan
    policy_decision: str
    policy_reason: str
    recommendations_provider: RecommendationsProvider
    result: AgentResult