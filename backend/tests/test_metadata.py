from app.metadata.retrieval import Capability, retrieve_capabilities
from app.metadata.validation import validate_report_spec


def test_retrieval_ranks_matching_capability():
    capabilities = [
        Capability("sales_report", "Sales Report", "View sales revenue"),
        Capability("inventory", "Inventory", "View stock levels"),
    ]

    results = retrieve_capabilities("sales revenue report", capabilities)

    assert results
    assert results[0]["key"] == "sales_report"


def test_retrieval_returns_no_results_for_empty_query():
    capabilities = [
        Capability("sales_report", "Sales Report", "View sales revenue"),
    ]

    assert retrieve_capabilities("", capabilities) == []


def test_report_spec_accepts_allowlisted_fields():
    valid, errors = validate_report_spec(
        {"measure": "revenue", "dimension": "month", "aggregation": "sum"},
        allowed_measures={"revenue", "orders"},
        allowed_dimensions={"month", "product"},
    )

    assert valid
    assert errors == []


def test_report_spec_rejects_unknown_measure():
    valid, errors = validate_report_spec(
        {"measure": "secret_table", "aggregation": "sum"},
        allowed_measures={"revenue", "orders"},
        allowed_dimensions={"month", "product"},
    )

    assert not valid
    assert "Measure is not registered or allowed" in errors


def test_report_spec_rejects_invalid_aggregation():
    valid, errors = validate_report_spec(
        {"measure": "revenue", "aggregation": "execute"},
        allowed_measures={"revenue"},
        allowed_dimensions={"month"},
    )

    assert not valid
    assert "Aggregation is not allowed" in errors

from app.metadata.registry import MetadataRecord, MetadataRegistry
from app.metadata.reports import ReportStore


def test_registry_registers_and_finds_metadata():
    registry = MetadataRegistry()
    registry.register(MetadataRecord(
        tenant_id="shop-1",
        kind="widget",
        key="sales-chart",
        name="Sales Chart",
        description="Monthly sales",
    ))

    result = registry.get("shop-1", "widget", "sales-chart")
    assert result is not None
    assert result["name"] == "Sales Chart"


def test_registry_rejects_duplicate_entry():
    registry = MetadataRegistry()
    record = MetadataRecord(
        tenant_id="shop-1",
        kind="page",
        key="dashboard",
        name="Dashboard",
    )
    registry.register(record)

    try:
        registry.register(record)
        assert False, "Expected duplicate registration to fail"
    except ValueError as exc:
        assert "already exists" in str(exc)


def test_report_store_saves_valid_spec():
    store = ReportStore()
    report = store.save(
        tenant_id="shop-1",
        name="Monthly Revenue",
        spec={"measure": "revenue", "dimension": "month",
              "aggregation": "sum"},
        allowed_measures={"revenue"},
        allowed_dimensions={"month"},
    )

    assert report["id"]
    assert report["tenant_id"] == "shop-1"
    assert len(store.list_reports("shop-1")) == 1


def test_report_store_rejects_invalid_spec():
    store = ReportStore()

    try:
        store.save(
            tenant_id="shop-1",
            name="Unsafe Report",
            spec={"measure": "unknown_table", "aggregation": "sum"},
            allowed_measures={"revenue"},
            allowed_dimensions={"month"},
        )
        assert False, "Expected invalid report to be rejected"
    except ValueError as exc:
        assert "Measure is not registered" in str(exc)
