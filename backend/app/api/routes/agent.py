
import base64
import hashlib
import hmac
import json
import time
from typing import Annotated
from fastapi.responses import JSONResponse

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.db.models import IdempotencyRecord

from app.agent.graph import run_host_agent
from app.agent.schemas import AgentRequest
from app.api.routes.inventory import (
    DbSession,
    InventoryReader,
    replenishment_recommendations,
)
from app.api.routes.purchase_orders import (
    create_purchase_order,
    get_db,
    get_purchase_order,
    hash_payload,
    issue_purchase_order_confirmation,
)
from app.core.config import settings
from app.core.security import Actor, require_permission
from app.db.session import SessionLocal
from app.schemas.purchase_orders import (
    PurchaseOrderCreate,
    PurchaseOrderResponse,
)

router = APIRouter(prefix="/api/v1/agent", tags=["host agent"])


class AgentPurchaseOrderConfirmation(BaseModel):
    confirmed: bool
    proposal_token: str = Field(min_length=20, max_length=2000)
    purchase_order: PurchaseOrderCreate


def _proposal_secret() -> bytes:
    secret = settings.auth_token_secret
    if secret is None or len(secret.get_secret_value()) < 32:
        raise HTTPException(
            status_code=503,
            detail=(
                "Proposal signing is not configured. "
                "Set AUTH_TOKEN_SECRET to a secret of at least 32 characters."
            ),
        )
    return secret.get_secret_value().encode()


