from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.enums import OperationStatus, OperationType, sql_in
from app.models.base import Base, CreatedAtMixin, IdMixin, TimestampMixin
from app.models.product import Product, Qty
from app.models.user import User
from app.models.warehouse import Location, Warehouse

# Which location columns each operation type must (not) have. Enforced by the DB.
_LOCATIONS_BY_TYPE = """
(type = 'receipt'    AND source_location_id IS NULL     AND destination_location_id IS NOT NULL)
OR (type = 'delivery'   AND source_location_id IS NOT NULL AND destination_location_id IS NULL)
OR (type = 'transfer'   AND source_location_id IS NOT NULL AND destination_location_id IS NOT NULL
                        AND source_location_id <> destination_location_id)
OR (type = 'adjustment' AND source_location_id IS NOT NULL AND destination_location_id IS NULL)
"""


class Operation(IdMixin, TimestampMixin, Base):
    """A receipt, delivery, internal transfer or adjustment document."""

    __tablename__ = "operations"
    __table_args__ = (
        CheckConstraint(f"type IN ({sql_in(OperationType)})", name="type"),
        CheckConstraint(f"status IN ({sql_in(OperationStatus)})", name="status"),
        CheckConstraint(_LOCATIONS_BY_TYPE, name="locations_by_type"),
        CheckConstraint(
            "(status = 'done') = (validated_at IS NOT NULL)", name="done_has_validated_at"
        ),
        Index("ix_operations_type_status", "type", "status"),
        Index("ix_operations_warehouse_status", "warehouse_id", "status"),
        Index("ix_operations_created_at", text("created_at DESC")),
    )

    reference: Mapped[str] = mapped_column(String(30), unique=True)
    type: Mapped[str] = mapped_column(String(12))
    status: Mapped[str] = mapped_column(String(10), server_default="draft")
    warehouse_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("warehouses.id"))
    source_location_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("locations.id"), index=True
    )
    destination_location_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("locations.id"), index=True
    )
    partner_name: Mapped[str | None] = mapped_column(String(160))
    scheduled_date: Mapped[date | None] = mapped_column(Date)
    notes: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id"))
    validated_by: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("users.id"))
    validated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    canceled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    warehouse: Mapped[Warehouse] = relationship()
    source_location: Mapped[Location | None] = relationship(foreign_keys=[source_location_id])
    destination_location: Mapped[Location | None] = relationship(
        foreign_keys=[destination_location_id]
    )
    creator: Mapped[User] = relationship(foreign_keys=[created_by])
    validator: Mapped[User | None] = relationship(foreign_keys=[validated_by])
    lines: Mapped[list["OperationLine"]] = relationship(
        back_populates="operation", cascade="all, delete-orphan", order_by="OperationLine.id"
    )


class OperationLine(IdMixin, CreatedAtMixin, Base):
    __tablename__ = "operation_lines"
    __table_args__ = (
        UniqueConstraint("operation_id", "product_id"),
        CheckConstraint("quantity > 0", name="quantity_positive"),
        CheckConstraint("counted_quantity >= 0", name="counted_non_negative"),
        # Exactly one of quantity (moves) / counted_quantity (adjustments) is set.
        CheckConstraint(
            "(quantity IS NULL) <> (counted_quantity IS NULL)", name="one_quantity_kind"
        ),
    )

    operation_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("operations.id", ondelete="CASCADE")
    )
    product_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("products.id"))
    quantity: Mapped[Decimal | None] = mapped_column(Qty)
    counted_quantity: Mapped[Decimal | None] = mapped_column(Qty)
    # Balance snapshot taken when an adjustment is validated (audit trail).
    system_quantity: Mapped[Decimal | None] = mapped_column(Qty)

    operation: Mapped[Operation] = relationship(back_populates="lines")
    product: Mapped[Product] = relationship(lazy="joined")


class OperationSequence(Base):
    """Per-warehouse, per-type reference counter (WH/IN/0001). Incremented under a row lock."""

    __tablename__ = "operation_sequences"
    __table_args__ = (CheckConstraint(f"type IN ({sql_in(OperationType)})", name="type"),)

    warehouse_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("warehouses.id", ondelete="CASCADE"), primary_key=True
    )
    type: Mapped[str] = mapped_column(String(12), primary_key=True)
    next_value: Mapped[int] = mapped_column(Integer, server_default=text("1"))
