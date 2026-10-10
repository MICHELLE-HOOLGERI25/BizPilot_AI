import hashlib
import json
import secrets
from datetime import timedelta
from typing import Annotated
from uuid import uuid4

from fastapi import (
    APIRouter,
    Depends,
    Header,
    HTTPException,
    Query,
    Request,
    status,
)
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import Actor, require_permission
from app.db.models import (
    ActionConfirmation,
    AuditLog,
    IdempotencyRecord,
    Product,
    PurchaseOrder,
    PurchaseOrderItem,
    Store,
    Supplier,
    SupplierProduct,
    utc_now,
)
from app.db.session import SessionLocal
from app.schemas.purchase_orders import (
    PurchaseOrderCreate,
    PurchaseOrderItemResponse,
    PurchaseOrderListResponse,
    PurchaseOrderResponse,
)

router = APIRouter(
    prefix="/api/v1/purchase-orders",
    tags=["purchase orders"],
)

CREATE_OPERATION = "purchase_orders:create"
READ_PERMISSION = "purchase_orders:read"


class ConfirmationResponse(BaseModel):
    confirmation_token: str
    expires_at: object
    payload_hash: str


def get_db():
    with SessionLocal() as session:
        yield session


def canonical_payload(payload: PurchaseOrderCreate) -> str:
    data = payload.model_dump(mode="json")
    data["store_code"] = data["store_code"].strip().upper()

    normalized_items = []
    for item in data["items"]:
        normalized_items.append(
            {
                **item,
                "sku": item["sku"].strip().upper(),
            }
        )

    data["items"] = sorted(
        normalized_items,
        key=lambda item: item["sku"],
    )

    return json.dumps(
        data,
        sort_keys=True,
        separators=(",", ":"),
    )


def hash_payload(payload: PurchaseOrderCreate) -> str:
    return hashlib.sha256(
        canonical_payload(payload).encode()
    ).hexdigest()


