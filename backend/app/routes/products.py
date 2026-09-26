from typing import Annotated

from fastapi import APIRouter, Depends, status

from app.deps import CurrentUser, DbSession, ManagerUser
from app.schemas.common import Page, PageParams
from app.schemas.product import ProductCreate, ProductDetail, ProductOut, ProductUpdate, StockStatus
from app.services import product_service

router = APIRouter(prefix="/api/products", tags=["products"])


@router.get("", response_model=Page[ProductOut])
def list_products(
    db: DbSession,
    _: CurrentUser,
    paging: Annotated[PageParams, Depends()],
    search: str | None = None,
    category_id: int | None = None,
    stock_status: StockStatus | None = None,
    is_active: bool | None = None,
):
    return product_service.list_products(
        db,
        paging,
        search=search,
        category_id=category_id,
        stock_status_filter=stock_status,
        is_active=is_active,
    )


@router.post("", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
def create_product(data: ProductCreate, db: DbSession, _: ManagerUser):
    return product_service.create_product(db, data)


@router.get("/{product_id}", response_model=ProductDetail)
def get_product(product_id: int, db: DbSession, _: CurrentUser):
    return product_service.get_product(db, product_id)


@router.patch("/{product_id}", response_model=ProductOut)
def update_product(product_id: int, data: ProductUpdate, db: DbSession, _: ManagerUser):
    return product_service.update_product(db, product_id, data)
