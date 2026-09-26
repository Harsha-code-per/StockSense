# Roadmap & Scope

## P0: must ship (the problem statement)
- [x] Signup / login / logout, OTP password reset, redirect to dashboard
- [x] Profile page (name, email, role)
- [x] Dashboard KPIs: products in stock, low / out of stock, pending receipts, pending deliveries, scheduled transfers
- [x] Dashboard filters: document type, status, warehouse/location, product category
- [x] Products: create/update, SKU, category, UOM, initial stock, stock per location, reordering rules (min/max)
- [x] Categories
- [x] Warehouses & locations (settings)
- [x] Receipts (incoming): create → validate → stock +
- [x] Delivery orders (outgoing): create → confirm (pick/pack) → validate → stock −, insufficient-stock rejection
- [x] Internal transfers: source → destination, total unchanged
- [x] Inventory adjustments: counted quantity → difference logged
- [x] Move history (stock ledger) with filters
- [x] Low-stock alerts (badges + dashboard list)
- [x] SKU search & smart filters on lists
- [x] Server + client input validation with friendly messages
- [x] CI (lint, tests, build) and free deployment

## P1: after the 3:30 checkpoint is green
- [x] `GET /api/inventory/integrity` badge on dashboard ("Ledger reconciled ✓")
- [x] Ledger CSV export
- [ ] Low-stock bell in header with count
- [ ] "Late" operations (scheduled_date < today and not done) highlighted
- [ ] Suggested reorder quantity on low-stock list → one click creates a draft receipt
- [ ] Keyboard shortcuts / quick SKU search in header

## P2: only if everything else is solid
- [x] **Explainable cycle-count priority** (`GET /api/inventory/count-priority`, "Count next" card on the dashboard) (the only "smart" feature): rule-based score per product-location from days since last count, movements in the last 30 days, past adjustment count and magnitude, shown with its reasons ("63 days since count · 27 movements · 3 past corrections"). Evaluate against oldest-count-first and random baselines at equal budget K (Recall@K / Precision@K) before claiming improvement.
- [ ] QR/barcode scan of SKU and location in operation forms (browser camera)
- [ ] Returns (reverse of a done delivery/receipt)

## Out of scope (say so if asked)
Purchasing/sales modules, invoicing/accounting/GST, CRM, serial/lot/expiry tracking, unit conversions, reservations/backorders, wave picking, multi-step routes, RFID, demand forecasting, LLM chatbot, blockchain, offline mode, WebSockets.

## Assumptions we made (the statement doesn't specify)
| Topic | Assumption |
|---|---|
| Roles | Two roles: `manager` (master data + adjustments) and `staff` (routine movements). Signup creates staff |
| Negative stock | Never allowed |
| Status semantics | Draft → Waiting/Ready (availability check on confirm) → Done / Canceled; Odoo-like |
| Done operations | Immutable; fix with an adjustment |
| Units | One base UOM per product; no conversions |
| Real-time | Committed changes are visible on the next read everywhere; no push updates |
| Supplier/customer | Free-text partner name on the operation; no partner master |
| Scale | Small-to-medium warehouse; indexed + paginated queries throughout |

## Open questions for the problem owner
1. What exactly can Warehouse Staff do that Managers can't (and vice versa)?
2. Do adjustments above some size need manager approval?
3. Are partial deliveries / backorders required?
4. Are returns or cancellation of completed operations required?
5. Is lot/serial/expiry tracking expected for any product type?
6. How many SKUs, locations, users and moves per day should we plan for?

## Production path (beyond the hackathon)
1. Configurable role permissions and approval thresholds
2. Barcode-first mobile workflows for warehouse staff
3. CSV import from existing spreadsheets (the problem's "replace Excel" goal)
4. Backups, monitoring/alerting, audit log retention policy
5. Rate limiting at the edge, 2FA for managers
6. GS1/EPCIS-compatible event export for supply-chain integration
