# StockSense Backend

FastAPI + SQLAlchemy 2 + Alembic + PostgreSQL 16.
**Owner: Member 1** (auth & dashboard modules: Member 4). See [ownership map](../docs/TEAM_PLAN.md#file-ownership).

## Run locally
```bash
docker compose up -d db              # from repo root (port busy? DB_PORT=5433 docker compose up -d db)
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt   # runtime + pytest/ruff
cp .env.example .env
alembic upgrade head                 # create schema (tables, CHECKs, indexes, ledger trigger)
python -m app.seed                   # demo users, warehouses, products, opening stock
uvicorn app.main:app --reload        # http://localhost:8000/docs
```

## Everyday commands
| Task | Command |
|---|---|
| Lint + format | `ruff check . && ruff format .` |
| Tests (needs the db container) | `pytest -q` |
| New migration (**M1 only**) | `alembic revision --autogenerate -m "add x"`, then hand-add CHECKs/triggers |
| Rich demo data (**wipes everything**): 14 days of history, 20 products, 3 warehouses, open work on the board | `python -m app.seed_demo --yes` |
| Reset DB | `docker compose down -v && docker compose up -d db && alembic upgrade head && python -m app.seed` |

## Layout
```text
app/
├── main.py        app, middleware, exception handlers, every router registered
├── config.py      settings from env
├── database.py    engine + session dependency
├── deps.py        current user, role guard
├── errors.py      domain errors → error JSON (+ DB unique violations → DUPLICATE)
├── security.py    bcrypt, JWT, session cookie helpers (used by auth_service)
├── enums.py       roles, UOMs, operation types/statuses (shared by DB CHECKs and schemas)
├── models/        tables (M1 only)
├── schemas/       request/response models
├── services/      business logic; operation_service is the ONLY writer of stock
├── routes/        thin HTTP layer
└── seed.py
alembic/           migrations (M1 only)
tests/             pytest (Steel Rod scenario, invariants, auth)
```

## Rules
- Routes stay thin: validate → call one service → return a schema.
- Stock changes **only** in `services/operation_service.py`, inside one transaction.
- Services raise domain errors, never `HTTPException`.

Contract: [docs/API.md](../docs/API.md) · Schema: [docs/DATA_MODEL.md](../docs/DATA_MODEL.md) · Rules: [docs/INVENTORY_RULES.md](../docs/INVENTORY_RULES.md)
