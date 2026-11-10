import re
import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import access
from ..agents.graph import run_ask
from ..agents.nodes import Ctx
from ..config import Settings, get_settings
from ..db import get_db
from ..deps import chat_limiter, csrf_guard, current_user, get_embedder, get_llm, get_translator
from ..errors import ApiError, not_found
from ..models import Conversation, Message, User
from ..ratelimit import RateLimiter
from ..schemas import AskIn, AskOut
from ..services import audit

router = APIRouter(prefix="/chat", tags=["chat"], dependencies=[Depends(csrf_guard)])
_CID = re.compile(r"(?<!\d)\d{11}(?!\d)")


@router.post("/ask", response_model=AskOut)
def ask(body: AskIn, user: User = Depends(current_user), db: Session = Depends(get_db),
        settings: Settings = Depends(get_settings), embedder=Depends(get_embedder), llm=Depends(get_llm),
        translator=Depends(get_translator), limiter: RateLimiter = Depends(chat_limiter)):
    if not limiter.allow(str(user.id)):
        raise ApiError(429, "rate_limited", "Too many questions. Wait a moment and try again")
    if _CID.search(body.question):
        raise ApiError(422, "personal_data", "Please remove customer identity numbers from the question and ask again")

    if body.conversation_id:
        conversation = db.get(Conversation, body.conversation_id)
        if conversation is None or conversation.user_id != user.id:
            raise not_found("Conversation not found")
    else:
        conversation = Conversation(user_id=user.id)
        db.add(conversation)
        db.flush()
    earlier = db.execute(select(Message).where(Message.conversation_id == conversation.id)
                         .order_by(Message.created_at.desc()).limit(6)).scalars().all()
    history = [{"role": m.role, "content": m.content} for m in reversed(earlier)]

    ctx = Ctx(db=db, user=user, embedder=embedder, llm=llm, settings=settings, business_line=body.business_line,
              include_history=body.include_history, language=body.language, translator=translator)
    result = run_ask(ctx, body.question, history, conversation.id, include_diagnostics=access.is_admin(user))

    db.add(Message(conversation_id=conversation.id, role="user", content=body.question))
    db.add(Message(conversation_id=conversation.id, role="assistant",
                   content=result.answer or result.abstention_reason or "",
                   source_version_ids=sorted({str(c.version_id) for c in result.citations})))
    audit.record(db, actor_id=user.id, event="chat.ask", resource_type="conversation", resource_id=str(conversation.id),
                 detail={"status": result.status, "citations": len(result.citations), "warnings": len(result.version_warnings),
                         "steps": [s.agent for s in result.steps]})  # never the question or the answer
    db.commit()
    return result
