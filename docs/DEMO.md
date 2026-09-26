# Demo Script & Acceptance Tests

> Owner: **Member 4**. The same Steel Rod story is automated as `backend/tests/test_steel_rod_scenario.py` (M1), so the demo is also a CI test.

## Demo accounts (created by `python -m app.seed`)

| Role | Email | Password |
|---|---|---|
| Manager | `manager@stocksense.dev` | `Manager@123` |
| Staff | `staff@stocksense.dev` | `Staff@123` |

## Seed data

| Kind | Data |
|---|---|
| Warehouses | `WH` Main Warehouse (locations: Stock, Rack A, Rack B, Production Floor) · `WH2` Secondary Warehouse (Stock) |
| Categories | Raw Material, Furniture, Components |
| Products | `STL001` Steel Rod (kg, min 20 / max 200, **0 stock**, for the live demo) · `CHR001` Office Chair (unit, 5/50) · `BRG001` Bearing (unit, 50/500, **low**) · `MTR001` Motor (unit, 5/40, **out of stock**) · `ALU001` Aluminium Sheet (kg, 30/300) |
| Opening stock | Posted as validated adjustments, so it has ledger evidence |
| Open operations | 1 receipt `ready`, 1 delivery `waiting` (for Motor), 1 transfer `draft`, so dashboard KPIs and filters show real numbers |

## Live demo: "Steel Rod" (about 5 minutes)

| # | Action (UI) | What to point out | Expected |
|---|---|---|---|
| 0 | Log in as manager | Invalid email → inline error; wrong password → generic message | Redirect to Dashboard |
| 1 | Products → Steel Rod | SKU, UOM kg, reorder rule min 20 / max 200 | On hand 0 · **Out of stock** badge |
| 2 | Receipts → New: supplier *Tata Steel*, dest `WH/Stock`, Steel Rod 100 → **Validate** | Reference `WH/IN/000x`, status Draft → Done, toast "+100 kg at WH/Stock" | Total 100 |
| 3 | Transfers → New: `WH/Stock` → `WH/Production Floor`, 40 → Validate | Same-location transfer is rejected (try it first) | Stock 60, Production Floor 40, **total still 100** |
| 4 | Deliveries → New: from `WH/Production Floor`, qty **50** → Validate | Server rejects: *INSUFFICIENT_STOCK, available 40* | Nothing changes |
| 5 | Edit qty to 20 → Validate | "Available: 40 kg" hint on the line | Production Floor 20, total 80 |
| 6 | Adjustments → New: location `WH/Production Floor`, counted **17** | Confirmation shows system 20 → counted 17 = **−3 kg** | Production Floor 17, total 77 |
| 7 | Move History, filter product = Steel Rod | +100 receipt · −40/+40 transfer · −20 delivery · −3 adjustment, each with who/when/reference and balance after | Explains exactly why stock is 77 |
| 8 | Dashboard | KPIs, low-stock list (Bearing), filters by type/status/warehouse/category, **"Ledger reconciled ✓"** | Everything reflects the live data |
| 9 | Validate the same receipt again (double click / API) | Idempotency | `already_done: true`, stock still 77 |
| 10 | Log in as staff → try Adjustments validate / create product | Role enforcement is server-side | 403 FORBIDDEN toast |
| 11 | Forgot password → OTP (console/email) → reset | Hashed OTP, 10-min expiry, 5 attempts | Can log in with new password |

## Acceptance test matrix

| ID | Area | Given | When | Then |
|---|---|---|---|---|
| T-01 | Receipt | Steel = 0 | receive 50 into WH/Stock | WH/Stock = 50; op `done`; 1 ledger row +50 |
| T-02 | Delivery | WH/Stock = 50 | deliver 10 | 40 |
| T-03 | Delivery reject | WH/Stock = 40 | deliver 100 | 409 `INSUFFICIENT_STOCK`; still 40; op not done |
| T-04 | Transfer | WH/Stock = 40, Rack A = 0 | transfer 15 | 25 / 15; total 40; 2 ledger rows |
| T-05 | Transfer reject | — | source = destination | 422 `SAME_LOCATION` |
| T-06 | Adjustment | Rack A = 15 | counted 12 | Rack A = 12; ledger −3; `system_quantity` = 15 |
| T-07 | Idempotency | receipt `done` | validate again | 200 `already_done`; no extra ledger row |
| T-08 | Atomicity | 2-line transfer, line 2 short | validate | 409; **neither** line moved |
| T-09 | Concurrency | stock 10 | two deliveries of 10 validated in parallel | exactly one succeeds; stock 0, never negative |
| T-10 | Ledger immutability | any ledger row | raw `UPDATE stock_ledger` | DB raises "append-only" |
| T-11 | Integrity | after T-01…T-09 | `GET /inventory/integrity` | `ok: true` |
| T-12 | Roles | staff user | validate adjustment / create product | 403 `FORBIDDEN` |
| T-13 | Validation | — | product with duplicate SKU / negative min | 409 `DUPLICATE` / 422 with `field_errors` |
| T-14 | Auth | — | 5 wrong passwords | 6th attempt 429 `TOO_MANY_ATTEMPTS` |
| T-15 | OTP | OTP issued | wrong code ×5, then right code | 400 ×5 then 429; expired code → `OTP_EXPIRED` |
| T-16 | Status | op `done` | PATCH / cancel | 409 `INVALID_STATE` |

## Judge Q&A (prepare answers)

| Question | Answer |
|---|---|
| Why not Firebase/Supabase? | Guidelines, and more importantly the core of this problem *is* transactional integrity. We needed our own transaction boundary, row locks and constraints, which a BaaS hides. |
| Why PostgreSQL? | Row-level locks for concurrent validation, exact NUMERIC for kg/litres, CHECK constraints and a trigger that enforce rules even if app code is wrong. |
| What stops double-counting on a double click? | Operation row lock + `done` guard → second call is a no-op (`already_done`). |
| How do you know stock is right? | Every change is a ledger row; `/inventory/integrity` proves Σ ledger = balance for every product-location. |
| Where is the AI? | Not in the core, on purpose (per guidelines). Our optional extension is an explainable cycle-count priority score (movement frequency, days since count, past adjustments), shown with its reasons, not presented as magic. |
| How would this scale? | Stateless FastAPI instances behind one Postgres; locks live in the DB so they work across instances; indexed, paginated queries; path to read replicas. |
| What would you add next? | Barcode/QR scanning, returns, lot/expiry tracking, role configuration, CSV import from existing spreadsheets. |

## Claims to avoid
- "Real-time" beyond what we do (we do: every read reflects committed data immediately; no WebSockets).
- "AI-powered", unless the risk score is implemented, and then only "rule-based, explainable".
- "Better than Odoo/ERPNext". Say "inspired by established ERP flows (Odoo-style references and states)".
- Any accuracy-improvement percentage without a measured experiment.
