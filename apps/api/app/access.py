"""Who may see what. Enforced on the server for every read; the UI never decides access.

Rules (docs/webapp-design.md section 7.2):
- admin sees everything
- a folder with a required role is visible only to that role (and admin)
- classification: public = any signed-in user, staff = staff/manager/admin, restricted = listed roles (and admin)
- draft versions are visible to admin and manager only
"""

from .models import AccessClassification, Document, DocumentVersion, Folder, User, VersionStatus

PRIVILEGED = {"admin", "manager"}


def role_names(user: User) -> set[str]:
    return {role.name for role in user.roles}


def is_admin(user: User) -> bool:
    return "admin" in role_names(user)


def can_manage(user: User) -> bool:
    return bool(role_names(user) & PRIVILEGED)


def can_see_folder(user: User, folder: Folder) -> bool:
    names = role_names(user)
    if "admin" in names:
        return True
    node: Folder | None = folder
    while node is not None:  # a restriction on a parent folder applies to everything inside it
        if node.required_role is not None and node.required_role.name not in names:
            return False
        node = node.parent
    return True


def can_see_document(user: User, document: Document) -> bool:
    names = role_names(user)
    if "admin" in names:
        return True
    if not can_see_folder(user, document.folder):
        return False
    classification = document.access_classification
    if classification == AccessClassification.public:
        return True
    if classification == AccessClassification.staff:
        return bool(names & {"staff", "manager"})
    return bool(names & {role.name for role in document.access_roles})


def visible_versions(user: User, document: Document) -> list[DocumentVersion]:
    """Newest first. Drafts are hidden from everyone except admin and manager."""
    versions = sorted(document.versions, key=lambda v: v.created_at, reverse=True)
    if can_manage(user):
        return versions
    return [v for v in versions if v.status != VersionStatus.draft]
