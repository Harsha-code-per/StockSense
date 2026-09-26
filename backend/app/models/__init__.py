"""Import every model so Base.metadata is complete (Alembic, tests)."""

from app.models.base import Base
from app.models.inventory import StockBalance, StockLedger
from app.models.operation import Operation, OperationLine, OperationSequence
from app.models.product import Category, Product
from app.models.user import PasswordReset, User
from app.models.warehouse import Location, Warehouse

__all__ = [
    "Base",
    "Category",
    "Location",
    "Operation",
    "OperationLine",
    "OperationSequence",
    "PasswordReset",
    "Product",
    "StockBalance",
    "StockLedger",
    "User",
    "Warehouse",
]
