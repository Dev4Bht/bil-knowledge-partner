import uuid
from typing import Any

from sqlalchemy.orm import Session

from ..models import AuditEvent


def record(
    db: Session, *, actor_id: uuid.UUID | None, event: str, resource_type: str,
    resource_id: str | None = None, result: str = "ok", detail: dict[str, Any] | None = None,
) -> None:
    """Append an audit event. Never put question text, passwords or customer data in `detail`."""
    db.add(AuditEvent(actor_id=actor_id, event=event, resource_type=resource_type,
                      resource_id=resource_id, result=result, detail=detail or {}))
    db.flush()
