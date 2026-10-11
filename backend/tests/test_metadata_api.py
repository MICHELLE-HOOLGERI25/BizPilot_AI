from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.routes.metadata import router

app = FastAPI()
app.include_router(router)
client = TestClient(app)


def test_save_valid_report():
    response = client.post(
        "/api/v1/metadata/reports",
        json={
            "tenant_id": "test-shop",
            "name": "Monthly Revenue",
            "spec": {
                "measure": "revenue",
                "dimension": "month",
                "aggregation": "sum",
            },
        },
    )
    assert response.status_code == 201
    assert response.json()["name"] == "Monthly Revenue"


def test_reject_unknown_measure():
    response = client.post(
        "/api/v1/metadata/reports",
        json={
            "tenant_id": "test-shop",
            "name": "Invalid Report",
            "spec": {
                "measure": "unknown_table",
                "aggregation": "sum",
            },
        },
    )
    assert response.status_code == 422


def test_list_saved_reports():
    response = client.get(
        "/api/v1/metadata/reports",
        params={"tenant_id": "test-shop"},
    )
    assert response.status_code == 200
    assert isinstance(response.json()["reports"], list)
