"""Needs the Postgres service: docker compose --env-file .env -f infra/docker-compose.yml up -d postgres"""

import uuid

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import get_engine
from app.main import create_app
from app.models import (
    BusinessLine, BusinessLineCode, Document, DocumentVersion, Folder, VersionStatus,
)

pytestmark = pytest.mark.integration


@pytest.fixture(scope="module")
def migrated_engine():
    engine = get_engine()
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except Exception as exc:
        pytest.skip(f"Postgres not reachable: {exc}")
    command.upgrade(Config("alembic.ini"), "head")
    return engine


@pytest.fixture
def db(migrated_engine):
    """A session inside a transaction that is always rolled back, so tests leave no data behind."""
    connection = migrated_engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection, join_transaction_mode="create_savepoint")
    yield session
    session.close()
    transaction.rollback()
    connection.close()


def _document(db) -> Document:
    line = db.query(BusinessLine).filter_by(code=BusinessLineCode.general_insurance).one_or_none()
    if line is None:
        line = BusinessLine(code=BusinessLineCode.general_insurance, name="General Insurance")
        db.add(line)
        db.flush()
    folder = Folder(name=f"Handbooks-{uuid.uuid4().hex[:8]}", business_line_id=line.id)
    db.add(folder)
    db.flush()
    doc = Document(title="Motor Handbook", business_line_id=line.id, folder_id=folder.id)
    db.add(doc)
    db.flush()
    return doc


def _version(doc: Document, label: str, status: VersionStatus) -> DocumentVersion:
    return DocumentVersion(
        document_id=doc.id, version_label=label, status=status, object_key=f"k/{label}",
        original_filename=f"{label}.txt", sha256="0" * 64, mime_type="text/plain", size_bytes=1,
    )


def test_database_allows_only_one_approved_current_version_per_document(db):
    doc = _document(db)
    db.add(_version(doc, "v1", VersionStatus.approved_current))
    db.flush()
    db.add(_version(doc, "v2", VersionStatus.superseded))
    db.flush()  # many superseded versions are fine
    db.add(_version(doc, "v3", VersionStatus.approved_current))
    with pytest.raises(IntegrityError):
        db.flush()


def test_version_labels_are_unique_per_document(db):
    doc = _document(db)
    db.add(_version(doc, "v1", VersionStatus.draft))
    db.flush()
    db.add(_version(doc, "v1", VersionStatus.draft))
    with pytest.raises(IntegrityError):
        db.flush()


def test_ready_is_green_with_database_and_filesystem_store(migrated_engine, tmp_path, monkeypatch):
    monkeypatch.setenv("OBJECT_STORE_PATH", str(tmp_path))
    from app.config import get_settings

    get_settings.cache_clear()
    try:
        response = TestClient(create_app()).get("/ready")
    finally:
        get_settings.cache_clear()
    assert response.status_code == 200
    assert response.json()["checks"]["database"]["ok"] is True
    assert response.json()["checks"]["object_store"]["backend"] == "filesystem"
