# Team Plan (7-hour round)

> Everyone reads this first. Ownership here is mirrored in [`.github/CODEOWNERS`](../.github/CODEOWNERS).
> Git rules: [CONTRIBUTING](../CONTRIBUTING.md).

## Roles

| Member | Role | One-line mission |
|---|---|---|
| **Member 1**: @Harsha-code-per | Backend core + Database + Inventory engine | Stock is always correct and explainable |
| **Member 2**: @member2-github | Frontend shell + Products + Warehouses + deploy (frontend) | The app looks like one consistent product |
| **Member 3**: @member3-github | Operations UI (Receipts, Deliveries, Transfers, Adjustments) | Warehouse tasks are fast and hard to get wrong |
| **Member 4**: @member4-github | Auth + Dashboard + Move History + QA/Demo | Secure entry, clear overview, and it all works end to end |

> Teammates: replace your placeholder handle here, in `README.md` and in `.github/CODEOWNERS` as your **first commit**.

## File ownership

Only the owner edits these paths. Need a change elsewhere? Ask the owner or open a PR and tag them.

| Path | Owner |
|---|---|
| `backend/app/{main,config,database,deps,errors}.py` | M1 |
| `backend/app/models/**`, `backend/alembic/**` | M1 |
| `backend/app/schemas/**` (except `auth.py`, `dashboard.py`) | M1 |
| `backend/app/schemas/{auth,dashboard}.py` | M4 |
| `backend/app/services/{product,warehouse,inventory,operation}_service.py` | M1 |
| `backend/app/services/{auth,email,dashboard}_service.py` | M4 |
| `backend/app/routes/{products,categories,warehouses,locations,inventory,operations,ledger,health}.py` | M1 |
| `backend/app/routes/{auth,dashboard}.py` | M4 |
| `backend/app/seed.py`, `backend/tests/**` (auth tests: M4 in `tests/test_auth.py`) | M1 |
| `backend/requirements.txt`, `docker-compose.yml`, `.github/workflows/**` | M1 |
| `frontend/` scaffold, `package.json`, `next.config.ts`, `tailwind`/`components.json` | M2 |
| `frontend/src/app/(app)/layout.tsx`, `components/layout/**`, `components/ui/**` | M2 |
| `frontend/src/lib/{api,types}.ts` | M2 |
| `frontend/src/app/(app)/{products,warehouses}/**` | M2 |
| `frontend/src/app/(app)/operations/**`, `components/operations/**`, `lib/operations.ts` | M3 |
| `frontend/src/app/(auth)/**`, `(app)/{dashboard,history,profile}/**`, `src/middleware.ts` | M4 |
| `docs/{ARCHITECTURE,DATA_MODEL,API,INVENTORY_RULES,DEPLOYMENT}.md` | M1 |
| `docs/DEMO.md` | M4 |
| `README.md`, `docs/{TEAM_PLAN,ROADMAP}.md` | M1 (anyone may PR) |

### Hot files, wired once
These are the only files everyone would otherwise touch. They are **pre-populated in the scaffold commits** and then frozen:

| File | Wired by | Contains from the start |
|---|---|---|
| `backend/app/main.py` | M1 | `include_router` for **every** router in API.md (auth + dashboard as empty stubs for M4) |
| `backend/requirements.txt` | M1 | all backend deps incl. M4's (`pyjwt`, `passlib[bcrypt]`, `email-validator`) |
| `frontend/package.json` | M2 | all frontend deps incl. `react-hook-form`, `zod`, `@hookform/resolvers`, `sonner`, `lucide-react`, `date-fns` |
| `frontend/src/components/layout/Sidebar.tsx` | M2 | **every** nav link |
| `frontend/src/app/(app)/**/page.tsx` | M2 | placeholder page for **every** route, which the owner then replaces |
| `frontend/src/lib/types.ts` | M2 | TypeScript types for every schema in API.md |

