// @ts-nocheck
/**
 * Service Layer Skeleton — POS + Inventory (Grocery MVP)
 * ------------------------------------------------------
 * هدف هذا الملف: إعطاءك "هيكل جاهز للتعبئة" للخدمات الأساسية
 * المتوافقة مع:
 * - PRD
 * - Backlog
 * - DB Schema المقترح
 *
 * التصميم هنا "Database-agnostic":
 * يمكنك ربطه لاحقاً مع SQLite (Tauri/Electron) أو IndexedDB (Dexie).
 *
 * ملاحظة مهمة:
 * هذا Skeleton مقصود أن يكون واضحاً وقابلاً للتوسع وليس نهائياً بكل التفاصيل التنفيذية.
 */

import {
  ID,
  Invoice,
  InvoiceItem,
  MovementType,
  PaymentMethod,
  PaymentStatus,
  Product,
  Purchase,
  PurchaseItem,
  ReferenceType,
  SalesReturn,
  SalesReturnItem,
  Settings,
  StockMovement,
} from "../packages/core/src/index.js";
import { UnitOfWork } from "../packages/db/src/index.js";

/* ===========================
   Utility Types
   =========================== */

export interface CartLineInput {
  product_id: ID;
  qty: number;
  unit_price?: number;
  discount?: number; // per-line discount
}

export interface CreateInvoiceInput {
  cashier_user_id: ID;
  items: CartLineInput[];
  payment_method: PaymentMethod;
  customer_name?: string;
  notes?: string;
  device_id?: string;
  allow_manager_override?: boolean; // تم تمريره بعد تحقق كلمة المرور في UI
}

export interface CreatePurchaseInput {
  supplier_name: string;
  received_by_user_id: ID;
  items: Array<{
    product_id: ID;
    qty: number;
    cost_price: number;
  }>;
  notes?: string;
}

export interface CreateSalesReturnInput {
  original_invoice_id: ID;
  processed_by_user_id: ID;
  items: Array<{
    product_id: ID;
    qty: number;
  }>;
  reason: string;
  notes?: string;
}

export interface CreateAdjustmentInput {
  user_id: ID;
  product_id: ID;
  qty_change: number; // + زيادة / - نقص
  reason: string;
}

/* ===========================
   Errors
   =========================== */

export class DomainError extends Error {
  constructor(message: string, public code: string = "DOMAIN_ERROR") {
    super(message);
  }
}

export class NotFoundError extends DomainError {
  constructor(entity: string) {
    super(`${entity} not found`, "NOT_FOUND");
  }
}

export class ValidationError extends DomainError {
  constructor(message: string) {
    super(message, "VALIDATION");
  }
}

export class StockError extends DomainError {
  constructor(message: string) {
    super(message, "STOCK");
  }
}

/* ===========================
   Settings Service
   =========================== */

export interface SettingsInput {
  store_name: string;
  currency_code: string;
  rounding_mode: Settings["rounding_mode"];
  idle_lock_minutes: number;
  auto_print?: boolean;
}

export class SettingsService {
  constructor(private uow: UnitOfWork) {}

  async getSettings(): Promise<Settings | null> {
    return this.uow.settings.get();
  }

  async createOrUpdateSettings(input: SettingsInput): Promise<Settings> {
    if (!input.store_name.trim()) {
      throw new ValidationError("Store name is required");
    }
    if (!input.currency_code.trim()) {
      throw new ValidationError("Currency code is required");
    }
    if (input.idle_lock_minutes <= 0) {
      throw new ValidationError("Idle lock minutes must be positive");
    }

    const now = nowIso();
    const existing = await this.uow.settings.get();

    const base: Settings =
      existing ??
      ({
        settings_id: 1,
        store_name: input.store_name,
        currency_code: input.currency_code,
        rounding_mode: input.rounding_mode,
        idle_lock_minutes: input.idle_lock_minutes,
        auto_print: input.auto_print ?? false,
        last_backup_at: null,
        created_at: now,
        updated_at: now,
      } satisfies Settings);

    const updated: Settings = {
      ...base,
      ...input,
      auto_print: input.auto_print ?? base.auto_print ?? false,
      updated_at: now,
    };

    return this.uow.settings.save(updated);
  }
}

/* ===========================
   Time helpers
   =========================== */

export const nowIso = () => new Date().toISOString();

/* ===========================
   Calculation helpers
   =========================== */

