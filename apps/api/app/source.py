"""The boundary between a document system and the knowledge layer (CLAUDE.md section 2).

The AI side reads documents ONLY through a `DocumentSource`. Today that is `LocalDMSAdapter`, backed by this
project's temporary DMS. BIL's real DMS would be a second implementation (`BILDMSReadOnlyAdapter`, a stub), after
BIL supplies the API details and the permission and metadata mapping. Adapters are read-only by design.
"""

import uuid
from dataclasses import dataclass
from datetime import date, datetime
from typing import Iterator, Protocol

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload, selectinload

from .models import Document, DocumentVersion, Folder
from .presenters import folder_path
from .storage import ObjectStore


@dataclass(frozen=True)
class SourceVersion:
    source_document_id: str
    version_id: str
    version_label: str
    status: str  # draft | approved_current | superseded | archived (mapped from the source system)
    effective_from: date | None
    effective_to: date | None
    approved_at: datetime | None
    sha256: str
    mime_type: str
    size_bytes: int
    language: str
    filename: str


@dataclass(frozen=True)
class SourceDocument:
    source_document_id: str
    title: str
    business_line: str
    folder_path: str
    access_classification: str
    allowed_roles: tuple[str, ...]
    is_demo_fixture: bool
    changed_at: datetime


@dataclass(frozen=True)
class SourceAcl:
    classification: str
    allowed_roles: tuple[str, ...]
    folder_required_role: str | None


class DocumentSource(Protocol):
    def list_documents(self, changed_since: datetime | None, cursor: str | None) -> tuple[list[SourceDocument], str | None]:
        """Incremental sync: documents changed since a time, with a cursor for the next page (None when done)."""

    def get_document_stream(self, source_document_id: str, version_id: str) -> Iterator[bytes]:
        """The original file bytes of one immutable version."""

    def get_document_metadata(self, source_document_id: str, version_id: str) -> SourceVersion: ...

    def get_version_history(self, source_document_id: str) -> list[SourceVersion]: ...

    def get_acl(self, source_document_id: str, version_id: str) -> SourceAcl: ...


class LocalDMSAdapter:
    """Reads this project's temporary DMS. Read-only: it never writes to the database or the object store."""

    PAGE = 100

    def __init__(self, db: Session, store: ObjectStore):
        self.db, self.store = db, store

    def _document(self, source_document_id: str) -> Document:
        doc = self.db.execute(select(Document).where(Document.id == uuid.UUID(source_document_id)).options(
            joinedload(Document.folder).joinedload(Folder.parent), joinedload(Document.folder).joinedload(Folder.required_role),
            joinedload(Document.business_line), selectinload(Document.versions), selectinload(Document.access_roles))).unique().scalar_one_or_none()
        if doc is None:
            raise KeyError(f"unknown document {source_document_id}")
        return doc

    @staticmethod
    def _version(doc: Document, v: DocumentVersion) -> SourceVersion:
        return SourceVersion(str(doc.id), str(v.id), v.version_label, v.status.value, v.effective_from, v.effective_to,
                             v.approved_at, v.sha256, v.mime_type, v.size_bytes, v.language, v.original_filename)

    def list_documents(self, changed_since, cursor):
        offset = int(cursor or 0)
        stmt = select(Document).options(joinedload(Document.folder).joinedload(Folder.parent), joinedload(Document.business_line),
                                        selectinload(Document.access_roles)).order_by(Document.updated_at, Document.id)
        if changed_since:
            stmt = stmt.where(Document.updated_at >= changed_since)
        rows = self.db.execute(stmt.limit(self.PAGE + 1).offset(offset)).unique().scalars().all()
        page = rows[:self.PAGE]
        docs = [SourceDocument(str(d.id), d.title, d.business_line.code.value, folder_path(d.folder), d.access_classification.value,
                               tuple(sorted(r.name for r in d.access_roles)), d.is_demo_fixture, d.updated_at) for d in page]
        return docs, (str(offset + self.PAGE) if len(rows) > self.PAGE else None)

    def get_document_stream(self, source_document_id, version_id):
        version = self.db.get(DocumentVersion, uuid.UUID(version_id))
        if version is None or str(version.document_id) != source_document_id:
            raise KeyError("unknown version")
        yield self.store.get(version.object_key)

    def get_document_metadata(self, source_document_id, version_id):
        doc = self._document(source_document_id)
        version = next((v for v in doc.versions if str(v.id) == version_id), None)
        if version is None:
            raise KeyError("unknown version")
        return self._version(doc, version)

    def get_version_history(self, source_document_id):
        doc = self._document(source_document_id)
        return [self._version(doc, v) for v in sorted(doc.versions, key=lambda v: v.created_at)]

    def get_acl(self, source_document_id, version_id):
        doc = self._document(source_document_id)
        node, required = doc.folder, None
        while node is not None and required is None:  # the nearest folder scope applies
            required = node.required_role.name if node.required_role else None
            node = node.parent
        return SourceAcl(doc.access_classification.value, tuple(sorted(r.name for r in doc.access_roles)), required)


class BILDMSReadOnlyAdapter:
    """STUB. Not connected to anything. BIL's real DMS is not accessible to this project and no endpoint is assumed.

    TODO (needs input from BIL's IT team before any of this can be written):
      - how to authenticate (service account, token, SSO) and the read-only API or staging directory to use
      - how BIL folders and document types map to business lines (general_insurance, credit, pf_gf, corporate)
      - how BIL marks a version as approved, current, superseded or archived, and where effective dates live
      - how BIL access rights (groups, folder permissions) map to the roles used here, and how to read them per document
      - an incremental change feed (or last-modified timestamps) for list_documents
    Every method raises until those answers exist, so nothing can silently pretend to be connected.
    """

    def _not_connected(self):
        raise NotImplementedError("The BIL DMS adapter is a stub: BIL's integration details have not been provided")

    def list_documents(self, changed_since, cursor): self._not_connected()
    def get_document_stream(self, source_document_id, version_id): self._not_connected()
    def get_document_metadata(self, source_document_id, version_id): self._not_connected()
    def get_version_history(self, source_document_id): self._not_connected()
    def get_acl(self, source_document_id, version_id): self._not_connected()
