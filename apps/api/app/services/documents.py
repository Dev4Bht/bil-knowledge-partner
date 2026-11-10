"""Document, version and approval rules (docs/webapp-design.md sections 7.3 and 7.4)."""

import difflib
import hashlib
import os
import re
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload, selectinload

from .. import access
from ..errors import ApiError, not_found
from ..models import (
    AccessClassification, BusinessLine, BusinessLineCode, Document, DocumentVersion, Folder, IngestionJob, Role,
    User, VersionStatus,
)
from ..schemas import DiffLine
from ..storage import ObjectStore
from . import audit

ALLOWED_TYPES = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".txt": "text/plain",
}
LANGUAGES = {"en", "dz"}
_CID = re.compile(r"(?<!\d)\d{11}(?!\d)")  # Bhutanese CID-style numbers


def sanitize_filename(name: str) -> str:
    base = os.path.basename(name.replace("\\", "/"))
    base = re.sub(r"[^\w.\- ()]", "_", base, flags=re.UNICODE).strip(" .")
    return (base or "upload")[:120]


def validate_upload(filename: str, data: bytes, max_bytes: int) -> tuple[str, str, str]:
    """Return (safe_name, mime_type, extension) or raise a 4xx ApiError. Never trusts the client's content type."""
    safe = sanitize_filename(filename)
    ext = Path(safe).suffix.lower()
    if ext not in ALLOWED_TYPES:
        raise ApiError(422, "unsupported_type", "Only PDF, DOCX and TXT files can be uploaded")
    if not data:
        raise ApiError(422, "empty_file", "The file is empty")
    if len(data) > max_bytes:
        raise ApiError(413, "too_large", f"The file is larger than {max_bytes // (1024 * 1024)} MB")
    if ext == ".pdf" and not data.startswith(b"%PDF-"):
        raise ApiError(422, "bad_content", "The file does not look like a PDF")
    if ext == ".docx" and not data.startswith(b"PK\x03\x04"):
        raise ApiError(422, "bad_content", "The file does not look like a DOCX document")
    if ext == ".txt":
        try:
            text = data.decode("utf-8")
        except UnicodeDecodeError:
            raise ApiError(422, "bad_content", "Text files must be UTF-8") from None
        if "\x00" in text:
            raise ApiError(422, "bad_content", "The text file contains binary data")
        if _CID.search(text):
            raise ApiError(422, "personal_data",
                           "This file appears to contain CID-style numbers. Remove customer personal data and upload again")
    return safe, ALLOWED_TYPES[ext], ext


# ---------------------------------------------------------------- loading with access checks

def _load_document(db: Session, document_id: uuid.UUID, *, lock: bool = False) -> Document | None:
    stmt = select(Document).where(Document.id == document_id).options(
        joinedload(Document.folder).joinedload(Folder.parent),
        joinedload(Document.business_line), joinedload(Document.owner),
        selectinload(Document.versions).joinedload(DocumentVersion.uploaded_by),
        selectinload(Document.versions).joinedload(DocumentVersion.approved_by),
        selectinload(Document.access_roles),
    )
    if lock:
        stmt = stmt.with_for_update(of=Document)
    return db.execute(stmt).unique().scalar_one_or_none()


def get_document(db: Session, user: User, document_id: uuid.UUID, *, lock: bool = False) -> Document:
    document = _load_document(db, document_id, lock=lock)
    if (
        document is not None
        and access.can_see_document(user, document)
        and (access.can_manage(user) or access.visible_versions(user, document))  # staff see nothing of a draft-only doc
    ):
        return document
    if document is not None:  # exists but not allowed: same 404, plus an audit trail
        audit.record(db, actor_id=user.id, event="document.view", resource_type="document",
                     resource_id=str(document_id), result="denied")
        db.commit()
    raise not_found("Document not found")


def get_version(document: Document, user: User, version_id: uuid.UUID) -> DocumentVersion:
    version = next((v for v in access.visible_versions(user, document) if v.id == version_id), None)
    if version is None:
        raise not_found("Version not found")
    return version


def indexing_map(db: Session, version_ids: list[uuid.UUID]) -> dict[uuid.UUID, str]:
    if not version_ids:
        return {}
    jobs = db.execute(select(IngestionJob).where(IngestionJob.version_id.in_(version_ids))
                      .order_by(IngestionJob.created_at)).scalars()
    return {job.version_id: job.state.value for job in jobs}