export function calcInvoiceTotals(
  items: Array<{ qty: number; unit_price: number; discount?: number }>
) {
  if (items.length === 0) throw new ValidationError("Invoice must have at least one item");

  const lineTotals = items.map((it) => {
    if (it.qty <= 0) throw new ValidationError("Qty must be > 0");
    if (it.unit_price < 0) throw new ValidationError("Unit price must be >= 0");
    const disc = Math.max(0, it.discount ?? 0);
    const raw = it.qty * it.unit_price;
    const line = Math.max(0, raw - disc);
    return { raw, disc, line };
  });

  const subtotal = lineTotals.reduce((s, x) => s + x.raw, 0);
  const total_discount = lineTotals.reduce((s, x) => s + x.disc, 0);
  const grand_before_round = lineTotals.reduce((s, x) => s + x.line, 0);

  return { subtotal, total_discount, grand_before_round };
}

/**
 * تبسيط rounding. يمكن تطويرها لاحقاً حسب العملة/الإعداد.
 */
export function applyRounding(
  amount: number,
  rounding_mode: Settings["rounding_mode"]
) {
  if (rounding_mode === "NONE") {
    return { rounded: amount, adjustment: 0 };
  }
  if (rounding_mode === "NEAREST") {
    const rounded = Math.round(amount);
    return { rounded, adjustment: rounded - amount };
  }
  // CUSTOM: placeholder
  return { rounded: amount, adjustment: 0 };
}

/* ===========================
   Stock Ledger Service
   =========================== */

export class StockLedgerService {
  constructor(private uow: UnitOfWork) {}

  /**
   * يسجل حركة واحدة مع حساب NewBalance
   * يعتمد على قراءة رصيد المنتج الحالي ثم تطبيق التغيير.
   * في العمليات الجماعية، الأفضل استخدام recordManyAtomic.
   */
  async record(input: {
    datetime?: string;
    type: MovementType;
    product_id: ID;
    qty_change: number;
    reference_type?: ReferenceType;
    reference_id?: ID | null;
    user_id: ID;
    notes?: string;
  }): Promise<void> {
    const datetime = input.datetime ?? nowIso();
    const p = await this.uow.products.getById(input.product_id);
    if (!p) throw new NotFoundError("Product");

    const new_balance = p.stock_qty + input.qty_change;

    // قاعدة سلامة بسيطة:
    // لا نمنع السالب في كل مكان لأن ADJUSTMENT قد يكون لإثبات تلف،
    // لكن في SALE يجب منع السالب على مستوى InvoiceService.
    const mov: Omit<StockMovement, "movement_id"> = {
      datetime,
      type: input.type,
      product_id: input.product_id,
      qty_change: input.qty_change,
      new_balance,
      reference_type: input.reference_type ?? null,
      reference_id: input.reference_id ?? null,
      user_id: input.user_id,
      notes: input.notes ?? null,
      created_at: nowIso(),
    };

    await this.uow.movements.insertMany([mov]);
    await this.uow.products.update(p.product_id, {
      stock_qty: new_balance,
      updated_at: nowIso(),
    });
  }

  /**
   * تسجيل عدة حركات بشكل ذري مع تحديث أرصدة المنتجات.
   * يُستدعى داخل Transaction.
   */
  async recordManyAtomic(
    tx: UnitOfWork,
    inputs: Array<{
      datetime?: string;
      type: MovementType;
      product_id: ID;
      qty_change: number;
      reference_type?: ReferenceType;
      reference_id?: ID | null;
      user_id: ID;
      notes?: string;
    }>
  ): Promise<void> {
    // جلب المنتجات دفعة واحدة
    const productIds = Array.from(new Set(inputs.map((i) => i.product_id)));
    const products = await tx.products.getByIds(productIds);

    const map = new Map<ID, Product>(products.map((p) => [p.product_id, p]));
    for (const id of productIds) {
      if (!map.has(id)) throw new NotFoundError("Product");
    }

    const now = nowIso();

    // تجميع التغيرات لكل منتج
    const deltaByProduct = new Map<ID, number>();
    for (const i of inputs) {
      deltaByProduct.set(i.product_id, (deltaByProduct.get(i.product_id) ?? 0) + i.qty_change);
    }

    // حساب الرصيد الجديد لكل منتج
    const newBalanceByProduct = new Map<ID, number>();
    for (const [pid, delta] of deltaByProduct.entries()) {
      const p = map.get(pid)!;
      newBalanceByProduct.set(pid, p.stock_qty + delta);
    }

    // إنشاء Movements متسلسلة (نفس NewBalance النهائي في MVP)
    const movs: Omit<StockMovement, "movement_id">[] = inputs.map((i) => ({
      datetime: i.datetime ?? now,
      type: i.type,
      product_id: i.product_id,
      qty_change: i.qty_change,
      new_balance: newBalanceByProduct.get(i.product_id)!,
      reference_type: i.reference_type ?? null,
      reference_id: i.reference_id ?? null,
      user_id: i.user_id,
      notes: i.notes ?? null,
      created_at: now,
    }));

    await tx.movements.insertMany(movs);

    // تحديث المنتجات
    for (const [pid, newBal] of newBalanceByProduct.entries()) {
      await tx.products.update(pid, { stock_qty: newBal, updated_at: now });
    }
  }
}

