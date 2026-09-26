from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.config import settings

# prepare_threshold=None: no server-side prepared statements, so the same URL works
# behind Neon's PgBouncer pooler (transaction mode) and against a plain local Postgres.
engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    connect_args={"prepare_threshold": None},
)
SessionLocal = sessionmaker(engine, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    """One session per request; anything not committed is rolled back on close."""
    with SessionLocal() as db:
        yield db