def hash_secret(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def request_id_for(request: Request) -> str:
    supplied = request.headers.get("X-Request-ID", "").strip()

    if (
        supplied
        and len(supplied) <= 100
        and all(char.isalnum() or char in "-_." for char in supplied)
    ):
        return supplied

    return str(uuid4())


def write_audit(
    db: Session,
    *,
    actor: Actor,
    request_id: str,
    action: str,
    outcome: str,
    entity_id: str | None = None,
    details: dict | None = None,
) -> None:
    db.add(
        AuditLog(
            actor_id=actor.actor_id,
            tenant_id=actor.tenant_id,
            request_id=request_id,
            action=action,
            entity_type="purchase_order",
            entity_id=entity_id,
            outcome=outcome,
            details=(
                json.dumps(details, sort_keys=True, default=str)
                if details
                else None
            ),
        )
    )


def serialize_purchase_order(
    order: PurchaseOrder,
    supplier_name: str,
    store_code: str,
    products_by_id: dict[int, Product],
) -> PurchaseOrderResponse:
    items = []

    for item in order.items:
        product = products_by_id.get(item.product_id)

        if product is None:
            raise HTTPException(
                status_code=500,
                detail="Purchase order references a missing product",
            )

        items.append(
            PurchaseOrderItemResponse(
                product_id=product.id,
                sku=product.sku,
                product_name=product.name,
                quantity=item.quantity,
                unit_cost=item.unit_cost,
            )
        )

    return PurchaseOrderResponse(
        id=order.id,
        order_number=order.order_number,
        supplier_id=order.supplier_id,
        supplier_name=supplier_name,
        store_id=order.store_id,
        store_code=store_code,
        status=order.status,
        created_at=order.created_at,
        items=items,
    )


def load_purchase_order(
    db: Session,
    order_id: int,
    tenant_id: str,
) -> PurchaseOrderResponse:
    order = db.scalar(
        select(PurchaseOrder).where(
            PurchaseOrder.id == order_id,
            PurchaseOrder.tenant_id == tenant_id,
        )
    )

    if order is None:
        raise HTTPException(
            status_code=404,
            detail="Purchase order not found",
        )

    supplier = db.scalar(
        select(Supplier).where(
            Supplier.id == order.supplier_id,
            Supplier.tenant_id == tenant_id,
        )
    )

    store = db.scalar(
        select(Store).where(
            Store.id == order.store_id,
            Store.tenant_id == tenant_id,
        )
    )

    if supplier is None or store is None:
        raise HTTPException(
            status_code=500,
            detail="Invalid purchase order data",
        )

    order_items = [
        item
        for item in order.items
        if item.tenant_id == tenant_id
    ]

    product_ids = [item.product_id for item in order_items]
    products_by_id = {}

    if product_ids:
        products_by_id = {
            product.id: product
            for product in db.scalars(
                select(Product).where(
                    Product.id.in_(product_ids),
                    Product.tenant_id == tenant_id,
                )
            ).all()
        }

    # Serialize only items belonging to the current tenant.
    original_items = order.items

    try:
        order.items = order_items
        return serialize_purchase_order(
            order=order,
            supplier_name=supplier.name,
            store_code=store.code,
            products_by_id=products_by_id,
        )
    finally:
        order.items = original_items


def validate_and_prepare_items(
    db: Session,
    payload: PurchaseOrderCreate,
    tenant_id: str,
) -> tuple[Supplier, Store, list[dict]]:
    skus = [
        item.sku.strip().upper()
        for item in payload.items
    ]

    if not skus:
        raise HTTPException(
            status_code=422,
            detail="At least one item is required",
        )

    if len(skus) != len(set(skus)):
        raise HTTPException(
            status_code=422,
            detail="Each SKU may appear only once in a purchase order",
        )

    supplier = db.scalar(
        select(Supplier).where(
            Supplier.id == payload.supplier_id,
            Supplier.tenant_id == tenant_id,
            Supplier.is_active.is_(True),
        )
    )

    if supplier is None:
        raise HTTPException(
            status_code=422,
            detail="Supplier does not exist or is inactive",
        )

    store = db.scalar(
        select(Store).where(
            Store.code == payload.store_code.strip().upper(),
            Store.tenant_id == tenant_id,
        )
    )

    if store is None:
        raise HTTPException(
            status_code=422,
            detail="Store code not found",
        )

    products = db.scalars(
        select(Product).where(
            Product.sku.in_(skus),
            Product.tenant_id == tenant_id,
        )
    ).all()

    products_by_sku = {
        product.sku.upper(): product
        for product in products
    }

    missing_skus = sorted(set(skus) - set(products_by_sku))

    if missing_skus:
        raise HTTPException(
            status_code=422,
            detail={
                "message": "One or more products were not found",
                "skus": missing_skus,
            },
        )

    prepared_items = []

    for requested_item in payload.items:
        sku = requested_item.sku.strip().upper()
        product = products_by_sku[sku]

        if not product.is_active:
            raise HTTPException(
                status_code=422,
                detail=f"Product {sku} is inactive",
            )

        supplier_link = db.scalar(
            select(SupplierProduct).where(
                SupplierProduct.supplier_id == supplier.id,
                SupplierProduct.product_id == product.id,
                SupplierProduct.tenant_id == tenant_id,
            )
        )

        if supplier_link is None:
            raise HTTPException(
                status_code=422,
                detail=(
                    f"Supplier {supplier.name} "
                    f"does not supply product {sku}"
                ),
            )

        prepared_items.append(
            {
                "product": product,
                "quantity": requested_item.quantity,
                "unit_cost": supplier_link.unit_cost,
            }
        )

    return supplier, store, prepared_items


@router.post(
    "/confirmations",
    response_model=ConfirmationResponse,
    status_code=status.HTTP_201_CREATED,
)
def issue_purchase_order_confirmation(
    payload: PurchaseOrderCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor: Actor = Depends(require_permission(CREATE_OPERATION)),
):
    request_id = request_id_for(request)
    digest = hash_payload(payload)

    try:
        # Validate all requested records within the actor's tenant.
        validate_and_prepare_items(
            db,
            payload,
            actor.tenant_id,
        )

        raw_token = secrets.token_urlsafe(32)
        expires_at = utc_now() + timedelta(
            seconds=settings.confirmation_ttl_seconds
        )

        db.add(
            ActionConfirmation(
                token_hash=hash_secret(raw_token),
                actor_id=actor.actor_id,
                tenant_id=actor.tenant_id,
                operation=CREATE_OPERATION,
                entity_type="purchase_order",
                payload_hash=digest,
                expected_version=None,
                expires_at=expires_at,
            )
        )

        write_audit(
            db,
            actor=actor,
            request_id=request_id,
            action="purchase_order.confirmation_issued",
            outcome="success",
            details={"payload_hash": digest},
        )

        db.commit()

        return ConfirmationResponse(
            confirmation_token=raw_token,
            expires_at=expires_at,
            payload_hash=digest,
        )

    except HTTPException:
        db.rollback()
        raise

    except Exception:
        db.rollback()
        raise


@router.post(
    "",
    response_model=PurchaseOrderResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_purchase_order(
    payload: PurchaseOrderCreate,
    request: Request,
    idempotency_key: Annotated[
        str,
        Header(alias="Idempotency-Key", min_length=8, max_length=200),
    ],
    confirmation_token: Annotated[
        str,
        Header(alias="X-Confirmation-Token", min_length=20, max_length=200),
    ],
    db: Session = Depends(get_db),
    actor: Actor = Depends(require_permission(CREATE_OPERATION)),
):
    request_id = request_id_for(request)
    digest = hash_payload(payload)

    try:
        # Serialize concurrent requests using a transaction-scoped lock.
        lock_value = int(
            hashlib.sha256(
                (
                    f"{actor.tenant_id}:{actor.actor_id}:"
                    f"{CREATE_OPERATION}:{idempotency_key}"
                ).encode()
            ).hexdigest()[:15],
            16,
        )

        db.connection().exec_driver_sql(
            "SELECT pg_advisory_xact_lock(%s)",
            (lock_value,),
        )

        existing = db.scalar(
            select(IdempotencyRecord).where(
                IdempotencyRecord.tenant_id == actor.tenant_id,
                IdempotencyRecord.actor_id == actor.actor_id,
                IdempotencyRecord.operation == CREATE_OPERATION,
                IdempotencyRecord.idempotency_key == idempotency_key,
            )
        )

        # Completed requests can be replayed with the same key and payload.
        if existing is not None:
            if existing.payload_hash != digest:
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "Idempotency key was used "
                        "with a different payload"
                    ),
                )

            if existing.response_body:
                saved = json.loads(existing.response_body)
                db.commit()
                return JSONResponse(
                    status_code=200,
                    content=saved,
                )

            raise HTTPException(
                status_code=409,
                detail="Request with this idempotency key is incomplete",
            )

        confirmation = db.scalar(
            select(ActionConfirmation)
            .where(
                ActionConfirmation.token_hash
                == hash_secret(confirmation_token)
            )
            .with_for_update()
        )

        if confirmation is None:
            raise HTTPException(
                status_code=403,
                detail="Invalid confirmation token",
            )

        if (
            confirmation.actor_id != actor.actor_id
            or confirmation.tenant_id != actor.tenant_id
            or confirmation.operation != CREATE_OPERATION
            or confirmation.entity_type != "purchase_order"
            or confirmation.payload_hash != digest
        ):
            write_audit(
                db,
                actor=actor,
                request_id=request_id,
                action="purchase_order.create",
                outcome="denied",
                details={"reason": "confirmation_binding_mismatch"},
            )
            db.commit()

            raise HTTPException(
                status_code=403,
                detail=(
                    "Confirmation does not match actor, tenant, or payload"
                ),
            )

        now = utc_now()

        if confirmation.expires_at <= now:
            write_audit(
                db,
                actor=actor,
                request_id=request_id,
                action="purchase_order.confirmation_expired",
                outcome="denied",
            )
            db.commit()

            raise HTTPException(
                status_code=403,
                detail="Confirmation token expired",
            )

        if confirmation.consumed_at is not None:
            write_audit(
                db,
                actor=actor,
                request_id=request_id,
                action="purchase_order.confirmation_replayed",
                outcome="denied",
            )
            db.commit()

            raise HTTPException(
                status_code=409,
                detail="Confirmation token already used",
            )

        # FIX: pass the tenant ID required by the validation helper.
        supplier, store, prepared_items = validate_and_prepare_items(
            db,
            payload,
            actor.tenant_id,
        )

        order = PurchaseOrder(
            order_number=f"PO-{uuid4().hex[:12].upper()}",
            tenant_id=actor.tenant_id,
            supplier_id=supplier.id,
            store_id=store.id,
            status="draft",
        )

        for prepared in prepared_items:
            order.items.append(
                PurchaseOrderItem(
                    tenant_id=actor.tenant_id,
                    product_id=prepared["product"].id,
                    quantity=prepared["quantity"],
                    unit_cost=prepared["unit_cost"],
                )
            )

        confirmation.consumed_at = now

        db.add(order)
        db.flush()

        result = load_purchase_order(
            db,
            order.id,
            actor.tenant_id,
        )

        response_body = result.model_dump_json()

        db.add(
            IdempotencyRecord(
                tenant_id=actor.tenant_id,
                actor_id=actor.actor_id,
                operation=CREATE_OPERATION,
                idempotency_key=idempotency_key,
                payload_hash=digest,
                response_status=201,
                response_body=response_body,
            )
        )

        write_audit(
            db,
            actor=actor,
            request_id=request_id,
            action="purchase_order.create",
            outcome="success",
            entity_id=str(order.id),
            details={"order_number": order.order_number},
        )

        # Commit the order, confirmation, idempotency record, and audit
        # entry together.
        db.commit()

        return result

    except HTTPException:
        if db.in_transaction():
            db.rollback()
        raise

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail=(
                "Concurrent request conflict; "
                "retry with a new idempotency key"
            ),
        ) from None

    except Exception:
        db.rollback()
        raise


@router.get(
    "",
    response_model=PurchaseOrderListResponse,
)
def list_purchase_orders(
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    actor: Actor = Depends(require_permission(READ_PERMISSION)),
):
    total = (
        db.scalar(
            select(func.count())
            .select_from(PurchaseOrder)
            .where(
                PurchaseOrder.tenant_id == actor.tenant_id,
            )
        )
        or 0
    )

    orders = db.scalars(
        select(PurchaseOrder)
        .where(
            PurchaseOrder.tenant_id == actor.tenant_id,
        )
        .order_by(
            PurchaseOrder.created_at.desc(),
            PurchaseOrder.id.desc(),
        )
        .offset(offset)
        .limit(limit)
    ).all()

    data = [
        load_purchase_order(
            db,
            order.id,
            actor.tenant_id,
        )
        for order in orders
    ]

    return PurchaseOrderListResponse(
        data=data,
        total=total,
    )


@router.get(
    "/{order_id}",
    response_model=PurchaseOrderResponse,
)
def get_purchase_order(
    order_id: int,
    db: Session = Depends(get_db),
    actor: Actor = Depends(require_permission(READ_PERMISSION)),
):
    return load_purchase_order(
        db,
        order_id,
        actor.tenant_id,
    )