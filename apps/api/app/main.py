from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from .config import get_settings
from .db import get_engine
from .storage import ObjectStore


def check_database() -> dict:
    try:
        with get_engine().connect() as connection:
            connection.execute(text("SELECT 1"))
        return {"ok": True}
    except Exception as exc:
        return {"ok": False, "detail": f"{type(exc).__name__}: {exc}"}


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="BIL Knowledge Partner API", version="0.1.0")

    # Restrictive CORS: only the web app's origin, only the verbs the API uses.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.web_origin],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
    )

    @app.get("/health")
    def health() -> dict:
        """Liveness: the process is up. Does not touch any dependency."""
        return {"status": "ok"}

    @app.get("/ready")
    def ready():
        """Readiness: the database and object store are reachable."""
        checks = {"database": check_database(), "object_store": ObjectStore(settings).check()}
        ok = all(c["ok"] for c in checks.values())
        return JSONResponse({"status": "ready" if ok else "not_ready", "checks": checks}, status_code=200 if ok else 503)

    return app


app = create_app()
