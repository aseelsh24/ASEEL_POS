# Database Schema + ERD (نصي) + TypeScript Types  
## نظام نقطة بيع وإدارة مخزون لمحل بقالة صغير — MVP (Offline / جهاز واحد)

هذه الوثيقة مصممة لتناسب مسارين:
1) **Web/PWA** باستخدام IndexedDB (مثل Dexie).  
2) **Desktop خفيف** باستخدام SQLite (مثل Tauri/Electron).  

الهيكل المقترح **Relational-first** ويمكن تطبيقه كما هو في SQLite أو ترجمته إلى Stores في IndexedDB.

---

## 1) مبادئ تصميم البيانات

- **سلامة تاريخية**: لا حذف فعلي لفواتير أو أصناف؛ نعتمد *Soft Delete* وحقول حالة.  
- **Ledger أولاً**: أي تغيير مخزون يجب أن يولّد حركة في سجل الحركة.  
- **MVP-lean**: مورد كنص حر، دور مستخدم واحد افتراضياً، بدون مزامنة.

---

## 2) الكيانات الأساسية

- Users (محدودة في MVP)
- Settings
- Categories
- Products
- Invoices
- InvoiceItems
- Purchases
- PurchaseItems
- SalesReturns
- SalesReturnItems
- StockMovements

---

## 3) مخطط ERD (نصي)

```
Users (1) ──────< Invoices (many) ──────< InvoiceItems (many) >────── (1) Products
   |                     |
   |                     └──────────< SalesReturns (many) ───────< SalesReturnItems (many) >──── (1) Products
   |
Settings (1 per store/device)

Categories (1) ──────< Products (many)

Purchases (many) ──────< PurchaseItems (many) >────── (1) Products

Products (1) ──────< StockMovements (many)
Invoices (0..1) ──────< StockMovements (many)   [Type = SALE]
Purchases (0..1) ─────< StockMovements (many)   [Type = PURCHASE]
SalesReturns (0..1) ──< StockMovements (many)   [Type = SALES_RETURN]
(Manual Adjustments) ─< StockMovements (many)   [Type = ADJUSTMENT]
```

---

## 4) SQLite Schema (مقترح)

> ملاحظة: يمكنك تعديل أنواع الحقول حسب احتياجك (INTEGER/REAL/TEXT).  
> استخدم `STRICT` إن رغبت لاحقاً.

### 4.1 Users

```sql
CREATE TABLE IF NOT EXISTS users (
  user_id        INTEGER PRIMARY KEY AUTOINCREMENT,
  username       TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  display_name   TEXT NOT NULL,
  role           TEXT NOT NULL DEFAULT 'MANAGER', -- MVP: MANAGER فقط
  is_active      INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);
```

### 4.2 Settings

```sql
CREATE TABLE IF NOT EXISTS settings (
  settings_id        INTEGER PRIMARY KEY CHECK (settings_id = 1),
  store_name         TEXT NOT NULL,
  currency_code      TEXT NOT NULL,  -- مثال: YER
  rounding_mode      TEXT NOT NULL DEFAULT 'NEAREST', -- أو تعريفك الخاص
  idle_lock_minutes  INTEGER NOT NULL DEFAULT 5,
  auto_print         INTEGER NOT NULL DEFAULT 0,
  last_backup_at     TEXT,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL
);

-- إدراج صف وحيد عند أول تشغيل
-- INSERT INTO settings(settings_id, store_name, currency_code, created_at, updated_at) VALUES (1, 'My Store', 'YER', datetime('now'), datetime('now'));
```

### 4.3 Categories

```sql
CREATE TABLE IF NOT EXISTS categories (
  category_id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL UNIQUE,
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
```

### 4.4 Products

```sql
CREATE TABLE IF NOT EXISTS products (
  product_id        INTEGER PRIMARY KEY AUTOINCREMENT,
  name              TEXT NOT NULL,
  barcode           TEXT UNIQUE,
  category_id       INTEGER,
  unit              TEXT,            -- قطعة/علبة/كرتون...
  sale_price        REAL NOT NULL CHECK (sale_price > 0),
  cost_price        REAL NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
  stock_qty         REAL NOT NULL DEFAULT 0,
  min_stock_alert   REAL NOT NULL DEFAULT 5,
  image_url         TEXT,
  max_discount      REAL,            -- اختياري
  is_active         INTEGER NOT NULL DEFAULT 1,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  FOREIGN KEY (category_id) REFERENCES categories(category_id)
);

CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
```

### 4.5 Invoices

