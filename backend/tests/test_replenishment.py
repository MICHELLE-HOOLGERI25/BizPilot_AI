from fastapi.testclient import TestClient

from app.main import app


def test_replenishment_recommendations_returns_valid_response():
    client = TestClient(app)
    response = client.get(
        "/api/v1/replenishment/recommendations",
        headers={
            "X-Demo-Actor-Id": "pytest-replenishment",
            "X-Demo-Tenant-Id": "demo",
            "X-Demo-Role": "admin",
        },
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert "data" in body
    assert isinstance(body["data"], list)
