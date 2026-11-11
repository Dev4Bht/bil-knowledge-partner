from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..config import Settings, get_settings
from ..db import get_db
from ..deps import csrf_guard, current_user, get_embedder
from ..models import User
from ..schemas import SearchHitOut, SearchIn, SearchOut
from ..search import Hit, hybrid_search
from ..services import audit

router = APIRouter(tags=["search"], dependencies=[Depends(csrf_guard)])
PAGE_SIZE = 10


def hit_url(hit: Hit) -> str:
    return f"/documents/{hit.document_id}/versions/{hit.version_id}/pages/{hit.page or 1}"


def hit_out(hit: Hit) -> SearchHitOut:
    section = " ".join(x for x in (f"§{hit.section_label}" if hit.section_label else None, hit.heading) if x) or None
    return SearchHitOut(
        id=hit.chunk_id, document_id=hit.document_id, version_id=hit.version_id, title=hit.title,
        folder_path=hit.folder_path, business_line=hit.business_line, version_label=hit.version_label,
        version_status=hit.version_status, section=section, page=hit.page, snippet=hit.snippet, url=hit_url(hit),
        score=round(hit.score, 5), is_demo_fixture=hit.is_demo_fixture,
    )


@router.post("/search", response_model=SearchOut)
def search(body: SearchIn, user: User = Depends(current_user), db: Session = Depends(get_db),
           settings: Settings = Depends(get_settings), embedder=Depends(get_embedder)):
    hits, meta = hybrid_search(db, user, embedder, body.query, vector_max_distance=settings.vector_max_distance,
                               business_line=body.business_line, include_history=body.status == "history", limit=50)
    facets: dict[str, int] = {}
    for hit in hits:
        facets[hit.business_line] = facets.get(hit.business_line, 0) + 1
    audit.record(db, actor_id=user.id, event="search.query", resource_type="search",  # no query text is stored
                 detail={"results": len(hits), "mode": meta.mode, "history": body.status == "history"})
    db.commit()
    start = (body.page - 1) * PAGE_SIZE
    return SearchOut(items=[hit_out(h) for h in hits[start:start + PAGE_SIZE]], total=len(hits),
                     facets={"business_line": facets}, mode=meta.mode, notes=meta.notes)
