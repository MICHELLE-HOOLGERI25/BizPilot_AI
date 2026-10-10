
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, select, func

from app.api.routes.purchase_orders import get_db
from app.db.models import (
    PurchaseOrder,
    PurchaseOrderItem,
    SalesOrder,
    Supplier,
    SupplierProduct,
    Product,
)
from app.db.session import SessionLocal
from app.main import app


def override_get_db():
    with SessionLocal() as session:
        yield session


@pytest.fixture
def client():
    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


def test_create_purchase_order_and_read_back(client):
    payload = {
        "supplier_id": 1,
        "store_code": "VIE",
        "items": [{"sku": "VEL-201", "quantity": 4}],
    }

    response = client.post("/api/v1/purchase-orders", json=payload)

    assert response.status_code == 201
    created = response.json()
    assert created["status"] == "draft"
    assert created["supplier_name"] == "Atelier Firenze"
    assert created["store_code"] == "VIE"
    assert created["items"][0]["sku"] == "VEL-201"
    assert created["items"][0]["quantity"] == 4

    order_id = created["id"]

    fetched = client.get(f"/api/v1/purchase-orders/{order_id}")

    assert fetched.status_code == 200
    assert fetched.json()["order_number"] == created["order_number"]
    assert fetched.json()["items"] == created["items"]


def test_list_purchase_orders(client):
    response = client.get("/api/v1/purchase-orders")

    assert response.status_code == 200
    body = response.json()
    assert "data" in body
    assert "total" in body
    assert body["total"] >= 1


def test_reject_supplier_without_product_coverage(client):
    payload = {
        "supplier_id": 2,
        "store_code": "VIE",
        "items": [{"sku": "VEL-201", "quantity": 4}],
    }

    response = client.post("/api/v1/purchase-orders", json=payload)

    assert response.status_code == 422
    assert "does not supply product VEL-201" in response.json()["detail"]


def test_reject_duplicate_skus(client):
    payload = {
        "supplier_id": 1,
        "store_code": "VIE",
        "items": [
            {"sku": "VEL-201", "quantity": 2},
            {"sku": "VEL-201", "quantity": 3},
        ],
    }

    response = client.post("/api/v1/purchase-orders", json=payload)

    assert response.status_code == 422
    assert "only once" in response.json()["detail"]


def test_reject_zero_quantity(client):
    payload = {
        "supplier_id": 1,
        "store_code": "VIE",
        "items": [{"sku": "VEL-201", "quantity": 0}],
    }

    response = client.post("/api/v1/purchase-orders", json=payload)

    assert response.status_code == 422


def test_missing_purchase_order_returns_404(client):
    response = client.get("/api/v1/purchase-orders/999999999")

    assert response.status_code == 404
