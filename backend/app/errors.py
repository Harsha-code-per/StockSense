"""Domain errors and the single error JSON shape: {code, message, details, field_errors}.

Services raise DomainError subclasses (never HTTPException); handlers here map them to HTTP.
"""

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError
from starlette.exceptions import HTTPException as StarletteHTTPException

log = logging.getLogger("stocksense")


class DomainError(Exception):
    status_code = 400
    code = "ERROR"

    def __init__(
        self,
        message: str,
        details: dict | None = None,
        field_errors: list[dict] | None = None,
    ):
        super().__init__(message)
        self.message = message
        self.details = details or {}
        self.field_errors = field_errors or []


class ValidationFailed(DomainError):
    status_code, code = 422, "VALIDATION_ERROR"


class SameLocation(DomainError):
    status_code, code = 422, "SAME_LOCATION"


class Unauthorized(DomainError):
    status_code, code = 401, "UNAUTHORIZED"


class Forbidden(DomainError):
    status_code, code = 403, "FORBIDDEN"


class NotFound(DomainError):
    status_code, code = 404, "NOT_FOUND"


class Duplicate(DomainError):
    status_code, code = 409, "DUPLICATE"


class InsufficientStock(DomainError):
    status_code, code = 409, "INSUFFICIENT_STOCK"


class InvalidState(DomainError):
    status_code, code = 409, "INVALID_STATE"


class OtpInvalid(DomainError):
    status_code, code = 400, "OTP_INVALID"


class OtpExpired(DomainError):
    status_code, code = 400, "OTP_EXPIRED"


class TooManyAttempts(DomainError):
    status_code, code = 429, "TOO_MANY_ATTEMPTS"


def field_error(field: str, message: str) -> ValidationFailed:
    """Shortcut for a single-field validation error raised from a service."""
    return ValidationFailed(message, field_errors=[{"field": field, "message": message}])


# Unique constraint name -> (API field, friendly message). Lets the DB be the source of truth
# for uniqueness instead of racy "SELECT then INSERT" checks in services.
_UNIQUE_FIELDS = {
    "uq_users_email_lower": ("email", "An account with this email already exists."),
    "uq_categories_name_lower": ("name", "A category with this name already exists."),
    "uq_products_sku": ("sku", "This SKU is already used by another product."),
    "uq_warehouses_code": ("code", "This warehouse code is already taken."),
    "uq_locations_warehouse_id": ("name", "This warehouse already has a location with that name."),
    "uq_operation_lines_operation_id": (
        "lines",
        "Each product can appear only once per operation.",
    ),
}


def _body(code: str, message: str, details=None, field_errors=None) -> dict:
    return {
        "code": code,
        "message": message,
        "details": details or {},
        "field_errors": field_errors or [],
    }


def _field_path(loc: tuple) -> str:
    # ("body", "lines", 0, "quantity") -> "lines.0.quantity"
    parts = [str(p) for p in loc if p not in ("body", "query", "path", "cookie", "header")]
    return ".".join(parts) or "request"


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(DomainError)
    async def _domain(_: Request, exc: DomainError):
        return JSONResponse(
            _body(exc.code, exc.message, exc.details, exc.field_errors), exc.status_code
        )

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError):
        field_errors = [
            {
                "field": _field_path(tuple(e["loc"])),
                "message": e["msg"].removeprefix("Value error, "),
            }
            for e in exc.errors()
        ]
        return JSONResponse(
            _body("VALIDATION_ERROR", "Please fix the highlighted fields.", None, field_errors),
            422,
        )

    @app.exception_handler(IntegrityError)
    async def _integrity(_: Request, exc: IntegrityError):
        diag = getattr(exc.orig, "diag", None)
        constraint = getattr(diag, "constraint_name", None) or ""
        sqlstate = getattr(exc.orig, "sqlstate", None)
        if sqlstate == "23505":  # unique_violation
            field, message = _UNIQUE_FIELDS.get(constraint, ("request", "Record already exists."))
            return JSONResponse(
                _body(
                    "DUPLICATE", message, {"field": field}, [{"field": field, "message": message}]
                ),
                409,
            )
        if sqlstate == "23503":  # foreign_key_violation
            return JSONResponse(
                _body(
                    "VALIDATION_ERROR",
                    "A referenced record does not exist or is in use.",
                    {"constraint": constraint},
                ),
                422,
            )
        # check_violation etc.: the DB caught something the service should have. Still a 422.
        log.warning("integrity error constraint=%s sqlstate=%s", constraint, sqlstate)
        return JSONResponse(
            _body(
                "VALIDATION_ERROR", "The data violates a database rule.", {"constraint": constraint}
            ),
            422,
        )

    @app.exception_handler(StarletteHTTPException)
    async def _http(_: Request, exc: StarletteHTTPException):
        codes = {401: "UNAUTHORIZED", 403: "FORBIDDEN", 404: "NOT_FOUND", 405: "METHOD_NOT_ALLOWED"}
        return JSONResponse(
            _body(codes.get(exc.status_code, "ERROR"), str(exc.detail)), exc.status_code
        )

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception):
        request_id = getattr(request.state, "request_id", None)
        log.exception("unhandled error rid=%s", request_id)
        return JSONResponse(
            _body(
                "INTERNAL_ERROR",
                "Something went wrong. Please try again.",
                {"request_id": request_id},
            ),
            500,
        )
