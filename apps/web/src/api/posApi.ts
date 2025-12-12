import type { CreateInvoiceInput } from '@backend/ServiceLayer_POS_Grocery_MVP'
import type { Invoice } from '@core/index'
import { appServices } from './appServices'

export interface CreateSaleInput
  extends Pick<
    CreateInvoiceInput,
    'cashier_user_id' | 'items' | 'payment_method' | 'customer_name' | 'notes' | 'allow_manager_override'
  > {}

export async function createSale(input: CreateSaleInput): Promise<Invoice> {
  return appServices.invoiceService.createSale(input)
}
