import enum
from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy import Column, Date, DateTime, Enum as SAEnum, ForeignKey, Integer, String, Table, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Role(str, enum.Enum):
    admin = "admin"
    staff = "staff"
    service = "service"


class BusinessLine(str, enum.Enum):
    general_insurance = "general_insurance"
    credit = "credit"
    pf_gf = "pf_gf"
    corporate = "corporate"


class DocType(str, enum.Enum):
    handbook = "handbook"
    sop = "sop"
    circular = "circular"
    policy_wording = "policy_wording"
    product_catalogue = "product_catalogue"
    form = "form"
    guideline = "guideline"
    training = "training"
    other = "other"


class VersionStatus(str, enum.Enum):
    draft = "draft"
    current = "current"
    superseded = "superseded"


def _enum(enum_cls):
    return SAEnum(enum_cls, native_enum=False, length=32, validate_strings=True)


user_groups = Table(
    "user_groups", Base.metadata,
    Column("user_id", ForeignKey("users.id"), primary_key=True),
    Column("group_id", ForeignKey("groups.id"), primary_key=True),
)

folder_read_groups = Table(
    "folder_read_groups", Base.metadata,
    Column("folder_id", ForeignKey("folders.id"), primary_key=True),
    Column("group_id", ForeignKey("groups.id"), primary_key=True),
)


class Group(Base):
    __tablename__ = "groups"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(100), unique=True)
    full_name: Mapped[str] = mapped_column(String(200))
    password_hash: Mapped[str] = mapped_column(String(300))
    role: Mapped[Role] = mapped_column(_enum(Role))
    groups: Mapped[list[Group]] = relationship(secondary=user_groups)


class Folder(Base):
    __tablename__ = "folders"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    parent_id: Mapped[Optional[int]] = mapped_column(ForeignKey("folders.id"), nullable=True)
    parent: Mapped[Optional["Folder"]] = relationship(back_populates="children", remote_side="Folder.id")
    children: Mapped[list["Folder"]] = relationship(back_populates="parent")
    read_groups: Mapped[list[Group]] = relationship(secondary=folder_read_groups)


class Document(Base):
    __tablename__ = "documents"
    id: Mapped[int] = mapped_column(primary_key=True)
    folder_id: Mapped[int] = mapped_column(ForeignKey("folders.id"))
    folder: Mapped[Folder] = relationship()
    title: Mapped[str] = mapped_column(String(300))
    business_line: Mapped[BusinessLine] = mapped_column(_enum(BusinessLine))
    doc_type: Mapped[DocType] = mapped_column(_enum(DocType))
    owner: Mapped[str] = mapped_column(String(200), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    versions: Mapped[list["DocumentVersion"]] = relationship(
        back_populates="document", order_by="DocumentVersion.version_number", cascade="all, delete-orphan",
    )


class DocumentVersion(Base):
    __tablename__ = "document_versions"
    __table_args__ = (UniqueConstraint("document_id", "version_number"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    document_id: Mapped[int] = mapped_column(ForeignKey("documents.id"))
    document: Mapped[Document] = relationship(back_populates="versions")
    version_number: Mapped[int] = mapped_column(Integer)
    filename: Mapped[str] = mapped_column(String(300))
    content_type: Mapped[str] = mapped_column(String(100))
    size_bytes: Mapped[int] = mapped_column(Integer)
    sha256: Mapped[str] = mapped_column(String(64))
    storage_path: Mapped[str] = mapped_column(String(200))
    effective_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    status: Mapped[VersionStatus] = mapped_column(_enum(VersionStatus))
    uploaded_by: Mapped[str] = mapped_column(String(100))
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    note: Mapped[str] = mapped_column(Text, default="")


class Change(Base):
    """Append-only feed the knowledge layer polls to index incrementally."""
    __tablename__ = "changes"
    seq: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    version_id: Mapped[int] = mapped_column(ForeignKey("document_versions.id"))
    version: Mapped[DocumentVersion] = relationship()
    kind: Mapped[str] = mapped_column(String(30))  # "created" | "status_changed"
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class AuditEntry(Base):
    __tablename__ = "audit_entries"
    id: Mapped[int] = mapped_column(primary_key=True)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    username: Mapped[str] = mapped_column(String(100))
    action: Mapped[str] = mapped_column(String(50))
    target_type: Mapped[str] = mapped_column(String(50))
    target_id: Mapped[int] = mapped_column(Integer)
    detail: Mapped[str] = mapped_column(Text, default="")
