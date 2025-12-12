export type ID = number;

export type PaymentMethod = "CASH" | "CREDIT";
export type PaymentStatus = "PAID" | "UNPAID";

export type MovementType =
  | "PURCHASE"
  | "SALE"
  | "SALES_RETURN"
  | "ADJUSTMENT"
  | "OPENING_BALANCE";

export type ReferenceType =
  | "INVOICE"
  | "PURCHASE"
  | "SALES_RETURN"
  | "ADJUSTMENT"
  | null;

export interface User {
  /**
   * Optional generic id to align with external schemas while keeping the
   * internal auto-incremented key (user_id) used by Dexie.
   */
  id?: ID;
  user_id: ID;
  username: string;
  password: string;
  display_name?: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Settings {
  settings_id: 1;
  store_name: string;
  currency_code: string;
  rounding_mode: "NEAREST" | "NONE" | "CUSTOM";
  idle_lock_minutes: number;
  auto_print: boolean;
  last_backup_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: ID;
  name: string;
  is_active: boolean;
  createdAt: string;
  updatedAt: string;
  /** Legacy aliases kept for backward compatibility with earlier schema drafts. */
  category_id?: ID;
  created_at?: string;
  updated_at?: string;
}

export interface Product {
  id: ID;
  name: string;
  barcode?: string | null;
  categoryId?: ID | null;
  unit?: string | null;
  sale_price: number;
  cost_price?: number | null;
  stock_qty: number;
  min_stock_alert: number;
  max_discount?: number | null;
  is_active: boolean;
  createdAt: string;
  updatedAt: string;
  /** Legacy aliases kept for backward compatibility with earlier schema drafts. */
  product_id?: ID;
  category_id?: ID | null;
  created_at?: string;
  updated_at?: string;
}

export interface Invoice {
  invoice_id: ID;
  invoice_number: string;
  datetime: string;
  cashier_user_id: ID;
  subtotal: number;
  total_discount: number;
  rounding_adjustment: number;
  grand_total: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  customer_name?: string | null;
  notes?: string | null;
  is_cancelled: boolean;
  cancelled_by_user_id?: ID | null;
  cancelled_at?: string | null;
  device_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItem {
  invoice_item_id: ID;
  invoice_id: ID;
  product_id: ID;
  qty: number;
  unit_price: number;
  discount: number;
  line_total: number;
  created_at: string;
}

export interface Purchase {
  purchase_id: ID;
  purchase_number: string;
  supplier_name: string;
  datetime: string;
  received_by_user_id: ID;
  total_cost: number;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PurchaseItem {
  purchase_item_id: ID;
  purchase_id: ID;
  product_id: ID;
  qty: number;
  cost_price: number;
  line_total: number;
  created_at: string;
}

export interface SalesReturn {
  sales_return_id: ID;
  return_number: string;
  original_invoice_id: ID;
  datetime: string;
  processed_by_user_id: ID;
  total_refund: number;
  reason: string;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SalesReturnItem {
  sales_return_item_id: ID;
  sales_return_id: ID;
  product_id: ID;
  qty: number;
  unit_price: number;
  discount: number;
  line_total: number;
  created_at: string;
}

export interface StockMovement {
  movement_id: ID;
  datetime: string;
  type: MovementType;
  product_id: ID;
  qty_change: number;
  new_balance: number;
  reference_type?: ReferenceType;
  reference_id?: ID | null;
  user_id: ID;
  notes?: string | null;
  created_at: string;
}

export interface StockAdjustment {
  adjustment_id: ID;
  product_id: ID;
  qty_change: number;
  reason?: string | null;
  created_at: string;
}

export interface StockSnapshot {
  snapshot_id: ID;
  product_id: ID;
  balance: number;
  captured_at: string;
}
