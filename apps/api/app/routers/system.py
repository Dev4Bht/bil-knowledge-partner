import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from ..capabilities import compute_capabilities
from ..config import Settings, get_settings
from ..db import get_db
from ..deps import current_user, require_admin, require_manager
from ..errors import not_found
from ..models import AuditEvent, IngestionJob, User
from ..schemas import AuditOut, AuditPage, CapabilitiesOut, IngestionJobOut

router = APIRouter(tags=["system"])


@router.get("/capabilities", response_model=CapabilitiesOut)
def capabilities(user: User = Depends(current_user), settings: Settings = Depends(get_settings),
                 db: Session = Depends(get_db)):
    return compute_capabilities(settings, db)


@router.get("/ingestion-jobs/{job_id}", response_model=IngestionJobOut)
def ingestion_job(job_id: uuid.UUID, user: User = Depends(require_manager), db: Session = Depends(get_db)):
    job = db.get(IngestionJob, job_id)
    if job is None:
        raise not_found("Job not found")
    return IngestionJobOut(id=job.id, version_id=job.version_id, state=job.state.value, attempts=job.attempts,
                           error=job.error, warning=job.warning, chunk_count=job.chunk_count, duration_ms=job.duration_ms)


@router.get("/audit", response_model=AuditPage)
def audit_log(
    event: str | None = None, result: str | None = None, page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=100),
    admin: User = Depends(require_admin), db: Session = Depends(get_db),
):
    stmt = select(AuditEvent)
    if event:
        stmt = stmt.where(AuditEvent.event == event)
    if result:
        stmt = stmt.where(AuditEvent.result == result)
    total = db.execute(select(func.count()).select_from(stmt.subquery())).scalar_one()
    rows = db.execute(stmt.order_by(AuditEvent.created_at.desc()).limit(page_size).offset((page - 1) * page_size)).scalars().all()
    actors = {u.id: u.display_name for u in db.execute(select(User).where(User.id.in_({r.actor_id for r in rows if r.actor_id}))).scalars()}
    items = [AuditOut(id=r.id, created_at=r.created_at, actor=actors.get(r.actor_id), event=r.event,
                      resource_type=r.resource_type, resource_id=r.resource_id, result=r.result, detail=r.detail)
             for r in rows]
    return AuditPage(items=items, total=total, page=page, page_size=page_size)
