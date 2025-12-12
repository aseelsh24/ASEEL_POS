import type { Invoice, InvoiceItem, SalesReturn, SalesReturnItem } from '@core/index'
import { appServices } from './appServices'

export interface InvoiceLineForReturn {
  invoiceItemId: number
  productId: number
  productName: string
  qty: number
  unitPrice: number
  alreadyReturnedQty: number
}

export interface InvoiceForReturn {
  invoice: Invoice
  items: InvoiceLineForReturn[]
}

export async function fetchInvoiceForReturn(invoiceNumber: string): Promise<InvoiceForReturn> {
  const trimmed = invoiceNumber.trim()
  if (!trimmed) {
    throw new Error('رقم الفاتورة مطلوب')
  }

  const invoice = await appServices.db.invoicesTable.where('invoice_number').equals(trimmed).first()
  if (!invoice) {
    throw new Error('لم يتم العثور على الفاتورة')
  }

  const invoiceItems = (await appServices.db.invoices.getItems(invoice.invoice_id)) as InvoiceItem[]
  const productIds = invoiceItems.map((it) => it.product_id)
  const products = await appServices.db.products.getByIds(productIds)
  const productMap = new Map(products.map((p) => [p.product_id, p]))

  const returnsForInvoice = await appServices.db.returnsTable
    .where('original_invoice_id')
    .equals(invoice.invoice_id)
    .toArray()

  const returnItems = await Promise.all(
    returnsForInvoice.map((ret: SalesReturn) =>
      appServices.db.returnItemsTable
        .where('sales_return_id')
        .equals(ret.sales_return_id)
        .toArray(),
    ),
  )

  const returnedQtyByProduct = new Map<number, number>()
  returnItems.flat().forEach((item: SalesReturnItem) => {
    const prev = returnedQtyByProduct.get(item.product_id) ?? 0
    returnedQtyByProduct.set(item.product_id, prev + item.qty)
  })

  const lines: InvoiceLineForReturn[] = invoiceItems.map((it) => {
    const product = productMap.get(it.product_id)
    const alreadyReturned = returnedQtyByProduct.get(it.product_id) ?? 0
    return {
      invoiceItemId: it.invoice_item_id,
      productId: it.product_id,
      productName: product?.name ?? 'منتج غير معروف',
      qty: it.qty,
      unitPrice: it.unit_price,
      alreadyReturnedQty: alreadyReturned,
    }
  })

  return { invoice, items: lines }
}

export interface CreateSalesReturnInput {
  original_invoice_id: number
  original_invoice_number: string
  reason?: string
  notes?: string
  items: Array<{
    product_id: number
    qty: number
  }>
}

export async function createSalesReturn(input: CreateSalesReturnInput) {
  return appServices.returnService.createSalesReturn({
    original_invoice_id: input.original_invoice_id,
    processed_by_user_id: 1,
    items: input.items,
    reason: input.reason ?? 'مرتجع مبيعات',
    notes: input.notes,
  })
}
