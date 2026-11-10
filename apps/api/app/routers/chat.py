import re
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Response
from sqlalchemy import delete, func, select
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
from ..schemas import AskIn, AskOut, ConversationDetail, ConversationSummary, MessageOut, RenameIn
from ..services import audit
from ..services.chat_history import make_title, revalidate

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
        conversation = Conversation(user_id=user.id, title=make_title(body.question))
        db.add(conversation)
        db.flush()
    earlier = db.execute(select(Message).where(Message.conversation_id == conversation.id)
                         .order_by(Message.created_at.desc()).limit(6)).scalars().all()
    history = [{"role": m.role, "content": m.content} for m in reversed(earlier)]

    ctx = Ctx(db=db, user=user, embedder=embedder, llm=llm, settings=settings, business_line=body.business_line,
              include_history=body.include_history, language=body.language, translator=translator)
    result = run_ask(ctx, body.question, history, conversation.id, include_diagnostics=access.is_admin(user))

    asked_at = datetime.now(timezone.utc)  # set explicitly: both rows share one transaction, so now() would tie them
    db.add(Message(conversation_id=conversation.id, role="user", content=body.question, created_at=asked_at))
    stored = result.model_copy(update={"unsupported_claims": []}).model_dump(mode="json")
    db.add(Message(conversation_id=conversation.id, role="assistant", content=result.answer or result.abstention_reason or "",
                   source_version_ids=sorted({str(c.version_id) for c in result.citations}), payload=stored,
                   created_at=datetime.now(timezone.utc)))
    conversation.updated_at = datetime.now(timezone.utc)
    audit.record(db, actor_id=user.id, event="chat.ask", resource_type="conversation", resource_id=str(conversation.id),
                 detail={"status": result.status, "citations": len(result.citations), "warnings": len(result.version_warnings),
                         "steps": [s.agent for s in result.steps]})  # never the question or the answer
    db.commit()
    return result


# ---------------------------------------------------------------- saved chats (each user sees only their own)

def _own(db: Session, user: User, conversation_id: uuid.UUID) -> Conversation:
    conversation = db.get(Conversation, conversation_id)
    if conversation is None or conversation.user_id != user.id:
        raise not_found("Chat not found")  # the same answer for "missing" and "someone else's"
    return conversation


def _summary(db: Session, conversation: Conversation) -> ConversationSummary:
    count = db.execute(select(func.count()).select_from(Message).where(Message.conversation_id == conversation.id,
                                                                       Message.role == "user")).scalar_one()
    return ConversationSummary(id=conversation.id, title=conversation.title, created_at=conversation.created_at,
                               updated_at=conversation.updated_at, question_count=count)


@router.get("/conversations", response_model=list[ConversationSummary])
def list_conversations(limit: int = 100, user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.execute(select(Conversation).where(Conversation.user_id == user.id)
                      .order_by(Conversation.updated_at.desc()).limit(max(1, min(limit, 200)))).scalars().all()
    return [_summary(db, c) for c in rows]


@router.get("/conversations/{conversation_id}", response_model=ConversationDetail)
def get_conversation(conversation_id: uuid.UUID, user: User = Depends(current_user), db: Session = Depends(get_db)):
    conversation = _own(db, user, conversation_id)
    messages = db.execute(select(Message).where(Message.conversation_id == conversation.id)
                          .order_by(Message.created_at, Message.role.desc())).scalars().all()  # on a tie, "user" comes first
    out = []
    for message in messages:
        result, notices = (revalidate(db, user, message.payload) if message.payload else (None, []))
        hidden = bool(message.payload) and result is not None and result.answer is None and bool(notices)
        out.append(MessageOut(id=message.id, role=message.role, content="" if hidden else message.content,
                              created_at=message.created_at, result=result, notices=notices))
    return ConversationDetail(id=conversation.id, title=conversation.title, created_at=conversation.created_at,
                              updated_at=conversation.updated_at, messages=out)


@router.patch("/conversations/{conversation_id}", response_model=ConversationSummary)
def rename_conversation(conversation_id: uuid.UUID, body: RenameIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    conversation = _own(db, user, conversation_id)
    title = re.sub(r"\s+", " ", body.title).strip()
    if not title:
        raise ApiError(422, "bad_title", "A chat needs a title")
    conversation.title = title
    audit.record(db, actor_id=user.id, event="chat.rename", resource_type="conversation", resource_id=str(conversation.id))
    db.commit()
    return _summary(db, conversation)


@router.delete("/conversations/{conversation_id}", status_code=204)
def delete_conversation(conversation_id: uuid.UUID, user: User = Depends(current_user), db: Session = Depends(get_db)):
    conversation = _own(db, user, conversation_id)
    db.delete(conversation)  # messages go with it (ON DELETE CASCADE)
    audit.record(db, actor_id=user.id, event="chat.delete", resource_type="conversation", resource_id=str(conversation_id))
    db.commit()
    return Response(status_code=204)


@router.delete("/conversations", status_code=204)
def delete_all_conversations(user: User = Depends(current_user), db: Session = Depends(get_db)):
    removed = db.execute(delete(Conversation).where(Conversation.user_id == user.id)).rowcount
    audit.record(db, actor_id=user.id, event="chat.delete_all", resource_type="conversation", detail={"count": removed})
    db.commit()
    return Response(status_code=204)
