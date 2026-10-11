
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.metadata.retrieval import search_metadata
from app.metadata.reports import ReportStore

router = APIRouter(prefix="/api/v1/metadata", tags=["metadata"])

report_store = ReportStore()


def get_db():
    """Create a database session only for endpoints that need it."""
    from app.db.session import SessionLocal

    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/search")
def metadata_search(
    q: str = Query(..., min_length=1, max_length=300),
    tenant_id: str = Query(default="demo", min_length=1, max_length=100),
    kind: str | None = Query(default=None, max_length=40),
    limit: int = Query(default=10, ge=1, le=50),
    db=Depends(get_db),
):
    entries = search_metadata(db, q, tenant_id, kind, limit)

    return {
        "query": q,
        "count": len(entries),
        "results": [
            {
                "kind": item.kind,
                "key": item.key,
                "name": item.name,
                "description": item.description,
                "parent_key": item.parent_key,
                "payload": item.payload,
            }
            for item in entries
        ],
    }


class ReportSaveRequest(BaseModel):
    tenant_id: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=200)
    spec: dict


@router.post("/reports", status_code=201)
def save_metadata_report(request: ReportSaveRequest):
    try:
        return report_store.save(
            tenant_id=request.tenant_id,
            name=request.name,
            spec=request.spec,
            allowed_measures={"revenue", "orders", "quantity", "stock"},
            allowed_dimensions={"month", "product", "category", "supplier"},
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail=str(exc),
        ) from exc


@router.get("/reports")
def list_metadata_reports(
    tenant_id: str = Query(..., min_length=1, max_length=100),
):
    return {
        "reports": report_store.list_reports(tenant_id)
    }
