import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from app.api.routes.purchase_orders import get_db
from app.db.models import (
    ActionConfirmation,
    IdempotencyRecord,
    PurchaseOrder,
    PurchaseOrderItem,
)
from app.db.session import SessionLocal
from app.main import app


DEMO_HEADERS = {
    "X-Demo-Actor-Id": "pytest-user",
    "X-Demo-Tenant-Id": "demo",
    "X-Demo-Role": "admin",
}

VALID_PAYLOAD = {
    "supplier_id": 1,
    "store_code": "VIE",
    "items": [
        {
            "sku": "VEL-201",
            "quantity": 4,
        }
    ],
}


def override_get_db():
    with SessionLocal() as session:
        yield session


@pytest.fixture
def client():
    """
    Use the real test database and remove stale records for this test actor.

    Old idempotency records can otherwise make a new test request look like
    a replay and return a previous response instead of creating an order.
    """

    with SessionLocal() as db:
        # Remove stale test idempotency records before this test starts.
        db.execute(
            delete(IdempotencyRecord).where(
                IdempotencyRecord.actor_id == "pytest-user",
                IdempotencyRecord.tenant_id == "demo",
                IdempotencyRecord.operation == "purchase_orders:create",
            )
        )

        # Remove stale test confirmations as well.
        db.execute(
            delete(ActionConfirmation).where(
                ActionConfirmation.actor_id == "pytest-user",
                ActionConfirmation.tenant_id == "demo",
            )
        )

        db.commit()

        # Snapshot existing purchase orders so teardown only removes
        # orders created during this test.
        existing_order_ids = set(
            db.scalars(select(PurchaseOrder.id)).all()
        )

    app.dependency_overrides[get_db] = override_get_db

    try:
        with TestClient(app, headers=DEMO_HEADERS) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.pop(get_db, None)

        with SessionLocal() as db:
            current_order_ids = set(
                db.scalars(select(PurchaseOrder.id)).all()
            )
            created_order_ids = current_order_ids - existing_order_ids

            if created_order_ids:
                db.execute(
                    delete(PurchaseOrderItem).where(
                        PurchaseOrderItem.purchase_order_id.in_(
                            created_order_ids
                        )
                    )
                )

                db.execute(
                    delete(PurchaseOrder).where(
                        PurchaseOrder.id.in_(created_order_ids)
                    )
                )

            # Clean up idempotency records and confirmations created by
            # this test actor so subsequent runs start cleanly.
            db.execute(
                delete(IdempotencyRecord).where(
                    IdempotencyRecord.actor_id == "pytest-user",
                    IdempotencyRecord.tenant_id == "demo",
                    IdempotencyRecord.operation == "purchase_orders:create",
                )
            )

            db.execute(
                delete(ActionConfirmation).where(
                    ActionConfirmation.actor_id == "pytest-user",
                    ActionConfirmation.tenant_id == "demo",
                )
            )

            db.commit()


def create_confirmed_purchase_order(
    client,
    payload,
    idempotency_key,
):
    confirmation_response = client.post(
        "/api/v1/purchase-orders/confirmations",
        json=payload,
    )

    assert confirmation_response.status_code == 201, (
        confirmation_response.text
    )

    confirmation_token = confirmation_response.json()[
        "confirmation_token"
    ]

    return client.post(
        "/api/v1/purchase-orders",
        json=payload,
        headers={
            "Idempotency-Key": idempotency_key,
            "X-Confirmation-Token": confirmation_token,
        },
    )


def test_create_purchase_order_and_read_back(client):
    response = create_confirmed_purchase_order(
        client,
        VALID_PAYLOAD,
        "pytest-create-po-0001",
    )

    assert response.status_code == 201, response.text

    created = response.json()

    assert created["id"] is not None
    assert created["status"] == "draft"
    assert created["store_code"] == "VIE"
    assert len(created["items"]) == 1
    assert created["items"][0]["sku"] == "VEL-201"
    assert created["items"][0]["quantity"] == 4

    read_response = client.get(
        f"/api/v1/purchase-orders/{created['id']}"
    )

    assert read_response.status_code == 200, read_response.text
    assert read_response.json()["id"] == created["id"]


def test_list_purchase_orders(client):
    response = client.get("/api/v1/purchase-orders")

    assert response.status_code == 200, response.text

    body = response.json()
    assert "data" in body
    assert "total" in body


