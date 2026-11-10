import hashlib
from pathlib import Path


class FileStorage:
    """Content-addressed file store. Original file names live in the database, never on disk."""

    def __init__(self, root: Path):
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)

    def save(self, data: bytes) -> tuple[str, str]:
        sha = hashlib.sha256(data).hexdigest()
        relative = f"{sha[:2]}/{sha}"
        target = self.root / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        if not target.exists():
            target.write_bytes(data)
        return relative, sha

    def path(self, relative: str) -> Path:
        resolved = (self.root / relative).resolve()
        if not resolved.is_relative_to(self.root.resolve()):
            raise ValueError("path escapes storage root")
        return resolved
