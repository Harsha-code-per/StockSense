// Owner: Member 3. Types mirror docs/API.md exactly (snake_case).
// Mock data below is copied from API.md examples (Working Rule #1: mock first,
// swap to lib/api.ts calls once the endpoint lands; mocks never reach main).

// ---------------------------------------------------------------------------
// Types (will move to lib/types.ts equivalents once M2's scaffold lands)
// ---------------------------------------------------------------------------

export type OperationType = "receipt" | "delivery" | "transfer" | "adjustment";
export type OperationStatus = "draft" | "waiting" | "ready" | "done" | "canceled";

export interface LocationRef {
  id: number;
  full_name: string;
}

export interface UserRef {
  id: number;
  name: string;
}

export interface OperationLine {
  id: number;
  product_id: number;
  sku: string;
  product_name: string;
  uom: string;
  quantity: string | null;
  counted_quantity: string | null;
  system_quantity: string | null;
  available: string | null;
}

export interface Operation {
  id: number;
  reference: string;
  type: OperationType;
  status: OperationStatus;
  warehouse_id: number;
  source_location: LocationRef | null;
  destination_location: LocationRef | null;
  partner_name: string | null;
  scheduled_date: string | null;
  notes: string | null;
  lines: OperationLine[];
  created_by: UserRef;
  validated_by: UserRef | null;
  created_at: string;
  validated_at: string | null;
}

