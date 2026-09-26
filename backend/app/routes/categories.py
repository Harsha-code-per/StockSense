from fastapi import APIRouter, status

from app.deps import CurrentUser, DbSession, ManagerUser
from app.schemas.product import CategoryCreate, CategoryOut
from app.services import product_service

router = APIRouter(prefix="/api/categories", tags=["categories"])


@router.get("", response_model=list[CategoryOut])
def list_categories(db: DbSession, _: CurrentUser):
    return product_service.list_categories(db)


@router.post("", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
def create_category(data: CategoryCreate, db: DbSession, _: ManagerUser):
    return product_service.create_category(db, data)
