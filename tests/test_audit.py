from bil.dms.services import audit


def test_record_and_list_newest_first(session):
    audit.record(session, username="admin", action="upload", target_type="version", target_id=1, detail="first")
    audit.record(session, username="admin", action="status", target_type="version", target_id=1)
    session.commit()
    entries = audit.list_entries(session)
    assert [e.action for e in entries] == ["status", "upload"]
    assert audit.list_entries(session, limit=1)[0].action == "status"
