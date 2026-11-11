"""View-only documents: staff never get the original, pages are watermarked images, and the usual access rules hold."""

import io

import pytest
from PIL import Image
from sqlalchemy import select

from app import deps
from app.models import AuditEvent
from app.services import protected_view
from tests.conftest import upload
from tests.test_extraction import DOCX_MIME, make_pdf  # noqa: F401

PDF_PAGES = [["Claims must be reported within 7 days."], ["Excess is Nu 5,000 for comprehensive cover."], ["Third page."]]


@pytest.fixture(autouse=True)
def fresh_limiter():
    deps.page_limiter().reset()
    yield
    deps.page_limiter().reset()


def published_pdf(admin, folders, pages=PDF_PAGES, title="Motor Handbook PDF"):
    doc = upload(admin, folders["general_insurance/Handbooks"], title=title, content=make_pdf(pages), filename="handbook.pdf").json()
    version = doc["versions"][0]["id"]
    assert admin.post(f"/documents/{doc['id']}/versions/{version}/approve").status_code == 200
    return doc["id"], version


def jpeg(response):
    assert response.status_code == 200, response.text
    assert response.content[:2] == b"\xff\xd8", "not a JPEG"
    return Image.open(io.BytesIO(response.content))


# ---------------------------------------------------------------- the original file

def test_documents_are_not_downloadable_by_anyone_by_default(client_for, folders):
    admin, manager, staff = client_for("admin"), client_for("manager"), client_for("staff")
    doc, version = published_pdf(admin, folders)
    original = make_pdf(PDF_PAGES)
    for who in (admin, manager, staff):
        refused = who.get(f"/documents/{doc}/versions/{version}/file")
        assert refused.status_code == 403 and refused.json()["code"] == "view_only"
        assert original not in refused.content and b"%PDF" not in refused.content
    for who in (admin, manager, staff):  # and the viewer says so, so the web app shows no download button
        assert who.get(f"/documents/{doc}/versions/{version}/pages").json()["can_download"] is False


def test_when_the_owners_switch_downloads_on_only_managers_and_admins_get_the_original(client_for, folders, allow_downloads):
    admin, manager, staff = client_for("admin"), client_for("manager"), client_for("staff")
    doc, version = published_pdf(admin, folders)
    original = make_pdf(PDF_PAGES)
    assert admin.get(f"/documents/{doc}/versions/{version}/file").content == original
    assert manager.get(f"/documents/{doc}/versions/{version}/file").content == original
    assert staff.get(f"/documents/{doc}/versions/{version}/file").status_code == 403
    assert admin.get(f"/documents/{doc}/versions/{version}/pages").json()["can_download"] is True
    assert staff.get(f"/documents/{doc}/versions/{version}/pages").json()["can_download"] is False


def test_the_refused_download_is_audited_as_denied(client_for, folders, db):
    admin, staff = client_for("admin"), client_for("staff")
    doc, version = published_pdf(admin, folders)
    staff.get(f"/documents/{doc}/versions/{version}/file")
    event = db.execute(select(AuditEvent).where(AuditEvent.event == "file.download")).scalar_one()
    assert event.result == "denied" and event.detail == {"reason": "view_only"} and event.resource_id == version


def test_a_document_staff_cannot_see_still_answers_404_not_403(client_for, folders):
    admin, staff = client_for("admin"), client_for("staff")
    doc = upload(admin, folders["general_insurance/Handbooks"], title="Unpublished").json()
    version = doc["versions"][0]["id"]  # a draft: staff must not learn it exists
    assert staff.get(f"/documents/{doc['id']}/versions/{version}/file").status_code == 404
    assert staff.get(f"/documents/{doc['id']}/versions/{version}/pages").status_code == 404
    assert staff.get(f"/documents/{doc['id']}/versions/{version}/pages/1").status_code == 404


# ---------------------------------------------------------------- the viewer

def test_the_viewer_reports_the_page_count_and_that_it_is_view_only(client_for, folders):
    admin, staff = client_for("admin"), client_for("staff")
    doc, version = published_pdf(admin, folders)
    seen = staff.get(f"/documents/{doc}/versions/{version}/pages").json()
    assert seen == {"page_count": 3, "view_only": True, "can_download": False, "kind": "pdf"}


def test_a_page_is_a_no_store_jpeg_with_no_text_layer(client_for, folders):
    admin, staff = client_for("admin"), client_for("staff")
    doc, version = published_pdf(admin, folders)
    response = staff.get(f"/documents/{doc}/versions/{version}/pages/2")
    image = jpeg(response)
    assert image.size[0] > 400 and image.size[1] > 400
    assert response.headers["content-type"] == "image/jpeg"
    assert "no-store" in response.headers["cache-control"]
    assert response.headers["x-content-type-options"] == "nosniff"
    assert b"Excess is Nu 5,000" not in response.content and b"%PDF" not in response.content
    assert "content-disposition" in response.headers and response.headers["content-disposition"].startswith("inline")


def test_every_viewer_gets_their_own_watermark(client_for, folders):
    admin = client_for("admin")
    alice, bob = client_for("staff", email="alice@test.bil"), client_for("staff", email="bob@test.bil")
    doc, version = published_pdf(admin, folders)
    page = f"/documents/{doc}/versions/{version}/pages/1"
    first, second = alice.get(page).content, bob.get(page).content
    assert first != second, "two people must not receive identical page bytes"


