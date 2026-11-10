"""Indexing pipeline: stored original -> extraction -> section/page-aware chunks -> local embeddings -> search index.

Jobs live in the database (no Redis). Processing is idempotent: re-running a job replaces that version's chunks.
If embeddings are unavailable the chunks are still stored for keyword search and the job carries a warning.
"""

import time
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..embeddings import Embedder, EmbeddingUnavailable
from ..extraction import chunk_sections, extract
from ..models import DocumentChunk, DocumentVersion, IngestionJob, JobState, QualityFlag
from ..storage import ObjectStore

MAX_ATTEMPTS = 3
STALE_AFTER = timedelta(minutes=10)
EMBED_BATCH = 16


def enqueue(db: Session, version_id: uuid.UUID) -> IngestionJob:
    """Queue indexing for a version unless a job for it is already waiting or running."""
    existing = db.execute(select(IngestionJob).where(
        IngestionJob.version_id == version_id, IngestionJob.state.in_([JobState.queued, JobState.processing]),
    )).scalars().first()
    if existing:
        return existing
    job = IngestionJob(version_id=version_id, state=JobState.queued)
    db.add(job)
    db.flush()
    return job


def claim_next(db: Session) -> IngestionJob | None:
    """Take the oldest queued job (or one stuck in 'processing' for too long). Safe with several workers."""
    stale = datetime.now(timezone.utc) - STALE_AFTER
    job = db.execute(
        select(IngestionJob)
        .where((IngestionJob.state == JobState.queued)
               | ((IngestionJob.state == JobState.processing) & (IngestionJob.started_at < stale)))
        .order_by(IngestionJob.created_at).limit(1).with_for_update(skip_locked=True)
    ).scalars().first()
    if job is None:
        return None
    job.state = JobState.processing
    job.attempts += 1
    job.started_at = datetime.now(timezone.utc)
    db.commit()
    return job


def _embedding_text(title: str, heading: str | None, text: str) -> str:
    return f"{title} | {heading or ''} | {text}"


def process_job(db: Session, store: ObjectStore, embedder: Embedder, job: IngestionJob) -> None:
    started = time.monotonic()
    job_id = job.id
    try:
        version = db.get(DocumentVersion, job.version_id)
        if version is None:
            raise ValueError("The version no longer exists")
        title = version.document.title
        extraction = extract(version.mime_type, store.get(version.object_key))
        chunks = chunk_sections(extraction.sections)
        if not chunks:
            raise ValueError("No readable text was found in this file")
        warnings = list(extraction.warnings)

        vectors: list[list[float]] | None = []
        try:
            for i in range(0, len(chunks), EMBED_BATCH):
                batch = chunks[i:i + EMBED_BATCH]
                vectors.extend(embedder.embed([_embedding_text(title, c.heading, c.text) for c in batch]))
        except EmbeddingUnavailable as exc:
            vectors = None
            warnings.append(f"Embeddings unavailable ({exc}); this version is searchable by keyword only")

        db.execute(delete(DocumentChunk).where(DocumentChunk.version_id == version.id))
        for index, chunk in enumerate(chunks):
            db.add(DocumentChunk(
                version_id=version.id, ordinal=chunk.ordinal, text=chunk.text, page_start=chunk.page_start,
                page_end=chunk.page_end, heading=chunk.heading, section_label=chunk.section_label,
                char_start=chunk.char_start, char_end=chunk.char_end,
                quality_flag=QualityFlag.needs_review if warnings and chunk.page_start is None and version.mime_type == "application/pdf" else QualityFlag.ok,
                embedding=vectors[index] if vectors else None,
            ))
        job = db.get(IngestionJob, job_id)
        job.state, job.error = JobState.indexed, None
        job.warning = "; ".join(warnings) or None
        job.chunk_count = len(chunks)
    except Exception as exc:
        db.rollback()
        job = db.get(IngestionJob, job_id)
        job.error = f"{type(exc).__name__}: {exc}"[:500]
        job.state = JobState.failed if job.attempts >= MAX_ATTEMPTS else JobState.queued
    job.finished_at = datetime.now(timezone.utc)
    job.duration_ms = int((time.monotonic() - started) * 1000)
    db.commit()


def process_next(db: Session, store: ObjectStore, embedder: Embedder) -> bool:
    job = claim_next(db)
    if job is None:
        return False
    process_job(db, store, embedder, job)
    return True
