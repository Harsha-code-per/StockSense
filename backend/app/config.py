from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All configuration comes from environment variables (or backend/.env)."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://stocksense:stocksense@localhost:5432/stocksense"
    jwt_secret: str = "dev-insecure-secret-change-me"
    jwt_expire_minutes: int = 480
    cookie_secure: bool = False
    frontend_origin: str = "http://localhost:3000"

    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "StockSense <no-reply@stocksense.dev>"


settings = Settings()
