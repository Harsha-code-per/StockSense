from fastapi import APIRouter
from sqlalchemy import text

from app.deps import DbSession

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health")
def health(db: DbSession) -> dict:
    db.execute(text("SELECT 1"))
    return {"status": "ok", "db": "ok"}
