
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from app.api.routes.products import get_db
from app.db.models import Product
from app.db.session import SessionLocal
from app.main import app


TEST_SKU = "TEST-API-9001"

PRODUCT_PAYLOAD = {
    "sku": TEST_SKU,
    "name": "Automated API Test Product",
    "category": "Accessories",
    "retail_price": "99.99",
    "cost_price": "40.00",
    "is_active": True,
}


def override_get_db():
    with SessionLocal() as session:
        yield session


@pytest.fixture
def client():
    # Use the configured local database and remove only this test's SKU.
    with SessionLocal() as session:
        session.execute(
            delete(Product).where(Product.sku == TEST_SKU)
        )
        session.commit()

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()

    with SessionLocal() as session:
        session.execute(
            delete(Product).where(Product.sku == TEST_SKU)
        )
        session.commit()


def test_list_products(client):
    response = client.get("/api/v1/products")

    assert response.status_code == 200
    body = response.json()
    assert body["total"] >= 8
    assert "data" in body
    assert "page" in body
    assert "page_size" in body


def test_search_product_by_sku(client):
    response = client.get("/api/v1/products?q=VEL-201")

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["data"][0]["sku"] == "VEL-201"


def test_filter_active_products(client):
    response = client.get("/api/v1/products?is_active=true")

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 7
    assert all(item["is_active"] for item in body["data"])


def test_pagination(client):
    response = client.get("/api/v1/products?page=1&page_size=3")

    assert response.status_code == 200
    body = response.json()
    assert len(body["data"]) == 3
    assert body["page"] == 1
    assert body["page_size"] == 3
    assert body["total"] >= 8


def test_get_product_by_sku(client):
    response = client.get("/api/v1/products/VEL-201")

    assert response.status_code == 200
    assert response.json()["name"] == "Signature Leather Tote"


def test_missing_product_returns_404(client):
    response = client.get("/api/v1/products/VEL-NOT-FOUND")

    assert response.status_code == 404


def test_create_product(client):
    response = client.post(
        "/api/v1/products",
        json=PRODUCT_PAYLOAD,
    )

    assert response.status_code == 201
    body = response.json()
    assert body["sku"] == TEST_SKU
    assert body["retail_price"] == "99.99"


def test_duplicate_sku_returns_409(client):
    first = client.post("/api/v1/products", json=PRODUCT_PAYLOAD)
    assert first.status_code == 201

    second = client.post(
        "/api/v1/products",
        json=PRODUCT_PAYLOAD,
    )

    assert second.status_code == 409


def test_update_product(client):
    created = client.post(
        "/api/v1/products",
        json=PRODUCT_PAYLOAD,
    )
    assert created.status_code == 201

    response = client.patch(
        f"/api/v1/products/{TEST_SKU}",
        json={"retail_price": "109.99"},
    )

    assert response.status_code == 200
    assert response.json()["retail_price"] == "109.99"


def test_update_missing_product_returns_404(client):
    response = client.patch(
        "/api/v1/products/VEL-NOT-FOUND",
        json={"retail_price": "109.99"},
    )

    assert response.status_code == 404


def test_create_product_rejects_invalid_price(client):
    invalid_payload = {
        **PRODUCT_PAYLOAD,
        "retail_price": "-1.00",
    }

    response = client.post(
        "/api/v1/products",
        json=invalid_payload,
    )

    assert response.status_code == 422

#
def test_update_rejects_empty_body(client):
    created = client.post(
        "/api/v1/products",
        json=PRODUCT_PAYLOAD,
    )
    assert created.status_code == 201

    response = client.patch(
        f"/api/v1/products/{TEST_SKU}",
        json={},
    )

    assert response.status_code == 422