def test_reject_supplier_without_product_coverage(client):
    payload = {
        "supplier_id": 2,
        "store_code": "VIE",
        "items": [
            {
                "sku": "VEL-201",
                "quantity": 4,
            }
        ],
    }

    response = client.post(
        "/api/v1/purchase-orders/confirmations",
        json=payload,
    )

    assert response.status_code == 422, response.text


def test_reject_duplicate_skus(client):
    payload = {
        "supplier_id": 1,
        "store_code": "VIE",
        "items": [
            {
                "sku": "VEL-201",
                "quantity": 2,
            },
            {
                "sku": "VEL-201",
                "quantity": 3,
            },
        ],
    }

    response = client.post(
        "/api/v1/purchase-orders/confirmations",
        json=payload,
    )

    assert response.status_code == 422, response.text


def test_reject_zero_quantity(client):
    payload = {
        "supplier_id": 1,
        "store_code": "VIE",
        "items": [
            {
                "sku": "VEL-201",
                "quantity": 0,
            }
        ],
    }

    response = client.post(
        "/api/v1/purchase-orders/confirmations",
        json=payload,
    )

    assert response.status_code == 422, response.text


def test_missing_purchase_order_returns_404(client):
    response = client.get("/api/v1/purchase-orders/999999999")

    assert response.status_code == 404, response.text


def test_missing_authentication_is_rejected():
    with TestClient(app) as unauthenticated_client:
        response = unauthenticated_client.get(
            "/api/v1/purchase-orders"
        )

    assert response.status_code == 401, response.text


def test_confirmation_cannot_be_replayed(client):
    confirmation_response = client.post(
        "/api/v1/purchase-orders/confirmations",
        json=VALID_PAYLOAD,
    )

    assert confirmation_response.status_code == 201

    token = confirmation_response.json()["confirmation_token"]

    first = client.post(
        "/api/v1/purchase-orders",
        json=VALID_PAYLOAD,
        headers={
            "Idempotency-Key": "pytest-replay-po-0001",
            "X-Confirmation-Token": token,
        },
    )

    assert first.status_code == 201, first.text

    # A consumed confirmation token must not authorize another creation,
    # even if the caller supplies a different idempotency key.
    second = client.post(
        "/api/v1/purchase-orders",
        json=VALID_PAYLOAD,
        headers={
            "Idempotency-Key": "pytest-replay-po-0002",
            "X-Confirmation-Token": token,
        },
    )

    assert second.status_code == 409, second.text


def test_idempotency_replay_returns_same_purchase_order(client):
    confirmation_response = client.post(
        "/api/v1/purchase-orders/confirmations",
        json=VALID_PAYLOAD,
    )

    assert confirmation_response.status_code == 201

    token = confirmation_response.json()["confirmation_token"]

    headers = {
        "Idempotency-Key": "pytest-idempotent-po-001",
        "X-Confirmation-Token": token,
    }

    first = client.post(
        "/api/v1/purchase-orders",
        json=VALID_PAYLOAD,
        headers=headers,
    )

    assert first.status_code == 201, first.text
    first_body = first.json()

    # Repeat the same request with the same idempotency key.
    second = client.post(
        "/api/v1/purchase-orders",
        json=VALID_PAYLOAD,
        headers=headers,
    )

    assert second.status_code == 200, second.text
    second_body = second.json()

    assert second_body["id"] == first_body["id"]
    assert second_body["order_number"] == first_body["order_number"]


def test_purchase_orders_are_scoped_to_tenant(client):
    created = create_confirmed_purchase_order(
        client,
        VALID_PAYLOAD,
        "pytest-tenant-scope-001",
    )

    assert created.status_code == 201, created.text
    order_id = created.json()["id"]

    tenant_b_headers = {
        "X-Demo-Actor-Id": "pytest-user-b",
        "X-Demo-Tenant-Id": "tenant-b",
        "X-Demo-Role": "admin",
    }

    read_response = client.get(
        f"/api/v1/purchase-orders/{order_id}",
        headers=tenant_b_headers,
    )

    assert read_response.status_code == 404, read_response.text

    list_response = client.get(
        "/api/v1/purchase-orders",
        headers=tenant_b_headers,
    )

    assert list_response.status_code == 200, list_response.text

    listed_orders = list_response.json()["data"]
    assert all(order["id"] != order_id for order in listed_orders)
