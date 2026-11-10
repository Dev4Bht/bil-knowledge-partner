"""chat history: conversation titles and update times, stored answer payloads

Revision ID: 0003
Revises: 0002
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("conversations", sa.Column("title", sa.String(120), nullable=False, server_default="New chat"))
    op.add_column("conversations", sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()))
    op.create_index("ix_conversations_user_updated", "conversations", ["user_id", "updated_at"])
    op.add_column("messages", sa.Column("payload", postgresql.JSONB(), nullable=True))


def downgrade() -> None:
    op.drop_column("messages", "payload")
    op.drop_index("ix_conversations_user_updated", table_name="conversations")
    op.drop_column("conversations", "updated_at")
    op.drop_column("conversations", "title")
