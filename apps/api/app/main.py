from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from .config import get_settings
from .db import get_engine
from .errors import ApiError
from .routers import auth, catalog, documents, search, system
from .worker import start_in_background
from .storage import build_object_store


def check_database() -> dict:
    try:
        with get_engine().connect() as connection:
            connection.execute(text("SELECT 1"))
        return {"ok": True}
    except Exception as exc:
        return {"ok": False, "detail": f"{type(exc).__name__}: {exc}"}


def create_app() -> FastAPI:
    settings = get_settings()
    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        indexer = start_in_background(settings) if settings.run_worker else None
        yield
        if indexer:
            indexer[1].set()

    app = FastAPI(title="BIL Knowledge Partner API", version="0.1.0", lifespan=lifespan)

    # Restrictive CORS: only the web app's origin, only the verbs the API uses.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.web_origin],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Content-Type", "X-Requested-With"],
    )

    @app.exception_handler(ApiError)
    async def api_error_handler(_request: Request, exc: ApiError):
        return JSONResponse({"detail": exc.message, "code": exc.code}, status_code=exc.status_code)

    for router in (auth.router, catalog.router, documents.router, search.router, system.router):
        app.include_router(router)

    @app.get("/health")
    def health() -> dict:
        """Liveness: the process is up. Does not touch any dependency."""
        return {"status": "ok"}

    @app.get("/ready")
    def ready():
        """Readiness: the database and object store are reachable."""
        checks = {"database": check_database(), "object_store": build_object_store(settings).check()}
        ok = all(c["ok"] for c in checks.values())
        return JSONResponse({"status": "ready" if ok else "not_ready", "checks": checks}, status_code=200 if ok else 503)

    return app


app = create_app()
