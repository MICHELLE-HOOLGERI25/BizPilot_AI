from dataclasses import dataclass
from typing import Any, Callable


@dataclass(frozen=True)
class Capability:
    tool_id: str
    description: str
    read_only: bool


class CapabilityProvider:
    """Small registry seam that can later connect to Person 4's service."""

    def __init__(
        self,
        capabilities: list[Capability] | None = None,
    ):
        registered = capabilities or [
            Capability(
                "person2.replenishment_recommendations",
                "Read live replenishment recommendations "
                "from Person 2's backend",
                True,
            )
        ]

        self._capabilities = {
            capability.tool_id: capability
            for capability in registered
        }

    def list_capabilities(self) -> list[Capability]:
        return list(self._capabilities.values())

    def get(self, tool_id: str) -> Capability | None:
        return self._capabilities.get(tool_id)

    def resolve(
        self,
        tool_id: str,
        handlers: dict[str, Callable[..., Any]],
    ) -> Callable[..., Any] | None:
        if self.get(tool_id) is None:
            return None

        return handlers.get(tool_id)


def default_capability_provider() -> CapabilityProvider:
    return CapabilityProvider()