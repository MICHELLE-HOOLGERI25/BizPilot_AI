from datetime import datetime, timedelta, timezone
from math import ceil
import json
import re
from uuid import uuid4
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy import func, select
from pydantic import BaseModel, Field, model_validator
from sqlalchemy.orm import Session

from app.core.security import Actor, require_permission
from app.db.models import (
    Inventory,
    AuditLog,
    StockMovement,
    Product,
    Store,
    Supplier,
    SupplierProduct,
    SalesOrder,
    SalesItem,
    PurchaseOrder,
    PurchaseOrderItem,
)
from app.db.session import SessionLocal

router = APIRouter(tags=["inventory and replenishment"])

DEFAULT_DEMAND_WINDOW_DAYS = 30
DEFAULT_SAFETY_STOCK_DAYS = 3
INCOMING_PO_STATUSES = ("confirmed", "ordered", "in_transit")


def get_db():
    with SessionLocal() as session:
        yield session


DbSession = Annotated[Session, Depends(get_db)]
InventoryReader = Annotated[
    Actor,
    Depends(require_permission("inventory:read")),
]


def get_inventory_rows(db: Session, tenant_id: str):
    return db.execute(
        select(Inventory, Product, Store)
        .join(Product, Inventory.product_id == Product.id)
        .join(Store, Inventory.store_id == Store.id)
        .where(
            Inventory.tenant_id == tenant_id,
            Product.tenant_id == tenant_id,
            Store.tenant_id == tenant_id,
        )
        .order_by(Store.name, Product.sku)
    ).all()


@router.get("/api/v1/inventory")
def list_inventory(
    db: DbSession,
    actor: InventoryReader,
    sku: str | None = Query(default=None, max_length=50),
    store: str | None = Query(default=None, max_length=150),
    low_stock_only: bool = False,
):
    rows = get_inventory_rows(db, actor.tenant_id)
    results = []

    for inventory, product, store_record in rows:
        if sku and product.sku.lower() != sku.strip().lower():
            continue

        if store and store_record.name.lower() != store.strip().lower():
            continue

        available = inventory.on_hand - inventory.reserved
        is_low_stock = available <= inventory.reorder_point

        if low_stock_only and not is_low_stock:
            continue

        results.append(
            {
                "inventory_id": inventory.id,
                "sku": product.sku,
                "product_name": product.name,
                "store_code": store_record.code,
                "store_name": store_record.name,
                "on_hand": inventory.on_hand,
                "reserved": inventory.reserved,
                "available_qty": available,
                "reorder_point": inventory.reorder_point,
                "is_low_stock": is_low_stock,
                "version": inventory.version,
            }
        )

    return {"data": results, "total": len(results)}


@router.get("/api/v1/replenishment/recommendations")
def replenishment_recommendations(
    db: DbSession,
    actor: InventoryReader,
    max_days_of_cover: float = Query(default=7, gt=0, le=365),
    demand_window_days: int = Query(
        default=DEFAULT_DEMAND_WINDOW_DAYS, ge=7, le=365
    ),
    safety_stock_days: int = Query(
        default=DEFAULT_SAFETY_STOCK_DAYS, ge=0, le=90
    ),
):
    tenant_id = actor.tenant_id
    rows = get_inventory_rows(db, tenant_id)
    recommendations = []

    window_start = datetime.now(timezone.utc) - timedelta(
        days=demand_window_days
    )

    for inventory, product, store_record in rows:
        available = inventory.on_hand - inventory.reserved

        # Completed sales for this tenant, store, and product.
        net_units_sold = db.execute(
            select(
                func.coalesce(
                    func.sum(SalesItem.quantity - SalesItem.returned_units),
                    0,
                )
            )
            .join(
                SalesOrder,
                SalesItem.sales_order_id == SalesOrder.id,
            )
            .where(
                SalesItem.tenant_id == tenant_id,
                SalesOrder.tenant_id == tenant_id,
                SalesItem.product_id == product.id,
                SalesOrder.store_id == store_record.id,
                SalesOrder.status == "completed",
                SalesOrder.sold_at >= window_start,
            )
        ).scalar_one()

        net_units_sold = int(net_units_sold)

        demand = (
            net_units_sold / demand_window_days
            if net_units_sold > 0
            else None
        )

        days_of_cover = (
            available / demand
            if demand is not None and demand > 0
            else None
        )

        # Incoming purchase orders for this tenant, store, and product.
        inbound_qty = db.execute(
            select(
                func.coalesce(func.sum(PurchaseOrderItem.quantity), 0)
            )
            .join(
                PurchaseOrder,
                PurchaseOrderItem.purchase_order_id == PurchaseOrder.id,
            )
            .where(
                PurchaseOrderItem.tenant_id == tenant_id,
                PurchaseOrder.tenant_id == tenant_id,
                PurchaseOrderItem.product_id == product.id,
                PurchaseOrder.store_id == store_record.id,
                func.lower(PurchaseOrder.status).in_(
                    INCOMING_PO_STATUSES
                ),
            )
        ).scalar_one()

        inbound_qty = int(inbound_qty)

        # Only consider suppliers and supplier-product links in this tenant.
        supplier_rows = db.execute(
            select(Supplier, SupplierProduct)
            .join(
                SupplierProduct,
                SupplierProduct.supplier_id == Supplier.id,
            )
            .where(
                Supplier.tenant_id == tenant_id,
                SupplierProduct.tenant_id == tenant_id,
                SupplierProduct.product_id == product.id,
                Supplier.is_active.is_(True),
            )
            .order_by(
                Supplier.on_time_delivery_rate.desc(),
                Supplier.lead_time_days.asc(),
                Supplier.id.asc(),
            )
        ).all()

        supplier = supplier_rows[0][0] if supplier_rows else None
        lead_time = supplier.lead_time_days if supplier else None

        needs_reorder = (
            available <= inventory.reorder_point
            or (
                days_of_cover is not None
                and days_of_cover <= max_days_of_cover
            )
        )

        if not needs_reorder:
            continue

        if demand is None:
            target_stock = None
            suggested_qty = None
            demand_status = "insufficient_sales_history"
        elif supplier is None:
            target_stock = None
            suggested_qty = None
            demand_status = "no_active_supplier"
        else:
            target_stock = ceil(
                demand * (lead_time + safety_stock_days)
            )
            suggested_qty = max(
                0,
                target_stock - available - inbound_qty,
            )
            demand_status = "calculated"

        recommendations.append(
            {
                "sku": product.sku,
                "product_name": product.name,
                "store_code": store_record.code,
                "store_name": store_record.name,
                "available_qty": available,
                "daily_demand": (
                    round(demand, 4) if demand is not None else None
                ),
                "days_of_cover": (
                    round(days_of_cover, 2)
                    if days_of_cover is not None
                    else None
                ),
                "demand_status": demand_status,
                "demand_window_days": demand_window_days,
                "net_units_sold": net_units_sold,
                "confirmed_inbound_qty": inbound_qty,
                "lead_time_days": lead_time,
                "safety_stock_days": safety_stock_days,
                "target_stock": target_stock,
                "suggested_qty": suggested_qty,
                "supplier_id": supplier.id if supplier else None,
                "supplier_name": supplier.name if supplier else None,
                "supplier_available": supplier is not None,
                "inventory_version": inventory.version,
            }
        )

    recommendations.sort(
        key=lambda item: (
            item["days_of_cover"] is None,
            (
                item["days_of_cover"]
                if item["days_of_cover"] is not None
                else float("inf")
            ),
            item["sku"],
        )
    )

    return {
        "data": recommendations,
        "total": len(recommendations),
        "max_days_of_cover": max_days_of_cover,
        "demand_window_days": demand_window_days,
        "safety_stock_days": safety_stock_days,
    }


