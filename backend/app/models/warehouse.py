from sqlalchemy import BigInteger, CheckConstraint, ForeignKey, String, Text, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, IdMixin, TimestampMixin


class Warehouse(IdMixin, TimestampMixin, Base):
    __tablename__ = "warehouses"
    __table_args__ = (CheckConstraint("code ~ '^[A-Z0-9]{2,5}$'", name="code_format"),)

    code: Mapped[str] = mapped_column(String(5), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    address: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(server_default=text("true"))

    locations: Mapped[list["Location"]] = relationship(
        back_populates="warehouse", order_by="Location.id"
    )


class Location(IdMixin, TimestampMixin, Base):
    """A place stock can sit: rack, bin, zone, production floor... inside a warehouse."""

    __tablename__ = "locations"
    __table_args__ = (UniqueConstraint("warehouse_id", "name"),)

    warehouse_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("warehouses.id", ondelete="RESTRICT")
    )
    name: Mapped[str] = mapped_column(String(80))
    is_active: Mapped[bool] = mapped_column(server_default=text("true"))

    warehouse: Mapped[Warehouse] = relationship(back_populates="locations", lazy="joined")

    @property
    def full_name(self) -> str:
        return f"{self.warehouse.code}/{self.name}"
