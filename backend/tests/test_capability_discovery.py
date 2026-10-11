
from app.agent.capability_provider import CapabilityProvider
from app.metadata.retrieval import Capability as MetadataCapability


def test_discover_matching_metadata():
    provider = CapabilityProvider(
        metadata_capabilities=[
            MetadataCapability(
                key="sales_dashboard",
                name="Sales Dashboard",
                description="View sales reports and revenue trends",
                kind="page",
            ),
            MetadataCapability(
                key="inventory_widget",
                name="Inventory Widget",
                description="View current stock levels",
                kind="widget",
            ),
        ]
    )

    results = provider.discover("sales revenue dashboard")

    assert results
    assert results[0]["key"] == "sales_dashboard"


def test_discover_returns_empty_for_no_match():
    provider = CapabilityProvider(metadata_capabilities=[])

    assert provider.discover("unknown capability") == []