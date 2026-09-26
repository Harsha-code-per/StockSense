import secrets
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.errors import Duplicate, OtpExpired, OtpInvalid, TooManyAttempts, Unauthorized
from app.models.user import PasswordReset, User
from app.schemas.auth import (
    ForgotPasswordIn,
    LoginIn,
    MessageOut,
    ResetPasswordIn,
    SignupIn,
    UserUpdateIn,
    VerifyOtpIn,
)
from app.security import hash_password, verify_password
from app.services.email_service import send_otp_email


def signup(db: Session, data: SignupIn) -> User:
    """Create a new staff user. Reject duplicate emails."""
    normalized_email = data.email.strip().lower()
    existing = db.scalar(select(User).where(func.lower(User.email) == normalized_email))
    if existing:
        raise Duplicate(
            "An account with this email already exists.",
            details={"field": "email"},
            field_errors=[
                {"field": "email", "message": "An account with this email already exists."}
            ],
        )

    user = User(
        email=normalized_email,
        name=data.name.strip(),
        password_hash=hash_password(data.password),
        role="staff",
        is_active=True,
        failed_login_count=0,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def login(db: Session, data: LoginIn) -> User:
    """Authenticate user with email and password. Lock out after 5 consecutive failures."""
    normalized_email = data.email.strip().lower()
    user = db.scalar(select(User).where(func.lower(User.email) == normalized_email))
    if not user or not user.is_active:
        raise Unauthorized("Invalid email or password.")

    now = datetime.now(UTC)

    # Check existing lockout
    if user.locked_until is not None:
        locked_until = (
            user.locked_until if user.locked_until.tzinfo else user.locked_until.replace(tzinfo=UTC)
        )
        if locked_until > now:
            raise TooManyAttempts("Account locked for 15 minutes due to 5 failed login attempts.")
        # Lockout expired; reset counters
        user.locked_until = None
        user.failed_login_count = 0

    if not verify_password(data.password, user.password_hash):
        user.failed_login_count += 1
        if user.failed_login_count >= 5:
            user.locked_until = now + timedelta(minutes=15)
        db.commit()
        raise Unauthorized("Invalid email or password.")

    # Successful login: reset failed login count and lockout
    user.failed_login_count = 0
    user.locked_until = None
    db.commit()
    return user


def get_me(user: User) -> User:
    return user


def update_me(db: Session, user: User, data: UserUpdateIn) -> User:
    """Update profile information (name)."""
    user.name = data.name.strip()
    db.commit()
    db.refresh(user)
    return user


def forgot_password(db: Session, data: ForgotPasswordIn) -> MessageOut:
    """Issue a 6-digit OTP for password reset. Always returns a generic response."""
    normalized_email = data.email.strip().lower()
    user = db.scalar(select(User).where(func.lower(User.email) == normalized_email))

    if user and user.is_active:
        now = datetime.now(UTC)
        # Invalidate any prior active OTPs
        db.execute(
            update(PasswordReset)
            .where(PasswordReset.user_id == user.id, PasswordReset.used_at.is_(None))
            .values(used_at=now)
        )

        otp = f"{secrets.randbelow(1_000_000):06d}"
        reset_entry = PasswordReset(
            user_id=user.id,
            otp_hash=hash_password(otp),
            expires_at=now + timedelta(minutes=10),
            attempts=0,
        )
        db.add(reset_entry)
        db.commit()

        send_otp_email(user.email, otp)

    return MessageOut(message="If the account exists, a code was sent.")


def _get_active_password_reset(db: Session, email: str) -> tuple[User, PasswordReset]:
    normalized_email = email.strip().lower()
    user = db.scalar(select(User).where(func.lower(User.email) == normalized_email))
    if not user or not user.is_active:
        raise OtpInvalid("Invalid or expired OTP.")

    reset_entry = db.scalar(
        select(PasswordReset)
        .where(PasswordReset.user_id == user.id, PasswordReset.used_at.is_(None))
        .order_by(PasswordReset.created_at.desc())
        .limit(1)
    )
    if not reset_entry:
        raise OtpInvalid("Invalid or expired OTP.")

    now = datetime.now(UTC)
    expires_at = (
        reset_entry.expires_at
        if reset_entry.expires_at.tzinfo
        else reset_entry.expires_at.replace(tzinfo=UTC)
    )
    if expires_at < now:
        raise OtpExpired("This OTP has expired. Please request a new code.")

    if reset_entry.attempts >= 5:
        raise TooManyAttempts("Too many incorrect OTP attempts. Please request a new code.")

    return user, reset_entry


def verify_otp(db: Session, data: VerifyOtpIn) -> bool:
    """Verify OTP without consuming it, allowing the UI to proceed to the new password step."""
    _, reset_entry = _get_active_password_reset(db, data.email)

    if not verify_password(data.otp, reset_entry.otp_hash):
        reset_entry.attempts += 1
        db.commit()
        if reset_entry.attempts >= 5:
            raise TooManyAttempts("Too many incorrect OTP attempts. Please request a new code.")
        raise OtpInvalid("Invalid OTP.")

    return True


def reset_password(db: Session, data: ResetPasswordIn) -> MessageOut:
    """Verify OTP and update user password, consuming the OTP."""
    user, reset_entry = _get_active_password_reset(db, data.email)

    if not verify_password(data.otp, reset_entry.otp_hash):
        reset_entry.attempts += 1
        db.commit()
        if reset_entry.attempts >= 5:
            raise TooManyAttempts("Too many incorrect OTP attempts. Please request a new code.")
        raise OtpInvalid("Invalid OTP.")

    now = datetime.now(UTC)
    reset_entry.used_at = now
    user.password_hash = hash_password(data.new_password)
    user.failed_login_count = 0
    user.locked_until = None
    db.commit()

    return MessageOut(message="Password updated.")
