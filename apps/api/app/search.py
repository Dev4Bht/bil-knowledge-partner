"""Hybrid search: PostgreSQL full-text (BM25-style ranking) plus pgvector similarity, fused with reciprocal rank fusion.

Access control happens INSIDE the retrieval query. The set of version ids a user may see is computed first by the
same rules as the rest of the API (app/access.py) and then used as a hard filter, so a passage the user may not
read is never retrieved, never ranked and never reaches the model. Drafts are never searchable by anyone.
"""

import re
import uuid
from dataclasses import dataclass, field

from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session, joinedload, selectinload

from . import access
from .embeddings import Embedder, EmbeddingUnavailable
from .models import BusinessLine, BusinessLineCode, Document, DocumentChunk, DocumentVersion, Folder, User, VersionStatus
from .presenters import folder_path
from .synonyms import expand

RRF_K = 60
CANDIDATES = 30
# Measured on the real corpus (docs/evaluation.md): vector search put the right passage in the top 8 for every
# question, while the keyword list is noisy on natural-language questions, so it is a minor vote, not an equal one.
VECTOR_WEIGHT = 4.0
KEYWORD_WEIGHT = 1.0


@dataclass
class Hit:
    chunk_id: uuid.UUID
    document_id: uuid.UUID
    version_id: uuid.UUID
    title: str
    folder_path: str
    business_line: str
    version_label: str
    version_status: str
    effective_from: str | None
    section_label: str | None
    heading: str | None
    page: int | None
    text: str
    is_demo_fixture: bool
    score: float
    vector_distance: float | None = None
    keyword_rank: float | None = None

    @property
    def snippet(self) -> str:
        flat = re.sub(r"\s+", " ", self.text).strip()
        return flat if len(flat) <= 320 else flat[:317].rstrip() + "..."


@dataclass
class SearchMeta:
    mode: str = "hybrid"  # "hybrid" | "keyword_only"
    eligible_versions: int = 0
    notes: list[str] = field(default_factory=list)


def eligible_versions(
    db: Session, user: User, *, business_line: BusinessLineCode | None, include_history: bool,
) -> dict[uuid.UUID, tuple[Document, DocumentVersion]]:
    """Versions this user may be shown. Current only, or current plus superseded and archived for history questions."""
    allowed = {VersionStatus.approved_current}
    if include_history:
        allowed |= {VersionStatus.superseded, VersionStatus.archived}
    stmt = select(Document).options(
        joinedload(Document.folder).joinedload(Folder.parent), joinedload(Document.business_line),
        selectinload(Document.versions), selectinload(Document.access_roles),
    )
    if business_line:
        stmt = stmt.where(Document.business_line.has(BusinessLine.code == business_line))
    result: dict[uuid.UUID, tuple[Document, DocumentVersion]] = {}
    for document in db.execute(stmt).unique().scalars():
        if not access.can_see_document(user, document):
            continue
        for version in document.versions:
            if version.status in allowed:  # drafts are excluded here, for everyone
                result[version.id] = (document, version)
    return result


def _keyword_query(query: str, use_synonyms: bool) -> str | None:
    tokens = re.findall(r"[a-z0-9]+", query.lower())
    if use_synonyms:
        tokens += expand(query)
    tokens = list(dict.fromkeys(t for t in tokens if len(t) > 1))
    return " | ".join(tokens) if tokens else None


def fuse_rankings(rankings: list[tuple[list[uuid.UUID], float]]) -> dict[uuid.UUID, float]:
    """Weighted reciprocal rank fusion. `rankings` is [(chunk ids best first, weight), ...]."""
    fused: dict[uuid.UUID, float] = {}
    for ranking, weight in rankings:
        for position, chunk_id in enumerate(ranking, start=1):
            fused[chunk_id] = fused.get(chunk_id, 0.0) + weight / (RRF_K + position)
    return fused


def hybrid_search(
    db: Session, user: User, embedder: Embedder, query: str, *, vector_max_distance: float,
    business_line: BusinessLineCode | None = None, include_history: bool = False, limit: int = 8,
    use_synonyms: bool = True,
) -> tuple[list[Hit], SearchMeta]:
    meta = SearchMeta()
    eligible = eligible_versions(db, user, business_line=business_line, include_history=include_history)
    meta.eligible_versions = len(eligible)
    if not eligible or not query.strip():
        return [], meta
    version_ids = list(eligible)

    keyword: dict[uuid.UUID, float] = {}
    tsquery_text = _keyword_query(query, use_synonyms)
    if tsquery_text:
        tsq = func.to_tsquery("english", tsquery_text)
        rank = func.ts_rank_cd(DocumentChunk.tsv, tsq)
        rows = db.execute(select(DocumentChunk.id, rank.label("r")).where(
            DocumentChunk.version_id.in_(version_ids), DocumentChunk.tsv.op("@@")(tsq),
        ).order_by(desc("r")).limit(CANDIDATES)).all()
        keyword = {row.id: float(row.r) for row in rows}

    vector: dict[uuid.UUID, float] = {}
    try:
        qvec = embedder.embed([query])[0]
        distance = DocumentChunk.embedding.cosine_distance(qvec)
        rows = db.execute(select(DocumentChunk.id, distance.label("d")).where(
            DocumentChunk.version_id.in_(version_ids), DocumentChunk.embedding.is_not(None),
        ).order_by("d").limit(CANDIDATES)).all()
        vector = {row.id: float(row.d) for row in rows if float(row.d) <= vector_max_distance}
    except EmbeddingUnavailable as exc:
        meta.mode = "keyword_only"
        meta.notes.append(f"Semantic search is unavailable ({exc}); using keyword search only")

    fused = fuse_rankings([(sorted(keyword, key=keyword.get, reverse=True), KEYWORD_WEIGHT), (sorted(vector, key=vector.get), VECTOR_WEIGHT)])
    top = sorted(fused, key=fused.get, reverse=True)[:limit]
    if not top:
        return [], meta

    chunks = {c.id: c for c in db.execute(select(DocumentChunk).where(DocumentChunk.id.in_(top))).scalars()}
    hits = []
    for chunk_id in top:
        chunk = chunks[chunk_id]
        document, version = eligible[chunk.version_id]
        hits.append(Hit(
            chunk_id=chunk.id, document_id=document.id, version_id=version.id, title=document.title,
            folder_path=folder_path(document.folder), business_line=document.business_line.code.value,
            version_label=version.version_label, version_status=version.status.value,
            effective_from=version.effective_from.isoformat() if version.effective_from else None,
            section_label=chunk.section_label, heading=chunk.heading, page=chunk.page_start, text=chunk.text,
            is_demo_fixture=document.is_demo_fixture, score=fused[chunk_id],
            vector_distance=vector.get(chunk_id), keyword_rank=keyword.get(chunk_id),
        ))
    return hits, meta
