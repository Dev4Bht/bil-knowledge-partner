"""Shared fixtures. API tests run against a real PostgreSQL database named bil_test (created on demand),
never the development database. Start Postgres first:
    docker compose --env-file .env -f infra/docker-compose.yml up -d postgres
"""

import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker

from app.models import Role, User
from app.security import hash_password

TEST_DB = "bil_test"
PASSWORD = "Correct-Horse-9"


@pytest.fixture(scope="session")
def test_env(tmp_path_factory):
    from alembic import command
    from alembic.config import Config

    from app.config import get_settings
    from app.db import reset_engine

    get_settings.cache_clear()
    dev_url = make_url(get_settings().database_url)
    try:
        engine = create_engine(dev_url.set(database="postgres"), isolation_level="AUTOCOMMIT")
        with engine.connect() as connection:
            if not connection.execute(text("SELECT 1 FROM pg_database WHERE datname = :n"), {"n": TEST_DB}).scalar():
                connection.execute(text(f'CREATE DATABASE "{TEST_DB}"'))
        engine.dispose()
    except Exception as exc:
        pytest.skip(f"Postgres not reachable: {exc}")

    objects = tmp_path_factory.mktemp("objects")
    overrides = {
        "DATABASE_URL": dev_url.set(database=TEST_DB).render_as_string(hide_password=False),
        "OBJECT_STORE_BACKEND": "filesystem", "OBJECT_STORE_PATH": str(objects),
        "JWT_SECRET": "test-secret-test-secret-test-secret", "LOGIN_ATTEMPTS_PER_MINUTE": "1000",
        "RUN_WORKER": "false", "SEED_DEMO": "false", "DEMO_PASSWORD": "", "APP_ENV": "dev", "OLLAMA_BASE_URL": "http://127.0.0.1:9",
    }
    saved = {k: os.environ.get(k) for k in overrides}
    os.environ.update(overrides)
    get_settings.cache_clear()
    reset_engine()
    command.upgrade(Config("alembic.ini"), "head")
    yield
    for key, value in saved.items():
        if value is None:
            os.environ.pop(key, None)
        else:
            os.environ[key] = value
    get_settings.cache_clear()
    reset_engine()


@pytest.fixture
def db(test_env):
    """A session on a freshly emptied database that already has roles, business lines and folders."""
    from app.db import get_engine
    from app.seed import ensure_base_data

    engine = get_engine()
    with engine.begin() as connection:
        tables = [t for t in connection.execute(text(
            "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'alembic_version'")).scalars()]
        connection.execute(text("TRUNCATE " + ", ".join(f'"{t}"' for t in tables) + " RESTART IDENTITY CASCADE"))
    with sessionmaker(engine, expire_on_commit=False)() as session:
        ensure_base_data(session)
        yield session


@pytest.fixture
def app(db):
    from app.config import get_settings
    from app.deps import _store_for
    from app.main import create_app

    from app import deps

    get_settings.cache_clear()
    _store_for.cache_clear()
    application = create_app()
    application.dependency_overrides[deps.get_embedder] = lambda: FakeEmbedder()
    return application


@pytest.fixture
def make_user(db):
    from sqlalchemy import select

    def _make(email: str, role: str = "staff", *, active: bool = True, display_name: str | None = None) -> User:
        user = User(email=email, display_name=display_name or email.split("@")[0].title(),
                    password_hash=hash_password(PASSWORD), is_active=active,
                    roles=[db.execute(select(Role).where(Role.name == role)).scalar_one()])
        db.add(user)
        db.commit()
        return user

    return _make


@pytest.fixture
def client_for(app, make_user):
    """client_for('admin') -> a TestClient already signed in as a new admin user."""

    def _client(role: str, *, email: str | None = None) -> TestClient:
        email = email or f"{role}@test.bil"
        make_user(email, role)
        client = TestClient(app)
        client.headers["X-Requested-With"] = "bil-web"
        response = client.post("/auth/login", json={"email": email, "password": PASSWORD})
        assert response.status_code == 200, response.text
        return client

    return _client


@pytest.fixture
def folders(client_for):
    """Map 'line/folder name' -> folder id, read through the API as an admin."""
    admin = client_for("admin", email="folders-admin@test.bil")
    return {f"{f['business_line']}/{f['name']}": f["id"] for f in admin.get("/folders").json()}


def upload(client, folder_id, *, title="Motor Handbook", content=b"Claims must be reported within 7 days.\n",
           filename="motor.txt", business_line="general_insurance", **fields):
    data = {"title": title, "business_line": business_line, "folder_id": folder_id, **fields}
    return client.post("/documents/upload", data=data, files={"file": (filename, content, "text/plain")})


def add_version(client, document_id, *, content, filename="motor2.txt", **fields):
    return client.post(f"/documents/{document_id}/versions", data=fields, files={"file": (filename, content, "text/plain")})


@pytest.fixture
def settings_object_path(test_env):
    from pathlib import Path

    return Path(os.environ["OBJECT_STORE_PATH"])


class FakeEmbedder:
    """Deterministic bag-of-words embedder so search tests need no model. Shared words mean similar vectors."""

    def embed(self, texts):
        import hashlib
        import math
        import re

        vectors = []
        for text in texts:
            vec = [0.0] * 1024
            for word in re.findall(r"[a-z0-9]+", text.lower()):
                vec[int(hashlib.md5(word.encode()).hexdigest(), 16) % 1024] += 1.0
            norm = math.sqrt(sum(x * x for x in vec)) or 1.0
            vectors.append([x / norm for x in vec])
        return vectors


class DownEmbedder:
    def embed(self, texts):
        from app.embeddings import EmbeddingUnavailable

        raise EmbeddingUnavailable("model server is down")
