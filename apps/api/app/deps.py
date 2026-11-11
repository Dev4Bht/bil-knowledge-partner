import uuid
from functools import lru_cache

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from . import access
from .config import Settings, get_settings
from .db import get_db
from .errors import ApiError
from .models import User
from .ratelimit import RateLimiter
from .security import read_session_token
from .storage import ObjectStore, build_object_store

COOKIE_NAME = "bil_session"
SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}
CSRF_HEADER, CSRF_VALUE = "x-requested-with", "bil-web"


def csrf_guard(request: Request) -> None:
    """State-changing requests must carry a custom header. Cross-site pages cannot send it (CORS only
    allows our web origin), which, with SameSite cookies, blocks cross-site request forgery."""
    if request.method not in SAFE_METHODS and request.headers.get(CSRF_HEADER) != CSRF_VALUE:
        raise ApiError(403, "csrf", "Missing or invalid request header")


def current_user(request: Request, db: Session = Depends(get_db), settings: Settings = Depends(get_settings)) -> User:
    token = request.cookies.get(COOKIE_NAME)
    user_id = read_session_token(token, settings.jwt_secret) if token else None
    user = None
    if user_id:
        try:
            user = db.get(User, uuid.UUID(user_id))
        except ValueError:
            user = None
    if user is None or not user.is_active:
        raise ApiError(401, "not_authenticated", "Please sign in")
    return user


def require_manager(user: User = Depends(current_user)) -> User:
    if not access.can_manage(user):
        raise ApiError(403, "forbidden", "You do not have permission to do this")
    return user


def require_admin(user: User = Depends(current_user)) -> User:
    if not access.is_admin(user):
        raise ApiError(403, "forbidden", "Administrator access is required")
    return user


@lru_cache
def _store_for(settings_key: tuple) -> ObjectStore:
    return build_object_store(get_settings())


def get_store(settings: Settings = Depends(get_settings)) -> ObjectStore:
    return _store_for((settings.object_store_backend, settings.object_store_path, settings.s3_endpoint, settings.s3_bucket))


_login_limiter: RateLimiter | None = None


def login_limiter(settings: Settings = Depends(get_settings)) -> RateLimiter:
    global _login_limiter
    if _login_limiter is None or _login_limiter.limit != settings.login_attempts_per_minute:
        _login_limiter = RateLimiter(settings.login_attempts_per_minute)
    return _login_limiter


def get_embedder(settings: Settings = Depends(get_settings)):
    from .embeddings import OllamaEmbedder

    return OllamaEmbedder(settings.ollama_base_url, settings.embedding_model)


def get_llm(settings: Settings = Depends(get_settings)):
    from .agents.llm import OllamaLLM

    return OllamaLLM(settings.ollama_base_url, settings.ollama_model)


_chat_limiter: RateLimiter | None = None


def chat_limiter() -> RateLimiter:
    global _chat_limiter
    if _chat_limiter is None:
        _chat_limiter = RateLimiter(30)  # questions per user per minute
    return _chat_limiter


_page_limiter: RateLimiter | None = None


def page_limiter() -> RateLimiter:
    """Page images per user per minute. Reading a long document page by page is fine; scraping a library is not."""
    global _page_limiter
    if _page_limiter is None:
        _page_limiter = RateLimiter(90)
    return _page_limiter


def get_translator(settings: Settings = Depends(get_settings)):
    from .agents.translate import get_nllb

    return get_nllb(settings.translation_model) if settings.translation_enabled else None
