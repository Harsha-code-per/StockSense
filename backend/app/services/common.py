from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from app.errors import NotFound, field_error
from app.schemas.common import PageParams


def paginate(db: Session, stmt: Select, paging: PageParams) -> tuple[list, int]:
    """Run `stmt` for one page. Returns (rows, total). Rows are Row tuples."""
    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
    offset = (paging.page - 1) * paging.page_size
    rows = db.execute(stmt.limit(paging.page_size).offset(offset)).all()
    return rows, total


def get_or_404[M](db: Session, model: type[M], obj_id: int, label: str) -> M:
    obj = db.get(model, obj_id)
    if obj is None:
        raise NotFound(f"{label} not found.", {"id": obj_id})
    return obj


def require_ref[M](db: Session, model: type[M], obj_id: int, field: str, label: str) -> M:
    """Like get_or_404, but for ids inside a request body: a missing one is a field error (422)."""
    obj = db.get(model, obj_id)
    if obj is None or getattr(obj, "is_active", True) is False:
        raise field_error(field, f"{label} not found or inactive.")
    return obj
