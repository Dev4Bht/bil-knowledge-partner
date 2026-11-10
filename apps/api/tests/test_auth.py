from fastapi.testclient import TestClient

from tests.conftest import PASSWORD


def test_login_sets_an_httponly_samesite_cookie_and_me_works(client_for):
    client = client_for("staff")
    me = client.get("/auth/me")
    assert me.status_code == 200 and me.json()["roles"] == ["staff"]
    # Re-login to inspect the raw header.
    raw = client.post("/auth/login", json={"email": "staff@test.bil", "password": PASSWORD})
    cookie = raw.headers["set-cookie"].lower()
    assert "bil_session=" in cookie and "httponly" in cookie and "samesite=lax" in cookie


def test_wrong_password_and_unknown_email_give_the_same_answer(app, make_user):
    make_user("known@test.bil")
    client = TestClient(app, headers={"X-Requested-With": "bil-web"})
    wrong = client.post("/auth/login", json={"email": "known@test.bil", "password": "nope"})
    unknown = client.post("/auth/login", json={"email": "ghost@test.bil", "password": "nope"})
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json()


def test_inactive_users_cannot_sign_in(app, make_user):
    make_user("off@test.bil", active=False)
    client = TestClient(app, headers={"X-Requested-With": "bil-web"})
    assert client.post("/auth/login", json={"email": "off@test.bil", "password": PASSWORD}).status_code == 401


def test_requests_without_the_csrf_header_are_refused(app, make_user):
    make_user("a@test.bil")
    client = TestClient(app)  # no X-Requested-With
    response = client.post("/auth/login", json={"email": "a@test.bil", "password": PASSWORD})
    assert response.status_code == 403 and response.json()["code"] == "csrf"


def test_me_requires_a_session_and_logout_ends_it(client_for, app):
    assert TestClient(app).get("/auth/me").status_code == 401
    client = client_for("staff")
    assert client.post("/auth/logout").status_code == 204
    client.cookies.clear()
    assert client.get("/auth/me").status_code == 401


def test_tampered_session_cookie_is_rejected(client_for):
    client = client_for("staff")
    client.cookies.set("bil_session", client.cookies.get("bil_session")[:-3] + "abc")
    assert client.get("/auth/me").status_code == 401


def test_login_is_rate_limited(app, make_user):
    from app import deps
    from app.ratelimit import RateLimiter

    make_user("rl@test.bil")
    limiter = RateLimiter(3)
    app.dependency_overrides[deps.login_limiter] = lambda: limiter
    client = TestClient(app, headers={"X-Requested-With": "bil-web"})
    codes = [client.post("/auth/login", json={"email": "rl@test.bil", "password": "bad"}).status_code for _ in range(5)]
    assert codes[:3] == [401, 401, 401] and codes[3:] == [429, 429]


def test_denied_and_successful_logins_are_audited_without_secrets(client_for, app, make_user):
    admin = client_for("admin")
    TestClient(app, headers={"X-Requested-With": "bil-web"}).post(
        "/auth/login", json={"email": "admin@test.bil", "password": "wrong-password-xyz"})
    events = admin.get("/audit").json()["items"]
    assert any(e["event"] == "auth.login" and e["result"] == "denied" for e in events)
    assert any(e["event"] == "auth.login" and e["result"] == "ok" for e in events)
    assert "wrong-password-xyz" not in str(events)