```sql
CREATE TABLE IF NOT EXISTS invoices (
  invoice_id           INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_number       TEXT NOT NULL UNIQUE, -- رقم قابل للعرض والطباعة
  datetime             TEXT NOT NULL,
  cashier_user_id      INTEGER NOT NULL,
  subtotal             REAL NOT NULL,
  total_discount       REAL NOT NULL DEFAULT 0,
  rounding_adjustment  REAL NOT NULL DEFAULT 0,
  grand_total          REAL NOT NULL,
  payment_method       TEXT NOT NULL DEFAULT 'CASH', -- CASH/CREDIT
  payment_status       TEXT NOT NULL DEFAULT 'PAID', -- PAID/UNPAID
  customer_name        TEXT,
  notes                TEXT,
  is_cancelled         INTEGER NOT NULL DEFAULT 0,
  cancelled_by_user_id INTEGER,
  cancelled_at         TEXT,
  device_id            TEXT,
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL,
  FOREIGN KEY (cashier_user_id) REFERENCES users(user_id),
  FOREIGN KEY (cancelled_by_user_id) REFERENCES users(user_id)
);

CREATE INDEX IF NOT EXISTS idx_invoices_datetime ON invoices(datetime);
CREATE INDEX IF NOT EXISTS idx_invoices_cashier ON invoices(cashier_user_id);
```

### 4.6 InvoiceItems

```sql
CREATE TABLE IF NOT EXISTS invoice_items (
  invoice_item_id  INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id       INTEGER NOT NULL,
  product_id       INTEGER NOT NULL,
  qty              REAL NOT NULL CHECK (qty > 0),
  unit_price       REAL NOT NULL CHECK (unit_price >= 0),
  discount         REAL NOT NULL DEFAULT 0 CHECK (discount >= 0),
  line_total       REAL NOT NULL,
  created_at       TEXT NOT NULL,
  FOREIGN KEY (invoice_id) REFERENCES invoices(invoice_id),
  FOREIGN KEY (product_id) REFERENCES products(product_id)
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_product ON invoice_items(product_id);
```

### 4.7 Purchases

```sql
CREATE TABLE IF NOT EXISTS purchases (
  purchase_id     INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_number TEXT NOT NULL UNIQUE,
  supplier_name   TEXT NOT NULL,
  datetime        TEXT NOT NULL,
  received_by_user_id INTEGER NOT NULL,
  total_cost      REAL NOT NULL,
  notes           TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  FOREIGN KEY (received_by_user_id) REFERENCES users(user_id)
);

CREATE INDEX IF NOT EXISTS idx_purchases_datetime ON purchases(datetime);
```

### 4.8 PurchaseItems

```sql
CREATE TABLE IF NOT EXISTS purchase_items (
  purchase_item_id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_id      INTEGER NOT NULL,
  product_id       INTEGER NOT NULL,
  qty              REAL NOT NULL CHECK (qty > 0),
  cost_price       REAL NOT NULL CHECK (cost_price >= 0),
  line_total       REAL NOT NULL,
  created_at       TEXT NOT NULL,
  FOREIGN KEY (purchase_id) REFERENCES purchases(purchase_id),
  FOREIGN KEY (product_id) REFERENCES products(product_id)
);

CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_product ON purchase_items(product_id);
```

### 4.9 SalesReturns

```sql
CREATE TABLE IF NOT EXISTS sales_returns (
  sales_return_id      INTEGER PRIMARY KEY AUTOINCREMENT,
  return_number        TEXT NOT NULL UNIQUE,
  original_invoice_id  INTEGER NOT NULL,
  datetime             TEXT NOT NULL,
  processed_by_user_id INTEGER NOT NULL,
  total_refund         REAL NOT NULL DEFAULT 0,
  reason               TEXT NOT NULL,
  notes                TEXT,
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL,
  FOREIGN KEY (original_invoice_id) REFERENCES invoices(invoice_id),
  FOREIGN KEY (processed_by_user_id) REFERENCES users(user_id)
);

CREATE INDEX IF NOT EXISTS idx_sales_returns_invoice ON sales_returns(original_invoice_id);
```

### 4.10 SalesReturnItems

```sql
CREATE TABLE IF NOT EXISTS sales_return_items (
  sales_return_item_id INTEGER PRIMARY KEY AUTOINCREMENT,
  sales_return_id      INTEGER NOT NULL,
  product_id           INTEGER NOT NULL,
  qty                  REAL NOT NULL CHECK (qty > 0),
  unit_price           REAL NOT NULL CHECK (unit_price >= 0),
  discount             REAL NOT NULL DEFAULT 0 CHECK (discount >= 0),
  line_total           REAL NOT NULL,
  created_at           TEXT NOT NULL,
  FOREIGN KEY (sales_return_id) REFERENCES sales_returns(sales_return_id),
  FOREIGN KEY (product_id) REFERENCES products(product_id)
);

CREATE INDEX IF NOT EXISTS idx_sales_return_items_return ON sales_return_items(sales_return_id);
```

### 4.11 StockMovements

