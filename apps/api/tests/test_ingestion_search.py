import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.config import Settings, get_settings
from app.models import DocumentChunk, IngestionJob, JobState
from app.search import hybrid_search
from app.seed import seed_demo
from app.services import ingestion
from app.storage import build_object_store
from tests.conftest import DownEmbedder, FakeEmbedder, upload

MAX_DISTANCE = 1.0  # permissive: the fake embedder is only a stand-in for semantic similarity


@pytest.fixture
def store(test_env):
    return build_object_store(get_settings())


@pytest.fixture
def seeded(db, store):
    seed_demo(db, store, Settings(_env_file=None, seed_demo=True, demo_password="Demo-Seed-Pass-1"))
    index_all(db, store)
    return db


def index_all(db, store, embedder=None):
    count = 0
    while ingestion.process_next(db, store, embedder or FakeEmbedder()):
        count += 1
    return count


def user_named(db, email):
    from app.models import User

    return db.execute(select(User).where(User.email == email)).scalar_one()


def search(db, user, query, **kwargs):
    return hybrid_search(db, user, kwargs.pop("embedder", FakeEmbedder()), query, vector_max_distance=MAX_DISTANCE, **kwargs)


def test_only_approved_versions_are_queued_and_they_are_indexed_with_metadata(seeded):
    jobs = seeded.execute(select(IngestionJob)).scalars().all()
    # 10 approved versions (the handbook has two: 2022 superseded and 2024 current); the draft is not queued
    assert len(jobs) == 10 and all(j.state == JobState.indexed for j in jobs)
    chunk = seeded.execute(select(DocumentChunk).where(DocumentChunk.section_label == "4.1", DocumentChunk.text.contains("natural calamity"))).scalars().one()
    assert chunk.heading == "Flood damage" and chunk.embedding is not None and chunk.quality_flag.value == "ok"
    texts = " ".join(c.text for c in seeded.execute(select(DocumentChunk)).scalars())
    assert "photograph of the insured building" not in texts  # the draft revision is never indexed


def test_reindexing_is_idempotent(seeded, store):
    before = seeded.query(DocumentChunk).count()
    for job in seeded.execute(select(IngestionJob)).scalars().all():
        ingestion.enqueue(seeded, job.version_id)
    seeded.commit()
    assert index_all(seeded, store) == 10
    assert seeded.query(DocumentChunk).count() == before


def test_flood_question_finds_the_current_handbook_section_first(seeded):
    staff = user_named(seeded, "staff@demo.bil.test")
    hits, meta = search(seeded, staff, "Is flood damage covered under comprehensive motor insurance?")
    assert meta.mode == "hybrid" and hits
    top = hits[0]
    assert (top.title, top.section_label, top.version_label, top.version_status) == (
        "Motor Insurance Handbook", "4.1", "2024", "approved_current")
    assert all(h.version_status == "approved_current" for h in hits)


def test_history_search_includes_superseded_versions_only_when_asked(seeded):
    staff = user_named(seeded, "staff@demo.bil.test")
    current, _ = search(seeded, staff, "flood damage comprehensive cover")
    history, _ = search(seeded, staff, "flood damage comprehensive cover", include_history=True)
    assert "superseded" not in {h.version_status for h in current}
    assert "superseded" in {h.version_status for h in history}


def test_access_rules_are_applied_inside_retrieval(seeded):
    staff, manager, admin = (user_named(seeded, f"{r}@demo.bil.test") for r in ("staff", "manager", "admin"))
    question = "managers only claims reporting period under review no change decided"
    titles = lambda user: {h.title for h in search(seeded, user, question)[0]}
    assert "Management Briefing: Claims Procedure Changes" not in titles(staff)
    assert "Management Briefing: Claims Procedure Changes" in titles(manager)
    # drafts are never searchable, not even by an administrator
    draft_hits, _ = search(seeded, admin, "recent photograph of the insured building fire renewal", include_history=True)
    assert not any("photograph of the insured building" in h.text for h in draft_hits)


def test_business_line_filter(seeded):
    staff = user_named(seeded, "staff@demo.bil.test")
    from app.models import BusinessLineCode

    hits, _ = search(seeded, staff, "documents procedure eligibility withdrawal loan claim", business_line=BusinessLineCode.credit)
    assert hits and {h.business_line for h in hits} == {"credit"}


def test_keyword_search_still_works_when_embeddings_are_down(db, store):
    seed_demo(db, store, Settings(_env_file=None, seed_demo=True, demo_password="Demo-Seed-Pass-1"))
    index_all(db, store, DownEmbedder())
    job = db.execute(select(IngestionJob)).scalars().first()
    assert job.state == JobState.indexed and "keyword only" in job.warning
    assert db.query(DocumentChunk).filter(DocumentChunk.embedding.is_not(None)).count() == 0
    staff = user_named(db, "staff@demo.bil.test")
    hits, meta = search(db, staff, "flood damage", embedder=DownEmbedder())
    assert meta.mode == "keyword_only" and hits and hits[0].section_label == "4.1"


def test_unreadable_files_fail_cleanly_after_three_attempts(db, store, client_for, folders):
    admin = client_for("admin")
    created = upload(admin, folders["general_insurance/Handbooks"], filename="bad.pdf", content=b"%PDF-1.4 not really a pdf").json()
    version = created["versions"][0]
    assert admin.post(f"/documents/{created['id']}/versions/{version['id']}/approve").status_code == 200
    index_all(db, store)
    job = db.execute(select(IngestionJob).where(IngestionJob.version_id == version["id"])).scalars().one()
    assert job.state == JobState.failed and job.attempts == 3 and "could not be read" in job.error
    assert admin.get(f"/documents/{created['id']}").json()["versions"][0]["indexing_status"] == "failed"


