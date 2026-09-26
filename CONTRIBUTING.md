# Contributing to StockSense

Thanks for helping. This guide covers the workflow we use and the rules that keep the stock numbers correct.

## Ground rules

1. **Stock changes only through operations.** Nothing in the frontend, a script or a new endpoint may write `stock_balances` or `stock_ledger` directly. All changes go through `backend/app/services/operation_service.py`, inside one transaction. See [Inventory rules](docs/INVENTORY_RULES.md).
2. **No stock arithmetic in the browser.** The frontend shows what the API returns. Display-only previews (such as a count difference) are fine; the server computes the real result.
3. **The API contract is documented.** If you add or rename a field or endpoint, update [docs/API.md](docs/API.md) in the same pull request.
4. **The database enforces the rules too.** When you add a model or a rule, add the matching constraint (CHECK, UNIQUE, FK) in a migration, not only a Python check.
5. **`main` is always deployable.** Every merge deploys to production automatically.

## Workflow

`main` is protected: changes land only through pull requests, and both CI workflows must pass (the required checks are `backend` and `check`, from `backend.yml` and `frontend.yml`).

```bash
git switch main && git pull
git switch -c feat/<short-name>          # or fix/, docs/, chore/, test/

# work in small commits
git add <files>                          # check `git status` first; never commit .env or *.db
git commit -m "feat(inventory): explain why a delivery is waiting"

git fetch origin && git rebase origin/main   # stay current before opening the PR
git push -u origin feat/<short-name>
```

Then open a pull request using the template. Every pull request gets a Vercel preview link and runs both CI workflows. Merge with **"Create a merge commit"** (or rebase-and-merge), **never squash**: squashing hides who wrote what.

Code owners (see [`.github/CODEOWNERS`](.github/CODEOWNERS)) are requested for review automatically when a pull request touches their area.

## Commit messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <imperative summary, 72 characters or fewer>

Optional body: what changed and why.
```

| Type | Use for |
|---|---|
| `feat` | New behaviour users can see |
| `fix` | A bug fix |
| `refactor` | Code change with no behaviour change |
| `test` | Tests only |
| `docs` | Documentation only |
| `chore` / `ci` | Tooling, dependencies, workflows |

Common scopes: `inventory`, `operations`, `ledger`, `products`, `warehouses`, `auth`, `dashboard`, `landing`, `ui`, `db`, `deploy`.

## Run the checks locally

CI runs exactly these, so run them before pushing.

**Backend** (`cd backend`, with PostgreSQL running via `docker compose up -d db`):

```bash
ruff check . && ruff format --check .
alembic upgrade head && alembic check    # models and migrations agree
pytest -q                                # uses a separate <db>_test database
```

**Frontend** (`cd frontend`):

```bash
npm run lint
npm test                                 # unit tests
npm run build
npm run test:e2e                         # Playwright: desktop, tablet and mobile
```

## Code style

**Python**
- Python 3.12, type hints everywhere, formatted and linted with ruff.
- Layers: routes (parse, authorize, call one service) → services (rules and transactions) → models. Routes never write to the database; services never raise `HTTPException`.
- Raise domain errors (`InsufficientStock`, `InvalidState`, `ValidationFailed`, …) from services; `app/errors.py` turns them into the standard error response `{code, message, details, field_errors}`.
- Every change to stock logic comes with a test that runs on real PostgreSQL.

**TypeScript**
- Strict TypeScript, ESLint and Prettier.
- Call the backend only through `lib/api.ts`, with relative `/api/...` paths; types live in `lib/types.ts` and mirror the API exactly (snake_case).
- Forms use react-hook-form and zod, and show server `field_errors` next to the matching field.
- Use the shared UI components and Tailwind tokens; no one-off colours.
- Animations must respect `prefers-reduced-motion`, and every drag-and-drop action needs a keyboard or button alternative.

## Database changes

Add or change a model, then create a migration and review it by hand. Autogenerate does not detect CHECK constraints or triggers.

```bash
alembic revision --autogenerate -m "add <thing>"
alembic upgrade head && alembic downgrade -1 && alembic upgrade head
```

Coordinate migrations in the team channel so two branches don't create competing heads.

## Security

Never commit secrets, `.env` files or database dumps. Configuration comes from environment variables (see `backend/.env.example` and `frontend/.env.example`). If a secret is committed by mistake, tell the team, rotate it immediately, and then remove it from the history.

## Reporting a bug

Open an issue with the steps to reproduce, what you expected and what happened. For API errors, include the `X-Request-ID` response header: it matches the backend log line for that request.
