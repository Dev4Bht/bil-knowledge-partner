import pytest
from sqlalchemy import select

from app.config import Settings, get_settings
from app.models import Document
from app.seed import seed_demo
from app.source import BILDMSReadOnlyAdapter, LocalDMSAdapter
from app.storage import build_object_store


@pytest.fixture
def adapter(db, test_env):
    store = build_object_store(get_settings())
    seed_demo(db, store, Settings(_env_file=None, seed_demo=True, demo_password="Demo-Seed-Pass-1"))
    return LocalDMSAdapter(db, store), db


def _doc(db, title):
    return db.execute(select(Document).where(Document.title == title)).scalar_one()


def test_local_adapter_exposes_history_acl_and_bytes_read_only(adapter):
    source, db = adapter
    handbook = _doc(db, "Motor Insurance Handbook")
    history = source.get_version_history(str(handbook.id))
    assert [(v.version_label, v.status) for v in history] == [("2022", "superseded"), ("2024", "approved_current")]
    current = history[-1]
    assert source.get_document_metadata(str(handbook.id), current.version_id).sha256 == current.sha256
    data = b"".join(source.get_document_stream(str(handbook.id), current.version_id))
    assert b"Flood damage is treated as a natural calamity" in data
    briefing = _doc(db, "Management Briefing: Claims Procedure Changes")
    acl = source.get_acl(str(briefing.id), "unused")
    assert acl.classification == "restricted" and acl.allowed_roles == ("manager",)


def test_incremental_listing_pages_and_filters(adapter):
    source, _ = adapter
    docs, cursor = source.list_documents(None, None)
    assert len(docs) == 9 and cursor is None
    assert {d.business_line for d in docs} == {"general_insurance", "credit", "pf_gf", "corporate"}
    assert source.list_documents(max(d.changed_at for d in docs).replace(year=2100), None)[0] == []


def test_wrong_ids_do_not_leak_bytes(adapter):
    source, db = adapter
    a, b = _doc(db, "Housing Loan SOP"), _doc(db, "Customer Service Charter")
    version_of_b = source.get_version_history(str(b.id))[0].version_id
    with pytest.raises(KeyError):
        list(source.get_document_stream(str(a.id), version_of_b))


def test_the_bil_adapter_is_an_honest_stub():
    stub = BILDMSReadOnlyAdapter()
    for call in (lambda: stub.list_documents(None, None), lambda: stub.get_document_stream("a", "b"),
                 lambda: stub.get_document_metadata("a", "b"), lambda: stub.get_version_history("a"), lambda: stub.get_acl("a", "b")):
        with pytest.raises(NotImplementedError, match="stub"):
            call()