class InventoryAdjustment(BaseModel):
    on_hand: int = Field(ge=0)
    reserved: int = Field(ge=0)
    reorder_point: int = Field(ge=0)
    expected_version: int = Field(ge=1)
    reason: str = Field(min_length=1, max_length=100)

    @model_validator(mode="after")
    def validate_reserved(self):
        if self.reserved > self.on_hand:
            raise ValueError("reserved cannot exceed on_hand")
        if not self.reason.strip():
            raise ValueError("reason cannot be empty")
        return self


@router.patch("/api/v1/inventory/{inventory_id}")
def adjust_inventory(
    inventory_id: int,
    payload: InventoryAdjustment,
    request: Request,
    response: Response,
    db: DbSession,
    actor: Annotated[Actor, Depends(require_permission("inventory:write"))],
):
    supplied_id = request.headers.get("X-Request-ID", "").strip()
    request_id = (
        supplied_id
        if supplied_id
        and len(supplied_id) <= 100
        and re.fullmatch(r"[A-Za-z0-9_.-]+", supplied_id)
        else str(uuid4())
    )
    response.headers["X-Request-ID"] = request_id

    try:
        row = db.scalar(
            select(Inventory)
            .where(
                Inventory.id == inventory_id,
                Inventory.tenant_id == actor.tenant_id,
            )
            .with_for_update()
        )

        if row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Inventory record not found",
            )

        if row.version != payload.expected_version:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "message": "Inventory changed since it was loaded. Refresh and try again.",
                    "current_version": row.version,
                },
            )

        old_on_hand = row.on_hand
        row.on_hand = payload.on_hand
        row.reserved = payload.reserved
        row.reorder_point = payload.reorder_point
        row.version += 1

        quantity_delta = payload.on_hand - old_on_hand
        if quantity_delta != 0:
            db.add(
                StockMovement(
                    tenant_id=actor.tenant_id,
                    inventory_id=row.id,
                    quantity_delta=quantity_delta,
                    reason=payload.reason.strip(),
                )
            )

        db.add(
            AuditLog(
                actor_id=actor.actor_id,
                tenant_id=actor.tenant_id,
                request_id=request_id,
                action="inventory.adjust",
                entity_type="inventory",
                entity_id=str(row.id),
                outcome="success",
                details=json.dumps(
                    {
                        "old_on_hand": old_on_hand,
                        "new_on_hand": row.on_hand,
                        "reserved": row.reserved,
                        "reorder_point": row.reorder_point,
                        "quantity_delta": quantity_delta,
                        "reason": payload.reason.strip(),
                        "version": row.version,
                    },
                    sort_keys=True,
                ),
            )
        )

        db.commit()
        db.refresh(row)

        return {
            "inventory_id": row.id,
            "on_hand": row.on_hand,
            "reserved": row.reserved,
            "available_qty": row.available_qty,
            "reorder_point": row.reorder_point,
            "version": row.version,
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise
