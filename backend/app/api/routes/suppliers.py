from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import Actor, require_permission
from app.db.models import Product, Supplier, SupplierProduct
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