"""Saved chats. A stored answer is a snapshot, so reading it back re-checks every citation against what the user may
see NOW and against the document's CURRENT status (docs/security.md)."""

import re

from sqlalchemy.orm import Session

from .. import access
from ..models import DocumentVersion, User, VersionStatus
from ..schemas import AskOut, Drafts

STATUS_WORDS = {"approved_current": "current", "superseded": "superseded", "archived": "archived", "draft": "a draft"}
HIDDEN_NOTICE = ("This answer used a document you can no longer open, so its text is hidden. "
                 "Ask the question again to get an answer based on what you can see now.")


def make_title(question: str) -> str:
    text = re.sub(r"\s+", " ", question).strip()
    if len(text) <= 60:
        return text or "New chat"
    cut = text[:60].rsplit(" ", 1)[0] or text[:60]
    return cut.rstrip(" ,;:.-") + "…"


def revalidate(db: Session, user: User, payload: dict) -> tuple[AskOut, list[str]]:
    result = AskOut.model_validate(payload)
    result.unsupported_claims = []  # diagnostics are never replayed
    changed: list[str] = []
    for citation in result.citations:
        version = db.get(DocumentVersion, citation.version_id)
        if version is None or version.status == VersionStatus.draft or not access.can_see_document(user, version.document):
            hidden = result.model_copy(update={
                "answer": None, "claims": [], "citations": [], "drafts": Drafts(), "version_warnings": [], "caveats": [],
                "draft_notes": [], "steps": [], "unsupported_claims": [],
            })
            return hidden, [HIDDEN_NOTICE]
        if version.status != citation.version_status:
            changed.append(f"{citation.title} ({citation.version_label}) is now {STATUS_WORDS[version.status.value]}. "
                           "This answer may be out of date; ask again for the current one.")
            citation.version_status = version.status
    return result, list(dict.fromkeys(changed))
