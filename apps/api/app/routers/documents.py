import uuid
from datetime import date
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, Form, Query, Response, UploadFile
from sqlalchemy.orm import Session

from ..config import Settings, get_settings
from ..db import get_db
from ..deps import csrf_guard, current_user, get_store, page_limiter, require_manager
from ..models import AccessClassification, BusinessLineCode, User, VersionStatus
from ..presenters import document_detail, document_summary, version_out
from ..errors import ApiError
from ..ratelimit import RateLimiter
from ..schemas import CompareOut, DocumentDetail, DocumentPage, VersionOut, ViewerOut
from ..services import audit, ingestion
from ..services import documents as svc
from ..storage import ObjectStore

router = APIRouter(prefix="/documents", tags=["documents"], dependencies=[Depends(csrf_guard)])


def _index_states(db: Session, documents) -> dict:
    return svc.indexing_map(db, [v.id for d in documents for v in d.versions])


@router.get("", response_model=DocumentPage)
def list_documents(
    q: str | None = Query(None, max_length=200), business_line: BusinessLineCode | None = None,
    folder_id: uuid.UUID | None = None, status: VersionStatus | None = None,
    page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=50),
    user: User = Depends(current_user), db: Session = Depends(get_db),
):
    docs, total = svc.list_documents(db, user, q=q, business_line=business_line, folder_id=folder_id,
                                     status=status, page=page, page_size=page_size)
    states = _index_states(db, docs)
    return DocumentPage(items=[document_summary(user, d, states) for d in docs], total=total, page=page, page_size=page_size)


@router.post("/upload", response_model=DocumentDetail, status_code=201)
def upload_document(
    file: UploadFile = File(...), title: str = Form(..., max_length=300), description: str = Form("", max_length=2000),
    business_line: BusinessLineCode = Form(...), folder_id: uuid.UUID = Form(...),
    access_classification: AccessClassification = Form(AccessClassification.staff), access_roles: str = Form(""),
    version_label: str | None = Form(None), effective_from: date | None = Form(None), effective_to: date | None = Form(None),
    language: str = Form("en"), source_lineage: str = Form("", max_length=1000), is_demo_fixture: bool = Form(False),
    user: User = Depends(require_manager), db: Session = Depends(get_db), store: ObjectStore = Depends(get_store),
    settings: Settings = Depends(get_settings),
):
    document = svc.create_document(
        db, store, user, title=title, description=description, business_line=business_line, folder_id=folder_id,
        classification=access_classification, access_role_names=[r.strip() for r in access_roles.split(",") if r.strip()],
        is_demo_fixture=is_demo_fixture, filename=file.filename or "upload", data=file.file.read(),
        max_bytes=settings.max_upload_mb * 1024 * 1024, label=version_label, effective_from=effective_from,
        effective_to=effective_to, language=language, lineage=source_lineage,
    )
    return document_detail(user, document, svc.indexing_map(db, [v.id for v in document.versions]))


@router.get("/{document_id}", response_model=DocumentDetail)
def get_document(document_id: uuid.UUID, user: User = Depends(current_user), db: Session = Depends(get_db)):
    document = svc.get_document(db, user, document_id)
    return document_detail(user, document, svc.indexing_map(db, [v.id for v in document.versions]))


@router.post("/{document_id}/versions", response_model=VersionOut, status_code=201)
def upload_version(
    document_id: uuid.UUID, file: UploadFile = File(...), version_label: str | None = Form(None),
    effective_from: date | None = Form(None), effective_to: date | None = Form(None), language: str = Form("en"),
    source_lineage: str = Form("", max_length=1000),
    user: User = Depends(require_manager), db: Session = Depends(get_db), store: ObjectStore = Depends(get_store),
    settings: Settings = Depends(get_settings),
):
    version = svc.add_version(db, store, user, document_id, filename=file.filename or "upload", data=file.file.read(),
                              max_bytes=settings.max_upload_mb * 1024 * 1024, label=version_label,
                              effective_from=effective_from, effective_to=effective_to, language=language,
                              lineage=source_lineage)
    return version_out(version)


