import { appServices } from './appServices'

export interface PurchaseItemInput {
  product_id: number
  qty: number
  unit_cost: number
}

export interface CreatePurchaseRequest {
  supplier_name?: string
  supplier_invoice_ref?: string
  invoice_date?: string
  notes?: string
  items: PurchaseItemInput[]
}

export async function createPurchase(input: CreatePurchaseRequest) {
  const supplierName = input.supplier_name?.trim() ?? ''
  const supplierInvoiceRef = input.supplier_invoice_ref?.trim()
  const combinedNotes = [input.notes?.trim(), supplierInvoiceRef ? `رقم فاتورة المورد: ${supplierInvoiceRef}` : null]
    .filter(Boolean)
    .join(' | ')

  return appServices.purchaseService.createPurchase({
    supplier_name: supplierName,
    received_by_user_id: 1,
    items: input.items.map((item) => ({
      product_id: item.product_id,
      qty: item.qty,
      cost_price: item.unit_cost,
    })),
    notes: combinedNotes || undefined,
  })
}