def list_documents(
    db: Session, user: User, *, q: str | None, business_line: BusinessLineCode | None, folder_id: uuid.UUID | None,
    status: VersionStatus | None, page: int, page_size: int,
) -> tuple[list[Document], int]:
    stmt = select(Document).options(
        joinedload(Document.folder).joinedload(Folder.parent), joinedload(Document.business_line),
        joinedload(Document.owner), selectinload(Document.versions).joinedload(DocumentVersion.uploaded_by),
        selectinload(Document.versions).joinedload(DocumentVersion.approved_by), selectinload(Document.access_roles),
    ).order_by(Document.updated_at.desc(), Document.title)
    if business_line:
        stmt = stmt.where(Document.business_line.has(BusinessLine.code == business_line))
    if q:
        like = "%" + q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
        stmt = stmt.where(Document.title.ilike(like, escape="\\") | Document.description.ilike(like, escape="\\"))
    if folder_id:
        children: dict[uuid.UUID | None, list[uuid.UUID]] = {}
        for fid, parent in db.execute(select(Folder.id, Folder.parent_id)):
            children.setdefault(parent, []).append(fid)
        wanted, stack = set(), [folder_id]
        while stack:
            current = stack.pop()
            wanted.add(current)
            stack.extend(children.get(current, []))
        stmt = stmt.where(Document.folder_id.in_(wanted))
    visible = []
    for document in db.execute(stmt).unique().scalars():
        if not access.can_see_document(user, document):
            continue
        versions = access.visible_versions(user, document)
        if not versions:
            continue
        if status and not any(v.status == status for v in versions):
            continue
        visible.append(document)
    total = len(visible)
    start = (page - 1) * page_size
    return visible[start:start + page_size], total


# ---------------------------------------------------------------- creating documents and versions

def _resolve_roles(db: Session, names: list[str]) -> list[Role]:
    roles = []
    for name in names:
        role = db.execute(select(Role).where(Role.name == name)).scalar_one_or_none()
        if role is None:
            raise ApiError(422, "unknown_role", f"Unknown role '{name}'")
        roles.append(role)
    return roles


def _check_dates(effective_from: date | None, effective_to: date | None) -> None:
    if effective_from and effective_to and effective_to < effective_from:
        raise ApiError(422, "bad_dates", "The end date is before the start date")


def _add_version(
    db: Session, store: ObjectStore, actor: User, document: Document, *, filename: str, data: bytes, max_bytes: int,
    label: str | None, effective_from: date | None, effective_to: date | None, language: str, lineage: str,
) -> DocumentVersion:
    if language not in LANGUAGES:
        raise ApiError(422, "bad_language", "Language must be 'en' or 'dz'")
    _check_dates(effective_from, effective_to)
    safe, mime, ext = validate_upload(filename, data, max_bytes)
    label = (label or f"v{len(document.versions) + 1}").strip()[:50]
    if any(v.version_label == label for v in document.versions):
        raise ApiError(409, "duplicate_label", f"This document already has a version called '{label}'")
    sha = hashlib.sha256(data).hexdigest()
    version_id = uuid.uuid4()
    key = f"documents/{document.id}/{version_id}/{sha}{ext}"  # built only from ids and the hash
    store.put(key, data, mime)
    version = DocumentVersion(
        id=version_id, document_id=document.id, version_label=label, status=VersionStatus.draft,
        effective_from=effective_from, effective_to=effective_to, object_key=key, original_filename=safe,
        sha256=sha, mime_type=mime, size_bytes=len(data), language=language, source_lineage=lineage,
        uploaded_by_id=actor.id,
    )
    db.add(version)
    db.flush()
    db.refresh(document)
    audit.record(db, actor_id=actor.id, event="version.upload", resource_type="version", resource_id=str(version.id),
                 detail={"document_id": str(document.id), "label": label, "size_bytes": len(data)})
    return version


def create_document(
    db: Session, store: ObjectStore, actor: User, *, title: str, description: str, business_line: BusinessLineCode,
    folder_id: uuid.UUID, classification: AccessClassification, access_role_names: list[str], is_demo_fixture: bool,
    filename: str, data: bytes, max_bytes: int, label: str | None, effective_from: date | None,
    effective_to: date | None, language: str, lineage: str,
) -> Document:
    title = title.strip()
    if not title:
        raise ApiError(422, "bad_title", "Title must not be empty")
    line = db.execute(select(BusinessLine).where(BusinessLine.code == business_line)).scalar_one_or_none()
    folder = db.get(Folder, folder_id)
    if line is None or folder is None or folder.business_line_id != line.id or not access.can_see_folder(actor, folder):
        raise ApiError(422, "bad_folder", "Choose a folder that belongs to the selected business line")
    roles = _resolve_roles(db, access_role_names)
    if classification == AccessClassification.restricted and not roles:
        raise ApiError(422, "no_roles", "A restricted document needs at least one role that may read it")
    document = Document(title=title, description=description.strip(), business_line_id=line.id, folder_id=folder.id,
                        owner_id=actor.id, access_classification=classification, is_demo_fixture=is_demo_fixture,
                        access_roles=roles if classification == AccessClassification.restricted else [])
    db.add(document)
    db.flush()
    document = _load_document(db, document.id)
    _add_version(db, store, actor, document, filename=filename, data=data, max_bytes=max_bytes, label=label,
                 effective_from=effective_from, effective_to=effective_to, language=language, lineage=lineage)
    audit.record(db, actor_id=actor.id, event="document.create", resource_type="document", resource_id=str(document.id))
    db.commit()
    return _load_document(db, document.id)


