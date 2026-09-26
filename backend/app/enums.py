"""Single source of truth for enumerated values (DB CHECKs and API schemas both use these)."""

from typing import Literal, get_args

Role = Literal["manager", "staff"]
Uom = Literal["unit", "kg", "g", "l", "ml", "m", "box"]
OperationType = Literal["receipt", "delivery", "transfer", "adjustment"]
OperationStatus = Literal["draft", "waiting", "ready", "done", "canceled"]

OPEN_STATUSES: tuple[OperationStatus, ...] = ("draft", "waiting", "ready")
REFERENCE_PREFIX: dict[str, str] = {
    "receipt": "IN",
    "delivery": "OUT",
    "transfer": "INT",
    "adjustment": "ADJ",
}


def sql_in(literal) -> str:
    """Render a Literal's values for a CHECK constraint: 'a', 'b', 'c'."""
    return ", ".join(f"'{v}'" for v in get_args(literal))
