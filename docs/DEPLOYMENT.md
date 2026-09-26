# Deployment & CI/CD

> Owner: **Member 1** (backend + DB), **Member 2** (Vercel section).
> Constraint: **free services only**. Everything below runs on free tiers with no credit card needed (as of Sept 2026; check each provider's current terms).

## Environments

| | Local dev | Production (demo) |
|---|---|---|
| Frontend | `npm run dev` → http://localhost:3000 | **Vercel** Hobby → `https://stocksense-eosin.vercel.app` |
| Backend | `uvicorn app.main:app --reload` → http://localhost:8000 | **Render** free web service → `https://stocksense-api-vs0b.onrender.com` |
| Database | PostgreSQL 16 in **Docker** (`docker compose up -d db`) | **Neon** free Postgres (plain Postgres over a connection string) |
| Email (OTP) | printed to backend console | Gmail SMTP with an app password (optional; console fallback otherwise) |

> **Is Neon a BaaS?** No. Neon only hosts a standard PostgreSQL server. We connect with a normal `postgresql://` URL through SQLAlchemy, and our own backend owns the schema, migrations, auth and business logic. Nothing about the app is Neon-specific; switching to any other Postgres host is a one-line env change. Fallback host: Render's free Postgres (expires after 30 days, fine for the event).

## 1. Local setup

Prerequisites: Git, Docker, Python 3.12, Node 20+.

```bash
git clone <repo-url> && cd StockSense

# Database (Postgres 16 on localhost:5432)
docker compose up -d db          # port 5432 busy? DB_PORT=5433 docker compose up -d db, and use :5433 in DATABASE_URL

# Backend
cd backend
python -m venv .venv && source .venv/bin/activate      # fish: source .venv/bin/activate.fish · Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt                    # runtime deps + pytest/ruff
cp .env.example .env
alembic upgrade head
python -m app.seed
uvicorn app.main:app --reload                          # http://localhost:8000/docs

# Frontend (new terminal)
cd frontend
npm install
cp .env.example .env.local
npm run dev                                            # http://localhost:3000
```

Reset your local DB any time:
```bash
docker compose down -v && docker compose up -d db
cd backend && alembic upgrade head && python -m app.seed
```

`docker-compose.yml` (added by M1 in the scaffold commit) runs only Postgres:
```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: stocksense
      POSTGRES_PASSWORD: stocksense
      POSTGRES_DB: stocksense
    ports: ["5432:5432"]
    volumes: [pgdata:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U stocksense"]
      interval: 5s
volumes:
  pgdata:
```

## 2. Environment variables

### Backend (`backend/.env`)
| Var | Example | Notes |
|---|---|---|
| `DATABASE_URL` | `postgresql+psycopg://stocksense:stocksense@localhost:5432/stocksense` | Neon: paste the **pooled** string as-is (`postgresql://…?sslmode=require`); the app switches the scheme to the psycopg driver itself |
| `JWT_SECRET` | 64 random chars | `python -c "import secrets; print(secrets.token_urlsafe(48))"`. Different in prod |
| `JWT_EXPIRE_MINUTES` | `480` | 8 hours |
| `COOKIE_SECURE` | `false` locally, `true` in prod | |
| `FRONTEND_ORIGIN` | `http://localhost:3000` | Only used for CORS when calling the API directly (not needed via rewrites) |
| `SMTP_HOST` / `SMTP_PORT` | `smtp.gmail.com` / `587` | Leave empty to print OTPs to the console |
| `SMTP_USER` / `SMTP_PASSWORD` | team Gmail + app password | Never commit |
| `SMTP_FROM` | `StockSense <team@gmail.com>` | |

### Frontend (`frontend/.env.local`)
| Var | Example | Notes |
|---|---|---|
| `BACKEND_URL` | `http://localhost:8000` | Server-side only; used by `next.config.ts` rewrites. Prod: the Render URL |

`next.config.ts` (M2):
```ts
const nextConfig = {
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${process.env.BACKEND_URL}/api/:path*` }];
  },
};
export default nextConfig;
```

## 3. CI: GitHub Actions (free for public repos)

Two workflows run on every push to `main` and every PR: `.github/workflows/backend.yml` (M1) and `.github/workflows/frontend.yml` (M2). They are separate files, so the two owners never edit the same file:

```mermaid
flowchart LR
    PR[push / pull_request] --> B[backend job]
    PR --> F[frontend job]
    B --> B1[setup Python 3.12] --> B2[pip install] --> B3[ruff check + format] --> B4["alembic upgrade → downgrade → upgrade → check<br/>(Postgres 16 service container)"] --> B5[pytest]
    F --> F1[setup Node 20] --> F2[npm ci] --> F3[npm run lint] --> F4[npm run build]