/* ===========================
   Invoice Service
   =========================== */

export class InvoiceService {
  constructor(private uow: UnitOfWork) {}

  /**
   * ينشئ فاتورة بيع كاملة:
   * - يحسب الإجماليات
   * - يتحقق من المخزون
   * - يحفظ Invoice + Items
   * - يسجل Movements من نوع SALE
   *
   * MUST be atomic.
   */
  async createSale(input: CreateInvoiceInput): Promise<Invoice> {
    if (!input.items?.length) throw new ValidationError("No items");

    const settings = await this.uow.settings.get();
    if (!settings) throw new ValidationError("Settings not configured");

    return this.uow.runInTransaction(async (tx) => {
      const products = await tx.products.getByIds(input.items.map((i) => i.product_id));
      const pMap = new Map(products.map((p) => [p.product_id, p]));

      // بناء عناصر الفاتورة بحساب سعر الوحدة الافتراضي إذا لم يُمرر
      const enriched = input.items.map((i) => {
        const p = pMap.get(i.product_id);
        if (!p) throw new NotFoundError("Product");
        if (!p.is_active) throw new ValidationError(`Product inactive: ${p.name}`);

        const unit_price = i.unit_price ?? p.sale_price;
        const discount = Math.max(0, i.discount ?? 0);

        return {
          product: p,
          qty: i.qty,
          unit_price,
          discount,
        };
      });

      // تحقق مخزون قبل البيع
      for (const e of enriched) {
        if (e.qty <= 0) throw new ValidationError("Qty must be > 0");

        const willGoNegative = e.product.stock_qty - e.qty < 0;
        if (willGoNegative && !input.allow_manager_override) {
          throw new StockError(
            `Insufficient stock for ${e.product.name}. Available: ${e.product.stock_qty}`
          );
        }
      }

      // حساب الإجماليات
      const totals = calcInvoiceTotals(
        enriched.map((e) => ({ qty: e.qty, unit_price: e.unit_price, discount: e.discount }))
      );

      const rounding = applyRounding(totals.grand_before_round, settings.rounding_mode);

      const invoice_number = await tx.invoices.generateInvoiceNumber();
      const now = nowIso();

      const invToInsert: Omit<Invoice, "invoice_id"> = {
        invoice_number,
        datetime: now,
        cashier_user_id: input.cashier_user_id,
        subtotal: totals.subtotal,
        total_discount: totals.total_discount,
        rounding_adjustment: rounding.adjustment,
        grand_total: rounding.rounded,
        payment_method: input.payment_method,
        payment_status: input.payment_method === "CREDIT" ? "UNPAID" : "PAID",
        customer_name: input.customer_name ?? null,
        notes: input.notes ?? null,
        is_cancelled: false,
        cancelled_by_user_id: null,
        cancelled_at: null,
        device_id: input.device_id ?? null,
        created_at: now,
        updated_at: now,
      };

      const invoice = await tx.invoices.insertInvoice(invToInsert);

      // Items
      const itemsToInsert: Omit<InvoiceItem, "invoice_item_id">[] = enriched.map((e) => ({
        invoice_id: invoice.invoice_id,
        product_id: e.product.product_id,
        qty: e.qty,
        unit_price: e.unit_price,
        discount: e.discount,
        line_total: Math.max(0, e.qty * e.unit_price - e.discount),
        created_at: now,
      }));

      await tx.invoices.insertItems(itemsToInsert);

      // Movements: SALE
      const ledger = new StockLedgerService(tx);
      const movInputs = enriched.map((e) => ({
        type: "SALE" as MovementType,
        product_id: e.product.product_id,
        qty_change: -e.qty,
        reference_type: "INVOICE" as ReferenceType,
        reference_id: invoice.invoice_id,
        user_id: input.cashier_user_id,
        notes: input.allow_manager_override ? "Manager override allowed" : undefined,
      }));

      await ledger.recordManyAtomic(tx, movInputs);

      return invoice;
    });
  }

