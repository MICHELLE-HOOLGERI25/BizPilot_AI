from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import case, cast, func, Numeric, select
from sqlalchemy.orm import Session

from app.core.security import Actor, require_permission
from app.db.models import SalesItem, SalesOrder, Store
from app.db.session import SessionLocal

router = APIRouter(
    prefix="/api/v1/sales",
    tags=["sales"],
)


def get_db():
    with SessionLocal() as session:
        yield session


DbSession = Annotated[Session, Depends(get_db)]
SalesReader = Annotated[
    Actor,
    Depends(require_permission("sales:read")),
]


def net_line_revenue_expression():
    """
    Calculate revenue after returns and discounts.

    discount_amount is treated as the total discount for the original
    line. When units are returned, the discount is prorated across the
    units that remain sold.
    """
    net_units = SalesItem.quantity - SalesItem.returned_units

    retained_discount = case(
        (
            SalesItem.quantity > 0,
            SalesItem.discount_amount
            * cast(net_units, Numeric(12, 4))
            / cast(SalesItem.quantity, Numeric(12, 4)),
        ),
        else_=Decimal("0.00"),
    )

    return (
        cast(net_units, Numeric(12, 4)) * SalesItem.unit_price
        - retained_discount
    )


@router.get("/summary")
def sales_summary(
    actor: SalesReader,
    db: DbSession,
    days: int = Query(default=30, ge=1, le=365),
    store_code: str | None = Query(
        default=None,
        min_length=1,
        max_length=20,
    ),
):
    now = datetime.now(timezone.utc)
    start = now - timedelta(days=days)
    tenant_id = actor.tenant_id

    query = (
        select(
            func.count(
                func.distinct(SalesOrder.id)
            ).label("order_count"),
            func.coalesce(
                func.sum(
                    SalesItem.quantity - SalesItem.returned_units
                ),
                0,
            ).label("net_units_sold"),
            func.coalesce(
                func.sum(net_line_revenue_expression()),
                Decimal("0.00"),
            ).label("net_revenue"),
            func.coalesce(
                func.sum(SalesItem.returned_units),
                0,
            ).label("returned_units"),
        )
        .select_from(SalesOrder)
        .join(
            SalesItem,
            SalesItem.sales_order_id == SalesOrder.id,
        )
        .where(
            SalesOrder.tenant_id == tenant_id,
            SalesItem.tenant_id == tenant_id,
            SalesOrder.status == "completed",
            SalesOrder.sold_at >= start,
            SalesOrder.sold_at <= now,
        )
    )

    normalized_store_code = (
        store_code.strip().upper() if store_code else None
    )

    if normalized_store_code:
        query = (
            query.join(
                Store,
                Store.id == SalesOrder.store_id,
            )
            .where(
                Store.tenant_id == tenant_id,
                Store.code == normalized_store_code,
            )
        )

    row = db.execute(query).one()

    return {
        "data_mode": "synthetic_demo",
        "window_days": days,
        "start_date": start.isoformat(),
        "end_date": now.isoformat(),
        "store_code": normalized_store_code,
        "completed_order_count": int(row.order_count or 0),
        "net_units_sold": int(row.net_units_sold or 0),
        "net_revenue": str(
            Decimal(str(row.net_revenue or 0)).quantize(
                Decimal("0.01")
            )
        ),
        "returned_units": int(row.returned_units or 0),
    }