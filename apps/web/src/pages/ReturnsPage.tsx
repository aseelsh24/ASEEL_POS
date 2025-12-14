import { useMemo, useState } from 'react'
import type { InvoiceForReturn } from '../api/returnsApi'
import { createSalesReturn, fetchInvoiceForReturn } from '../api/returnsApi'
import { fetchProducts } from '../api/productsApi'
import { createStockAdjustment } from '../api/stockAdjustmentsApi'
import type { Product } from '@core/index'

interface ReturnLine {
  invoiceLineId: number
  productId: number
  name: string
  maxReturnableQty: number
  alreadyReturned: number
  returnQty: number
  unitPrice: number
}

type AdjustmentReason = 'DAMAGE' | 'LOSS' | 'INVENTORY_CORRECTION'

export default function ReturnsPage() {
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceData, setInvoiceData] = useState<InvoiceForReturn | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  const [returnLines, setReturnLines] = useState<ReturnLine[]>([])
  const [returnReason, setReturnReason] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [submitLoading, setSubmitLoading] = useState(false)

  const [productSearch, setProductSearch] = useState('')
  const [productResults, setProductResults] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [adjustReason, setAdjustReason] = useState<AdjustmentReason>('DAMAGE')
  const [adjustQty, setAdjustQty] = useState('')
  const [adjustNote, setAdjustNote] = useState('')
  const [adjustError, setAdjustError] = useState<string | null>(null)
  const [adjustSuccess, setAdjustSuccess] = useState<string | null>(null)
  const [adjustLoading, setAdjustLoading] = useState(false)
  const [productSearchLoading, setProductSearchLoading] = useState(false)
  const [productSearchError, setProductSearchError] = useState<string | null>(null)

  const totalReturnQty = useMemo(() => returnLines.reduce((sum, line) => sum + line.returnQty, 0), [returnLines])
  const totalReturnValue = useMemo(
    () => returnLines.reduce((sum, line) => sum + line.returnQty * line.unitPrice, 0),
    [returnLines],
  )

  function resetReturnForm(data: InvoiceForReturn) {
    const mappedLines: ReturnLine[] = data.items.map((item) => ({
      invoiceLineId: item.invoiceItemId,
      productId: item.productId,
      name: item.productName,
      alreadyReturned: item.alreadyReturnedQty,
      maxReturnableQty: Math.max(0, item.qty - item.alreadyReturnedQty),
      returnQty: 0,
      unitPrice: item.unitPrice,
    }))
    setInvoiceData(data)
    setReturnLines(mappedLines)
  }

  async function handleSearchInvoice() {
    setSearchLoading(true)
    setSearchError(null)
    setSaveError(null)
    setSuccessMessage(null)
    try {
      const data = await fetchInvoiceForReturn(invoiceNumber)
      resetReturnForm(data)
    } catch (err) {
      console.error('Failed to fetch invoice for return', err)
      setSearchError((err as Error).message || 'تعذر جلب الفاتورة')
      setInvoiceData(null)
      setReturnLines([])
    } finally {
      setSearchLoading(false)
    }
  }

  function handleReturnQtyChange(invoiceLineId: number, value: string) {
    setReturnLines((prev) =>
      prev.map((line) => {
        if (line.invoiceLineId !== invoiceLineId) return line
        const numeric = Number(value)
        if (Number.isNaN(numeric)) return line
        const clamped = Math.max(0, Math.min(numeric, line.maxReturnableQty))
        return { ...line, returnQty: clamped }
      }),
    )
  }

  async function handleSubmitReturn() {
    if (!invoiceData) {
      setSaveError('يرجى البحث عن فاتورة أولاً')
      return
    }
    const selected = returnLines.filter((line) => line.returnQty > 0)
    if (!selected.length) {
      setSaveError('يرجى تحديد كمية مرتجعة لعنصر واحد على الأقل')
      return
    }

    const invalidQty = selected.some((line) => line.returnQty > line.maxReturnableQty)
    if (invalidQty) {
      setSaveError('الكمية المدخلة تتجاوز الكمية المتاحة للإرجاع')
      return
    }

    setSubmitLoading(true)
    setSaveError(null)
    setSuccessMessage(null)

    try {
      await createSalesReturn({
        original_invoice_id: invoiceData.invoice.invoice_id,
        original_invoice_number: invoiceData.invoice.invoice_number,
        reason: returnReason.trim() || 'مرتجع مبيعات',
        items: selected.map((line) => ({
          product_id: line.productId,
          qty: line.returnQty,
        })),
      })
      setSuccessMessage('تم تسجيل المرتجع وتحديث المخزون بنجاح.')
      const refreshed = await fetchInvoiceForReturn(invoiceData.invoice.invoice_number)
      resetReturnForm(refreshed)
      setReturnReason('')
    } catch (err) {
      console.error('Failed to submit return', err)
      setSaveError((err as Error).message || 'تعذر تسجيل المرتجع')
    } finally {
      setSubmitLoading(false)
    }
  }

  async function handleProductSearch() {
    setProductSearchLoading(true)
    setProductSearchError(null)
    try {
      const results = await fetchProducts({ name: productSearch.trim() || undefined, activeOnly: true })
      setProductResults(results)
    } catch (err) {
      console.error('Failed to search products', err)
      setProductSearchError('تعذر البحث عن المنتجات حالياً')
    } finally {
      setProductSearchLoading(false)
    }
  }

  function handleSelectProduct(product: Product) {
    setSelectedProduct(product)
    setAdjustSuccess(null)
    setAdjustError(null)
  }

  async function handleSubmitAdjustment() {
    setAdjustError(null)
    setAdjustSuccess(null)

    if (!selectedProduct) {
      setAdjustError('يرجى اختيار منتج أولاً')
      return
    }

    const qtyNumber = Number(adjustQty)
    if (!qtyNumber || Number.isNaN(qtyNumber)) {
      setAdjustError('يرجى إدخال كمية صحيحة')
      return
    }

    if ((adjustReason === 'DAMAGE' || adjustReason === 'LOSS') && qtyNumber <= 0) {
      setAdjustError('الكمية يجب أن تكون أكبر من صفر')
      return
    }

    if (adjustReason === 'INVENTORY_CORRECTION' && qtyNumber === 0) {
      setAdjustError('لا يمكن أن تكون الكمية صفراً')
      return
    }

    const qty_delta = adjustReason === 'INVENTORY_CORRECTION' ? qtyNumber : -Math.abs(qtyNumber)

    setAdjustLoading(true)
    try {
      await createStockAdjustment({
        product_id: selectedProduct.product_id ?? (selectedProduct as any).id,
        qty_delta,
        reason: adjustReason,
        note: adjustNote.trim() || undefined,
      })
      setAdjustSuccess('تم تسجيل تسوية المخزون بنجاح.')
      setAdjustQty('')
      setAdjustNote('')
    } catch (err) {
      console.error('Failed to save adjustment', err)
      setAdjustError('تعذر تسجيل التسوية، يرجى المحاولة لاحقاً')
    } finally {
      setAdjustLoading(false)
    }
  }

  return (
    <section>
      <header className="page-header">
        <div>
          <h1 className="page-title">مرتجعات المبيعات</h1>
          <p className="muted">إرجاع أصناف من فواتير سابقة مع تعديل المخزون.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 md-grid-cols-2 lg-grid-cols-3 gap-6">

        {/* Search Invoice - Column 1 */}
        <div className="d-flex flex-col gap-6">
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">بحث عن الفاتورة</h2>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="invoiceNumber">رقم الفاتورة</label>
              <div className="d-flex gap-2">
                <input
                  id="invoiceNumber"
                  className="form-input"
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="مثال: INV-123"
                />
                <button className="btn btn-primary" onClick={handleSearchInvoice} disabled={searchLoading}>
                  {searchLoading ? '...' : 'بحث'}
                </button>
              </div>
            </div>
            {searchError && <div className="error-text mt-2">{searchError}</div>}

            {invoiceData && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="d-flex justify-between items-center mb-3">
                  <h3 className="font-bold text-lg">بيانات الفاتورة</h3>
                  <span className="badge badge-muted">{invoiceData.invoice.invoice_number}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <strong className="block muted">التاريخ</strong>
                    <div>{new Date(invoiceData.invoice.datetime).toLocaleString('ar-EG')}</div>
                  </div>
                  <div>
                    <strong className="block muted">الإجمالي</strong>
                    <div>{invoiceData.invoice.grand_total?.toFixed(2) ?? '-'}</div>
                  </div>
                  <div>
                    <strong className="block muted">عدد الأصناف</strong>
                    <div>{invoiceData.items.length}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Return Details - Column 2 */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">تفاصيل المرتجع</h2>
          </div>
          {!invoiceData ? (
            <div className="d-flex items-center justify-center h-48 text-center muted bg-gray-50 rounded-lg border border-dashed border-gray-300">
              <p>يرجى البحث عن فاتورة للبدء.</p>
            </div>
          ) : (
            <div className="d-flex flex-col gap-4">
              <div className="table-container" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>المنتج</th>
                      <th>المتاح</th>
                      <th>للإرجاع</th>
                    </tr>
                  </thead>
                  <tbody>
                    {returnLines.map((line) => (
                      <tr key={line.invoiceLineId}>
                        <td>
                           <div className="font-bold">{line.name}</div>
                           <div className="text-xs muted">سعر الوحدة: {line.unitPrice}</div>
                        </td>
                        <td>{line.maxReturnableQty}</td>
                        <td>
                          <input
                            type="number"
                            className="form-input p-1"
                            min={0}
                            max={line.maxReturnableQty}
                            value={line.returnQty}
                            onChange={(e) => handleReturnQtyChange(line.invoiceLineId, e.target.value)}
                            style={{ width: '80px' }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="returnReason">سبب الإرجاع</label>
                <input
                  id="returnReason"
                  className="form-input"
                  type="text"
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="مثال: منتج تالف أو غير مناسب"
                />
              </div>

              <div className="bg-gray-50 p-3 rounded-lg d-flex justify-between items-center text-sm">
                <div>
                  <strong>الكمية:</strong> {totalReturnQty}
                </div>
                <div>
                  <strong>القيمة المستردة:</strong> {totalReturnValue.toFixed(2)}
                </div>
              </div>

              {saveError && <div className="error-text">{saveError}</div>}
              {successMessage && <div className="badge badge-success w-full justify-center p-2 text-sm">{successMessage}</div>}

              <button className="btn btn-primary w-full" onClick={handleSubmitReturn} disabled={submitLoading}>
                {submitLoading ? 'جارِ التسجيل...' : 'تسجيل المرتجع'}
              </button>
            </div>
          )}
        </div>

        {/* Stock Adjustments - Column 3 */}
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">تسويات المخزون</h2>
              <p className="muted text-sm">تعديل الكمية يدويًا (تلف، فقد، جرد).</p>
            </div>
          </div>

          <div className="d-flex flex-col gap-4">
            <div className="form-group">
              <label className="form-label" htmlFor="productSearch">بحث عن منتج</label>
              <div className="d-flex gap-2">
                <input
                  id="productSearch"
                  className="form-input"
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="اسم المنتج"
                />
                <button className="btn btn-secondary" onClick={handleProductSearch} disabled={productSearchLoading}>
                  بحث
                </button>
              </div>
              {productSearchError && <div className="error-text mt-2">{productSearchError}</div>}
            </div>

            {productResults.length > 0 && !selectedProduct && (
              <div className="table-container" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                <table className="table">
                  <tbody>
                    {productResults.map((p) => (
                      <tr key={p.product_id ?? (p as any).id}>
                        <td>{p.name}</td>
                        <td className="text-left" style={{ textAlign: 'left' }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => handleSelectProduct(p)}>
                            اختيار
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {selectedProduct && (
              <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-indigo-900">{selectedProduct.name}</h3>
                    <div className="text-sm text-indigo-700">المخزون الحالي: {selectedProduct.stock_qty ?? 0}</div>
                  </div>
                  <button className="text-indigo-500 hover:text-indigo-700" onClick={() => setSelectedProduct(null)}>✕</button>
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="adjustReason">نوع التسوية</label>
              <select
                id="adjustReason"
                className="form-select"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value as AdjustmentReason)}
              >
                <option value="DAMAGE">تلف (خصم)</option>
                <option value="LOSS">فقد (خصم)</option>
                <option value="INVENTORY_CORRECTION">تسوية جرد (تعديل)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="adjustQty">الكمية</label>
              <input
                id="adjustQty"
                className="form-input"
                type="number"
                value={adjustQty}
                onChange={(e) => setAdjustQty(e.target.value)}
                placeholder={adjustReason === 'INVENTORY_CORRECTION' ? "أدخل الفرق (مثال: 5 أو -2)" : "أدخل الكمية المفقودة (مثال: 3)"}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="adjustNote">ملاحظات</label>
              <input
                id="adjustNote"
                className="form-input"
                type="text"
                value={adjustNote}
                onChange={(e) => setAdjustNote(e.target.value)}
                placeholder="اختياري"
              />
            </div>

            {adjustError && <div className="error-text">{adjustError}</div>}
            {adjustSuccess && <div className="badge badge-success w-full justify-center p-2 text-sm">{adjustSuccess}</div>}

            <button className="btn btn-primary w-full mt-2" onClick={handleSubmitAdjustment} disabled={adjustLoading}>
              {adjustLoading ? 'جارِ التسجيل...' : 'تسجيل التسوية'}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
