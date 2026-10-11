"""Metadata registration service; database adapter can be added later."""

from dataclasses import asdict, dataclass, field
from threading import RLock


ALLOWED_KINDS = {
    "page", "widget", "filter", "schema", "navigation", "capability"
}


@dataclass
class MetadataRecord:
    tenant_id: str
    kind: str
    key: str
    name: str
    description: str = ""
    parent_key: str | None = None
    payload: dict = field(default_factory=dict)
    is_active: bool = True


class MetadataRegistry:
    """Thread-safe registry with tenant-scoped unique keys."""

    def __init__(self):
        self._records: dict[tuple[str, str, str], MetadataRecord] = {}
        self._lock = RLock()

    def register(self, record: MetadataRecord) -> dict:
        if record.kind not in ALLOWED_KINDS:
            raise ValueError(f"Unsupported metadata kind: {record.kind}")
        if not record.tenant_id.strip() or not record.key.strip():
            raise ValueError("tenant_id and key are required")
        if not record.name.strip():
            raise ValueError("name is required")

        identity = (record.tenant_id, record.kind, record.key)
        with self._lock:
            if identity in self._records:
                raise ValueError("Metadata entry already exists")
            self._records[identity] = record
            return asdict(record)

    def list_entries(
        self, tenant_id: str, kind: str | None = None
    ) -> list[dict]:
        with self._lock:
            return [
                asdict(record)
                for record in self._records.values()
                if record.tenant_id == tenant_id
                and (kind is None or record.kind == kind)
            ]

    def get(
        self, tenant_id: str, kind: str, key: str
    ) -> dict | None:
        with self._lock:
            record = self._records.get((tenant_id, kind, key))
            return asdict(record) if record else None
# Shared in-memory registry for application-level metadata discovery.
metadata_registry = MetadataRegistry()