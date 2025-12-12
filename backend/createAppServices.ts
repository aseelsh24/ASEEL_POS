import { DexieDbClient } from "../packages/db/src/index.js";
import { InvoiceService, PurchaseService, ReturnService, StockLedgerService } from "./ServiceLayer_POS_Grocery_MVP.ts";

export function createAppServices() {
  const db = new DexieDbClient();
  const uow = db;

  return {
    db,
    stockLedger: new StockLedgerService(uow),
    invoiceService: new InvoiceService(uow),
    purchaseService: new PurchaseService(uow),
    returnService: new ReturnService(uow),
  };
}