@router.post("/{document_id}/versions/{version_id}/approve", response_model=VersionOut)
def approve(document_id: uuid.UUID, version_id: uuid.UUID, user: User = Depends(require_manager),
            db: Session = Depends(get_db)):
    return version_out(svc.approve_version(db, user, document_id, version_id))


@router.post("/{document_id}/versions/{version_id}/archive", response_model=VersionOut)
def archive(document_id: uuid.UUID, version_id: uuid.UUID, user: User = Depends(require_manager),
            db: Session = Depends(get_db)):
    return version_out(svc.archive_version(db, user, document_id, version_id))


@router.get("/{document_id}/versions/{version_id}/file")
def file(document_id: uuid.UUID, version_id: uuid.UUID, user: User = Depends(current_user),
         db: Session = Depends(get_db), store: ObjectStore = Depends(get_store), settings: Settings = Depends(get_settings)):
    """The original file. Refused (403 view_only) for everyone unless ALLOW_ORIGINAL_DOWNLOAD is on, and then managers/admins only."""
    version, data = svc.read_file(db, store, user, document_id, version_id, settings.allow_original_download)
    media = "text/plain; charset=utf-8" if version.mime_type == "text/plain" else version.mime_type
    return Response(content=data, media_type=media, headers={
        "Content-Disposition": f"inline; filename*=UTF-8''{quote(version.original_filename)}",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": f"frame-ancestors 'self' {settings.web_origin}",
        "Cache-Control": "private, no-store",
    })


@router.get("/{document_id}/versions/{version_id}/pages", response_model=ViewerOut)
def viewer(document_id: uuid.UUID, version_id: uuid.UUID, user: User = Depends(current_user),
           db: Session = Depends(get_db), store: ObjectStore = Depends(get_store), settings: Settings = Depends(get_settings)):
    """Open the view-only viewer for a version: how many pages, and whether this person may also download the original."""
    version, count = svc.open_view(db, store, user, document_id, version_id)
    return ViewerOut(page_count=count, can_download=svc.can_download_original(user, settings.allow_original_download),
                     kind="pdf" if version.mime_type == "application/pdf" else "text")


@router.get("/{document_id}/versions/{version_id}/pages/{page}")
def page_image(document_id: uuid.UUID, version_id: uuid.UUID, page: int, user: User = Depends(current_user),
               db: Session = Depends(get_db), store: ObjectStore = Depends(get_store),
               limiter: RateLimiter = Depends(page_limiter)):
    """One page as a watermarked image. It has no text layer, and the watermark names the person who requested it."""
    if not limiter.allow(str(user.id)):
        raise ApiError(429, "too_many_pages", "You are opening pages very quickly. Wait a moment and try again.")
    image = svc.render_view_page(db, store, user, document_id, version_id, page)
    return Response(content=image, media_type="image/jpeg", headers={
        "Content-Disposition": "inline; filename=\"page.jpg\"",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store, max-age=0",
        "Pragma": "no-cache",
        "Content-Security-Policy": "default-src 'none'; img-src 'self'",
    })


@router.get("/{document_id}/compare", response_model=CompareOut)
def compare(document_id: uuid.UUID, from_: uuid.UUID = Query(..., alias="from"), to: uuid.UUID = Query(...),
            user: User = Depends(current_user), db: Session = Depends(get_db), store: ObjectStore = Depends(get_store)):
    a, b, lines = svc.compare_versions(db, store, user, document_id, from_, to)
    return CompareOut(from_version=version_out(a), to_version=version_out(b), lines=lines)


@router.post("/{document_id}/reindex", status_code=202)
def reindex(document_id: uuid.UUID, user: User = Depends(require_manager), db: Session = Depends(get_db)):
    """Queue indexing again for every approved, superseded or archived version. Drafts are never indexed."""
    document = svc.get_document(db, user, document_id)
    jobs = [ingestion.enqueue(db, v.id) for v in document.versions if v.status != VersionStatus.draft]
    audit.record(db, actor_id=user.id, event="document.reindex", resource_type="document", resource_id=str(document_id),
                 detail={"jobs": len(jobs)})
    db.commit()
    return {"queued": [str(job.id) for job in jobs]}
