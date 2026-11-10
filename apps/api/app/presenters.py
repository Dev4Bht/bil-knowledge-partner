from . import access
from .models import BusinessLine, Document, DocumentVersion, Folder, User, VersionStatus
from .schemas import (
    BusinessLineOut, DocumentDetail, DocumentSummary, FolderOut, FolderRef, UserOut, VersionOut,
)


def folder_path(folder: Folder) -> str:
    parts: list[str] = []
    node: Folder | None = folder
    while node is not None:
        parts.append(node.name)
        node = node.parent
    return "/".join(reversed(parts))


def user_out(user: User) -> UserOut:
    return UserOut(id=user.id, email=user.email, display_name=user.display_name,
                   roles=sorted(role.name for role in user.roles))


def business_line_out(line: BusinessLine) -> BusinessLineOut:
    return BusinessLineOut(code=line.code, name=line.name)


def folder_out(folder: Folder) -> FolderOut:
    return FolderOut(id=folder.id, name=folder.name, path=folder_path(folder),
                     business_line=folder.business_line.code, parent_id=folder.parent_id,
                     required_role=folder.required_role.name if folder.required_role else None)


def version_out(version: DocumentVersion, indexing_status: str = "not_indexed") -> VersionOut:
    return VersionOut(
        id=version.id, document_id=version.document_id, version_label=version.version_label, status=version.status,
        effective_from=version.effective_from, effective_to=version.effective_to, approved_at=version.approved_at,
        approved_by=version.approved_by.display_name if version.approved_by else None,
        supersedes_version_id=version.supersedes_version_id, original_filename=version.original_filename,
        mime_type=version.mime_type, size_bytes=version.size_bytes, sha256=version.sha256, language=version.language,
        source_lineage=version.source_lineage,
        uploaded_by=version.uploaded_by.display_name if version.uploaded_by else None,
        created_at=version.created_at, indexing_status=indexing_status,
    )


def document_summary(user: User, document: Document, indexing: dict | None = None) -> DocumentSummary:
    indexing = indexing or {}
    versions = access.visible_versions(user, document)
    current = next((v for v in versions if v.status == VersionStatus.approved_current), None)
    latest = versions[0] if versions else None

    def out(v: DocumentVersion | None):
        return version_out(v, indexing.get(v.id, "not_indexed")) if v else None

    return DocumentSummary(
        id=document.id, title=document.title, description=document.description,
        business_line=business_line_out(document.business_line),
        folder=FolderRef(id=document.folder.id, name=document.folder.name, path=folder_path(document.folder)),
        access_classification=document.access_classification, is_demo_fixture=document.is_demo_fixture,
        owner=document.owner.display_name if document.owner else None,
        current_version=out(current), latest_version=out(latest), version_count=len(versions),
        updated_at=document.updated_at,
    )


def document_detail(user: User, document: Document, indexing: dict | None = None) -> DocumentDetail:
    indexing = indexing or {}
    summary = document_summary(user, document, indexing)
    versions = [version_out(v, indexing.get(v.id, "not_indexed")) for v in access.visible_versions(user, document)]
    return DocumentDetail(**summary.model_dump(), versions=versions,
                          access_roles=sorted(role.name for role in document.access_roles))
