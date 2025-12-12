// @ts-nocheck
import Dexie, { Table } from "dexie";
import {
  Category,
  ID,
  Invoice,
  InvoiceItem,
  MovementType,
  Product,
  Purchase,
  PurchaseItem,
  ReferenceType,
  SalesReturn,
  SalesReturnItem,
  Settings,
  StockMovement,
  User,
} from "../../core/src/index.js";

export interface CategoriesRepo {
  list(): Promise<Category[]>;
  create(category: Omit<Category, "category_id">): Promise<Category>;
}

export interface ProductsRepo {
  getById(id: ID): Promise<Product | null>;
  getByIds(ids: ID[]): Promise<Product[]>;
  getByBarcode(barcode: string): Promise<Product | null>;
  searchByName(query: string, limit?: number): Promise<Product[]>;
  insert(p: Omit<Product, "product_id">): Promise<Product>;
  update(id: ID, patch: Partial<Product>): Promise<Product>;
}

export interface InvoicesRepo {
  generateInvoiceNumber(): Promise<string>;
  insertInvoice(inv: Omit<Invoice, "invoice_id">): Promise<Invoice>;
  insertItems(items: Omit<InvoiceItem, "invoice_item_id">[]): Promise<InvoiceItem[]>;
  getById(id: ID): Promise<Invoice | null>;
  getItems(invoice_id: ID): Promise<InvoiceItem[]>;
  markCancelled(input: {
    invoice_id: ID;
    cancelled_by_user_id: ID;
    cancelled_at: string;
  }): Promise<void>;
  listByDateRange(startIso: string, endIso: string): Promise<Invoice[]>;
}

export interface PurchasesRepo {
  generatePurchaseNumber(): Promise<string>;
  insertPurchase(p: Omit<Purchase, "purchase_id">): Promise<Purchase>;
  insertItems(items: Omit<PurchaseItem, "purchase_item_id">[]): Promise<PurchaseItem[]>;
  getById(id: ID): Promise<Purchase | null>;
  getItems(purchase_id: ID): Promise<PurchaseItem[]>;
  listByDateRange(startIso: string, endIso: string): Promise<Purchase[]>;
}

export interface SalesReturnsRepo {
  generateReturnNumber(): Promise<string>;
  insertReturn(r: Omit<SalesReturn, "sales_return_id">): Promise<SalesReturn>;
  insertItems(items: Omit<SalesReturnItem, "sales_return_item_id">[]): Promise<SalesReturnItem[]>;
  getById(id: ID): Promise<SalesReturn | null>;
  getItems(sales_return_id: ID): Promise<SalesReturnItem[]>;
}

export interface MovementsRepo {
  insertMany(movs: Omit<StockMovement, "movement_id">[]): Promise<void>;
  listForProduct(product_id: ID, startIso?: string, endIso?: string): Promise<StockMovement[]>;
}

export interface SettingsRepo {
  get(): Promise<Settings | null>;
  save(settings: Settings): Promise<Settings>;
}

export interface BackupRepo {
  exportBackupBlob(): Promise<Blob | Uint8Array | string>;
  saveAutoBackup(meta?: { createdAt: string }): Promise<void>;
  rotateAutoBackups(maxKeep: number): Promise<void>;
}

export interface ReportsRepo {}

export interface UsersRepo {
  getById(id: ID): Promise<User | null>;
  getByUsername(username: string): Promise<User | null>;
  getAny(): Promise<User | null>;
  list(): Promise<User[]>;
  createUser(input: { username: string; password: string; role: string; display_name?: string | null }): Promise<User>;
}

export interface UnitOfWork {
  categories: CategoriesRepo;
  products: ProductsRepo;
  invoices: InvoicesRepo;
  purchases: PurchasesRepo;
  returns: SalesReturnsRepo;
  movements: MovementsRepo;
  settings: SettingsRepo;
  backup: BackupRepo;
  reports: ReportsRepo;
  users: UsersRepo;
  runInTransaction<T>(fn: (tx: UnitOfWork) => Promise<T>): Promise<T>;
}

export type DbClient = UnitOfWork;

const nowIso = () => new Date().toISOString();

