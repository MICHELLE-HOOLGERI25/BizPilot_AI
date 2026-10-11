
from dataclasses import dataclass
from typing import Any, Callable

from app.metadata.retrieval import Capability as MetadataCapability
from app.metadata.retrieval import retrieve_capabilities


@dataclass(frozen=True)
class Capability:
    tool_id: str
    description: str
    read_only: bool


class CapabilityProvider:
    """Tool registry with metadata-based capability discovery."""

    def __init__(
        self,
        capabilities: list[Capability] | None = None,
        metadata_capabilities: list[MetadataCapability] | None = None,
    ):
        registered = capabilities if capabilities is not None else [
            Capability(
                tool_id="person2.replenishment_recommendations",
                description=(
                    "Read live replenishment recommendations "
                    "from Person 2's backend"
                ),
                read_only=True,
            )
        ]

        self._capabilities = {
            capability.tool_id: capability
            for capability in registered
        }

        self._metadata_capabilities = (
            metadata_capabilities
            if metadata_capabilities is not None
            else []
        )

    def list_capabilities(self) -> list[Capability]:
        """Return all registered capabilities."""
        return list(self._capabilities.values())

    def get(self, tool_id: str) -> Capability | None:
        """Get a capability by its tool ID."""
        return self._capabilities.get(tool_id)

    def resolve(
        self,
        tool_id: str,
        handlers: dict[str, Callable[..., Any]],
    ) -> Callable[..., Any] | None:
        """Resolve a registered capability to its handler."""
        if self.get(tool_id) is None:
            return None

        return handlers.get(tool_id)

    def discover(
        self,
        query: str,
        limit: int = 10,
    ) -> list[dict]:
        """Find matching registered metadata without executing tools."""
        return retrieve_capabilities(
            query=query,
            capabilities=self._metadata_capabilities,
            limit=limit,
        )


def default_capability_provider() -> CapabilityProvider:
    from app.metadata.registry import metadata_registry

    records = metadata_registry.list_entries(tenant_id="demo")

    metadata_capabilities = [
        MetadataCapability(
            key=record["key"],
            name=record["name"],
            description=record["description"],
            kind=record["kind"],
            parent_key=record["parent_key"],
            payload=record["payload"],
        )
        for record in records
        if record["is_active"]
    ]

    return CapabilityProvider(
        metadata_capabilities=metadata_capabilities,
    )