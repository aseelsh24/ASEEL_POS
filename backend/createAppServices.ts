import { DexieDbClient } from "../packages/db/src/index.js";
import {
  InvoiceService,
  PurchaseService,
  ReturnService,
  SettingsService,
  StockLedgerService,
  CatalogService,
  UsersService,
  AdjustmentService,
  ReportService,
} from "./ServiceLayer_POS_Grocery_MVP.ts";

export function createAppServices() {
  const db = new DexieDbClient();
  const uow = db;

  return {
    db,
    stockLedger: new StockLedgerService(uow),
    settingsService: new SettingsService(uow),
    invoiceService: new InvoiceService(uow),
    purchaseService: new PurchaseService(uow),
    returnService: new ReturnService(uow),
    adjustmentService: new AdjustmentService(uow),
    catalogService: new CatalogService(uow),
    usersService: new UsersService(uow),
    reportsService: new ReportService(uow),
  };
}
