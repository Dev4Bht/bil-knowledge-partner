from collections.abc import Iterable

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..errors import ConflictError, NotFoundError, ValidationFailed
from ..models import Folder, Group, User
from ..permissions import can_read_folder
from . import audit


def get_or_create_group(session: Session, name: str) -> Group:
    group = session.scalar(select(Group).where(Group.name == name))
    if group is None:
        group = Group(name=name)
        session.add(group)
        session.flush()
    return group


def folder_path(folder: Folder) -> str:
    parts = []
    node: Folder | None = folder
    while node is not None:
        parts.append(node.name)
        node = node.parent
    return "/".join(reversed(parts))


def create_folder(
    session: Session, *, name: str, parent_id: int | None = None,
    read_groups: Iterable[str] = (), actor: str = "system",
) -> Folder:
    name = name.strip()
    if not name or "/" in name:
        raise ValidationFailed("Folder name must not be empty or contain '/'")
    if parent_id is not None and session.get(Folder, parent_id) is None:
        raise NotFoundError(f"Parent folder {parent_id} not found")
    if session.scalar(select(Folder).where(Folder.name == name, Folder.parent_id == parent_id)) is not None:
        raise ConflictError(f"Folder '{name}' already exists here")
    folder = Folder(name=name, parent_id=parent_id, read_groups=[get_or_create_group(session, g) for g in read_groups])
    session.add(folder)
    session.flush()
    audit.record(session, username=actor, action="folder_created", target_type="folder", target_id=folder.id, detail=name)
    session.commit()
    return folder


def get_folder_by_path(session: Session, path: str) -> Folder | None:
    parent_id: int | None = None
    folder: Folder | None = None
    for part in path.split("/"):
        folder = session.scalar(select(Folder).where(Folder.name == part, Folder.parent_id == parent_id))
        if folder is None:
            return None
        parent_id = folder.id
    return folder


def list_readable_folders(session: Session, user: User) -> list[Folder]:
    folders = [f for f in session.scalars(select(Folder)) if can_read_folder(user, f)]
    return sorted(folders, key=folder_path)