  /**
   * إلغاء فاتورة (MVP-style):
   * - Mark cancelled
   * - إعادة المخزون بحركة ADJUSTMENT أو حركة عكسية
   *
   * لتبسيط الـ MVP: سنستخدم ADJUSTMENT بإشارة واضحة.
   */
  async cancelInvoice(input: {
    invoice_id: ID;
    cancelled_by_user_id: ID;
    reason?: string;
  }): Promise<void> {
    return this.uow.runInTransaction(async (tx) => {
      const inv = await tx.invoices.getById(input.invoice_id);
      if (!inv) throw new NotFoundError("Invoice");
      if (inv.is_cancelled) return;

      const items = await tx.invoices.getItems(inv.invoice_id);
      if (!items.length) throw new ValidationError("Invoice has no items");

      const now = nowIso();

      await tx.invoices.markCancelled({
        invoice_id: inv.invoice_id,
        cancelled_by_user_id: input.cancelled_by_user_id,
        cancelled_at: now,
      });

      // إعادة المخزون عبر ADJUSTMENT
      const ledger = new StockLedgerService(tx);
      const movInputs = items.map((it) => ({
        type: "ADJUSTMENT" as MovementType,
        product_id: it.product_id,
        qty_change: it.qty, // إعادة الكمية
        reference_type: "INVOICE" as ReferenceType,
        reference_id: inv.invoice_id,
        user_id: input.cancelled_by_user_id,
        notes: `Cancel invoice (${inv.invoice_number})${input.reason ? `: ${input.reason}` : ""}`,
      }));

      await ledger.recordManyAtomic(tx, movInputs);
    });
  }
}

/* ===========================
   Purchase Service
   =========================== */

export class PurchaseService {
  constructor(private uow: UnitOfWork) {}

  async createPurchase(input: CreatePurchaseInput): Promise<Purchase> {
    if (!input.supplier_name?.trim()) throw new ValidationError("Supplier name required");
    if (!input.items?.length) throw new ValidationError("No items");

    return this.uow.runInTransaction(async (tx) => {
      const now = nowIso();
      const purchase_number = await tx.purchases.generatePurchaseNumber();

      // جلب المنتجات
      const products = await tx.products.getByIds(input.items.map((i) => i.product_id));
      const pMap = new Map(products.map((p) => [p.product_id, p]));
      for (const i of input.items) {
        if (!pMap.get(i.product_id)) throw new NotFoundError("Product");
        if (i.qty <= 0) throw new ValidationError("Qty must be > 0");
        if (i.cost_price < 0) throw new ValidationError("Cost price must be >= 0");
      }

      const itemsWithTotals = input.items.map((i) => ({
        ...i,
        line_total: i.qty * i.cost_price,
      }));

      const total_cost = itemsWithTotals.reduce((s, x) => s + x.line_total, 0);

      const purchaseToInsert: Omit<Purchase, "purchase_id"> = {
        purchase_number,
        supplier_name: input.supplier_name.trim(),
        datetime: now,
        received_by_user_id: input.received_by_user_id,
        total_cost,
        notes: input.notes ?? null,
        created_at: now,
        updated_at: now,
      };

      const purchase = await tx.purchases.insertPurchase(purchaseToInsert);

      const itemsToInsert: Omit<PurchaseItem, "purchase_item_id">[] = itemsWithTotals.map((i) => ({
        purchase_id: purchase.purchase_id,
        product_id: i.product_id,
        qty: i.qty,
        cost_price: i.cost_price,
        line_total: i.line_total,
        created_at: now,
      }));

      await tx.purchases.insertItems(itemsToInsert);

      // تحديث CostPrice لكل منتج إلى آخر تكلفة شراء (Last Purchase Cost)
      for (const i of input.items) {
        await tx.products.update(i.product_id, { cost_price: i.cost_price, updated_at: now });
      }

      // Movements: PURCHASE
      const ledger = new StockLedgerService(tx);
      const movInputs = input.items.map((i) => ({
        type: "PURCHASE" as MovementType,
        product_id: i.product_id,
        qty_change: i.qty,
        reference_type: "PURCHASE" as ReferenceType,
        reference_id: purchase.purchase_id,
        user_id: input.received_by_user_id,
        notes: `Supplier: ${input.supplier_name}`,
      }));

      await ledger.recordManyAtomic(tx, movInputs);

      return purchase;
    });
  }
}

