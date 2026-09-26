from decimal import Decimal

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.enums import Uom, sql_in
from app.models.base import Base, CreatedAtMixin, IdMixin, TimestampMixin

# Exact decimal quantities (kg, litres). Never floats.
Qty = Numeric(18, 3)


class Category(IdMixin, CreatedAtMixin, Base):
    __tablename__ = "categories"

    name: Mapped[str] = mapped_column(String(80))


Index("uq_categories_name_lower", func.lower(Category.name), unique=True)


class Product(IdMixin, TimestampMixin, Base):
    __tablename__ = "products"
    __table_args__ = (
        CheckConstraint("sku ~ '^[A-Z0-9][A-Z0-9_-]*$'", name="sku_format"),
        CheckConstraint(f"uom IN ({sql_in(Uom)})", name="uom"),
        CheckConstraint("min_qty >= 0", name="min_qty_non_negative"),
        CheckConstraint("max_qty >= min_qty", name="max_gte_min"),
    )

    sku: Mapped[str] = mapped_column(String(40), unique=True)
    name: Mapped[str] = mapped_column(String(160))
    category_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("categories.id", ondelete="SET NULL"), index=True
    )
    uom: Mapped[str] = mapped_column(String(20))
    min_qty: Mapped[Decimal] = mapped_column(Qty, server_default=text("0"))
    max_qty: Mapped[Decimal] = mapped_column(Qty, server_default=text("0"))
    description: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(server_default=text("true"))

    category: Mapped[Category | None] = relationship(lazy="joined")


Index("ix_products_name_lower", func.lower(Product.name))
