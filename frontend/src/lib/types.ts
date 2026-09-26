export type Quantity = string;
export type QuantityInput = string | number;
export type Role = 'manager' | 'staff';
export type Uom = 'unit' | 'kg' | 'g' | 'l' | 'ml' | 'm' | 'box';
export type StockStatus = 'in_stock' | 'low' | 'out';
export type OperationType = 'receipt' | 'delivery' | 'transfer' | 'adjustment';
export type OperationStatus =
  'draft' | 'waiting' | 'ready' | 'done' | 'canceled';
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}
export interface FieldError {
  field: string;
  message: string;
}
export interface ApiErrorBody {
  code: string;
  message: string;
  details: Record<string, unknown>;
  field_errors: FieldError[];
}
export interface UserRef {
  id: number;
  name: string;
}
export interface User extends UserRef {
  email: string;
  role: Role;
  created_at: string;
}
export interface Category {
  id: number;
  name: string;
}
export interface ProductCreate {
  sku: string;
  name: string;
  category_id?: number | null;
  uom: Uom;
  min_qty?: QuantityInput;
  max_qty?: QuantityInput;
  description?: string | null;
  initial_quantity?: QuantityInput;
  initial_location_id?: number | null;
}
export type ProductUpdate = Partial<
  Omit<ProductCreate, 'initial_quantity' | 'initial_location_id'>
> & { is_active?: boolean };
export interface Product {
  id: number;
  sku: string;
  name: string;
  category: Category | null;
  uom: Uom;
  min_qty: Quantity;
  max_qty: Quantity;
  on_hand: Quantity;
  stock_status: StockStatus;
  suggested_order: Quantity;
  is_active: boolean;
  created_at: string;
  description?: string | null;
}
export interface StockByLocation {
  location_id: number;
  location_name: string;
  warehouse_id: number;
  quantity: Quantity;
}
export interface ProductDetail extends Product {
  stock_by_location: StockByLocation[];
  recent_moves: LedgerEntry[];
}
export interface Warehouse {
  id: number;
  code: string;
  name: string;
  address: string | null;
  is_active: boolean;
  location_count: number;
}
export interface WarehouseCreate {
  code: string;
  name: string;
  address?: string | null;
}
export type WarehouseUpdate = Partial<Omit<WarehouseCreate, 'code'>> & {
  is_active?: boolean;
};
export interface Location {
  id: number;
  warehouse_id: number;
  warehouse_code: string;
  name: string;
  full_name: string;
  is_active: boolean;
}
export interface LocationCreate {
  warehouse_id: number;
  name: string;
}
export interface LocationUpdate {
  name?: string;
  is_active?: boolean;
}
export interface LocationRef {
  id: number;
  full_name: string;
}
export interface Balance extends StockByLocation {
  product_id: number;
  sku: string;
  product_name: string;
  uom: Uom;
}
export interface AvailableStock {
  product_id: number;
  location_id: number;
  quantity: Quantity;
}
export interface InventoryIntegrity {
  ok: boolean;
  checked: number;
  mismatches: Record<string, unknown>[];
}
export interface CountPriorityItem {
  product_id: number;
  sku: string;
  product_name: string;
  uom: Uom;
  location_id: number;
  location_name: string;
  quantity: Quantity;
  last_counted_at: string | null;
  days_since_count: number;
  movements_since_count: number;
  past_discrepancies: number;
  score: number;
  level: 'high' | 'medium' | 'low';
  reasons: string[];
}
export interface OperationLineCreate {
  product_id: number;
  quantity?: QuantityInput;
  counted_quantity?: QuantityInput;
}
export interface OperationCreate {
  type: OperationType;
  source_location_id?: number | null;
  destination_location_id?: number | null;
  partner_name?: string | null;
  scheduled_date?: string | null;
  notes?: string | null;
  lines: OperationLineCreate[];
}
export type OperationUpdate = Partial<Omit<OperationCreate, 'type'>>;
export interface OperationLine {
  id: number;
  product_id: number;
  sku: string;
  product_name: string;
  uom: Uom;
  quantity: Quantity | null;
  counted_quantity: Quantity | null;
  system_quantity: Quantity | null;
  available: Quantity;
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
export interface Operation extends Omit<OperationSummary, 'line_count'> {
  warehouse_id: number;
  notes: string | null;
  lines: OperationLine[];
  created_by: UserRef;
  validated_by: UserRef | null;
}
export interface StockEffect {
  product_id: number;
  sku: string;
  location_id: number;
  location_name: string;
  quantity_delta: Quantity;
  balance_after: Quantity;
}
export interface ValidateResult extends Operation {
  already_done: boolean;
  stock_effects: StockEffect[];
}
export interface LedgerEntry extends StockEffect {
  id: number;
  created_at: string;
  operation_id: number;
  reference: string;
  movement_type: OperationType;
  product_name: string;
  uom: Uom;
  counterpart_location_id: number | null;
  counterpart_location_name: string | null;
  created_by: UserRef;
}
export interface DashboardSummary {
  kpis: {
    products_in_stock: number;
    low_stock: number;
    out_of_stock: number;
    pending_receipts: number;
    pending_deliveries: number;
    scheduled_transfers: number;
  };
  low_stock_items: {
    product_id: number;
    sku: string;
    name: string;
    uom: Uom;
    on_hand: Quantity;
    min_qty: Quantity;
    suggested_order: Quantity;
    stock_status: StockStatus;
  }[];
  recent_operations: OperationSummary[];
  ledger_ok: boolean;
}
export interface LoginRequest {
  email: string;
  password: string;
}
export interface SignupRequest extends LoginRequest {
  name: string;
}
export interface ForgotPasswordRequest {
  email: string;
}
export interface VerifyOtpRequest extends ForgotPasswordRequest {
  otp: string;
}
export interface ResetPasswordRequest extends VerifyOtpRequest {
  new_password: string;
}
export interface MessageResponse {
  message: string;
}
export interface VerifyOtpResponse {
  valid: boolean;
}
export interface HealthResponse {
  status: string;
  db: string;
}
