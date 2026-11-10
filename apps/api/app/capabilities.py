"""What the running system can actually do. The UI reads this so it never pretends a feature exists."""

import httpx
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .config import Settings
from .models import IngestionJob, JobState
from .schemas import CapabilitiesOut

# Flipped to True only when the feature is built and tested (docs/progress.md).
EXTRACTION_BUILT = True
SEARCH_BUILT = True
AGENTS_BUILT = True
TRANSLATION_BUILT = True  # experimental: always labelled for human validation


def ollama_status(settings: Settings) -> tuple[bool, str | None, str | None]:
    """(reachable, model_present_name_or_None, error)."""
    try:
        response = httpx.get(f"{settings.ollama_base_url}/api/tags", timeout=1.5)
        response.raise_for_status()
        names = [m.get("name", "") for m in response.json().get("models", [])]
        wanted = settings.ollama_model
        found = next((n for n in names if n == wanted or n.split(":")[0] == wanted.split(":")[0] and wanted in n), None)
        return True, found, None if found else f"model '{wanted}' is not pulled"
    except Exception as exc:
        return False, None, f"{type(exc).__name__}"


def _has_model(settings: Settings, wanted: str) -> bool:
    try:
        response = httpx.get(f"{settings.ollama_base_url}/api/tags", timeout=1.5)
        return any(m.get("name", "").split(":")[0] == wanted.split(":")[0] for m in response.json().get("models", []))
    except Exception:
        return False


def compute_capabilities(settings: Settings, db: Session) -> CapabilitiesOut:
    reachable, model, error = ollama_status(settings)
    llm = reachable and model is not None
    notes: list[str] = []
    counts = dict(db.execute(select(IngestionJob.state, func.count()).group_by(IngestionJob.state)).all())
    indexed, pending, failed = (counts.get(JobState.indexed, 0), counts.get(JobState.queued, 0) + counts.get(JobState.processing, 0),
                                counts.get(JobState.failed, 0))
    notes.append(f"Search index: {indexed} version(s) indexed, {pending} waiting, {failed} failed.")
    if not _has_model(settings, settings.embedding_model):
        notes.append(f"The embedding model '{settings.embedding_model}' is not available, so search is keyword-only.")
    if not reachable:
        notes.append("The local model server (Ollama) is not reachable.")
    elif model is None:
        notes.append(f"The local model '{settings.ollama_model}' has not been downloaded.")
    if TRANSLATION_BUILT:
        notes.append("Dzongkha drafts are experimental machine translations and always need human validation.")
    return CapabilitiesOut(dms=True, extraction=EXTRACTION_BUILT, search=SEARCH_BUILT and EXTRACTION_BUILT,
                           llm=llm and AGENTS_BUILT, translation=TRANSLATION_BUILT and llm,
                           llm_model=model if llm else None, notes=notes)
