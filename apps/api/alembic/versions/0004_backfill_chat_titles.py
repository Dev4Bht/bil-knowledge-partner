"""give chats saved before 0003 a real title (their first question) and their true last-updated time

Revision ID: 0004
Revises: 0003
"""
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None

BACKFILL_TITLES = """
UPDATE conversations c
SET title = left(regexp_replace(trim(m.content), '\\s+', ' ', 'g'), 60)
FROM (SELECT DISTINCT ON (conversation_id) conversation_id, content
      FROM messages WHERE role = 'user' ORDER BY conversation_id, created_at) m
WHERE m.conversation_id = c.id AND c.title = 'New chat'
"""

BACKFILL_UPDATED = """
UPDATE conversations c SET updated_at = last.at
FROM (SELECT conversation_id, max(created_at) AS at FROM messages GROUP BY conversation_id) last
WHERE last.conversation_id = c.id
"""


def upgrade() -> None:
    op.execute(BACKFILL_TITLES)
    op.execute(BACKFILL_UPDATED)


def downgrade() -> None:
    pass  # titles and times are harmless to keep
