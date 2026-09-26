from datetime import datetime
from decimal import Decimal

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, Index, String, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.enums import OperationType, sql_in
from app.models.base import Base, CreatedAtMixin, IdMixin
from app.models.operation import Operation
from app.models.product import Product, Qty
from app.models.user import User
from app.models.warehouse import Location


class StockBalance(Base):
    """On-hand quantity per product per location. Written ONLY by operation_service."""

    __tablename__ = "stock_balances"
    __table_args__ = (CheckConstraint("quantity >= 0", name="quantity_non_negative"),)

    product_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("products.id", ondelete="RESTRICT"), primary_key=True
    )
    location_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("locations.id", ondelete="RESTRICT"), primary_key=True, index=True
    )
    quantity: Mapped[Decimal] = mapped_column(Qty, server_default=text("0"))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    product: Mapped[Product] = relationship(lazy="joined")
    location: Mapped[Location] = relationship(lazy="joined")


class StockLedger(IdMixin, CreatedAtMixin, Base):
    """Append-only movement evidence: one row per (line x location whose balance changed).

    UPDATE/DELETE are rejected by the `stock_ledger_append_only` trigger (see migration 0001).
    """

    __tablename__ = "stock_ledger"
    __table_args__ = (
        CheckConstraint(f"movement_type IN ({sql_in(OperationType)})", name="movement_type"),
        CheckConstraint("quantity_delta <> 0", name="delta_non_zero"),
        CheckConstraint("balance_after >= 0", name="balance_after_non_negative"),
        Index("ix_stock_ledger_product_created", "product_id", "created_at"),
        Index("ix_stock_ledger_location_created", "location_id", "created_at"),
    )

    operation_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("operations.id"), index=True)
    operation_line_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("operation_lines.id"))
    product_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("products.id"))
    location_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("locations.id"))
    counterpart_location_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("locations.id")
    )
    movement_type: Mapped[str] = mapped_column(String(12))
    quantity_delta: Mapped[Decimal] = mapped_column(Qty)
    balance_after: Mapped[Decimal] = mapped_column(Qty)
    created_by: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id"))

    operation: Mapped[Operation] = relationship(lazy="joined")
    product: Mapped[Product] = relationship(lazy="joined")
    location: Mapped[Location] = relationship(foreign_keys=[location_id], lazy="joined")
    counterpart_location: Mapped[Location | None] = relationship(
        foreign_keys=[counterpart_location_id], lazy="joined"
    )
    creator: Mapped[User] = relationship(lazy="joined")