/* ===========================
   Return Service
   =========================== */

export class ReturnService {
  constructor(private uow: UnitOfWork) {}

  /**
   * مرتجع مبيعات مرتبط بفاتورة أصلية.
   * يعتمد على:
   * - قراءة عناصر الفاتورة الأصلية
   * - التحقق من أن qty_returned <= qty_sold (MVP: لا نراكم مرتجعات متعددة إلا بتطوير لاحق)
   */
  async createSalesReturn(input: CreateSalesReturnInput): Promise<SalesReturn> {
    if (!input.items?.length) throw new ValidationError("No items");
    if (!input.reason?.trim()) throw new ValidationError("Reason required");

    return this.uow.runInTransaction(async (tx) => {
      const inv = await tx.invoices.getById(input.original_invoice_id);
      if (!inv) throw new NotFoundError("Invoice");
      if (inv.is_cancelled) throw new ValidationError("Cannot return a cancelled invoice");

      const invItems = await tx.invoices.getItems(inv.invoice_id);
      if (!invItems.length) throw new ValidationError("Original invoice has no items");

      const soldByProduct = new Map<ID, InvoiceItem>();
      for (const it of invItems) {
        soldByProduct.set(it.product_id, it);
      }

      // تحقق كميات المرتجع
      const requested = input.items.map((i) => {
        const sold = soldByProduct.get(i.product_id);
        if (!sold) throw new ValidationError("Product not in original invoice");
        if (i.qty <= 0) throw new ValidationError("Qty must be > 0");
        if (i.qty > sold.qty) {
          throw new ValidationError("Return qty exceeds sold qty");
        }
        return { sold, qty: i.qty };
      });

      const now = nowIso();
      const return_number = await tx.returns.generateReturnNumber();

      // حساب إجمالي الاسترداد بناء على سعر البيع في الفاتورة الأصلية
      const lineModels = requested.map(({ sold, qty }) => {
        const unit_price = sold.unit_price;
        const discount = 0; // MVP: يمكن توزيع خصم سطر الأصل إن أردت.
        const line_total = Math.max(0, qty * unit_price - discount);
        return {
          product_id: sold.product_id,
          qty,
          unit_price,
          discount,
          line_total,
        };
      });

      const total_refund = lineModels.reduce((s, x) => s + x.line_total, 0);

      const retToInsert: Omit<SalesReturn, "sales_return_id"> = {
        return_number,
        original_invoice_id: inv.invoice_id,
        datetime: now,
        processed_by_user_id: input.processed_by_user_id,
        total_refund,
        reason: input.reason.trim(),
        notes: input.notes ?? null,
        created_at: now,
        updated_at: now,
      };

      const ret = await tx.returns.insertReturn(retToInsert);

      const itemsToInsert: Omit<SalesReturnItem, "sales_return_item_id">[] = lineModels.map((m) => ({
        sales_return_id: ret.sales_return_id,
        product_id: m.product_id,
        qty: m.qty,
        unit_price: m.unit_price,
        discount: m.discount,
        line_total: m.line_total,
        created_at: now,
      }));

      await tx.returns.insertItems(itemsToInsert);

      // Movements: SALES_RETURN
      const ledger = new StockLedgerService(tx);
      const movInputs = lineModels.map((m) => ({
        type: "SALES_RETURN" as MovementType,
        product_id: m.product_id,
        qty_change: m.qty,
        reference_type: "SALES_RETURN" as ReferenceType,
        reference_id: ret.sales_return_id,
        user_id: input.processed_by_user_id,
        notes: `Return for invoice ${inv.invoice_number}`,
      }));

      await ledger.recordManyAtomic(tx, movInputs);

      return ret;
    });
  }
}

/* ===========================
   Adjustment Service
   =========================== */

export class AdjustmentService {
  constructor(private uow: UnitOfWork) {}

  async adjustStock(input: CreateAdjustmentInput): Promise<void> {
    if (!input.reason?.trim()) throw new ValidationError("Reason required");
    if (input.qty_change === 0) throw new ValidationError("Qty change cannot be zero");

    return this.uow.runInTransaction(async (tx) => {
      const p = await tx.products.getById(input.product_id);
      if (!p) throw new NotFoundError("Product");

      const ledger = new StockLedgerService(tx);
      await ledger.recordManyAtomic(tx, [
        {
          type: "ADJUSTMENT",
          product_id: input.product_id,
          qty_change: input.qty_change,
          reference_type: "ADJUSTMENT",
          reference_id: null,
          user_id: input.user_id,
          notes: input.reason.trim(),
        },
      ]);
    });
  }
}

