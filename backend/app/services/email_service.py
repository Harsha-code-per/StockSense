import logging
import smtplib
from email.message import EmailMessage

from app.config import settings

log = logging.getLogger("stocksense")


def send_otp_email(to_email: str, otp: str) -> None:
    """Send a 6-digit OTP code to the user's email, or print to console if no SMTP."""
    if not settings.smtp_host:
        log.info("Development mode: OTP for %s is %s", to_email, otp)
        banner = (
            f"\n========================================\n"
            f"[StockSense Email] OTP for {to_email}: {otp}\n"
            f"========================================\n"
        )
        print(banner)
        return

    msg = EmailMessage()
    msg["Subject"] = "StockSense Password Reset Code"
    msg["From"] = settings.smtp_from
    msg["To"] = to_email
    msg.set_content(
        "Hello,\n\n"
        f"Your StockSense password reset code is: {otp}\n\n"
        "This code will expire in 10 minutes.\n"
        "If you did not request a password reset, please ignore this email.\n"
    )

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as server:
            server.starttls()
            if settings.smtp_user and settings.smtp_password:
                server.login(settings.smtp_user, settings.smtp_password)
            server.send_message(msg)
            log.info("Password reset email sent to %s", to_email)
    except Exception:
        log.exception(
            "Failed to send OTP email to %s via SMTP; falling back to console log: %s",
            to_email,
            otp,
        )
        fallback_banner = (
            f"\n========================================\n"
            f"[StockSense Email Fallback] OTP for {to_email}: {otp}\n"
            f"========================================\n"
        )
        print(fallback_banner)
