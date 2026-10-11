
from dataclasses import dataclass
from typing import Any, Callable


REPLENISHMENT_TOOL_ID = "person2.replenishment_recommendations"
REVENUE_TOOL_ID = "person3.revenue_investigation"


@dataclass(frozen=True)
class Capability:
    tool_id: str
    description: str
    read_only: bool


class CapabilityProvider:
    """Registry of explicitly permitted HostAgent capabilities."""

    def __init__(
        self,
        capabilities: list[Capability] | None = None,
    ):
        registered = (
            capabilities
            if capabilities is not None
            else [
                Capability(
                    tool_id=REPLENISHMENT_TOOL_ID,
                    description=(
                        "Read live replenishment recommendations "
                        "from Person 2's backend."
                    ),
                    read_only=True,
                ),
                Capability(
                    tool_id=REVENUE_TOOL_ID,
                    description=(
                        "Compare current and equivalent previous-period "
                        "revenue using authenticated sales aggregates."
                    ),
                    read_only=True,
                ),
            ]
        )

        # Reject duplicate IDs so capability registration is deterministic.
        self._capabilities: dict[str, Capability] = {}

        for capability in registered:
            if capability.tool_id in self._capabilities:
                raise ValueError(
                    f"Duplicate capability ID: {capability.tool_id}"
                )

            self._capabilities[capability.tool_id] = capability

    def list_capabilities(self) -> list[Capability]:
        """Return all registered capabilities."""
        return list(self._capabilities.values())

    def get(self, tool_id: str) -> Capability | None:
        """Return a registered capability, if present."""
        return self._capabilities.get(tool_id)

    def resolve(
        self,
        tool_id: str,
        handlers: dict[str, Callable[..., Any]],
    ) -> Callable[..., Any] | None:
        """Resolve only explicitly registered tool handlers."""
        capability = self.get(tool_id)

        if capability is None:
            return None

        return handlers.get(tool_id)


def default_capability_provider() -> CapabilityProvider:
    """Build the default registry."""
    return CapabilityProvider()
