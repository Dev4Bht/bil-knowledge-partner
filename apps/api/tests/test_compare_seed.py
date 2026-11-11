from app.config import Settings
from tests.conftest import add_version, upload


def test_compare_shows_added_and_removed_lines(client_for, folders):
    admin = client_for("admin")
    doc = upload(admin, folders["general_insurance/Handbooks"], version_label="v1",
                 content=b"Flood damage is not covered.\nClaims within 7 days.\n").json()
    v1 = doc["versions"][0]["id"]
    v2 = add_version(admin, doc["id"], version_label="v2",
                     content=b"Flood damage is covered.\nClaims within 7 days.\n").json()["id"]
    result = admin.get(f"/documents/{doc['id']}/compare", params={"from": v1, "to": v2})
    assert result.status_code == 200
    lines = result.json()["lines"]
    assert {"kind": "del", "text": "Flood damage is not covered."} in lines
    assert {"kind": "add", "text": "Flood damage is covered."} in lines
    assert {"kind": "ctx", "text": "Claims within 7 days."} in lines


def test_compare_is_text_only_for_now(client_for, folders):
    admin = client_for("admin")
    doc = upload(admin, folders["general_insurance/Handbooks"], filename="a.pdf", content=b"%PDF-1.4 a").json()
    other = admin.post(f"/documents/{doc['id']}/versions", files={"file": ("b.pdf", b"%PDF-1.4 b", "application/pdf")}).json()
    response = admin.get(f"/documents/{doc['id']}/compare", params={"from": doc["versions"][0]["id"], "to": other["id"]})
    assert response.status_code == 422 and response.json()["code"] == "not_text"


def test_file_is_served_inline_with_safe_headers(client_for, folders, allow_downloads):
    admin = client_for("admin")
    doc = upload(admin, folders["general_insurance/Handbooks"], content=b"<script>alert(1)</script>\n",
                 filename="notes.txt").json()
    response = admin.get(f"/documents/{doc['id']}/versions/{doc['versions'][0]['id']}/file")
    assert response.headers["content-type"].startswith("text/plain")
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["content-disposition"].startswith("inline")
    assert "frame-ancestors" in response.headers["content-security-policy"]


def test_capabilities_report_what_is_built_and_do_not_claim_the_rest(client_for):
    caps = client_for("staff").get("/capabilities").json()
    assert caps["dms"] is True and caps["extraction"] is True and caps["search"] is True
    assert caps["llm"] is False and caps["translation"] is False  # the agent workflow is not built in this test setup
    assert any("Search index:" in n for n in caps["notes"])


def test_seed_creates_the_fictional_fixtures_and_is_idempotent(db, tmp_path):
    from app.seed import ensure_base_data, seed_demo
    from app.storage import LocalFileStore
    from app.models import Document, User

    settings = Settings(_env_file=None, seed_demo=True, demo_password="Demo-Seed-Pass-1")
    store = LocalFileStore(tmp_path)
    seed_demo(db, store, settings)
    docs, users = db.query(Document).count(), db.query(User).count()
    assert docs == 9 and users == 3
    assert all(d.is_demo_fixture for d in db.query(Document))
    seed_demo(db, store, settings)
    ensure_base_data(db)
    assert (db.query(Document).count(), db.query(User).count()) == (docs, users)


def test_seeded_fixtures_behave_as_designed_for_each_role(app, db, tmp_path):
    from fastapi.testclient import TestClient

    from app.seed import seed_demo
    from app.storage import LocalFileStore

    seed_demo(db, LocalFileStore(tmp_path), Settings(_env_file=None, seed_demo=True, demo_password="Demo-Seed-Pass-1"))

    def sign_in(email):
        client = TestClient(app, headers={"X-Requested-With": "bil-web"})
        assert client.post("/auth/login", json={"email": email, "password": "Demo-Seed-Pass-1"}).status_code == 200
        return client

    titles = lambda c: {d["title"] for d in c.get("/documents", params={"page_size": 50}).json()["items"]}
    staff, manager, admin = sign_in("staff@demo.bil.test"), sign_in("manager@demo.bil.test"), sign_in("admin@demo.bil.test")
    assert "Management Briefing: Claims Procedure Changes" not in titles(staff)
    assert "Management Briefing: Claims Procedure Changes" in titles(manager)
    assert len(titles(staff)) == 8 and len(titles(admin)) == 9

    handbook = next(d for d in staff.get("/documents", params={"q": "Motor Insurance Handbook"}).json()["items"])
    detail = staff.get(f"/documents/{handbook['id']}").json()
    assert {v["version_label"]: v["status"] for v in detail["versions"]} == {"2022": "superseded", "2024": "approved_current"}

    fire = next(d for d in admin.get("/documents", params={"q": "Fire Policy"}).json()["items"])
    staff_fire = staff.get(f"/documents/{fire['id']}").json()
    assert [v["version_label"] for v in staff_fire["versions"]] == ["v1"]  # the draft is hidden
    assert len(admin.get(f"/documents/{fire['id']}").json()["versions"]) == 2


def test_seed_refuses_to_run_in_production(db, tmp_path):
    import pytest

    from app.seed import seed_demo
    from app.storage import LocalFileStore

    settings = Settings(_env_file=None, app_env="production", jwt_secret="x" * 40, seed_demo=True, demo_password="pw")
    with pytest.raises(RuntimeError):
        seed_demo(db, LocalFileStore(tmp_path), settings)


def test_capabilities_report_translation_off_when_disabled(db, monkeypatch):
    from app.capabilities import compute_capabilities

    off = compute_capabilities(Settings(_env_file=None, translation_enabled=False, ollama_base_url="http://127.0.0.1:9"), db)
    assert off.translation is False and any("switched off" in n for n in off.notes)
