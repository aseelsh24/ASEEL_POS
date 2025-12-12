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
          <h1>مرتجعات المبيعات</h1>
          <p className="muted">إرجاع أصناف من فواتير سابقة مع تعديل المخزون.</p>
        </div>
      </header>

      <div className="grid-layout">
        <div className="card">
          <div className="card-header">
            <h2>بحث عن الفاتورة</h2>
          </div>
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="invoiceNumber">رقم الفاتورة</label>
              <input
                id="invoiceNumber"
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="مثال: INV-123"
              />
            </div>
            <div className="form-actions">
              <button onClick={handleSearchInvoice} disabled={searchLoading}>
                {searchLoading ? 'جارِ البحث...' : 'بحث عن الفاتورة'}
              </button>
            </div>
            {searchError && <div className="error-text">{searchError}</div>}

            {invoiceData && (
              <div className="card" aria-live="polite">
                <div className="card-header">
                  <h3>بيانات الفاتورة</h3>
                  <span className="badge badge-muted">{invoiceData.invoice.invoice_number}</span>
                </div>
                <div className="grid-layout" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                  <div>
                    <strong>التاريخ</strong>
                    <div>{new Date(invoiceData.invoice.datetime).toLocaleString('ar-EG')}</div>
                  </div>
                  <div>
                    <strong>الإجمالي</strong>
                    <div>{invoiceData.invoice.grand_total?.toFixed(2) ?? '-'}</div>
                  </div>
                  <div>
                    <strong>عدد الأصناف</strong>
                    <div>{invoiceData.items.length}</div>
                  </div>
                </div>
                <div className="table-responsive" style={{ marginTop: '0.75rem' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>المنتج</th>
                        <th>الكمية الأصلية</th>
                        <th>كمية مرتجعة سابقاً</th>
                        <th>المتاح للإرجاع</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoiceData.items.map((item) => {
                        const available = Math.max(0, item.qty - item.alreadyReturnedQty)
                        return (
                          <tr key={item.invoiceItemId}>
                            <td>{item.productName}</td>
                            <td>{item.qty}</td>
                            <td>{item.alreadyReturnedQty}</td>
                            <td>{available}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>تفاصيل المرتجع</h2>
          </div>
          {!invoiceData ? (
            <p className="muted">يرجى البحث عن فاتورة للبدء.</p>
          ) : (
            <div className="form-grid">
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>المنتج</th>
                      <th>المتاح للإرجاع</th>
                      <th>كمية للإرجاع</th>
                    </tr>
                  </thead>
                  <tbody>
                    {returnLines.map((line) => (
                      <tr key={line.invoiceLineId}>
                        <td>{line.name}</td>
                        <td>{line.maxReturnableQty}</td>
                        <td>
                          <input
                            type="number"
                            min={0}
                            max={line.maxReturnableQty}
                            value={line.returnQty}
                            onChange={(e) => handleReturnQtyChange(line.invoiceLineId, e.target.value)}
                            style={{ width: '120px' }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="form-field">
                <label htmlFor="returnReason">سبب الإرجاع</label>
                <input
                  id="returnReason"
                  type="text"
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="مثال: منتج تالف أو غير مناسب"
                />
              </div>

              <div className="grid-layout" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                <div>
                  <strong>إجمالي الكمية المرتجعة</strong>
                  <div>{totalReturnQty}</div>
                </div>
                <div>
                  <strong>قيمة المرتجع التقديرية</strong>
                  <div>{totalReturnValue.toFixed(2)}</div>
                </div>
              </div>

              {saveError && <div className="error-text">{saveError}</div>}
              {successMessage && <div className="badge badge-success">{successMessage}</div>}

              <div className="form-actions">
                <button onClick={handleSubmitReturn} disabled={submitLoading}>
                  {submitLoading ? 'جارِ التسجيل...' : 'تسجيل المرتجع'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <h2>تسويات المخزون</h2>
              <p className="muted">تعديل الكمية يدويًا في حالات التلف أو الفقد أو التصحيح.</p>
            </div>
          </div>

          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="productSearch">بحث عن منتج</label>
              <input
                id="productSearch"
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="اسم المنتج"
              />
              <div className="form-actions">
                <button onClick={handleProductSearch} disabled={productSearchLoading}>
                  {productSearchLoading ? 'جارِ البحث...' : 'بحث'}
                </button>
              </div>
              {productSearchError && <div className="error-text">{productSearchError}</div>}
              {productResults.length > 0 && (
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>المنتج</th>
                        <th>المخزون الحالي</th>
                        <th>اختيار</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productResults.map((p) => (
                        <tr key={p.product_id ?? (p as any).id}>
                          <td>{p.name}</td>
                          <td>{p.stock_qty ?? 0}</td>
                          <td>
                            <button className="secondary" onClick={() => handleSelectProduct(p)}>
                              اختيار
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {selectedProduct && (
              <div className="card" aria-live="polite">
                <div className="card-header">
                  <h3>المنتج المختار</h3>
                  <span className="badge badge-muted">المخزون: {selectedProduct.stock_qty ?? 0}</span>
                </div>
                <div>{selectedProduct.name}</div>
                {selectedProduct.barcode && <div className="muted">باركود: {selectedProduct.barcode}</div>}
              </div>
            )}

            <div className="grid-layout" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
              <div className="form-field">
                <label htmlFor="adjustReason">نوع التسوية</label>
                <select
                  id="adjustReason"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value as AdjustmentReason)}
                >
                  <option value="DAMAGE">تلف</option>
                  <option value="LOSS">فقد</option>
                  <option value="INVENTORY_CORRECTION">تسوية جرد</option>
                </select>
              </div>
              <div className="form-field">
                <label htmlFor="adjustQty">الكمية</label>
                <input
                  id="adjustQty"
                  type="number"
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  placeholder="مثال: 2 أو -1"
                />
              </div>
              <div className="form-field">
                <label htmlFor="adjustNote">ملاحظات</label>
                <input
                  id="adjustNote"
                  type="text"
                  value={adjustNote}
                  onChange={(e) => setAdjustNote(e.target.value)}
                  placeholder="اختياري"
                />
              </div>
            </div>

            {adjustError && <div className="error-text">{adjustError}</div>}
            {adjustSuccess && <div className="badge badge-success">{adjustSuccess}</div>}

            <div className="form-actions">
              <button onClick={handleSubmitAdjustment} disabled={adjustLoading}>
                {adjustLoading ? 'جارِ التسجيل...' : 'تسجيل التسوية'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
