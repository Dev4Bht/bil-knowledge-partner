"""Saved chats: list, re-open, rename, delete, and what happens when a saved answer goes stale."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app import deps
from app.config import Settings, get_settings
from app.models import AccessClassification, Conversation, Document, DocumentVersion, Message, Role, VersionStatus
from app.services.chat_history import make_title
from tests.test_agents import FLOOD_Q, FakeTranslator, PASSWORD, ScriptedLLM, flood_claims, seeded  # noqa: F401  (fixtures)


@pytest.fixture
def chat(app, seeded):  # noqa: F811
    llm = ScriptedLLM(synth=flood_claims)
    app.dependency_overrides[deps.get_llm] = lambda: llm
    app.dependency_overrides[deps.get_translator] = lambda: FakeTranslator()
    app.dependency_overrides[get_settings] = lambda: Settings(_env_file=None, vector_max_distance=1.0, run_worker=False,
                                                              jwt_secret="test-secret-test-secret-test-secret")

    def sign_in(email="staff@demo.bil.test") -> TestClient:
        client = TestClient(app, headers={"X-Requested-With": "bil-web"})
        assert client.post("/auth/login", json={"email": email, "password": PASSWORD}).status_code == 200
        return client

    return sign_in


def ask(client, question=FLOOD_Q, **extra):
    response = client.post("/chat/ask", json={"question": question, **extra})
    assert response.status_code == 200, response.text
    return response.json()


def test_make_title_is_short_clean_and_cut_at_a_word():
    assert make_title("  Is   flood\ndamage covered?  ") == "Is flood damage covered?"
    long = make_title("What documents does a customer need to submit for a motor own damage claim after a flood at night?")
    assert len(long) <= 61 and long.endswith("…") and not long.endswith(" …") and " " in long
    assert make_title("   ") == "New chat"


def test_a_new_question_creates_a_titled_chat_that_appears_in_the_list(chat):
    staff = chat()
    assert staff.get("/chat/conversations").json() == []
    first = ask(staff)
    listing = staff.get("/chat/conversations").json()
    assert len(listing) == 1 and listing[0]["id"] == first["conversation_id"]
    assert listing[0]["title"].startswith("Is flood damage covered") and listing[0]["question_count"] == 1


def test_reopening_a_chat_returns_every_message_in_order_with_the_full_answer(chat):
    staff = chat()
    first = ask(staff)
    ask(staff, "And what about theft?", conversation_id=first["conversation_id"])
    detail = staff.get(f"/chat/conversations/{first['conversation_id']}").json()
    assert [m["role"] for m in detail["messages"]] == ["user", "assistant", "user", "assistant"]
    assert detail["messages"][0]["content"] == FLOOD_Q and detail["messages"][2]["content"] == "And what about theft?"
    answer = detail["messages"][1]["result"]
    assert answer["status"] == "answered" and answer["claims"] and answer["citations"]
    assert answer["citations"][0]["url"].startswith("/documents/") and answer["unsupported_claims"] == []
    assert detail["messages"][0]["result"] is None


def test_the_most_recently_used_chat_is_listed_first(chat):
    staff = chat()
    older = ask(staff, FLOOD_Q)
    newer = ask(staff, "How long do we have to settle a motor claim once we have all the documents?")
    assert [c["id"] for c in staff.get("/chat/conversations").json()] == [newer["conversation_id"], older["conversation_id"]]
    ask(staff, "More about flood damage", conversation_id=older["conversation_id"])
    assert staff.get("/chat/conversations").json()[0]["id"] == older["conversation_id"]  # continuing a chat moves it to the top


def test_a_chat_can_be_renamed_and_blank_or_oversized_titles_are_refused(chat):
    staff = chat()
    cid = ask(staff)["conversation_id"]
    renamed = staff.patch(f"/chat/conversations/{cid}", json={"title": "  Flood claims   Q&A "})
    assert renamed.status_code == 200 and renamed.json()["title"] == "Flood claims Q&A"
    assert staff.patch(f"/chat/conversations/{cid}", json={"title": ""}).status_code == 422
    assert staff.patch(f"/chat/conversations/{cid}", json={"title": "x" * 121}).status_code == 422
    assert staff.patch(f"/chat/conversations/{cid}", json={"title": "   "}).status_code == 422


def test_deleting_a_chat_removes_it_and_all_its_messages(chat, db):
    staff = chat()
    cid = ask(staff)["conversation_id"]
    ask(staff, "Another question about theft", conversation_id=cid)
    assert db.query(Message).count() == 4
    assert staff.delete(f"/chat/conversations/{cid}").status_code == 204
    assert staff.get(f"/chat/conversations/{cid}").status_code == 404
    assert staff.get("/chat/conversations").json() == []
    db.expire_all()
    assert db.query(Message).count() == 0 and db.query(Conversation).count() == 0
    assert staff.delete(f"/chat/conversations/{cid}").status_code == 404  # already gone


def test_clearing_history_only_clears_the_signed_in_users_chats(chat, db):
    staff, manager = chat(), chat("manager@demo.bil.test")
    ask(staff)
    ask(staff, "Second question about theft")
    kept = ask(manager)
    assert staff.delete("/chat/conversations").status_code == 204
    assert staff.get("/chat/conversations").json() == []
    assert [c["id"] for c in manager.get("/chat/conversations").json()] == [kept["conversation_id"]]


def test_nobody_can_read_rename_or_delete_someone_elses_chat(chat):
    staff, manager = chat(), chat("manager@demo.bil.test")
    cid = ask(staff)["conversation_id"]
    for response in (manager.get(f"/chat/conversations/{cid}"), manager.patch(f"/chat/conversations/{cid}", json={"title": "mine now"}),
                     manager.delete(f"/chat/conversations/{cid}")):
        assert response.status_code == 404
    assert staff.get(f"/chat/conversations/{cid}").status_code == 200  # untouched
    assert manager.post("/chat/ask", json={"question": FLOOD_Q, "conversation_id": cid}).status_code == 404  # cannot continue it either


def test_history_needs_sign_in_and_deletes_need_the_csrf_header(chat, app):
    staff = chat()
    cid = ask(staff)["conversation_id"]
    anonymous = TestClient(app, headers={"X-Requested-With": "bil-web"})
    assert anonymous.get("/chat/conversations").status_code == 401
    assert anonymous.delete(f"/chat/conversations/{cid}").status_code == 401
    bare = TestClient(app)
    bare.cookies.update(staff.cookies)
    assert bare.delete(f"/chat/conversations/{cid}").status_code == 403
    assert staff.get(f"/chat/conversations/{cid}").status_code == 200


def test_a_saved_answer_is_flagged_when_a_cited_document_has_changed_since(chat, db):
    staff = chat()
    cid = ask(staff)["conversation_id"]
    cited = staff.get(f"/chat/conversations/{cid}").json()["messages"][1]["result"]["citations"][0]
    version = db.get(DocumentVersion, cited["version_id"])
    version.status = VersionStatus.superseded
    db.commit()
    reopened = staff.get(f"/chat/conversations/{cid}").json()["messages"][1]
    assert reopened["result"]["answer"]  # still readable, because the user may still open it
    assert any("now superseded" in n and "out of date" in n for n in reopened["notices"])
    assert all(c["version_status"] != "approved_current" for c in reopened["result"]["citations"] if c["version_id"] == cited["version_id"])


def test_a_saved_answer_is_hidden_when_the_user_can_no_longer_open_a_cited_document(chat, db):
    staff = chat()
    cid = ask(staff)["conversation_id"]
    cited = staff.get(f"/chat/conversations/{cid}").json()["messages"][1]["result"]["citations"][0]
    document = db.get(Document, db.get(DocumentVersion, cited["version_id"]).document_id)
    document.access_classification = AccessClassification.restricted  # access is revoked after the answer was saved
    document.access_roles = [db.execute(select(Role).where(Role.name == "manager")).scalar_one()]
    db.commit()
    hidden = staff.get(f"/chat/conversations/{cid}").json()["messages"][1]
    assert hidden["result"]["answer"] is None and hidden["result"]["claims"] == [] and hidden["result"]["citations"] == []
    assert hidden["result"]["drafts"] == {"en": None, "dzo": None} and hidden["content"] == ""
    assert any("can no longer open" in n for n in hidden["notices"])
    assert "natural calamity" not in str(hidden)  # none of the answer text leaks through any field
    # the manager, who may still read the document, still sees their own saved answer unchanged
    manager = chat("manager@demo.bil.test")
    mid = ask(manager)["conversation_id"]
    assert manager.get(f"/chat/conversations/{mid}").json()["messages"][1]["result"]["answer"]


def test_deleting_is_audited_without_the_chat_content(chat):
    staff, admin = chat(), chat("admin@demo.bil.test")
    cid = ask(staff, "Is flood damage covered under SECRET-WORD policy?")["conversation_id"]
    staff.patch(f"/chat/conversations/{cid}", json={"title": "SECRET-TITLE"})
    staff.delete(f"/chat/conversations/{cid}")
    events = admin.get("/audit", params={"page_size": 100}).json()["items"]
    assert {"chat.rename", "chat.delete"} <= {e["event"] for e in events}
    assert "SECRET-WORD" not in str(events) and "SECRET-TITLE" not in str(events)


def test_the_backfill_migration_titles_old_chats_from_their_first_question(db, make_user):
    import importlib.util
    from datetime import datetime, timedelta, timezone
    from pathlib import Path

    from sqlalchemy import text

    spec = importlib.util.spec_from_file_location("backfill", Path("alembic/versions/0004_backfill_chat_titles.py"))
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)

    user = make_user("legacy@test.bil")
    t0 = datetime(2026, 1, 1, tzinfo=timezone.utc)
    old = Conversation(user_id=user.id, title="New chat")           # saved before titles existed
    kept = Conversation(user_id=user.id, title="Renamed by user")   # must not be touched
    empty = Conversation(user_id=user.id, title="New chat")         # no messages at all
    db.add_all([old, kept, empty])
    db.flush()
    db.add_all([
        Message(conversation_id=old.id, role="user", content="  Is flood   damage\ncovered under comprehensive motor insurance and what is needed to claim?  ", created_at=t0),
        Message(conversation_id=old.id, role="assistant", content="Yes", created_at=t0 + timedelta(minutes=1)),
        Message(conversation_id=old.id, role="user", content="Second question", created_at=t0 + timedelta(minutes=9)),
        Message(conversation_id=kept.id, role="user", content="Another question", created_at=t0),
    ])
    db.commit()
    db.execute(text(migration.BACKFILL_TITLES))
    db.execute(text(migration.BACKFILL_UPDATED))
    db.commit()
    db.expire_all()
    assert old.title == "Is flood damage covered under comprehensive motor insurance a"[:60]  # first question, whitespace collapsed, 60 chars
    assert kept.title == "Renamed by user" and empty.title == "New chat"
    assert old.updated_at == t0 + timedelta(minutes=9)  # the time of the last message