```

- Tests use a separate `<db>_test` database (created automatically), so running `pytest` locally never wipes your dev data.
- The backend job uses a `postgres:16` **service container**, so tests run against real Postgres, including CHECK constraints, the ledger trigger and row locks.
- Branch protection on `main` (repo Settings → Branches): require the `backend` and `frontend` checks to pass and require 1 approval.

## 4. CD: auto-deploy on merge to `main`

```mermaid
flowchart LR
    M[merge to main] --> CI{CI green?}
    CI -- yes --> R[Render: build + alembic upgrade head + start]
    CI -- yes --> V[Vercel: next build + deploy]
    PRV[open PR] --> VP[Vercel preview URL per PR]
```

### 4a. Database: Neon (once, M1)
1. Sign up at neon.tech → **New project** `stocksense`, Postgres 16, region closest to Render (e.g. AWS Singapore / `ap-southeast-1`).
2. **Dashboard → Connect** → tick **Connection pooling** → copy the connection string (`postgresql://…-pooler…neon.tech/…?sslmode=require…`). Paste it as-is; no editing needed.
3. Migrate and seed it from your laptop (Render free has no shell):
   ```bash
   cd backend
   export DATABASE_URL='postgresql://...-pooler...neon.tech/neondb?sslmode=require'   # fish: set -x DATABASE_URL '...'
   alembic upgrade head
   python -m app.seed          # skips itself if data already exists
   ```
   Render also runs `alembic upgrade head` on every deploy, so later migrations apply automatically.

### 4b. Backend: Render (once, M1)
The service is defined as code in [`render.yaml`](../render.yaml) (a Render Blueprint): free plan, root dir `backend`, build/start commands, health check `/api/health`, auto-deploy **only after CI passes**, and a generated `JWT_SECRET`.

1. render.com → sign in with GitHub → **New → Blueprint** → pick this repo → branch `main`.
2. Render reads `render.yaml` and asks for the secrets marked `sync: false`:
   | Var | Value |
   |---|---|
   | `DATABASE_URL` | the Neon pooled string from 4a |
   | `FRONTEND_ORIGIN` | the Vercel URL once it exists (e.g. `https://stocksense-xyz.vercel.app`); any placeholder until then |
   | `SMTP_*` | leave empty to log OTPs to the Render log (fine for the demo), or Gmail SMTP + app password |
3. **Apply**. The first deploy takes ~3 min. Check `https://stocksense-api-vs0b.onrender.com/api/health` → `{"status":"ok","db":"ok"}`; `/` opens the Swagger docs.

Safety net: with `COOKIE_SECURE=true` the app refuses to start on the development JWT secret.

### 4c. Frontend: Vercel (once)
Done with the Vercel CLI from the repo root (`npx vercel login` first):
```bash
npx vercel project add stocksense
npx vercel api /v9/projects/stocksense -X PATCH --input - <<< '{"rootDirectory":"frontend","framework":"nextjs"}'
npx vercel link --yes --project stocksense
printf 'https://stocksense-api-vs0b.onrender.com' | npx vercel env add BACKEND_URL production --yes
printf 'https://stocksense-api-vs0b.onrender.com' | npx vercel env add BACKEND_URL preview --yes
npx vercel git connect --yes      # merges to main auto-deploy; PRs get preview URLs
npx vercel deploy --prod --yes
```
`BACKEND_URL` must exist **before** the build: Next.js bakes rewrites into the build output.

Dashboard alternative:
1. vercel.com → **Add New Project** → import the repo.
2. Root Directory `frontend`, framework preset **Next.js** (auto-detected).
3. Environment variable `BACKEND_URL=https://stocksense-api-vs0b.onrender.com`.
4. Deploy. Every PR now also gets a preview URL.

Because Vercel proxies `/api/*` to Render, the browser only ever talks to the Vercel domain: cookies are first-party and no CORS config is needed.

## 5. Demo-day checklist
- [ ] **Warm up Render 2 minutes before judging**: open `https://stocksense-api-vs0b.onrender.com/api/health`. The free tier sleeps after 15 min idle, and the first request takes ~30–60 s.
- [ ] Log in on the Vercel URL with the demo manager account.
- [ ] `GET /api/inventory/integrity` returns `"ok": true`.
- [ ] Fallback: the full stack runs locally in two commands if the network fails.

## 6. Troubleshooting
| Symptom | Fix |
|---|---|
| `connection refused :5432` | `docker compose up -d db`; check `docker compose ps` shows *healthy* |
| `alembic: multiple heads` | Someone other than M1 created a migration. Delete it and ask M1 |
| Login works locally but not in prod | `COOKIE_SECURE=true` on Render, and the frontend must call relative `/api/...` (not the Render URL) |
| 502 from Vercel on `/api/*` | Render is asleep or deploying; open `/api/health` and wait |
| Neon `SSL required` | keep `?sslmode=require` in `DATABASE_URL` |
| CRLF diffs on Windows | `.gitattributes` handles it; run `git add --renormalize .` once |
