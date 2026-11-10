"""Background indexing. Runs inside the API process by default, or alone with:  python -m app.worker"""

import logging
import threading

from sqlalchemy.orm import sessionmaker

from .config import Settings, get_settings
from .db import get_engine
from .embeddings import OllamaEmbedder
from .services import ingestion
from .storage import build_object_store

log = logging.getLogger("bil.worker")


def run_forever(settings: Settings, stop: threading.Event, poll_seconds: float = 2.0) -> None:
    factory = sessionmaker(get_engine(), expire_on_commit=False)
    store = build_object_store(settings)
    embedder = OllamaEmbedder(settings.ollama_base_url, settings.embedding_model)
    log.info("indexing worker started")
    while not stop.is_set():
        try:
            with factory() as db:
                worked = ingestion.process_next(db, store, embedder)
        except Exception:  # keep the worker alive whatever happens to one job
            log.exception("indexing worker error")
            worked = False
        if not worked:
            stop.wait(poll_seconds)


def start_in_background(settings: Settings) -> tuple[threading.Thread, threading.Event]:
    stop = threading.Event()
    thread = threading.Thread(target=run_forever, args=(settings, stop), name="bil-indexer", daemon=True)
    thread.start()
    return thread, stop


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run_forever(get_settings(), threading.Event())
