
"""Validate and save constrained report specifications."""

from copy import deepcopy
from threading import RLock
from uuid import uuid4

from app.metadata.validation import validate_report_spec


class ReportStore:
    def __init__(self):
        self._reports: dict[str, dict] = {}
        self._lock = RLock()

    def save(
        self,
        tenant_id,
        name,
        spec,
        allowed_measures,
        allowed_dimensions,
        db=None,
    ) -> dict:
        if not tenant_id.strip() or not name.strip():
            raise ValueError("tenant_id and report name are required")

        valid, errors = validate_report_spec(
            spec,
            allowed_measures,
            allowed_dimensions,
        )

        if not valid:
            raise ValueError("; ".join(errors))

        report_id = str(uuid4())

        report = {
            "id": report_id,
            "tenant_id": tenant_id,
            "name": name,
            "spec": deepcopy(spec),
        }

        if db is not None:
            from app.metadata.report_models import SavedMetadataReport

            row = SavedMetadataReport(**report)

            try:
                db.add(row)
                db.commit()
                return report
            except Exception:
                db.rollback()
                raise

        # In-memory fallback preserves existing unit tests.
        with self._lock:
            self._reports[report_id] = report

        return deepcopy(report)

    def list_reports(self, tenant_id, db=None) -> list[dict]:
        if db is not None:
            from sqlalchemy import select
            from app.metadata.report_models import SavedMetadataReport

            rows = db.scalars(
                select(SavedMetadataReport)
                .where(SavedMetadataReport.tenant_id == tenant_id)
                .order_by(SavedMetadataReport.created_at.desc())
            ).all()

            return [
                {
                    "id": row.id,
                    "tenant_id": row.tenant_id,
                    "name": row.name,
                    "spec": deepcopy(row.spec),
                }
                for row in rows
            ]

        with self._lock:
            return [
                deepcopy(report)
                for report in self._reports.values()
                if report["tenant_id"] == tenant_id
            ]