"""Capability retrieval with pure-Python and database-backed interfaces."""

from dataclasses import dataclass


@dataclass
class Capability:
    key: str
    name: str
    description: str
    kind: str = "capability"
    parent_key: str | None = None
    payload: dict | None = None


def retrieve_capabilities(
    query: str,
    capabilities: list[Capability],
    limit: int = 10,
) -> list[dict]:
    """Rank capabilities using simple keyword overlap."""
    terms = set(query.lower().replace("-", " ").replace("_", " ").split())
    if not terms:
        return []

    results = []
    for item in capabilities:
        searchable = (
            f"{item.key} {item.name} {item.description} {item.kind}"
        ).lower().replace("-", " ").replace("_", " ")
        words = set(searchable.split())
        matched = terms & words

        if matched:
            results.append({
                "key": item.key,
                "name": item.name,
                "description": item.description,
                "kind": item.kind,
                "parent_key": item.parent_key,
                "payload": item.payload or {},
                "score": len(matched) / len(terms),
            })

    results.sort(key=lambda item: item["score"], reverse=True)
    return results[:max(1, min(limit, 50))]


def search_metadata(
    db,
    query: str,
    tenant_id: str = "demo",
    kind: str | None = None,
    limit: int = 10,
):
    """Search the existing SQLAlchemy metadata registry.

    Imports are lazy so pure-Python retrieval tests do not require
    SQLAlchemy to import successfully.
    """
    from sqlalchemy import or_, select
    from app.metadata.models import MetadataEntry

    terms = list(dict.fromkeys(
        term.lower()
        for term in query.replace("-", " ").replace("_", " ").split()
        if term.strip()
    ))[:8]

    if not terms:
        return []

    statement = select(MetadataEntry).where(
        MetadataEntry.tenant_id == tenant_id,
        MetadataEntry.is_active.is_(True),
    )

    if kind:
        statement = statement.where(MetadataEntry.kind == kind)

    conditions = []
    for term in terms:
        pattern = f"%{term}%"
        conditions.append(or_(
            MetadataEntry.name.ilike(pattern),
            MetadataEntry.key.ilike(pattern),
            MetadataEntry.description.ilike(pattern),
        ))

    statement = statement.where(or_(*conditions)).limit(
        max(1, min(limit, 50))
    )
    return list(db.scalars(statement).all())
