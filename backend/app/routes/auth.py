from fastapi import APIRouter, Response, status

from app.deps import CurrentUser, DbSession
from app.schemas.auth import (
    ForgotPasswordIn,
    LoginIn,
    MessageOut,
    ResetPasswordIn,
    SignupIn,
    UserOut,
    UserUpdateIn,
    VerifyOtpIn,
    VerifyOtpOut,
)
from app.security import clear_session_cookie, set_session_cookie
from app.services import auth_service

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/signup", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def signup(data: SignupIn, db: DbSession, response: Response) -> UserOut:
    user = auth_service.signup(db, data)
    set_session_cookie(response, user.id)
    return user


@router.post("/login", response_model=UserOut)
def login(data: LoginIn, db: DbSession, response: Response) -> UserOut:
    user = auth_service.login(db, data)
    set_session_cookie(response, user.id)
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(_: CurrentUser, response: Response) -> Response:
    clear_session_cookie(response)
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


@router.get("/me", response_model=UserOut)
def get_me(user: CurrentUser) -> UserOut:
    return auth_service.get_me(user)


@router.patch("/me", response_model=UserOut)
def update_me(data: UserUpdateIn, db: DbSession, user: CurrentUser) -> UserOut:
    return auth_service.update_me(db, user, data)


@router.post("/forgot-password", response_model=MessageOut)
def forgot_password(data: ForgotPasswordIn, db: DbSession) -> MessageOut:
    return auth_service.forgot_password(db, data)


@router.post("/verify-otp", response_model=VerifyOtpOut)
def verify_otp(data: VerifyOtpIn, db: DbSession) -> VerifyOtpOut:
    auth_service.verify_otp(db, data)
    return VerifyOtpOut(valid=True)


@router.post("/reset-password", response_model=MessageOut)
def reset_password(data: ResetPasswordIn, db: DbSession) -> MessageOut:
    return auth_service.reset_password(db, data)