def test_the_watermark_covers_the_whole_page_not_just_a_corner():
    white = Image.new("RGB", (800, 1100), "white")
    marked = protected_view.apply_watermark(white, protected_view.watermark_label("Pema", "pema@bil.test"))
    assert marked.size == white.size
    for x0, y0 in [(0, 0), (400, 0), (0, 550), (400, 550)]:  # each quadrant carries marks
        quadrant = marked.crop((x0, y0, x0 + 400, y0 + 550)).convert("L")
        dark = sum(1 for p in quadrant.getdata() if p < 235)
        assert dark > 150, f"quadrant at {(x0, y0)} has no watermark"


def test_the_watermark_names_the_viewer_and_the_time():
    from datetime import datetime, timezone

    label = protected_view.watermark_label("Pema Dorji", "pema@bil.test", datetime(2026, 11, 11, 9, 5, tzinfo=timezone.utc))
    assert label == "Pema Dorji · pema@bil.test · 2026-11-11 09:05 UTC · view only"


def test_pages_out_of_range_are_404(client_for, folders):
    admin = client_for("admin")
    doc, version = published_pdf(admin, folders)
    for page in (0, 4, 999, -1):
        assert admin.get(f"/documents/{doc}/versions/{version}/pages/{page}").status_code == 404


def test_a_pdf_that_cannot_be_opened_is_reported_not_crashed(client_for, folders, monkeypatch):
    admin = client_for("admin")
    doc, version = published_pdf(admin, folders)

    def boom(*_args, **_kwargs):
        raise protected_view.ViewError("The PDF could not be opened (PdfiumError)")

    monkeypatch.setattr(protected_view, "page_count", boom)
    response = admin.get(f"/documents/{doc}/versions/{version}/pages")
    assert response.status_code == 422 and response.json()["code"] == "not_viewable"
    assert "Traceback" not in response.text


def test_pdfium_really_refuses_garbage():
    with pytest.raises(protected_view.ViewError):
        protected_view.page_count("v", "application/pdf", b"%PDF-1.4\nthis is not a pdf at all")


# ---------------------------------------------------------------- text and Word documents

def test_text_documents_are_laid_out_into_pages_of_images(client_for, folders):
    admin, staff = client_for("admin"), client_for("staff")
    body = "## Settlement\n" + "\n".join(f"Line {i}: a settled claim must be paid within ten working days of approval." for i in range(160)) + "\n"
    doc = upload(admin, folders["general_insurance/Handbooks"], title="Long note", content=body.encode(), filename="note.txt").json()
    version = doc["versions"][0]["id"]
    admin.post(f"/documents/{doc['id']}/versions/{version}/approve")
    meta = staff.get(f"/documents/{doc['id']}/versions/{version}/pages").json()
    assert meta["kind"] == "text" and meta["page_count"] >= 3 and meta["can_download"] is False
    one, two = jpeg(staff.get(f"/documents/{doc['id']}/versions/{version}/pages/1")), jpeg(staff.get(f"/documents/{doc['id']}/versions/{version}/pages/2"))
    assert one.size == two.size == protected_view.TEXT_PAGE
    assert staff.get(f"/documents/{doc['id']}/versions/{version}/pages/1").content != staff.get(f"/documents/{doc['id']}/versions/{version}/pages/2").content
    assert staff.get(f"/documents/{doc['id']}/versions/{version}/file").status_code == 403


def test_word_documents_can_be_viewed_by_staff_without_downloading_them(client_for, folders):
    from docx import Document as Docx

    buffer = io.BytesIO()
    document = Docx()
    document.add_heading("Settlement", level=1)
    document.add_paragraph("A settled claim must be paid within ten working days of approval.")
    document.save(buffer)
    admin, staff = client_for("admin"), client_for("staff")
    created = admin.post("/documents/upload", data={"title": "Word memo", "business_line": "general_insurance", "folder_id": folders["general_insurance/Handbooks"]},
                         files={"file": ("memo.docx", buffer.getvalue(), DOCX_MIME)})
    assert created.status_code == 201, created.text
    doc, version = created.json()["id"], created.json()["versions"][0]["id"]
    admin.post(f"/documents/{doc}/versions/{version}/approve")
    assert staff.get(f"/documents/{doc}/versions/{version}/pages").json()["page_count"] >= 1
    jpeg(staff.get(f"/documents/{doc}/versions/{version}/pages/1"))
    assert staff.get(f"/documents/{doc}/versions/{version}/file").status_code == 403


# ---------------------------------------------------------------- limits and audit

def test_bulk_page_requests_are_rate_limited(client_for, folders):
    admin, staff = client_for("admin"), client_for("staff")
    doc, version = published_pdf(admin, folders)
    deps.page_limiter().limit = 3
    page = f"/documents/{doc}/versions/{version}/pages/1"
    assert [staff.get(page).status_code for _ in range(3)] == [200, 200, 200]
    blocked = staff.get(page)
    assert blocked.status_code == 429 and blocked.json()["code"] == "too_many_pages"
    assert admin.get(page).status_code == 200  # the limit is per person


def test_opening_the_viewer_is_audited_without_any_content(client_for, folders, db):
    admin, staff = client_for("admin"), client_for("staff")
    doc, version = published_pdf(admin, folders)
    staff.get(f"/documents/{doc}/versions/{version}/pages")
    staff.get(f"/documents/{doc}/versions/{version}/pages/1")
    views = db.execute(select(AuditEvent).where(AuditEvent.event == "file.view", AuditEvent.detail["view_only"].astext == "true")).scalars().all()
    assert len(views) == 1 and views[0].detail == {"view_only": True, "pages": 3}
    assert "Claims must be reported" not in str(views[0].detail)
