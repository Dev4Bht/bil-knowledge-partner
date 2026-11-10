"""Domain model for the DMS (CLAUDE.md section 3).

Originals, versions and approval metadata are the source of truth. Search indexes derived from them
(chunks, embeddings) can always be rebuilt.
"""

import enum
import uuid
from datetime import date, datetime
from typing import Any, Optional

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    Boolean, Column, Computed, Date, DateTime, Enum as SAEnum, ForeignKey, Index, Integer, String, Table, Text,
    UniqueConstraint, Uuid, func, text,
)
from sqlalchemy.dialects.postgresql import JSONB, TSVECTOR
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class BusinessLineCode(str, enum.Enum):
    general_insurance = "general_insurance"
    credit = "credit"
    pf_gf = "pf_gf"
    corporate = "corporate"


class AccessClassification(str, enum.Enum):
    public = "public"          # any signed-in user
    staff = "staff"            # any signed-in staff, manager or admin
    restricted = "restricted"  # only roles listed in document_access_roles (plus admin)


class VersionStatus(str, enum.Enum):
    draft = "draft"
    approved_current = "approved_current"
    superseded = "superseded"
    archived = "archived"


class JobState(str, enum.Enum):
    queued = "queued"
    processing = "processing"
    indexed = "indexed"
    failed = "failed"


class QualityFlag(str, enum.Enum):
    ok = "ok"
    needs_review = "needs_review"


class RelationType(str, enum.Enum):
    modifies = "modifies"
    revokes = "revokes"
    clarifies = "clarifies"


def _enum(enum_cls: type[enum.Enum]) -> SAEnum:
    return SAEnum(enum_cls, native_enum=False, length=32, validate_strings=True,
                  values_callable=lambda e: [member.value for member in e])


def _pk() -> Mapped[uuid.UUID]:
    return mapped_column(Uuid, primary_key=True, default=uuid.uuid4)


def _created() -> Mapped[datetime]:
    return mapped_column(DateTime(timezone=True), server_default=func.now())


user_roles = Table(
    "user_roles", Base.metadata,
    Column("user_id", Uuid, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("role_id", Uuid, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
)

document_access_roles = Table(
    "document_access_roles", Base.metadata,
    Column("document_id", Uuid, ForeignKey("documents.id", ondelete="CASCADE"), primary_key=True),
    Column("role_id", Uuid, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
)


class Role(Base):
    __tablename__ = "roles"
    id: Mapped[uuid.UUID] = _pk()
    name: Mapped[str] = mapped_column(String(50), unique=True)  # admin | manager | staff


class User(Base):
    __tablename__ = "users"
    id: Mapped[uuid.UUID] = _pk()
    email: Mapped[str] = mapped_column(String(320), unique=True)
    display_name: Mapped[str] = mapped_column(String(200))
    password_hash: Mapped[str] = mapped_column(String(300))  # never a plaintext password
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = _created()
    roles: Mapped[list[Role]] = relationship(secondary=user_roles)


class BusinessLine(Base):
    __tablename__ = "business_lines"
    id: Mapped[uuid.UUID] = _pk()
    code: Mapped[BusinessLineCode] = mapped_column(_enum(BusinessLineCode), unique=True)
    name: Mapped[str] = mapped_column(String(100))


class Folder(Base):
    __tablename__ = "folders"
    __table_args__ = (
        Index("uq_folder_root_name", "business_line_id", "name", unique=True, postgresql_where=text("parent_id IS NULL")),
        Index("uq_folder_child_name", "parent_id", "name", unique=True, postgresql_where=text("parent_id IS NOT NULL")),
    )
    id: Mapped[uuid.UUID] = _pk()
    name: Mapped[str] = mapped_column(String(200))
    parent_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("folders.id"), nullable=True)
    business_line_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("business_lines.id"))
    required_role_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("roles.id"), nullable=True)  # optional access scope
    created_at: Mapped[datetime] = _created()
    parent: Mapped[Optional["Folder"]] = relationship(remote_side="Folder.id")
    business_line: Mapped["BusinessLine"] = relationship()
    required_role: Mapped[Optional[Role]] = relationship()


class Document(Base):
    __tablename__ = "documents"
    id: Mapped[uuid.UUID] = _pk()
    title: Mapped[str] = mapped_column(String(300))
    description: Mapped[str] = mapped_column(Text, default="")
    business_line_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("business_lines.id"))
    folder_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("folders.id"))
    owner_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    access_classification: Mapped[AccessClassification] = mapped_column(_enum(AccessClassification), default=AccessClassification.staff)
    # Fictional fixtures are flagged so the UI can never present them as approved BIL content.
    is_demo_fixture: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = _created()
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    folder: Mapped[Folder] = relationship()
    business_line: Mapped[BusinessLine] = relationship()
    owner: Mapped[Optional[User]] = relationship()
    versions: Mapped[list["DocumentVersion"]] = relationship(back_populates="document", order_by="DocumentVersion.created_at")
    access_roles: Mapped[list[Role]] = relationship(secondary=document_access_roles)