def add_version(
    db: Session, store: ObjectStore, actor: User, document_id: uuid.UUID, *, filename: str, data: bytes,
    max_bytes: int, label: str | None, effective_from: date | None, effective_to: date | None, language: str,
    lineage: str,
) -> DocumentVersion:
    document = get_document(db, actor, document_id)
    version = _add_version(db, store, actor, document, filename=filename, data=data, max_bytes=max_bytes,
                           label=label, effective_from=effective_from, effective_to=effective_to,
                           language=language, lineage=lineage)
    db.commit()
    return get_version(_load_document(db, document_id), actor, version.id)


# ---------------------------------------------------------------- approval and archiving

def approve_version(db: Session, actor: User, document_id: uuid.UUID, version_id: uuid.UUID) -> DocumentVersion:
    """One transaction: lock the document, supersede the old current version, make this one current.
    The database index guarantees at most one approved_current version per document."""
    get_document(db, actor, document_id)  # access check first
    document = _load_document(db, document_id, lock=True)
    version = get_version(document, actor, version_id)
    if version.status != VersionStatus.draft:
        raise ApiError(409, "not_draft", "Only a draft version can be approved")
    previous = next((v for v in document.versions if v.status == VersionStatus.approved_current), None)
    if previous is not None:
        previous.status = VersionStatus.superseded
        if version.effective_from and previous.effective_to is None:
            previous.effective_to = max(version.effective_from - timedelta(days=1), previous.effective_from or date.min)
        version.supersedes_version_id = previous.id
        db.flush()  # free the "one current" slot before taking it
    version.status = VersionStatus.approved_current
    version.approved_by_id = actor.id
    version.approved_at = datetime.now(timezone.utc)
    db.flush()
    audit.record(db, actor_id=actor.id, event="version.approve", resource_type="version", resource_id=str(version.id),
                 detail={"document_id": str(document_id), "superseded": str(previous.id) if previous else None})
    db.commit()
    return get_version(_load_document(db, document_id), actor, version_id)


def archive_version(db: Session, actor: User, document_id: uuid.UUID, version_id: uuid.UUID) -> DocumentVersion:
    document = get_document(db, actor, document_id, lock=True)
    version = get_version(document, actor, version_id)
    if version.status == VersionStatus.archived:
        raise ApiError(409, "already_archived", "This version is already archived")
    version.status = VersionStatus.archived
    db.flush()
    audit.record(db, actor_id=actor.id, event="version.archive", resource_type="version", resource_id=str(version.id),
                 detail={"document_id": str(document_id)})
    db.commit()
    return get_version(_load_document(db, document_id), actor, version_id)


# ---------------------------------------------------------------- files and comparison

def read_file(db: Session, store: ObjectStore, user: User, document_id: uuid.UUID, version_id: uuid.UUID):
    document = get_document(db, user, document_id)
    version = get_version(document, user, version_id)
    data = store.get(version.object_key)
    audit.record(db, actor_id=user.id, event="file.view", resource_type="version", resource_id=str(version.id))
    db.commit()
    return version, data


def compare_versions(
    db: Session, store: ObjectStore, user: User, document_id: uuid.UUID, from_id: uuid.UUID, to_id: uuid.UUID,
):
    document = get_document(db, user, document_id)
    a, b = get_version(document, user, from_id), get_version(document, user, to_id)
    if a.mime_type != "text/plain" or b.mime_type != "text/plain":
        raise ApiError(422, "not_text", "Comparison works for text files for now; PDF and DOCX arrive with text extraction")
    old, new = store.get(a.object_key).decode("utf-8"), store.get(b.object_key).decode("utf-8")
    lines: list[DiffLine] = []
    for raw in difflib.unified_diff(old.splitlines(), new.splitlines(), lineterm="", n=2):
        if raw.startswith(("---", "+++")):
            continue
        kind = "hunk" if raw.startswith("@@") else "add" if raw.startswith("+") else "del" if raw.startswith("-") else "ctx"
        lines.append(DiffLine(kind=kind, text=raw if kind == "hunk" else raw[1:]))
        if len(lines) >= 2000:
            break
    return a, b, lines