export class DexieDbClient extends Dexie implements DbClient {
  categoriesTable!: Table<Category, ID>;
  productsTable!: Table<Product, ID>;
  invoicesTable!: Table<Invoice, ID>;
  invoiceItemsTable!: Table<InvoiceItem, ID>;
  purchasesTable!: Table<Purchase, ID>;
  purchaseItemsTable!: Table<PurchaseItem, ID>;
  returnsTable!: Table<SalesReturn, ID>;
  returnItemsTable!: Table<SalesReturnItem, ID>;
  movementsTable!: Table<StockMovement, ID>;
  settingsTable!: Table<Settings, ID>;
  usersTable!: Table<User, ID>;

  constructor(dbName = "AseelPosLocalDB") {
    super(dbName);
    this.version(1).stores({
      categories: "++category_id, name",
      products: "++product_id, barcode, category_id",
      invoices: "++invoice_id, invoice_number, datetime",
      invoice_items: "++invoice_item_id, invoice_id, product_id",
      purchases: "++purchase_id, purchase_number, datetime",
      purchase_items: "++purchase_item_id, purchase_id, product_id",
      sales_returns: "++sales_return_id, return_number, original_invoice_id",
      sales_return_items: "++sales_return_item_id, sales_return_id, product_id",
      stock_movements: "++movement_id, product_id, datetime",
      settings: "++settings_id",
      users: "++user_id, username",
    });

    this.categoriesTable = this.table("categories");
    this.productsTable = this.table("products");
    this.invoicesTable = this.table("invoices");
    this.invoiceItemsTable = this.table("invoice_items");
    this.purchasesTable = this.table("purchases");
    this.purchaseItemsTable = this.table("purchase_items");
    this.returnsTable = this.table("sales_returns");
    this.returnItemsTable = this.table("sales_return_items");
    this.movementsTable = this.table("stock_movements");
    this.settingsTable = this.table("settings");
    this.usersTable = this.table("users");
  }

  categories: CategoriesRepo = {
    list: () => this.categoriesTable.toArray(),
    create: async (category) => {
      const id = await this.categoriesTable.add({
        ...category,
        created_at: category.created_at ?? nowIso(),
        updated_at: category.updated_at ?? nowIso(),
      } as Category);
      return { ...category, category_id: id } as Category;
    },
  };

  products: ProductsRepo = {
    getById: async (id) => (await this.productsTable.get(id)) ?? null,
    getByIds: async (ids) => {
      const rows = await this.productsTable.bulkGet(ids);
      return (rows.filter(Boolean) as Product[]).map((p) => p);
    },
    getByBarcode: async (barcode) => {
      const rows = await this.productsTable.where("barcode").equals(barcode).toArray();
      return rows[0] ?? null;
    },
    searchByName: async (query, limit = 20) => {
      const rows = await this.productsTable
        .filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
        .limit(limit)
        .toArray();
      return rows;
    },
    insert: async (p) => {
      const id = await this.productsTable.add(p as Product);
      return { ...p, product_id: id } as Product;
    },
    update: async (id, patch) => {
      await this.productsTable.update(id, patch);
      const updated = await this.productsTable.get(id);
      return updated as Product;
    },
  };

  invoices: InvoicesRepo = {
    generateInvoiceNumber: async () => `INV-${Date.now()}`,
    insertInvoice: async (inv) => {
      const id = await this.invoicesTable.add(inv as Invoice);
      return { ...inv, invoice_id: id } as Invoice;
    },
    insertItems: async (items) => {
      const ids = await this.invoiceItemsTable.bulkAdd(items as InvoiceItem[], { allKeys: true });
      return items.map((it, idx) => ({ ...it, invoice_item_id: Number(ids?.[idx]) })) as InvoiceItem[];
    },
    getById: async (id) => (await this.invoicesTable.get(id)) ?? null,
    getItems: (invoice_id) =>
      this.invoiceItemsTable.where("invoice_id").equals(invoice_id).toArray() as Promise<InvoiceItem[]>,
    markCancelled: async ({ invoice_id, cancelled_at, cancelled_by_user_id }) => {
      await this.invoicesTable.update(invoice_id, {
        is_cancelled: true,
        cancelled_at,
        cancelled_by_user_id,
      });
    },
    listByDateRange: async (startIso, endIso) => {
      const all = await this.invoicesTable.toArray();
      return all.filter((inv) => inv.datetime >= startIso && inv.datetime <= endIso);
    },
  };

