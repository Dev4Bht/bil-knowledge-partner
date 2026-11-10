from .models import Folder, Role, User


def effective_read_groups(folder: Folder) -> list[str]:
    """Groups allowed to read this folder. Inherited from the nearest ancestor that sets any.
    An empty list means every signed-in user may read it."""
    node: Folder | None = folder
    while node is not None:
        if node.read_groups:
            return sorted(g.name for g in node.read_groups)
        node = node.parent
    return []


def can_read_folder(user: User, folder: Folder) -> bool:
    if user.role in (Role.admin, Role.service):
        return True
    required = effective_read_groups(folder)
    if not required:
        return True
    return bool(set(required) & {g.name for g in user.groups})