def _encode_segment(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode().rstrip("=")


def _decode_segment(value: str) -> bytes:
    return base64.urlsafe_b64decode(
        value + ("=" * (-len(value) % 4))
    )


def _create_proposal_token(
    payload: PurchaseOrderCreate,
    actor: Actor,
) -> str:
    claims = {
        "actor_id": actor.actor_id,
        "tenant_id": actor.tenant_id,
        "payload_hash": hash_payload(payload),
        "expires_at": int(time.time()) + settings.confirmation_ttl_seconds,
    }
    body = _encode_segment(
        json.dumps(
            claims,
            separators=(",", ":"),
            sort_keys=True,
        ).encode()
    )
    signature = hmac.new(
        _proposal_secret(),
        body.encode(),
        hashlib.sha256,
    ).digest()

    return f"{body}.{_encode_segment(signature)}"


def _validate_proposal_token(
    token: str,
    payload: PurchaseOrderCreate,
    actor: Actor,
) -> None:
    try:
        body, encoded_signature = token.split(".", maxsplit=1)
        supplied_signature = _decode_segment(encoded_signature)
        expected_signature = hmac.new(
            _proposal_secret(),
            body.encode(),
            hashlib.sha256,
        ).digest()

        if not hmac.compare_digest(supplied_signature, expected_signature):
            raise HTTPException(
                status_code=403,
                detail="Invalid proposal reference.",
            )

        claims = json.loads(_decode_segment(body))

        if int(claims["expires_at"]) <= int(time.time()):
            raise HTTPException(
                status_code=403,
                detail="Proposal reference expired. Generate a new proposal.",
            )

        if (
            claims["actor_id"] != actor.actor_id
            or claims["tenant_id"] != actor.tenant_id
            or claims["payload_hash"] != hash_payload(payload)
        ):
            raise HTTPException(
                status_code=403,
                detail="Proposal does not match the actor, tenant, or order payload.",
            )

    except HTTPException:
        raise
    except (
        ValueError,
        TypeError,
        KeyError,
        json.JSONDecodeError,
    ):
        raise HTTPException(
            status_code=403,
            detail="Invalid proposal reference.",
        )


@router.post("/run")
def run_agent(
    payload: AgentRequest,
    db: DbSession,
    actor: InventoryReader,
):
    def get_recommendations(max_days_of_cover: float):
        return replenishment_recommendations(
            db=db,
            actor=actor,
            max_days_of_cover=max_days_of_cover,
            demand_window_days=30,
            safety_stock_days=3,
        )

    result = run_host_agent(
        payload.request,
        recommendations_provider=get_recommendations,
    )
    return result.model_dump()


@router.post("/propose-purchase-orders")
def propose_purchase_orders(
    db: DbSession,
    actor: InventoryReader,
    max_days_of_cover: float = 7.0,
):
    if not 0 < max_days_of_cover <= 365:
        raise HTTPException(
            status_code=422,
            detail="max_days_of_cover must be greater than 0 and at most 365.",
        )

    recommendations = replenishment_recommendations(
        db=db,
        actor=actor,
        max_days_of_cover=max_days_of_cover,
        demand_window_days=30,
        safety_stock_days=3,
    )

    grouped = {}

    for row in recommendations.get("data", []):
        if (
            row.get("demand_status") != "calculated"
            or not row.get("supplier_available")
            or row.get("supplier_id") is None
            or not row.get("store_code")
            or not row.get("sku")
        ):
            continue

        quantity = row.get("suggested_qty")
        if (
            not isinstance(quantity, int)
            or isinstance(quantity, bool)
            or quantity <= 0
        ):
            continue

        supplier_id = row["supplier_id"]
        store_code = row["store_code"].strip().upper()
        sku = row["sku"].strip().upper()
        key = (supplier_id, store_code)

        proposal = grouped.setdefault(
            key,
            {
                "supplier_id": supplier_id,
                "supplier_name": row.get("supplier_name"),
                "store_code": store_code,
                "items": {},
            },
        )
        proposal["items"][sku] = proposal["items"].get(sku, 0) + quantity

    proposals = []

    for proposal in grouped.values():
        items = [
            {"sku": sku, "quantity": quantity}
            for sku, quantity in sorted(proposal["items"].items())
        ]

        order_payload = PurchaseOrderCreate(
            supplier_id=proposal["supplier_id"],
            store_code=proposal["store_code"],
            items=items,
        )

        proposals.append(
            {
                "supplier_id": proposal["supplier_id"],
                "supplier_name": proposal["supplier_name"],
                "store_code": proposal["store_code"],
                "item_count": len(items),
                "purchase_order": order_payload.model_dump(),
                "proposal_token": _create_proposal_token(
                    order_payload,
                    actor,
                ),
            }
        )

    proposals.sort(
        key=lambda item: (
            item["supplier_id"],
            item["store_code"],
        )
    )

    return {
        "status": "proposed",
        "creates_purchase_orders": False,
        "max_days_of_cover": max_days_of_cover,
        "proposal_count": len(proposals),
        "proposals": proposals,
    }


@router.post(
    "/confirm-purchase-order",
    response_model=PurchaseOrderResponse,
)
def confirm_agent_purchase_order(
    payload: AgentPurchaseOrderConfirmation,
    request: Request,
    idempotency_key: Annotated[
        str,
        Header(alias="Idempotency-Key", min_length=8, max_length=200),
    ],
    db: Session = Depends(get_db),
    actor: Actor = Depends(require_permission("purchase_orders:create")),
):
    if not payload.confirmed:
        raise HTTPException(
            status_code=400,
            detail="Explicit confirmation is required.",
        )

    order_payload = payload.purchase_order

    _validate_proposal_token(
        payload.proposal_token,
        order_payload,
        actor,
    )

        # Reuse a completed operation before issuing another confirmation.
    existing = db.scalar(
        select(IdempotencyRecord).where(
            IdempotencyRecord.tenant_id == actor.tenant_id,
            IdempotencyRecord.actor_id == actor.actor_id,
            IdempotencyRecord.operation == "purchase_orders:create",
            IdempotencyRecord.idempotency_key == idempotency_key,
        )
    )

    if existing is not None:
        if existing.payload_hash != hash_payload(order_payload):
            raise HTTPException(
                status_code=409,
                detail="Idempotency key was used with a different payload.",
            )

        if not existing.response_body:
            raise HTTPException(
                status_code=409,
                detail="Request with this idempotency key is incomplete.",
            )

        try:
            previous = json.loads(existing.response_body)
            existing_id = int(previous["id"])
            existing_order_number = previous["order_number"]
        except (ValueError, TypeError, KeyError, json.JSONDecodeError):
            raise HTTPException(
                status_code=500,
                detail="Stored idempotency response was invalid.",
            )

        with SessionLocal() as verify_db:
            verified_order = get_purchase_order(
                order_id=existing_id,
                db=verify_db,
                actor=actor,
            )

        expected_items = sorted(
            (item.sku.strip().upper(), item.quantity)
            for item in order_payload.items
        )
        actual_items = sorted(
            (item.sku.strip().upper(), item.quantity)
            for item in verified_order.items
        )

        if (
            verified_order.id != existing_id
            or verified_order.order_number != existing_order_number
            or verified_order.status != "draft"
            or verified_order.supplier_id != order_payload.supplier_id
            or verified_order.store_code != order_payload.store_code.strip().upper()
            or actual_items != expected_items
        ):
            raise HTTPException(
                status_code=500,
                detail="Purchase order replay verification failed.",
            )

        return verified_order

    confirmation = issue_purchase_order_confirmation(
        payload=order_payload,
        request=request,
        db=db,
        actor=actor,
    )


    created = create_purchase_order(
        payload=order_payload,
        request=request,
        idempotency_key=idempotency_key,
        confirmation_token=confirmation.confirmation_token,
        db=db,
        actor=actor,
    )

    # Normalize a fresh creation and an idempotent replay.
    if isinstance(created, JSONResponse):
        try:
            created_data = json.loads(created.body)
            created_id = int(created_data["id"])
            created_order_number = created_data["order_number"]
        except (ValueError, TypeError, KeyError, json.JSONDecodeError):
            raise HTTPException(
                status_code=500,
                detail="Purchase order replay response was invalid.",
            )
    else:
        created_id = created.id
        created_order_number = created.order_number

    with SessionLocal() as verify_db:
        verified_order = get_purchase_order(
            order_id=created_id,
            db=verify_db,
            actor=actor,
        )

    expected_items = sorted(
        (item.sku.strip().upper(), item.quantity)
        for item in order_payload.items
    )
    actual_items = sorted(
        (item.sku.strip().upper(), item.quantity)
        for item in verified_order.items
    )

    if (
        verified_order.id != created_id
        or verified_order.order_number != created_order_number
        or verified_order.status != "draft"
        or verified_order.supplier_id != order_payload.supplier_id
        or verified_order.store_code != order_payload.store_code.strip().upper()
        or actual_items != expected_items
    ):
        raise HTTPException(
            status_code=500,
            detail="Purchase order read-back verification failed.",
        )

    return verified_order
