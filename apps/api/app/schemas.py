import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

from .models import AccessClassification, BusinessLineCode, VersionStatus


class LoginIn(BaseModel):
    email: str = Field(max_length=320)
    password: str = Field(max_length=200)


class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    display_name: str
    roles: list[str]


class BusinessLineOut(BaseModel):
    code: BusinessLineCode
    name: str


class FolderIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    business_line: BusinessLineCode
    parent_id: uuid.UUID | None = None
    required_role: str | None = None


class FolderRef(BaseModel):
    id: uuid.UUID
    name: str
    path: str


class FolderOut(FolderRef):
    business_line: BusinessLineCode
    parent_id: uuid.UUID | None
    required_role: str | None


class VersionOut(BaseModel):
    id: uuid.UUID
    document_id: uuid.UUID
    version_label: str
    status: VersionStatus
    effective_from: date | None
    effective_to: date | None
    approved_at: datetime | None
    approved_by: str | None
    supersedes_version_id: uuid.UUID | None
    original_filename: str
    mime_type: str
    size_bytes: int
    sha256: str
    language: str
    source_lineage: str
    uploaded_by: str | None
    created_at: datetime
    indexing_status: Literal["not_indexed", "queued", "processing", "indexed", "failed"] = "not_indexed"


class DocumentSummary(BaseModel):
    id: uuid.UUID
    title: str
    description: str
    business_line: BusinessLineOut
    folder: FolderRef
    access_classification: AccessClassification
    is_demo_fixture: bool
    owner: str | None
    current_version: VersionOut | None
    latest_version: VersionOut | None
    version_count: int
    updated_at: datetime


class DocumentDetail(DocumentSummary):
    versions: list[VersionOut]
    access_roles: list[str]


class DocumentPage(BaseModel):
    items: list[DocumentSummary]
    total: int
    page: int
    page_size: int


class DiffLine(BaseModel):
    kind: Literal["add", "del", "ctx", "hunk"]
    text: str


class CompareOut(BaseModel):
    from_version: VersionOut
    to_version: VersionOut
    lines: list[DiffLine]


class CapabilitiesOut(BaseModel):
    dms: bool
    extraction: bool
    search: bool
    llm: bool
    translation: bool
    llm_model: str | None
    notes: list[str]


class AuditOut(BaseModel):
    id: uuid.UUID
    created_at: datetime
    actor: str | None
    event: str
    resource_type: str
    resource_id: str | None
    result: str
    detail: dict


class AuditPage(BaseModel):
    items: list[AuditOut]
    total: int
    page: int
    page_size: int


class SearchIn(BaseModel):
    query: str = Field(min_length=1, max_length=1000)
    business_line: BusinessLineCode | None = None
    status: Literal["current", "history"] = "current"
    page: int = Field(1, ge=1)


class SearchHitOut(BaseModel):
    id: uuid.UUID
    document_id: uuid.UUID
    version_id: uuid.UUID
    title: str
    folder_path: str
    business_line: BusinessLineCode
    version_label: str
    version_status: VersionStatus
    section: str | None
    page: int | None
    snippet: str
    url: str
    score: float
    is_demo_fixture: bool


class SearchOut(BaseModel):
    items: list[SearchHitOut]
    total: int
    facets: dict[str, dict[str, int]]
    mode: Literal["hybrid", "keyword_only"]
    notes: list[str]


class IngestionJobOut(BaseModel):
    id: uuid.UUID
    version_id: uuid.UUID
    state: Literal["queued", "processing", "indexed", "failed"]
    attempts: int
    error: str | None
    warning: str | None
    chunk_count: int
    duration_ms: int | None


# ---------------------------------------------------------------- /chat/ask (CLAUDE.md section 6)

class AskIn(BaseModel):
    question: str = Field(min_length=3, max_length=2000)
    business_line: BusinessLineCode | None = None
    language: Literal["en", "dz"] | None = None
    include_history: bool = False
    conversation_id: uuid.UUID | None = None


class Citation(BaseModel):
    id: str  # "E1", "E2", ... stable within one response
    document_id: uuid.UUID
    version_id: uuid.UUID
    title: str
    folder_path: str
    version_label: str
    version_status: VersionStatus
    section: str | None
    page: int | None
    snippet: str
    url: str
    is_demo_fixture: bool


class Claim(BaseModel):
    text: str
    citation_ids: list[str]


class VersionWarning(BaseModel):
    kind: Literal["older_version_ignored", "conflict", "draft_excluded", "history_included"]
    message: str
    version_ids: list[uuid.UUID]


class Drafts(BaseModel):
    en: str | None = None
    dzo: str | None = None


class Step(BaseModel):
    agent: str
    summary: str


class AskOut(BaseModel):
    conversation_id: uuid.UUID
    status: Literal["answered", "no_evidence", "conflict", "model_unavailable", "needs_clarification", "error"]
    answer: str | None
    claims: list[Claim]
    citations: list[Citation]
    version_warnings: list[VersionWarning]
    drafts: Drafts
    needs_human_review: bool = True
    abstention_reason: str | None
    caveats: list[str] = []
    draft_notes: list[str] = []
    steps: list[Step] = []
    unsupported_claims: list[str] = []  # diagnostics; the API only fills this for admins


# ---------------------------------------------------------------- chat history

class ConversationSummary(BaseModel):
    id: uuid.UUID
    title: str
    created_at: datetime
    updated_at: datetime
    question_count: int


class MessageOut(BaseModel):
    id: uuid.UUID
    role: Literal["user", "assistant"]
    content: str
    created_at: datetime
    result: AskOut | None = None  # the full answer as it was shown, re-checked against the user's current access
    notices: list[str] = []       # why a saved answer may be out of date, or why its text is hidden


class ConversationDetail(BaseModel):
    id: uuid.UUID
    title: str
    created_at: datetime
    updated_at: datetime
    messages: list[MessageOut]


class RenameIn(BaseModel):
    title: str = Field(min_length=1, max_length=120)