class DocumentVersion(Base):
    """Immutable once created: only status and approval fields change, never the stored file or its hash."""

    __tablename__ = "document_versions"
    __table_args__ = (
        UniqueConstraint("document_id", "version_label"),
        # At most one approved_current version per document, enforced by the database.
        Index("uq_one_current_per_document", "document_id", unique=True, postgresql_where=text("status = 'approved_current'")),
    )
    id: Mapped[uuid.UUID] = _pk()
    document_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("documents.id"))
    document: Mapped[Document] = relationship(back_populates="versions")
    version_label: Mapped[str] = mapped_column(String(50))
    effective_from: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    effective_to: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    status: Mapped[VersionStatus] = mapped_column(_enum(VersionStatus), default=VersionStatus.draft)
    approved_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    supersedes_version_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("document_versions.id"), nullable=True)
    object_key: Mapped[str] = mapped_column(String(300))
    original_filename: Mapped[str] = mapped_column(String(300))
    sha256: Mapped[str] = mapped_column(String(64))
    mime_type: Mapped[str] = mapped_column(String(100))
    size_bytes: Mapped[int] = mapped_column(Integer)
    language: Mapped[str] = mapped_column(String(10), default="en")
    source_lineage: Mapped[str] = mapped_column(Text, default="")
    uploaded_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = _created()
    uploaded_by: Mapped[Optional[User]] = relationship(foreign_keys=[uploaded_by_id])
    approved_by: Mapped[Optional[User]] = relationship(foreign_keys=[approved_by_id])


class DocumentChunk(Base):
    """Derived from a version's file. Rebuildable. The embedding column is added with the search backend (phase 3)."""

    __tablename__ = "document_chunks"
    __table_args__ = (
        UniqueConstraint("version_id", "ordinal"),
        Index("ix_chunks_tsv", "tsv", postgresql_using="gin"),
        Index("ix_chunks_embedding", "embedding", postgresql_using="hnsw", postgresql_ops={"embedding": "vector_cosine_ops"}),
    )
    id: Mapped[uuid.UUID] = _pk()
    version_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("document_versions.id", ondelete="CASCADE"))
    ordinal: Mapped[int] = mapped_column(Integer)
    text: Mapped[str] = mapped_column(Text)
    page_start: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    page_end: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    heading: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    section_label: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    char_start: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    char_end: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    quality_flag: Mapped[QualityFlag] = mapped_column(_enum(QualityFlag), default=QualityFlag.ok)
    embedding: Mapped[Optional[list[float]]] = mapped_column(Vector(1024), nullable=True)  # BGE-M3, 1024 dimensions
    tsv: Mapped[Optional[Any]] = mapped_column(
        TSVECTOR, Computed("to_tsvector('english', coalesce(heading, '') || ' ' || text)", persisted=True), nullable=True)
    created_at: Mapped[datetime] = _created()


class IngestionJob(Base):
    __tablename__ = "ingestion_jobs"
    id: Mapped[uuid.UUID] = _pk()
    version_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("document_versions.id", ondelete="CASCADE"))
    state: Mapped[JobState] = mapped_column(_enum(JobState), default=JobState.queued)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    warning: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # indexed, but something was degraded
    chunk_count: Mapped[int] = mapped_column(Integer, default=0)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = _created()


class Conversation(Base):
    __tablename__ = "conversations"
    id: Mapped[uuid.UUID] = _pk()
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = _created()


class Message(Base):
    __tablename__ = "messages"
    id: Mapped[uuid.UUID] = _pk()
    conversation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("conversations.id", ondelete="CASCADE"))
    role: Mapped[str] = mapped_column(String(20))  # user | assistant
    content: Mapped[str] = mapped_column(Text)
    source_version_ids: Mapped[list[Any]] = mapped_column(JSONB, default=list)  # identifiers only, never customer data
    created_at: Mapped[datetime] = _created()


class AuditEvent(Base):
    """No question or answer text is stored here by default."""

    __tablename__ = "audit_events"
    id: Mapped[uuid.UUID] = _pk()
    actor_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    event: Mapped[str] = mapped_column(String(100))
    resource_type: Mapped[str] = mapped_column(String(50))
    resource_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    result: Mapped[str] = mapped_column(String(30))  # ok | denied | error
    detail: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = _created()


class DocumentRelation(Base):
    """Reviewer-approved link such as 'circular X modifies clause Y of handbook Z'.
    Authority is never inferred from dates or filenames; a human sets and approves these."""

    __tablename__ = "document_relations"
    id: Mapped[uuid.UUID] = _pk()
    from_version_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("document_versions.id"))
    to_version_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("document_versions.id"))
    relation_type: Mapped[RelationType] = mapped_column(_enum(RelationType))
    note: Mapped[str] = mapped_column(Text, default="")
    reviewed_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = _created()
