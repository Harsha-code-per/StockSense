# StockSense Frontend

Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui + react-hook-form + zod.
**Owner: Member 2** (shell, products, warehouses). Operations pages: **Member 3**. Auth, dashboard, history, profile: **Member 4**.
See [ownership map](../docs/TEAM_PLAN.md#file-ownership).

## Run locally
Use Node.js 24 or newer (the same version used in CI).

```bash
cd frontend
npm install
cp .env.example .env.local          # BACKEND_URL=http://localhost:8000
npm run dev                         # http://localhost:3000
```
The backend must be running; `/api/*` is proxied to it by `next.config.ts` rewrites.

## Commands
| Task | Command |
|---|---|
| Dev server | `npm run dev` |
| Lint | `npm run lint` |
| Production build (what CI runs) | `npm run build` |
| API client checks | `npm test` |
| Browser checks (after building) | `npx playwright install chromium && npm run test:e2e` |
| Add a shadcn component (**M2 only**) | `npx shadcn@latest add <component>` |

## Layout
```text
src/
├── app/
│   ├── (auth)/login | signup | forgot-password              M4
│   └── (app)/layout.tsx  (sidebar shell)                     M2
│       ├── dashboard/ · history/ · profile/                  M4
│       ├── products/ · products/[id]/ · warehouses/          M2
│       └── operations/receipts | deliveries | transfers | adjustments   M3
├── components/ui/          shadcn primitives                 M2
├── components/layout/      Sidebar, Header, PageHeader       M2
├── components/operations/  OperationForm, LineEditor, StatusBadge   M3
├── lib/api.ts · lib/types.ts                                 M2
├── lib/operations.ts                                         M3
└── middleware.ts           route protection (proxy.ts on Next 16)   M4
```

## Rules
- Call the backend only through `lib/api.ts` with relative URLs (`/api/products`), never the Render URL.
- Types come from `lib/types.ts`, mirroring [docs/API.md](../docs/API.md) exactly (snake_case).
- **Never compute stock in the browser.** Show what the API returns.
- Every form: zod schema + inline errors + server `field_errors` mapped to fields.
- Status colors: Draft gray · Waiting amber · Ready blue · Done green · Canceled red.
- UI conventions: [ARCHITECTURE § UI conventions](../docs/ARCHITECTURE.md#ui-conventions-consistency-is-judged).

## Shared frontend helpers

Use `api<T>('/api/...', { method, body: JSON.stringify(values) })` from `@/lib/api`.
It includes the same-origin session cookie, disables response caching, and throws
`ApiError` with `status`, `code`, `details`, and `field_errors`. A 204 response returns
`undefined`. Do not catch a failed request and replace it with mock inventory.

`useApi<T>(path)` provides loading/error state, aborts obsolete requests, and exposes
`reload()` after mutations. `PageHeader`, `DataState`, `Field`, and `formErrors` provide
shared page, loading/error, and form conventions. New shadcn components must import
`cn` from `@/lib/utils`; reuse that utility rather than installing another package.

Browser tests use contract-shaped responses only inside `tests/`. They cover desktop,
tablet, and mobile layouts; the production app always calls the real API. Live login
and complete inventory lifecycle verification require Members 3 and 4's implementations.

## Frontend deployment

Import this repository into Vercel with Root Directory `frontend` and the Next.js
preset. Set the server-only `BACKEND_URL` to the team's deployed backend origin;
do not prefix it with `NEXT_PUBLIC_`. Vercel runs `npm run build`. All browser requests
continue to use `/api/*` through the Next.js rewrite. Deployment account configuration
and the final backend URL must be supplied by the team.
