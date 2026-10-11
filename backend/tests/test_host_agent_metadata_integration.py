from app.agent.graph import run_host_agent
from app.metadata.registry import MetadataRecord, metadata_registry


def test_host_agent_discovers_registered_metadata():
    metadata_registry.register(
        MetadataRecord(
            tenant_id="demo",
            kind="page",
            key="sales_dashboard",
            name="Sales Dashboard",
            description="View sales reports and revenue trends",
        )
    )

    result = run_host_agent("show me the sales dashboard")

    assert result.status == "completed"
    assert result.metadata_matches
    assert result.metadata_matches[0]["key"] == "sales_dashboard"