"""search index: pgvector embeddings, full-text vector, ingestion job warnings

Revision ID: 0002
Revises: 0001
"""
import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects import postgresql

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.add_column("document_chunks", sa.Column("embedding", Vector(1024), nullable=True))
    op.add_column("document_chunks", sa.Column(
        "tsv", postgresql.TSVECTOR(),
        sa.Computed("to_tsvector('english', coalesce(heading, '') || ' ' || text)", persisted=True), nullable=True))
    op.create_index("ix_chunks_tsv", "document_chunks", ["tsv"], postgresql_using="gin")
    op.execute("CREATE INDEX ix_chunks_embedding ON document_chunks USING hnsw (embedding vector_cosine_ops)")
    op.add_column("ingestion_jobs", sa.Column("warning", sa.Text(), nullable=True))
    op.add_column("ingestion_jobs", sa.Column("chunk_count", sa.Integer(), nullable=False, server_default="0"))


def downgrade() -> None:
    op.drop_column("ingestion_jobs", "chunk_count")
    op.drop_column("ingestion_jobs", "warning")
    op.execute("DROP INDEX IF EXISTS ix_chunks_embedding")
    op.drop_index("ix_chunks_tsv", table_name="document_chunks")
    op.drop_column("document_chunks", "tsv")
    op.drop_column("document_chunks", "embedding")
