"""Test setup: a separate `<db>_test` database, migrated fresh each run, truncated after each test.

Point DATABASE_URL at your dev DB as usual; tests never touch it.
"""

from collections.abc import Iterator

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

from app.config import settings

# Must happen before app.database is imported (the engine is built at import time).
_dev_url = make_url(settings.database_url)
_test_url = _dev_url.set(database=f"{_dev_url.database}_test")
settings.database_url = _test_url.render_as_string(hide_password=False)


def _create_test_database() -> None:
    admin = create_engine(_dev_url, isolation_level="AUTOCOMMIT")
    with admin.connect() as conn:
        exists = conn.scalar(
            text("SELECT 1 FROM pg_database WHERE datname = :n"), {"n": _test_url.database}
        )
        if not exists:
            conn.execute(text(f'CREATE DATABASE "{_test_url.database}"'))
    admin.dispose()


@pytest.fixture(scope="session", autouse=True)
def _migrated_database() -> Iterator[None]:
    from alembic.config import Config

    from alembic import command

    _create_test_database()
    from app.database import engine

    with engine.begin() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE; CREATE SCHEMA public"))
    cfg = Config("alembic.ini")
    cfg.attributes["configure_logger"] = False
    command.upgrade(cfg, "head")
    yield
    engine.dispose()


@pytest.fixture(autouse=True)
def _clean_tables() -> Iterator[None]:
    yield
    from app.database import engine
    from app.models import Base

    tables = ", ".join(t.name for t in Base.metadata.sorted_tables)
    with engine.begin() as conn:
        # TRUNCATE is not a row-level DELETE, so the append-only ledger trigger doesn't fire.
        conn.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))


@pytest.fixture
def db():
    from app.database import SessionLocal

    with SessionLocal() as session:
        yield session


@pytest.fixture
def client():
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as c:
        yield c


def _client_for(role: str):
    from fastapi.testclient import TestClient

    from app.database import SessionLocal
    from app.main import app
    from app.models import User
    from app.security import SESSION_COOKIE, create_access_token

    with SessionLocal() as session:
        user = User(email=f"{role}@test.dev", name=role.title(), password_hash="x", role=role)
        session.add(user)
        session.commit()
        user_id = user.id
    c = TestClient(app)
    c.cookies.set(SESSION_COOKIE, create_access_token(user_id))
    c.user_id = user_id
    return c


@pytest.fixture
def manager():
    """HTTP client logged in as a manager (real session cookie)."""
    with _client_for("manager") as c:
        yield c


@pytest.fixture
def staff():
    with _client_for("staff") as c:
        yield c