## Working rules
1. **Mock first, never wait.** Frontend members build against hard-coded objects copied from `docs/API.md` examples, then swap to `lib/api.ts` calls once the endpoint lands. Mocks never reach `main`.
2. **Contract is frozen.** Field-name change = team message + `docs/API.md` update in the same PR.
3. **No stock math in the frontend.** Show what the API returns.
4. **Rebase every ~45 min** and merge small PRs often. Big-bang merges at hour 6 are how teams lose.
5. **Everyone commits their own work** from their own GitHub account (the judges check).

## Timeline

| Time | M1 Backend/DB | M2 Frontend shell | M3 Operations UI | M4 Auth/Dashboard/QA |
|---|---|---|---|---|
| **0:00–0:20** | Everyone: read docs, create branch, first commit = own handle in CODEOWNERS/README/TEAM_PLAN | ← | ← | ← |
| **0:20–1:00** | FastAPI scaffold, config, DB, **all models + first migration (with CHECKs + trigger)**, all stub routers in `main.py`, `docker-compose.yml`, CI backend job. **Merge by 1:00** | `create-next-app`, Tailwind, shadcn, layout + full sidebar + all placeholder pages, `lib/api.ts`, `lib/types.ts`, CI frontend job. **Merge by 1:00** | `components/operations/`: StatusBadge, LineEditor, OperationForm (mock data) | Login / Signup / Forgot-password UI with zod validation; draft `auth_service` logic |
| **1:00–2:00** | products, categories, warehouses, locations, inventory endpoints + `seed.py` | Products list/create/edit, Warehouses + Locations pages (wired) | Receipts + Deliveries list & form pages (mock) | Auth endpoints wired to users table, cookie, `middleware.ts`, profile + logout |
| **2:00–3:00** | `operation_service`: create / confirm / validate for receipt + delivery, ledger writes, sequence numbers, **pytest** | Product detail (stock by location, recent moves), stock badges | Wire receipts + deliveries to API (create → confirm → validate, available qty) | Dashboard API (KPI aggregates) + Dashboard page |
| **3:00–3:30** | transfer + adjustment + cancel, `/inventory/integrity`, Steel Rod scenario test | UI consistency pass across pages | Transfers + Adjustments (system/counted/difference preview) | Move History page with filters; start end-to-end testing |
| **3:30 ✅ CHECKPOINT** | **Full lifecycle works in the browser: create product → receive 100 → transfer 40 → deliver 20 → count 17 → total 77, ledger correct.** If not: everybody stops features and fixes this. | | | |
| **3:30–4:30** | Filters/search on all list endpoints, error polish, **first production deploy: Neon + Render** | **First deploy: Vercel** (rewrites → Render URL) | Filters on operation lists, cancel with confirm dialog | OTP reset (forgot → verify → reset), dashboard filters, ledger badge |
| **4:30–5:30** | More tests (insufficient stock, double validate, concurrency), seed production DB | Loading/empty states, toasts, responsiveness | Keyboard-friendly forms, inline server errors | QA the whole app against `docs/DEMO.md` matrix, log bugs to owners |
| **5:30–6:15** | P1/P2 only if everything is green (CSV export, risk score) | P1 UI polish | P1 (QR scan) only if green | Screenshots, README demo section |
| **6:15–7:00** | 🧊 **Feature freeze.** Bug fixes only, final deploy, rehearse demo (everyone presents) | ← | ← | ← |

## Checkpoints
| Time | Must be true |
|---|---|
| 1:00 | Both scaffolds merged; `docker compose up -d db && alembic upgrade head` works for everyone; `npm run dev` shows the full sidebar |
| 2:00 | Products + warehouses persist in Postgres via the UI; login works |
| 3:30 | **Full stock lifecycle end to end** (see above) |
| 4:30 | App deployed on free URLs and reachable by judges |
| 6:15 | Feature freeze, CI green on `main` |

## Presentation split (everyone speaks)
| Member | Talks about |
|---|---|
| M1 | Problem framing, database design (constraints, trigger, ledger), transaction safety, integrity check |
| M2 | UI/UX system, navigation, deployment and CI/CD pipeline |
| M3 | Live demo of the operations lifecycle (Steel Rod story) |
| M4 | Auth and security (OTP, lockout, roles), validation, dashboard, testing approach |
