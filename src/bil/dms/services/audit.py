from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import AuditEntry


def record(session: Session, *, username: str, action: str, target_type: str, target_id: int, detail: str = "") -> None:
    session.add(AuditEntry(username=username, action=action, target_type=target_type, target_id=target_id, detail=detail))
    session.flush()


def list_entries(session: Session, limit: int = 100) -> list[AuditEntry]:
    return list(session.scalars(select(AuditEntry).order_by(AuditEntry.id.desc()).limit(limit)))