```sql
CREATE TABLE IF NOT EXISTS stock_movements (
  movement_id    INTEGER PRIMARY KEY AUTOINCREMENT,
  datetime       TEXT NOT NULL,
  type           TEXT NOT NULL, -- PURCHASE/SALE/SALES_RETURN/ADJUSTMENT/OPENING_BALANCE
  product_id     INTEGER NOT NULL,
  qty_change     REAL NOT NULL,
  new_balance    REAL NOT NULL,
  reference_type TEXT,  -- 'INVOICE' | 'PURCHASE' | 'SALES_RETURN' | 'ADJUSTMENT'
  reference_id   INTEGER,
  user_id        INTEGER NOT NULL,
  notes          TEXT,
  created_at     TEXT NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(product_id),
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE INDEX IF NOT EXISTS idx_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_movements_datetime ON stock_movements(datetime);
CREATE INDEX IF NOT EXISTS idx_movements_type ON stock_movements(type);
```

---

## 5) قواعد اتساق مهمّة (للتنفيذ بالخدمات)

هذه ليست SQL constraints بل قواعد Service-level:

1) **عند حفظ فاتورة بيع**  
   - إنشاء Invoice + InvoiceItems  
   - تعديل `products.stock_qty`  
   - إنشاء StockMovements من نوع SALE لكل سطر.

2) **عند إلغاء فاتورة**  
   - وضع `is_cancelled = 1`  
   - **إعادة المخزون** بحركة عكسية (SALE_REVERSAL)  
     أو استخدام ADJUSTMENT مع ملاحظة واضحة.  
   - في MVP يمكن اختيار أبسط مسار:  
     *منع إلغاء فاتورة بعد مرور X دقائق* أو  
     *السماح مع حركة ADJUSTMENT واضحة.*

3) **عند حفظ مشتريات**  
   - تحديث `products.cost_price` إلى آخر تكلفة شراء.  
   - زيادة `stock_qty`.  
   - تسجيل PURCHASE movements.

4) **عند المرتجع**  
   - التحقق أن `qty_returned <= qty_sold` لكل سطر.  
   - زيادة المخزون.  
   - تسجيل SALES_RETURN movements.

---

## 6) تحويل هذا إلى IndexedDB (Dexie Map)

اقتراح Stores:

- `users`
- `settings`
- `categories`
- `products`
- `invoices`
- `invoice_items`
- `purchases`
- `purchase_items`
- `sales_returns`
- `sales_return_items`
- `stock_movements`

**Indexes مقترحة في Dexie:**
- products: `&barcode, name, category_id, is_active`
- invoices: `&invoice_number, datetime, cashier_user_id, is_cancelled`
- invoice_items: `invoice_id, product_id`
- purchases: `&purchase_number, datetime`
- stock_movements: `product_id, datetime, type`

---

## 7) TypeScript Types (واجهة بيانات)

> هذه الأنواع مناسبة لطبقة Domain/Store، ويمكنك إضافة DTOs للـ UI عند الحاجة.

```ts
export type ID = number;

export type UserRole = "MANAGER" | "CASHIER";

export interface User {
  user_id: ID;
  username: string;
  password_hash: string;
  display_name: string;
  role: UserRole;
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
  category_id: ID;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  product_id: ID;
  name: string;
  barcode?: string | null;
  category_id?: ID | null;
  unit?: string | null;
  sale_price: number;
  cost_price: number;
  stock_qty: number;
  min_stock_alert: number;
  image_url?: string | null;
  max_discount?: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type PaymentMethod = "CASH" | "CREDIT";
export type PaymentStatus = "PAID" | "UNPAID";

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

export interface StockMovement {
  movement_id: ID;
  datetime: string;
  type: MovementType;
  product_id: ID;
  qty_change: number;    // + زيادة / - نقص
  new_balance: number;
  reference_type?: ReferenceType;
  reference_id?: ID | null;
  user_id: ID;
  notes?: string | null;
  created_at: string;
}
```

---

## 8) Helpers Types للـ POS

```ts
export interface CartLine {
  product_id: ID;
  name: string;
  barcode?: string | null;
  qty: number;
  unit_price: number;
  discount: number;
  line_total: number;
  stock_qty_snapshot: number; // لعرض تحذير سريع
}

export interface CreateInvoiceInput {
  cashier_user_id: ID;
  items: Array<{
    product_id: ID;
    qty: number;
    unit_price: number;
    discount: number;
  }>;
  payment_method: PaymentMethod;
  customer_name?: string;
  notes?: string;
}
```

---

## 9) توصية عملية لطبقة الخدمات

**Services مقترحة:**
- `ProductService`
- `InvoiceService`
- `PurchaseService`
- `ReturnService`
- `StockLedgerService`
- `BackupService`
- `ReportService`

**قاعدة ذهبية:**  
أي خدمة تغير المخزون يجب أن تستدعي `StockLedgerService.record(...)`.

---

## 10) نقاط قد تُختصر لو أردت MVP أنحف

- حذف جداول Returns والاكتفاء بـ:
  - إنشاء حركة SALES_RETURN مباشرة مع Reference إلى Invoice.  
  لكن وجود جداول المرتجع يجعل واجهة الإرجاع وقيودها أوضح وأسهل.

---

✅ بهذه الوثيقة لديك الآن:
- Schema جاهز للتنفيذ.  
- ERD نصي واضح.  
- Typescript types متسقة مع الـ PRD والـ Backlog.
