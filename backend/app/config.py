from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_DEV_SECRET = "dev-insecure-secret-change-me"


class Settings(BaseSettings):
    """All configuration comes from environment variables (or backend/.env)."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://stocksense:stocksense@localhost:5432/stocksense"
    jwt_secret: str = _DEV_SECRET
    jwt_expire_minutes: int = 480
    cookie_secure: bool = False
    frontend_origin: str = "http://localhost:3000"

    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "StockSense <no-reply@stocksense.dev>"

    @field_validator("database_url")
    @classmethod
    def _use_psycopg_driver(cls, v: str) -> str:
        """Accept the plain URL Neon/Render show (postgres:// or postgresql://) as-is."""
        for prefix in ("postgres://", "postgresql://"):
            if v.startswith(prefix):
                return "postgresql+psycopg://" + v.removeprefix(prefix)
        return v

    @model_validator(mode="after")
    def _no_dev_secret_in_production(self):
        if self.cookie_secure and self.jwt_secret == _DEV_SECRET:
            raise ValueError(
                "Set JWT_SECRET: the development default must not be used in production."
            )
        return self


settings = Settings()
