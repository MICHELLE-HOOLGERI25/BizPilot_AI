"""Validation for safe, constrained report specifications."""

ALLOWED_AGGREGATIONS = {"count", "sum", "avg", "min", "max"}


def validate_report_spec(
    spec: dict,
    allowed_measures: set[str],
    allowed_dimensions: set[str],
) -> tuple[bool, list[str]]:
    errors = []

    if not isinstance(spec, dict):
        return False, ["Report specification must be an object"]

    measure = spec.get("measure")
    dimension = spec.get("dimension")
    aggregation = spec.get("aggregation", "count")

    if measure not in allowed_measures:
        errors.append("Measure is not registered or allowed")

    if dimension is not None and dimension not in allowed_dimensions:
        errors.append("Dimension is not registered or allowed")

    if aggregation not in ALLOWED_AGGREGATIONS:
        errors.append("Aggregation is not allowed")

    filters = spec.get("filters", [])
    if not isinstance(filters, list):
        errors.append("Filters must be a list")

    return not errors, errors
