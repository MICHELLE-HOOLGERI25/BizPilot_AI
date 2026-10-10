from typing import Annotated

from fastapi import APIRouter, Depends, Query, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field, ConfigDict, field_validator
from sqlalchemy.exc import IntegrityError

from app.core.security import Actor, require_permission
from app.db.models import AuditLog, Product, PurchaseOrder, Supplier, SupplierProduct
from app.db.session import SessionLocal

router = APIRouter(
    prefix="/api/v1/suppliers",
    tags=["suppliers"],
)


def get_db():
    with SessionLocal() as session:
        yield session


DbSession = Annotated[Session, Depends(get_db)]
SupplierReader = Annotated[
    Actor,
    Depends(require_permission("suppliers:read")),
]


@router.get("")
def list_suppliers(
    actor: SupplierReader,
    db: DbSession,
    active_only: bool = False,
    q: str | None = Query(default=None, max_length=200),
):
    tenant_id = actor.tenant_id

    query = (
        select(Supplier)
        .where(Supplier.tenant_id == tenant_id)
        .order_by(Supplier.name, Supplier.id)
    )

    if active_only:
        query = query.where(Supplier.is_active.is_(True))

    if q and q.strip():
        query = query.where(
            Supplier.name.ilike(f"%{q.strip()}%")
        )

    suppliers = db.scalars(query).all()
    data = []

    for supplier in suppliers:
        coverage_rows = db.execute(
            select(
                Product.sku,
                Product.name,
                SupplierProduct.unit_cost,
            )
            .join(
                SupplierProduct,
                SupplierProduct.product_id == Product.id,
            )
            .where(
                SupplierProduct.tenant_id == tenant_id,
                SupplierProduct.supplier_id == supplier.id,
                Product.tenant_id == tenant_id,
            )
            .order_by(Product.sku)
        ).all()

        data.append(
            {
                "id": supplier.id,
                "name": supplier.name,
                "email": supplier.email,
                "phone": supplier.phone,
                "is_active": supplier.is_active,
                "lead_time_days": supplier.lead_time_days,
                "on_time_delivery_rate": (
                    supplier.on_time_delivery_rate
                ),
                "product_coverage": [
                    {
                        "sku": row.sku,
                        "product_name": row.name,
                        "unit_cost": str(row.unit_cost),
                    }
                    for row in coverage_rows
                ],
            }
        )

    return {
        "data_mode": "synthetic_demo",
        "total": len(data),
        "data": data,
    }

class SupplierCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=50)
    lead_time_days: int = Field(default=7, ge=0)
    on_time_delivery_rate: int = Field(default=100, ge=0, le=100)
    is_active: bool = True

    @field_validator("name")
    @classmethod
    def valid_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Name cannot be blank")
        return value


class SupplierUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str | None = Field(default=None, min_length=1, max_length=200)
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=50)
    lead_time_days: int | None = Field(default=None, ge=0)
    on_time_delivery_rate: int | None = Field(default=None, ge=0, le=100)
    is_active: bool | None = None

    @field_validator("name")
    @classmethod
    def valid_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("Name cannot be blank")
        return value


def supplier_audit(db, actor, request_id, action, supplier_id, details):
    db.add(AuditLog(
        actor_id=str(actor.actor_id),
        tenant_id=actor.tenant_id,
        request_id=request_id,
        action=action,
        entity_type="supplier",
        entity_id=str(supplier_id) if supplier_id is not None else None,
        outcome="success",
        details=details,
    ))


def supplier_request_id(request: Request) -> str:
    import uuid
    return request.headers.get("X-Request-ID") or str(uuid.uuid4())


def supplier_result(supplier):
    return {
        "id": supplier.id,
        "name": supplier.name,
        "email": supplier.email,
        "phone": supplier.phone,
        "is_active": supplier.is_active,
        "lead_time_days": supplier.lead_time_days,
        "on_time_delivery_rate": supplier.on_time_delivery_rate,
        "product_coverage": [],
    }


@router.post("", status_code=status.HTTP_201_CREATED)
def create_supplier(
    payload: SupplierCreate,
    request: Request,
    response: Response,
    actor: Annotated[Actor, Depends(require_permission("suppliers:write"))],
    db: DbSession,
):
    request_id = supplier_request_id(request)
    supplier = Supplier(tenant_id=actor.tenant_id, **payload.model_dump())
    try:
        db.add(supplier)
        db.flush()
        supplier_audit(
            db, actor, request_id, "supplier.create",
            supplier.id, "Supplier created",
        )
        db.commit()
        db.refresh(supplier)
        response.headers["X-Request-ID"] = request_id
        return supplier_result(supplier)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Supplier conflicts with existing data") from None


@router.patch("/{supplier_id}")
def update_supplier(
    supplier_id: int,
    payload: SupplierUpdate,
    request: Request,
    response: Response,
    actor: Annotated[Actor, Depends(require_permission("suppliers:write"))],
    db: DbSession,
):
    request_id = supplier_request_id(request)
    supplier = db.scalar(select(Supplier).where(
        Supplier.id == supplier_id,
        Supplier.tenant_id == actor.tenant_id,
    ))
    if supplier is None:
        raise HTTPException(status_code=404, detail="Supplier not found")

    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=422, detail="Provide at least one field to update")
    if any(value is None for key, value in changes.items()
           if key in {"name", "lead_time_days", "on_time_delivery_rate", "is_active"}):
        raise HTTPException(status_code=422, detail="Required fields cannot be null")

    for key, value in changes.items():
        setattr(supplier, key, value)

    supplier_audit(
        db, actor, request_id, "supplier.update",
        supplier.id, "Updated fields: " + ", ".join(sorted(changes)),
    )
    db.commit()
    db.refresh(supplier)
    response.headers["X-Request-ID"] = request_id
    return supplier_result(supplier)


@router.delete("/{supplier_id}")
def delete_supplier(
    supplier_id: int,
    request: Request,
    response: Response,
    actor: Annotated[Actor, Depends(require_permission("suppliers:write"))],
    db: DbSession,
):
    request_id = supplier_request_id(request)
    supplier = db.scalar(select(Supplier).where(
        Supplier.id == supplier_id,
        Supplier.tenant_id == actor.tenant_id,
    ))
    if supplier is None:
        raise HTTPException(status_code=404, detail="Supplier not found")

    has_order = db.scalar(select(PurchaseOrder.id).where(
        PurchaseOrder.supplier_id == supplier.id,
        PurchaseOrder.tenant_id == actor.tenant_id,
    ).limit(1))

    has_product_link = db.scalar(select(SupplierProduct.id).where(
        SupplierProduct.supplier_id == supplier.id,
        SupplierProduct.tenant_id == actor.tenant_id,
    ).limit(1))

    if has_order is not None or has_product_link is not None:
        supplier.is_active = False
        outcome = "deactivated"
        details = "Deactivated to preserve linked records"
    else:
        db.delete(supplier)
        outcome = "deleted"
        details = "Supplier deleted"

    supplier_audit(
        db, actor, request_id, "supplier.delete",
        supplier_id, details,
    )
    db.commit()
    response.headers["X-Request-ID"] = request_id
    return {"id": supplier_id, "outcome": outcome, "detail": details}
