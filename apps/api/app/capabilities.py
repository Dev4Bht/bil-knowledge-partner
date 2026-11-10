"""What the running system can actually do. The UI reads this so it never pretends a feature exists."""

import httpx

from .config import Settings
from .schemas import CapabilitiesOut

# Flipped to True only when the feature is built and tested (docs/progress.md).
EXTRACTION_BUILT = False
SEARCH_BUILT = False
AGENTS_BUILT = False
TRANSLATION_BUILT = False


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


def compute_capabilities(settings: Settings) -> CapabilitiesOut:
    reachable, model, error = ollama_status(settings)
    llm = reachable and model is not None
    notes: list[str] = []
    if not EXTRACTION_BUILT:
        notes.append("Text extraction is not built yet, so uploaded files are stored but not read.")
    if not SEARCH_BUILT:
        notes.append("The search index is not built yet.")
    if not reachable:
        notes.append("The local model server (Ollama) is not reachable.")
    elif model is None:
        notes.append(f"The local model '{settings.ollama_model}' has not been downloaded.")
    if not AGENTS_BUILT:
        notes.append("The question-answering workflow is not built yet.")
    if not TRANSLATION_BUILT:
        notes.append("Dzongkha drafting is not available yet.")
    return CapabilitiesOut(dms=True, extraction=EXTRACTION_BUILT, search=SEARCH_BUILT and EXTRACTION_BUILT,
                           llm=llm and AGENTS_BUILT, translation=TRANSLATION_BUILT and llm,
                           llm_model=model if llm else None, notes=notes)