  purchases: PurchasesRepo = {
    generatePurchaseNumber: async () => `PO-${Date.now()}`,
    insertPurchase: async (p) => {
      const id = await this.purchasesTable.add(p as Purchase);
      return { ...p, purchase_id: id } as Purchase;
    },
    insertItems: async (items) => {
      const ids = await this.purchaseItemsTable.bulkAdd(items as PurchaseItem[], { allKeys: true });
      return items.map((it, idx) => ({ ...it, purchase_item_id: Number(ids?.[idx]) })) as PurchaseItem[];
    },
    getById: async (id) => (await this.purchasesTable.get(id)) ?? null,
    getItems: (purchase_id) =>
      this.purchaseItemsTable.where("purchase_id").equals(purchase_id).toArray() as Promise<PurchaseItem[]>,
    listByDateRange: async (startIso, endIso) => {
      const all = await this.purchasesTable.toArray();
      return all.filter((p) => p.datetime >= startIso && p.datetime <= endIso);
    },
  };

  returns: SalesReturnsRepo = {
    generateReturnNumber: async () => `RET-${Date.now()}`,
    insertReturn: async (r) => {
      const id = await this.returnsTable.add(r as SalesReturn);
      return { ...r, sales_return_id: id } as SalesReturn;
    },
    insertItems: async (items) => {
      const ids = await this.returnItemsTable.bulkAdd(items as SalesReturnItem[], { allKeys: true });
      return items.map((it, idx) => ({ ...it, sales_return_item_id: Number(ids?.[idx]) })) as SalesReturnItem[];
    },
    getById: async (id) => (await this.returnsTable.get(id)) ?? null,
    getItems: (sales_return_id) =>
      this.returnItemsTable.where("sales_return_id").equals(sales_return_id).toArray() as Promise<SalesReturnItem[]>,
  };

  movements: MovementsRepo = {
    insertMany: async (movs) => {
      await this.movementsTable.bulkAdd(movs as StockMovement[]);
    },
    listForProduct: async (product_id, startIso, endIso) => {
      const all = await this.movementsTable.where("product_id").equals(product_id).toArray();
      return all.filter((m) => {
        if (startIso && m.datetime < startIso) return false;
        if (endIso && m.datetime > endIso) return false;
        return true;
      });
    },
  };

  settings: SettingsRepo = {
    get: async () => {
      const existing = await this.settingsTable.toArray();
      return existing[0] ?? null;
    },
    save: async (settings) => {
      const now = nowIso();
      const withDefaults: Settings = {
        ...settings,
        settings_id: 1,
        created_at: settings.created_at ?? now,
        updated_at: now,
      };
      await this.settingsTable.put(withDefaults);
      return withDefaults;
    },
  };

  backup: BackupRepo = {
    exportBackupBlob: async () => "TODO: backup blob",
    saveAutoBackup: async () => {},
    rotateAutoBackups: async () => {},
  };

  reports: ReportsRepo = {};

  users: UsersRepo = {
    getById: async (id) => (await this.usersTable.get(id)) ?? null,
    getByUsername: async (username) => {
      const rows = await this.usersTable.where("username").equals(username).toArray();
      return rows[0] ?? null;
    },
    getAny: async () => (await this.usersTable.limit(1).toArray())[0] ?? null,
    list: () => this.usersTable.toArray(),
    createUser: async ({ username, password, role, display_name }) => {
      const now = nowIso();
      const user: Omit<User, "user_id"> = {
        username,
        password,
        display_name: display_name ?? null,
        role,
        is_active: true,
        created_at: now,
        updated_at: now,
      } as Omit<User, "user_id">;

      const id = await this.usersTable.add(user as User);
      return { ...user, user_id: id, id } as User;
    },
  };

  runInTransaction = async <T>(fn: (tx: UnitOfWork) => Promise<T>): Promise<T> => {
    // Placeholder: Dexie transaction wiring can be added later.
    return fn(this);
  };
}
