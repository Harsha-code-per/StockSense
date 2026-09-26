from datetime import datetime

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, Index, String, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.enums import Role, sql_in
from app.models.base import Base, CreatedAtMixin, IdMixin, TimestampMixin


class User(IdMixin, TimestampMixin, Base):
    __tablename__ = "users"
    __table_args__ = (CheckConstraint(f"role IN ({sql_in(Role)})", name="role"),)

    email: Mapped[str] = mapped_column(String(254))
    name: Mapped[str] = mapped_column(String(120))
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), server_default="staff")
    is_active: Mapped[bool] = mapped_column(server_default=text("true"))
    failed_login_count: Mapped[int] = mapped_column(server_default=text("0"))
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


Index("uq_users_email_lower", func.lower(User.email), unique=True)


class PasswordReset(IdMixin, CreatedAtMixin, Base):
    """OTP challenge for password reset. The raw OTP is never stored, only its bcrypt hash."""

    __tablename__ = "password_resets"
    __table_args__ = (Index("ix_password_resets_user_created", "user_id", text("created_at DESC")),)

    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"))
    otp_hash: Mapped[str] = mapped_column(String(255))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    attempts: Mapped[int] = mapped_column(server_default=text("0"))
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
