from app.agent.capability_provider import CapabilityProvider
from app.metadata.retrieval import Capability as MetadataCapability


def test_provider_discovers_registered_sales_dashboard():
    provider = CapabilityProvider(
        metadata_capabilities=[
            MetadataCapability(
                key="sales_dashboard",
                name="Sales Dashboard",
                description="View sales reports and revenue trends",
                kind="page",
            )
        ]
    )

    results = provider.discover("show me the sales dashboard")

    assert len(results) == 1
    assert results[0]["key"] == "sales_dashboard"
    assert results[0]["kind"] == "page"