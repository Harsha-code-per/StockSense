from datetime import datetime
from typing import Annotated

from pydantic import EmailStr, Field, field_validator

from app.enums import Role
from app.schemas.common import ApiModel


def validate_password_strength(v: str) -> str:
    if len(v) < 8:
        raise ValueError("Password must be at least 8 characters long.")
    if len(v) > 72:
        raise ValueError("Password cannot exceed 72 characters.")
    if not any(c.isalpha() for c in v):
        raise ValueError("Password must contain at least one letter.")
    if not any(c.isdigit() for c in v):
        raise ValueError("Password must contain at least one digit.")
    return v


class UserOut(ApiModel):
    id: int
    name: str
    email: str
    role: Role
    created_at: datetime


class SignupIn(ApiModel):
    name: Annotated[str, Field(min_length=2, max_length=120)]
    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def _validate_password(cls, v: str) -> str:
        return validate_password_strength(v)


class LoginIn(ApiModel):
    email: EmailStr
    password: Annotated[str, Field(min_length=1, max_length=72)]


class UserUpdateIn(ApiModel):
    name: Annotated[str, Field(min_length=2, max_length=120)]


class ForgotPasswordIn(ApiModel):
    email: EmailStr


class VerifyOtpIn(ApiModel):
    email: EmailStr
    otp: Annotated[str, Field(pattern=r"^\d{6}$")]


class ResetPasswordIn(ApiModel):
    email: EmailStr
    otp: Annotated[str, Field(pattern=r"^\d{6}$")]
    new_password: str

    @field_validator("new_password")
    @classmethod
    def _validate_new_password(cls, v: str) -> str:
        return validate_password_strength(v)


class MessageOut(ApiModel):
    message: str


class VerifyOtpOut(ApiModel):
    valid: bool = True