export interface OperationSummary {
  id: number;
  reference: string;
  type: OperationType;
  status: OperationStatus;
  partner_name: string | null;
  source_location: LocationRef | null;
  destination_location: LocationRef | null;
  scheduled_date: string | null;
  line_count: number;
  created_at: string;
  validated_at: string | null;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface StockEffect {
  product_id: number;
  sku: string;
  location_id: number;
  location_name: string;
  quantity_delta: string;
  balance_after: string;
}

export interface ValidateResult extends Operation {
  already_done: boolean;
  stock_effects: StockEffect[];
}

// Request payloads (API.md "OperationCreate" per type)
export interface OperationLineInput {
  product_id: number;
  quantity?: string;
  counted_quantity?: string;
}

export interface OperationCreateInput {
  type: OperationType;
  source_location_id?: number;
  destination_location_id?: number;
  partner_name?: string | null;
  scheduled_date?: string | null;
  notes?: string | null;
  lines: OperationLineInput[];
}

export interface OperationsQuery {
  type?: OperationType;
  status?: OperationStatus[]; // sent comma-separated
  warehouse_id?: number;
  location_id?: number;
  category_id?: number;
  search?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
}

// ---------------------------------------------------------------------------
// Mock data (Phase 1 only — verbatim shapes from docs/API.md)
// ---------------------------------------------------------------------------

export const MOCK_PRODUCTS = [
  { id: 12, sku: "STL001", name: "Steel Rod", uom: "kg" },
  { id: 14, sku: "BRG001", name: "Bearing", uom: "unit" },
  { id: 15, sku: "SCR010", name: "Screw M10", uom: "box" },
];

export const MOCK_LOCATIONS = [
  { id: 1, warehouse_id: 1, full_name: "WH/Stock", is_active: true },
  { id: 4, warehouse_id: 1, full_name: "WH/Production Floor", is_active: true },
  { id: 7, warehouse_id: 2, full_name: "WH2/Stock", is_active: true },
];

const MOCK_USER: UserRef = { id: 1, name: "Asha Manager" };

export const MOCK_OPERATIONS: Operation[] = [
  {
    id: 31,
    reference: "WH/IN/0001",
    type: "receipt",
    status: "done",
    warehouse_id: 1,
    source_location: null,
    destination_location: { id: 1, full_name: "WH/Stock" },
    partner_name: "Tata Steel Ltd",
    scheduled_date: "2026-09-26",
    notes: null,
    lines: [
      {
        id: 50,
        product_id: 12,
        sku: "STL001",
        product_name: "Steel Rod",
        uom: "kg",
        quantity: "100.000",
        counted_quantity: null,
        system_quantity: null,
        available: "100.000",
      },
    ],
    created_by: MOCK_USER,
    validated_by: MOCK_USER,
    created_at: "2026-09-26T09:45:00Z",
    validated_at: "2026-09-26T09:46:10Z",
  },
  {
    id: 33,
    reference: "WH/OUT/0003",
    type: "delivery",
    status: "waiting",
    warehouse_id: 1,
    source_location: { id: 1, full_name: "WH/Stock" },
    destination_location: null,
    partner_name: "BuildCo",
    scheduled_date: "2026-09-26",
    notes: null,
    lines: [
      {
        id: 52,
        product_id: 12,
        sku: "STL001",
        product_name: "Steel Rod",
        uom: "kg",
        quantity: "20.000",
        counted_quantity: null,
        system_quantity: null,
        available: "8.000",
      },
    ],
    created_by: MOCK_USER,
    validated_by: null,
    created_at: "2026-09-26T10:05:00Z",
    validated_at: null,
  },
  {
    id: 34,
    reference: "WH/INT/0001",
    type: "transfer",
    status: "ready",
    warehouse_id: 1,
    source_location: { id: 1, full_name: "WH/Stock" },
    destination_location: { id: 4, full_name: "WH/Production Floor" },
    partner_name: null,
    scheduled_date: "2026-09-26",
    notes: null,
    lines: [
      {
        id: 53,
        product_id: 12,
        sku: "STL001",
        product_name: "Steel Rod",
        uom: "kg",
        quantity: "40.000",
        counted_quantity: null,
        system_quantity: null,
        available: "60.000",
      },
    ],
    created_by: MOCK_USER,
    validated_by: null,
    created_at: "2026-09-26T10:10:00Z",
    validated_at: null,
  },
  {
    id: 35,
    reference: "WH/ADJ/0001",
    type: "adjustment",
    status: "draft",
    warehouse_id: 1,
    source_location: { id: 4, full_name: "WH/Production Floor" },
    destination_location: null,
    partner_name: null,
    scheduled_date: null,
    notes: null,
    lines: [
      {
        id: 54,
        product_id: 12,
        sku: "STL001",
        product_name: "Steel Rod",
        uom: "kg",
        quantity: null,
        counted_quantity: "17.000",
        system_quantity: "20.000",
        available: "20.000",
      },
    ],
    created_by: MOCK_USER,
    validated_by: null,
    created_at: "2026-09-26T10:15:00Z",
    validated_at: null,
  },
];

export const MOCK_SUMMARIES: OperationSummary[] = MOCK_OPERATIONS.map((op) => ({
  id: op.id,
  reference: op.reference,
  type: op.type,
  status: op.status,
  partner_name: op.partner_name,
  source_location: op.source_location,
  destination_location: op.destination_location,
  scheduled_date: op.scheduled_date,
  line_count: op.lines.length,
  created_at: op.created_at,
  validated_at: op.validated_at,
}));

/** Mock for GET /api/inventory/available: key = `${product_id}:${location_id}` */
export const MOCK_AVAILABLE: Record<string, string> = {
  "12:1": "60.000",
  "12:4": "17.000",
  "14:1": "30.000",
  "15:1": "0.000",
};

// ---------------------------------------------------------------------------
// Live API wrappers (Phase 2+: wire to lib/api.ts once M2's scaffold merges).
// All calls use relative /api URLs per frontend/README rules.
// ---------------------------------------------------------------------------
//
// import { api } from "@/lib/api";
//
// export function listOperations(q: OperationsQuery): Promise<Page<OperationSummary>> {
//   const params = new URLSearchParams();
//   if (q.type) params.set("type", q.type);
//   if (q.status?.length) params.set("status", q.status.join(","));
//   ... etc
//   return api.get(`/api/operations?${params}`);
// }
// export const getOperation = (id: number) => api.get<Operation>(`/api/operations/${id}`);
// export const createOperation = (body: OperationCreateInput) => api.post<Operation>("/api/operations", body);
// export const updateOperation = (id, body) => api.patch<Operation>(`/api/operations/${id}`, body);
// export const confirmOperation = (id: number) => api.post<Operation>(`/api/operations/${id}/confirm`);
// export const validateOperation = (id: number) => api.post<ValidateResult>(`/api/operations/${id}/validate`);
// export const cancelOperation = (id: number) => api.post<Operation>(`/api/operations/${id}/cancel`);
// export const getAvailable = (product_id: number, location_id: number) =>
//   api.get<{ quantity: string }>(`/api/inventory/available?product_id=${product_id}&location_id=${location_id}`);

// ---------------------------------------------------------------------------
// Mock implementations used by Phase 1 components (never merged to main)
// ---------------------------------------------------------------------------

function delay<T>(value: T, ms = 150): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export async function mockListOperations(
  q: OperationsQuery = {},
): Promise<Page<OperationSummary>> {
  let items = MOCK_SUMMARIES;
  if (q.type) items = items.filter((op) => op.type === q.type);
  if (q.status?.length) items = items.filter((op) => q.status!.includes(op.status));
  if (q.search) {
    const s = q.search.toLowerCase();
    items = items.filter(
      (op) =>
        op.reference.toLowerCase().includes(s) ||
        (op.partner_name ?? "").toLowerCase().includes(s),
    );
  }
  return delay({ items, total: items.length, page: 1, page_size: 20 });
}

export async function mockGetOperation(id: number): Promise<Operation> {
  const op = MOCK_OPERATIONS.find((o) => o.id === id);
  if (!op) throw new Error("NOT_FOUND");
  return delay(op);
}

export async function mockGetAvailable(
  product_id: number,
  location_id: number,
): Promise<{ product_id: number; location_id: number; quantity: string }> {
  return delay({
    product_id,
    location_id,
    quantity: MOCK_AVAILABLE[`${product_id}:${location_id}`] ?? "0.000",
  });
}
