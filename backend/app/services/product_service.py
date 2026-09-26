from decimal import Decimal

from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from app.errors import ValidationFailed, field_error
from app.models import Category, Product, StockBalance, User
from app.schemas.common import Page, PageParams
from app.schemas.operation import LineIn, OperationCreate
from app.schemas.product import (
    CategoryCreate,
    CategoryOut,
    ProductCreate,
    ProductDetail,
    ProductOut,
    ProductUpdate,
    StockByLocation,
)
from app.services import operation_service
from app.services.common import get_or_404, paginate, require_ref
from app.services.inventory_service import (
    on_hand_subquery,
    recent_moves,
    stock_status,
    suggested_order,
)

# ---------- categories ----------


def list_categories(db: Session) -> list[Category]:
    return list(db.scalars(select(Category).order_by(Category.name)))


def create_category(db: Session, data: CategoryCreate) -> Category:
    category = Category(name=data.name)
    db.add(category)
    db.commit()
    return category


# ---------- products ----------


def product_out(p: Product, on_hand: Decimal) -> ProductOut:
    return ProductOut(
        id=p.id,
        sku=p.sku,
        name=p.name,
        category=CategoryOut.model_validate(p.category) if p.category else None,
        uom=p.uom,
        min_qty=p.min_qty,
        max_qty=p.max_qty,
        description=p.description,
        on_hand=on_hand,
        stock_status=stock_status(on_hand, p.min_qty),
        suggested_order=suggested_order(on_hand, p.min_qty, p.max_qty),
        is_active=p.is_active,
        created_at=p.created_at,
    )


def _on_hand(db: Session, product_id: int) -> Decimal:
    sq = on_hand_subquery()
    return db.scalar(select(sq.c.on_hand).where(sq.c.product_id == product_id)) or Decimal("0")


def list_products(
    db: Session,
    paging: PageParams,
    *,
    search: str | None = None,
    category_id: int | None = None,
    stock_status_filter: str | None = None,
    is_active: bool | None = None,
) -> Page[ProductOut]:
    sq = on_hand_subquery()
    on_hand = func.coalesce(sq.c.on_hand, 0)
    stmt = (
        select(Product, on_hand.label("on_hand"))
        .outerjoin(sq, sq.c.product_id == Product.id)
        .order_by(Product.name)
    )
    if search:
        stmt = stmt.where(
            Product.sku.icontains(search, autoescape=True)
            | Product.name.icontains(search, autoescape=True)
        )
    if category_id is not None:
        stmt = stmt.where(Product.category_id == category_id)
    if is_active is not None:
        stmt = stmt.where(Product.is_active == is_active)
    if stock_status_filter:
        stmt = stmt.where(
            {
                "out": on_hand <= 0,
                "low": and_(on_hand > 0, on_hand < Product.min_qty),
                "in_stock": and_(on_hand > 0, on_hand >= Product.min_qty),
            }[stock_status_filter]
        )
    rows, total = paginate(db, stmt, paging)
    return Page(
        items=[product_out(p, oh) for p, oh in rows],
        total=total,
        page=paging.page,
        page_size=paging.page_size,
    )


def get_product(db: Session, product_id: int) -> ProductDetail:
    p = get_or_404(db, Product, product_id, "Product")
    balances = db.scalars(
        select(StockBalance)
        .where(StockBalance.product_id == product_id, StockBalance.quantity != 0)
        .order_by(StockBalance.location_id)
    )
    return ProductDetail(
        **product_out(p, _on_hand(db, product_id)).model_dump(),
        stock_by_location=[
            StockByLocation(
                location_id=b.location_id,
                location_name=b.location.full_name,
                warehouse_id=b.location.warehouse_id,
                quantity=b.quantity,
            )
            for b in balances
        ],
        recent_moves=recent_moves(db, product_id),
    )


def create_product(db: Session, data: ProductCreate, user: User) -> ProductOut:
    """Create a product. Initial stock is posted as a validated adjustment in the SAME
    transaction, so opening stock has ledger evidence like every other change."""
    if data.category_id is not None:
        require_ref(db, Category, data.category_id, "category_id", "Category")
    product = Product(**data.model_dump(exclude={"initial_quantity", "initial_location_id"}))
    db.add(product)
    db.flush()  # duplicate SKU -> IntegrityError -> 409 DUPLICATE (field "sku")
    if data.initial_quantity > 0:
        opening = OperationCreate(
            type="adjustment",
            source_location_id=data.initial_location_id,
            notes="Initial stock",
            lines=[LineIn(product_id=product.id, counted_quantity=data.initial_quantity)],
        )
        try:
            op = operation_service.build_operation(db, opening, user)
        except ValidationFailed as e:  # report the location problem on the product form field
            raise field_error("initial_location_id", "Location not found or inactive.") from e
        operation_service.apply_stock(db, op, user)
    db.commit()
    return product_out(product, data.initial_quantity)


def update_product(db: Session, product_id: int, data: ProductUpdate) -> ProductOut:
    product = get_or_404(db, Product, product_id, "Product")
    changes = data.model_dump(exclude_unset=True)
    if changes.get("category_id") is not None:
        require_ref(db, Category, changes["category_id"], "category_id", "Category")
    for field, value in changes.items():
        if value is None and field not in ("category_id", "description"):
            continue  # ignore explicit nulls on required fields
        setattr(product, field, value)
    if product.max_qty < product.min_qty:
        raise field_error("max_qty", "Max quantity must be greater than or equal to min quantity.")
    db.commit()
    return product_out(product, _on_hand(db, product_id))
