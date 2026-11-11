"""Dashboard numbers for admins and managers. Counts only: no question or answer text, no document titles, and no
names, so it cannot reveal anything the audit log is designed not to store."""

from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import Date, Integer, cast, distinct, func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import require_manager
from ..models import (AuditEvent, BusinessLine, Document, DocumentChunk, DocumentVersion, IngestionJob, JobState, User,
                      VersionStatus)
from ..schemas import (CountItem, DashboardActivity, DashboardDocuments, DashboardIndexing, DashboardOut, DayCount)

router = APIRouter(tags=["dashboard"])

OUTCOMES = ["answered", "conflict", "no_evidence", "needs_clarification", "model_unavailable"]


def _counts(rows, order: list[str]) -> list[CountItem]:
    found = {str(key.value if hasattr(key, "value") else key): count for key, count in rows}
    return [CountItem(key=key, count=found.get(key, 0)) for key in order]


@router.get("/dashboard", response_model=DashboardOut)
def dashboard(days: int = Query(14, ge=1, le=90), user: User = Depends(require_manager), db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=days)

    version_rows = db.execute(select(DocumentVersion.status, func.count()).group_by(DocumentVersion.status)).all()
    line_rows = db.execute(
        select(BusinessLine.code, func.count(distinct(Document.id)))
        .join(Document, Document.business_line_id == BusinessLine.id)
        .join(DocumentVersion, DocumentVersion.document_id == Document.id)
        .where(DocumentVersion.status == VersionStatus.approved_current).group_by(BusinessLine.code)).all()
    lines = [row[0].value for row in db.execute(select(BusinessLine.code).order_by(BusinessLine.code)).all()]
    newest = (select(DocumentVersion.document_id, func.max(DocumentVersion.created_at).label("at"))
              .group_by(DocumentVersion.document_id).subquery())
    awaiting = db.execute(select(func.count()).select_from(DocumentVersion).join(
        newest, (newest.c.document_id == DocumentVersion.document_id) & (newest.c.at == DocumentVersion.created_at))
        .where(DocumentVersion.status == VersionStatus.draft)).scalar_one()
    documents = DashboardDocuments(
        documents=db.execute(select(func.count()).select_from(Document)).scalar_one(), awaiting_approval=awaiting,
        by_status=_counts(version_rows, [s.value for s in VersionStatus]), by_business_line=_counts(line_rows, lines),
        demo_fixtures=db.execute(select(func.count()).select_from(Document).where(Document.is_demo_fixture.is_(True))).scalar_one())

    job_rows = db.execute(select(IngestionJob.state, func.count()).group_by(IngestionJob.state)).all()
    indexing = DashboardIndexing(
        indexed_passages=db.execute(select(func.count()).select_from(DocumentChunk)).scalar_one(),
        jobs=_counts(job_rows, [s.value for s in JobState]),
        average_duration_ms=(lambda v: int(v) if v is not None else None)(
            db.execute(select(func.avg(IngestionJob.duration_ms)).where(IngestionJob.state == JobState.indexed)).scalar_one()))

    asks = (AuditEvent.event == "chat.ask") & (AuditEvent.created_at >= since)
    status = AuditEvent.detail["status"].astext
    outcome_rows = db.execute(select(status, func.count()).where(asks).group_by(status)).all()
    day = cast(AuditEvent.created_at, Date)
    per_day = {row[0]: row[1] for row in db.execute(select(day, func.count()).where(asks).group_by(day)).all()}
    today = now.date()
    series = [DayCount(day=today - timedelta(days=offset), questions=per_day.get(today - timedelta(days=offset), 0))
              for offset in range(days - 1, -1, -1)]
    activity = DashboardActivity(
        days=days, questions=db.execute(select(func.count()).where(asks)).scalar_one(),
        outcomes=_counts(outcome_rows, OUTCOMES),
        with_version_warnings=db.execute(select(func.count()).where(asks, cast(AuditEvent.detail["warnings"].astext, Integer) > 0)).scalar_one(),
        searches=db.execute(select(func.count()).where(AuditEvent.event == "search.query", AuditEvent.created_at >= since)).scalar_one(),
        denied=db.execute(select(func.count()).where(AuditEvent.result == "denied", AuditEvent.created_at >= since)).scalar_one(),
        active_people=db.execute(select(func.count(distinct(AuditEvent.actor_id))).where(
            AuditEvent.created_at >= since, AuditEvent.actor_id.is_not(None), AuditEvent.result == "ok")).scalar_one(),
        per_day=series)
    return DashboardOut(generated_at=now, documents=documents, indexing=indexing, activity=activity)
