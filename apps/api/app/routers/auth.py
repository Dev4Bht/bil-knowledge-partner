from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..config import Settings, get_settings
from ..db import get_db
from ..deps import COOKIE_NAME, csrf_guard, current_user, login_limiter
from ..errors import ApiError
from ..models import User
from ..presenters import user_out
from ..ratelimit import RateLimiter
from ..schemas import LoginIn, UserOut
from ..security import create_session_token, verify_password
from ..services import audit

router = APIRouter(prefix="/auth", tags=["auth"], dependencies=[Depends(csrf_guard)])


@router.post("/login", response_model=UserOut)
def login(body: LoginIn, request: Request, response: Response, db: Session = Depends(get_db),
          settings: Settings = Depends(get_settings), limiter: RateLimiter = Depends(login_limiter)):
    email = body.email.strip().lower()
    client = request.client.host if request.client else "unknown"
    if not limiter.allow(f"{client}|{email}"):
        raise ApiError(429, "rate_limited", "Too many sign-in attempts. Wait a minute and try again")
    user = db.execute(select(User).where(func.lower(User.email) == email)).scalar_one_or_none()
    if user is None or not user.is_active or not verify_password(body.password, user.password_hash):
        audit.record(db, actor_id=user.id if user else None, event="auth.login", resource_type="session", result="denied")
        db.commit()
        raise ApiError(401, "invalid_credentials", "Wrong email or password")  # never says which one
    audit.record(db, actor_id=user.id, event="auth.login", resource_type="session")
    db.commit()
    token = create_session_token(str(user.id), settings.jwt_secret, settings.session_ttl_seconds)
    response.set_cookie(COOKIE_NAME, token, max_age=settings.session_ttl_seconds, httponly=True,
                        samesite="lax", secure=settings.cookie_secure, path="/")
    return user_out(user)


@router.post("/logout", status_code=204)
def logout(response: Response):
    response.delete_cookie(COOKIE_NAME, path="/")
    response.status_code = 204
    return response


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)):
    return user_out(user)