/* ===========================
   Reports Service
   =========================== */

export class ReportService {
  constructor(private uow: UnitOfWork) {}

  /**
   * تقرير مبيعات اليوم (MVP)
   * يعتمد على فواتير غير ملغاة.
   */
  async getSalesSummary(startIso: string, endIso: string) {
    const invoices = await this.uow.invoices.listByDateRange(startIso, endIso);
    const valid = invoices.filter((i) => !i.is_cancelled);

    const total_sales = valid.reduce((s, i) => s + i.grand_total, 0);
    const invoices_count = valid.length;
    const avg_invoice = invoices_count ? total_sales / invoices_count : 0;

    return { total_sales, invoices_count, avg_invoice };
  }

  /**
   * تنبيهات المخزون
   */
  async getLowStock(products: Product[]) {
    // يمكنك لاحقاً نقل هذا لـ ProductsRepo query.
    return products.filter((p) => p.is_active && p.stock_qty <= p.min_stock_alert);
  }

  /**
   * أفضل الأصناف (Top N)
   * MVP: نجمع من InvoiceItems ضمن نطاق زمني.
   * يحتاج Repo helper لاحقاً لتحسين الأداء.
   */
  async getTopProducts(
    startIso: string,
    endIso: string,
    topN: number = 10
  ): Promise<
    Array<{ product_id: ID; qty: number; value: number }>
  > {
    // Skeleton placeholder:
    // في التطبيق الحقيقي ستجلب InvoiceItems ضمن نطاق،
    // أو تستخدم Query Aggregate في SQLite.
    throw new DomainError("Implement with repo aggregate or query helper", "NOT_IMPLEMENTED");
  }

  /**
   * ربح تقديري
   * يعتمد على Last Purchase Cost المخزنة في product.cost_price
   */
  async getEstimatedProfit(
    startIso: string,
    endIso: string
  ): Promise<number> {
    // Skeleton placeholder.
    throw new DomainError("Implement profit calculation", "NOT_IMPLEMENTED");
  }
}

/* ===========================
   Backup Service
   =========================== */

export class BackupService {
  constructor(private uow: UnitOfWork) {}

  async manualBackup() {
    const blob = await this.uow.backup.exportBackupBlob();
    // في الويب: تُرجع blob للواجهة لتقوم هي بعمليات download.
    // في الديسكتوب: يمكن حفظه في مسار محدد.
    return blob;
  }

  async runDailyAutoBackup() {
    const now = nowIso();
    await this.uow.backup.saveAutoBackup({ createdAt: now });
    await this.uow.backup.rotateAutoBackups(7);

    await this.uow.settings.update({
      last_backup_at: now,
      updated_at: now,
    });
  }
}

/* ===========================
   Orchestrator (اختياري)
   =========================== */

export class Services {
  public ledger: StockLedgerService;
  public invoices: InvoiceService;
  public purchases: PurchaseService;
  public returns: ReturnService;
  public adjustments: AdjustmentService;
  public reports: ReportService;
  public backup: BackupService;

  constructor(private uow: UnitOfWork) {
    this.ledger = new StockLedgerService(uow);
    this.invoices = new InvoiceService(uow);
    this.purchases = new PurchaseService(uow);
    this.returns = new ReturnService(uow);
    this.adjustments = new AdjustmentService(uow);
    this.reports = new ReportService(uow);
    this.backup = new BackupService(uow);
  }
}

/* ===========================
   Notes for next implementation step
   =========================== */

/**
 * 1) Implement UnitOfWork for:
 *    - Dexie (IndexedDB):
 *      - define stores + indexes
 *      - implement runInTransaction using dexie.transaction
 *
 *    - SQLite (Tauri/Electron):
 *      - implement repos with SQL statements
 *      - implement runInTransaction with BEGIN/COMMIT/ROLLBACK
 *
 * 2) Add Repo helpers for reports:
 *    - Aggregate sales by product
 *    - InvoiceItems fetch by date range
 *
 * 3) Decide cancellation policy:
 *    - allow cancellation within short time window
 *    - or require manager override + reason
 *
 * 4) Add tests:
 *    - Unit tests for calcInvoiceTotals / applyRounding
 *    - Integration tests for createSale & createPurchase with mock repos
 */
