# StockSense Frontend

Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui + react-hook-form + zod.
**Owner: Member 2** (shell, products, warehouses). Operations pages: **Member 3**. Auth, dashboard, history, profile: **Member 4**.
See [ownership map](../docs/TEAM_PLAN.md#file-ownership).

## Run locally
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