def test_search_endpoint_returns_citable_hits_and_does_not_log_the_question(app, seeded, store):
    client = TestClient(app, headers={"X-Requested-With": "bil-web"})
    assert client.post("/search", json={"query": "flood"}).status_code == 401
    client.post("/auth/login", json={"email": "staff@demo.bil.test", "password": "Demo-Seed-Pass-1"})
    body = client.post("/search", json={"query": "secret-question-text flood damage covered"}).json()
    top = body["items"][0]
    assert top["title"] == "Motor Insurance Handbook" and top["section"] == "§4.1 Flood damage"
    assert top["url"] == f"/documents/{top['document_id']}/versions/{top['version_id']}/file"
    assert top["version_status"] == "approved_current" and top["is_demo_fixture"] is True
    assert body["facets"]["business_line"]["general_insurance"] >= 1
    admin = TestClient(app, headers={"X-Requested-With": "bil-web"})
    admin.post("/auth/login", json={"email": "admin@demo.bil.test", "password": "Demo-Seed-Pass-1"})
    assert "secret-question-text" not in str(admin.get("/audit", params={"page_size": 100}).json())


def test_reindex_and_job_status_need_a_manager(app, seeded, store):
    def sign_in(email):
        c = TestClient(app, headers={"X-Requested-With": "bil-web"})
        c.post("/auth/login", json={"email": email, "password": "Demo-Seed-Pass-1"})
        return c

    staff, manager = sign_in("staff@demo.bil.test"), sign_in("manager@demo.bil.test")
    doc = staff.get("/documents", params={"q": "Housing"}).json()["items"][0]
    assert staff.post(f"/documents/{doc['id']}/reindex").status_code == 403
    queued = manager.post(f"/documents/{doc['id']}/reindex")
    assert queued.status_code == 202 and len(queued.json()["queued"]) == 1
    job_id = queued.json()["queued"][0]
    assert manager.get(f"/ingestion-jobs/{job_id}").json()["state"] == "queued"
    assert staff.get(f"/ingestion-jobs/{job_id}").status_code == 403


@pytest.mark.live_ollama
def test_real_bge_m3_finds_flood_when_the_question_says_natural_calamity(db, store):
    """Needs Ollama with bge-m3 pulled. Skipped otherwise."""
    from app.embeddings import EmbeddingUnavailable, OllamaEmbedder

    settings = get_settings()
    embedder = OllamaEmbedder("http://localhost:11434", "bge-m3")
    try:
        embedder.embed(["ping"])
    except EmbeddingUnavailable:
        pytest.skip("Ollama or bge-m3 is not available")
    seed_demo(db, store, Settings(_env_file=None, seed_demo=True, demo_password="Demo-Seed-Pass-1"))
    index_all(db, store, embedder)
    staff = user_named(db, "staff@demo.bil.test")
    hits, meta = hybrid_search(db, staff, embedder, "My car was damaged in a natural calamity. Am I covered?",
                               vector_max_distance=settings.vector_max_distance, use_synonyms=False)
    assert meta.mode == "hybrid"
    assert hits[0].title == "Motor Insurance Handbook" and hits[0].section_label == "4.1"


def _add_text_doc(client, folder_id, title, text):
    created = upload(client, folder_id, title=title, content=(text + "\n").encode(), filename=f"{title}.txt")
    assert created.status_code == 201, created.text
    document = created.json()
    assert client.post(f"/documents/{document['id']}/versions/{document['versions'][0]['id']}/approve").status_code == 200


def test_a_rare_word_in_the_question_is_not_drowned_out_by_common_words(db, store, client_for, folders):
    """The real R01 failure: 'flood' appears in a handful of passages but 'motor insurance cover' in hundreds, so a
    passage that merely repeats the common words outranked the short list that actually says 'Flood'."""
    admin = client_for("admin")
    folder = folders["general_insurance/Handbooks"]
    for n in range(14):  # many passages stuffed with the question's common words
        _add_text_doc(admin, folder, f"Motor overview {n}",
                      f"## Motor insurance cover {n}\nMotor insurance cover applies to a motor vehicle. Motor insurance policy cover and motor insurance rules {n}.")
    _add_text_doc(admin, folder, "Comprehensive coverage list", "## Coverage\n- Accidental\n- Flood, typhoon, hurricane, storm\n- Burglary or theft")
    index_all(db, store)
    hits, _ = search(db, user_named(db, "admin@test.bil"), "Does motor insurance cover flood damage?", limit=3)
    assert "Comprehensive coverage list" in [h.title for h in hits]  # the passage with the rare word is in the top three


def test_common_question_words_do_not_get_their_own_ranking(db, store, client_for, folders):
    from app.search import rare_terms

    admin = client_for("admin", email="admin2@test.bil")
    folder = folders["general_insurance/Handbooks"]
    for n in range(40):
        _add_text_doc(admin, folder, f"Doc {n}", f"## Section {n}\nInsurance policy cover applies. Insurance rules {n}.")
    _add_text_doc(admin, folder, "Special", "## Special\nA hailstorm rider is available.")
    index_all(db, store)
    from app.search import eligible_versions

    ids = list(eligible_versions(db, user_named(db, "admin2@test.bil"), business_line=None, include_history=False))
    terms = rare_terms(db, ids, "Does insurance cover a hailstorm rider?")
    assert "hailstorm" in terms and "insurance" not in terms and "cover" not in terms
