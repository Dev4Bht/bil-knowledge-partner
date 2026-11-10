from fastapi.testclient import TestClient

from app import main
from app.config import get_settings
from app.main import create_app


def test_health_is_liveness_only():
    assert TestClient(create_app()).get("/health").json() == {"status": "ok"}


def test_ready_reports_503_with_reasons_when_a_dependency_is_down(monkeypatch):
    monkeypatch.setattr(main, "check_database", lambda: {"ok": False, "detail": "OperationalError: down"})
    response = TestClient(create_app()).get("/ready")
    assert response.status_code == 503
    body = response.json()
    assert body["status"] == "not_ready"
    assert body["checks"]["database"]["ok"] is False
    assert "object_store" in body["checks"]


def test_cors_allows_only_the_web_origin():
    client = TestClient(create_app())
    web_origin = get_settings().web_origin
    allowed = client.options("/health", headers={"Origin": web_origin, "Access-Control-Request-Method": "GET"})
    assert allowed.headers.get("access-control-allow-origin") == web_origin
    other = client.options("/health", headers={"Origin": "http://evil.example", "Access-Control-Request-Method": "GET"})
    assert "access-control-allow-origin" not in other.headers
