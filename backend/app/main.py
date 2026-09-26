"""StockSense API. Every router is registered here once. Don't add routes in this file."""

import logging
import time
import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from app.config import settings
from app.errors import register_exception_handlers
from app.routes import (
    auth,
    categories,
    dashboard,
    health,
    inventory,
    ledger,
    locations,
    operations,
    products,
    warehouses,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("stocksense")

app = FastAPI(
    title="StockSense API",
    version="0.1.0",
    description="Inventory management: every stock change is a validated, ledgered operation.",
)

# Only needed when the browser calls the API directly; via Next.js rewrites it's same-origin.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_context(request: Request, call_next):
    """Attach a request id (echoed in X-Request-ID and 500 bodies) and log one line per request."""
    request_id = request.headers.get("x-request-id") or uuid.uuid4().hex[:12]
    request.state.request_id = request_id
    started = time.perf_counter()
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    log.info(
        "%s %s -> %s %.0fms rid=%s",
        request.method,
        request.url.path,
        response.status_code,
        (time.perf_counter() - started) * 1000,
        request_id,
    )
    return response


register_exception_handlers(app)


@app.get("/", include_in_schema=False)
def root() -> RedirectResponse:
    return RedirectResponse("/docs")


for module in (
    health,
    auth,
    dashboard,
    categories,
    products,
    warehouses,
    locations,
    inventory,
    operations,
    ledger,
):
    app.include_router(module.router)
