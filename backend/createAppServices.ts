import { DexieDbClient } from "../packages/db/src/index.js";
import {
  InvoiceService,
  PurchaseService,
  ReturnService,
  SettingsService,
  StockLedgerService,
  UsersService,
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
    usersService: new UsersService(uow),
  };
}
