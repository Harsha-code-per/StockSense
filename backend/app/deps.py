"""Shared FastAPI dependencies: DB session, current user, role guard."""

from typing import Annotated

from fastapi import Cookie, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.errors import Forbidden, Unauthorized
from app.models import User
from app.security import SESSION_COOKIE, decode_access_token

DbSession = Annotated[Session, Depends(get_db)]


def get_current_user(
    db: DbSession,
    token: Annotated[str | None, Cookie(alias=SESSION_COOKIE)] = None,
) -> User:
    user_id = decode_access_token(token) if token else None
    user = db.get(User, user_id) if user_id else None
    if user is None or not user.is_active:
        raise Unauthorized("Please log in to continue.")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_manager(user: CurrentUser) -> User:
    if user.role != "manager":
        raise Forbidden("Only managers can perform this action.")
    return user


ManagerUser = Annotated[User, Depends(require_manager)]
