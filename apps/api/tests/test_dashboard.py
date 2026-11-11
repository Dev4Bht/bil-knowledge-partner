"""Dashboard: role gate, correct counts, and no content or names in the response."""

from datetime import datetime, timedelta, timezone

from app.models import AuditEvent, User
from tests.conftest import upload


def _ask_event(db, user, status, *, warnings=0, days_ago=0, result="ok"):
    db.add(AuditEvent(actor_id=user.id, event="chat.ask", resource_type="conversation", result=result,
                      detail={"status": status, "citations": 1, "warnings": warnings, "steps": []},
                      created_at=datetime.now(timezone.utc) - timedelta(days=days_ago)))
    db.commit()


def _user(db, email):
    from sqlalchemy import select

    return db.execute(select(User).where(User.email == email)).scalar_one()


def test_staff_cannot_open_the_dashboard_but_managers_and_admins_can(client_for):
    assert client_for("staff").get("/dashboard").status_code == 403
    assert client_for("manager").get("/dashboard").status_code == 200
    assert client_for("admin").get("/dashboard").status_code == 200


def test_it_requires_a_session(app):
    from fastapi.testclient import TestClient

    assert TestClient(app).get("/dashboard").status_code in (401, 403)


def test_document_and_version_counts_follow_upload_and_approval(client_for, folders):
    admin = client_for("admin")
    created = upload(admin, folders["general_insurance/Handbooks"], title="Counts handbook").json()
    first = admin.get("/dashboard").json()["documents"]
    assert first["documents"] == 1 and first["awaiting_approval"] == 1
    assert {i["key"]: i["count"] for i in first["by_status"]}["draft"] == 1
    assert {i["key"]: i["count"] for i in first["by_business_line"]}["general_insurance"] == 0  # nothing approved yet

    version = created["versions"][0]["id"]
    assert admin.post(f"/documents/{created['id']}/versions/{version}/approve").status_code == 200
    second = admin.get("/dashboard").json()["documents"]
    assert second["awaiting_approval"] == 0
    assert {i["key"]: i["count"] for i in second["by_status"]}["approved_current"] == 1
    assert {i["key"]: i["count"] for i in second["by_business_line"]}["general_insurance"] == 1


def test_question_outcomes_and_daily_series_come_from_the_audit_trail(client_for, db):
    manager = client_for("manager")
    staff = client_for("staff")
    person = _user(db, "staff@test.bil")
    for status in ("answered", "answered", "no_evidence", "conflict"):
        _ask_event(db, person, status)
    _ask_event(db, person, "answered", warnings=2, days_ago=3)
    _ask_event(db, person, "answered", days_ago=40)  # outside the window
    _ask_event(db, person, "answered", result="denied")
    assert staff  # signed-in staff exist, the count below must not name them

    body = manager.get("/dashboard?days=14").json()["activity"]
    outcomes = {i["key"]: i["count"] for i in body["outcomes"]}
    assert outcomes == {"answered": 4, "conflict": 1, "no_evidence": 1, "needs_clarification": 0, "model_unavailable": 0}
    assert body["questions"] == 6 and body["with_version_warnings"] == 1 and body["denied"] == 1
    assert len(body["per_day"]) == 14 and sum(d["questions"] for d in body["per_day"]) == 6
    assert body["per_day"][-1]["day"] == datetime.now(timezone.utc).date().isoformat()


def test_a_shorter_window_leaves_out_older_questions(client_for, db):
    manager = client_for("manager")
    person = _user(db, "manager@test.bil")
    _ask_event(db, person, "answered", days_ago=10)
    assert manager.get("/dashboard?days=7").json()["activity"]["questions"] == 0
    assert manager.get("/dashboard?days=14").json()["activity"]["questions"] == 1


def test_the_window_is_bounded(client_for):
    manager = client_for("manager")
    assert manager.get("/dashboard?days=0").status_code == 422
    assert manager.get("/dashboard?days=1000").status_code == 422


def test_the_response_has_no_titles_names_or_emails(client_for, folders, db):
    admin = client_for("admin")
    upload(admin, folders["general_insurance/Handbooks"], title="Very Distinctive Title")
    _ask_event(db, _user(db, "admin@test.bil"), "answered")
    raw = admin.get("/dashboard").text
    assert "Very Distinctive Title" not in raw and "@test.bil" not in raw and "Admin" not in raw


def test_active_people_is_a_count_only(client_for, db):
    manager = client_for("manager")
    client_for("staff")
    assert manager.get("/dashboard").json()["activity"]["active_people"] == 2  # both signed in; logins are recorded as ok
