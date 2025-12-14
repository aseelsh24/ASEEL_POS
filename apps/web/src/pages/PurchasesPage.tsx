import { useEffect, useMemo, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { Product } from '@core/index'
import { fetchProducts } from '../api/productsApi'
import { createPurchase } from '../api/purchasesApi'

interface PurchaseLine {
  productId: number
  name: string
  barcode?: string | null
  qty: number
  unitCost: number
}

const todayIso = () => new Date().toISOString().slice(0, 10)

function calculateLineTotal(line: PurchaseLine) {
  return line.qty * line.unitCost
}

function calculatePurchaseTotal(lines: PurchaseLine[]) {
  return lines.reduce((sum, line) => sum + calculateLineTotal(line), 0)
}

export default function PurchasesPage() {
  const [supplierName, setSupplierName] = useState('')
  const [supplierInvoiceRef, setSupplierInvoiceRef] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(todayIso())
  const [notes, setNotes] = useState('')

  const [productSearch, setProductSearch] = useState('')
  const [barcodeSearch, setBarcodeSearch] = useState('')
  const [searchResults, setSearchResults] = useState<Product[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [lineQty, setLineQty] = useState('1')
  const [lineCost, setLineCost] = useState('')
  const [lines, setLines] = useState<PurchaseLine[]>([])

  const [saveError, setSaveError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedProduct) return
    const cost = selectedProduct.cost_price ?? selectedProduct.sale_price ?? 0
    setLineCost(cost ? String(cost) : '')
  }, [selectedProduct])

  const totalCost = useMemo(() => calculatePurchaseTotal(lines), [lines])

  async function handleSearch() {
    setSearchLoading(true)
    setSearchError(null)
    try {
      const data = await fetchProducts({
        name: productSearch.trim() || undefined,
        barcode: undefined,
        activeOnly: true,
      })
      setSearchResults(data)
    } catch (err) {
      console.error('Failed to search products', err)
      setSearchError('تعذر البحث عن المنتجات حالياً')
    } finally {
      setSearchLoading(false)
    }
  }

  async function handleBarcodeSearch(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    setSearchLoading(true)
    setSearchError(null)
    try {
      const data = await fetchProducts({ barcode: barcodeSearch.trim() || undefined, activeOnly: true })
      setSearchResults(data)
      if (data.length === 1) {
        handleSelectProduct(data[0])
      }
      if (data.length === 0) {
        setSearchError('لم يتم العثور على منتج بالباركود المدخل')
      }
    } catch (err) {
      console.error('Failed to search by barcode', err)
      setSearchError('تعذر البحث عن المنتجات بالباركود')
    } finally {
      setSearchLoading(false)
    }
  }

  function handleSelectProduct(product: Product) {
    setSelectedProduct(product)
    setLineQty('1')
    const cost = product.cost_price ?? product.sale_price ?? 0
    setLineCost(cost ? String(cost) : '')
  }

  function handleAddLine() {
    setSaveError(null)
    if (!selectedProduct) {
      setSaveError('يرجى اختيار منتج أولاً')
      return
    }

    const qty = Number(lineQty)
    const cost = Number(lineCost)

    if (!qty || qty <= 0) {
      setSaveError('الكمية يجب أن تكون أكبر من صفر')
      return
    }

    if (!cost || cost <= 0) {
      setSaveError('سعر الشراء يجب أن يكون أكبر من صفر')
      return
    }

    setLines((prev) => {
      const existingIndex = prev.findIndex((l) => l.productId === selectedProduct.id || l.productId === (selectedProduct as any).product_id)
      if (existingIndex >= 0) {
        const updated = [...prev]
        const base = updated[existingIndex]
        updated[existingIndex] = {
          ...base,
          qty: base.qty + qty,
          unitCost: cost,
        }
        return updated
      }

      return [
        ...prev,
        {
          productId: selectedProduct.id ?? (selectedProduct as any).product_id,
          name: selectedProduct.name,
          barcode: selectedProduct.barcode,
          qty,
          unitCost: cost,
        },
      ]
    })

    setSelectedProduct(null)
    setLineQty('1')
    setLineCost('')
  }

  function handleLineChange(productId: number, field: 'qty' | 'unitCost', value: string) {
    setLines((prev) =>
      prev.map((line) =>
        line.productId === productId
          ? {
              ...line,
              [field]: Number(value) || 0,
            }
          : line,
      ),
    )
  }

  function handleDeleteLine(productId: number) {
    setLines((prev) => prev.filter((line) => line.productId !== productId))
  }

  function resetForm() {
    setSupplierName('')
    setSupplierInvoiceRef('')
    setInvoiceDate(todayIso())
    setNotes('')
    setLines([])
    setSelectedProduct(null)
    setLineQty('1')
    setLineCost('')
  }

  async function handleSavePurchase() {
    setSaveError(null)
    setSuccessMessage(null)

    if (!supplierName.trim()) {
      setSaveError('اسم المورد مطلوب')
      return
    }

    if (!lines.length) {
      setSaveError('يجب إضافة منتج واحد على الأقل')
      return
    }

    const invalidLine = lines.some((line) => line.qty <= 0 || line.unitCost <= 0)
    if (invalidLine) {
      setSaveError('يرجى التأكد من أن الكميات والأسعار أكبر من صفر')
      return
    }

    try {
      await createPurchase({
        supplier_name: supplierName,
        supplier_invoice_ref: supplierInvoiceRef,
        invoice_date: invoiceDate,
        notes,
        items: lines.map((line) => ({
          product_id: line.productId,
          qty: line.qty,
          unit_cost: line.unitCost,
        })),
      })

      setSuccessMessage('تم حفظ عملية الشراء وزيادة المخزون بنجاح.')
      resetForm()
    } catch (err) {
      console.error('Failed to save purchase', err)
      setSaveError('تعذر حفظ عملية الشراء، يرجى المحاولة مجدداً')
    }
  }

  return (
    <section>
      <header className="page-header">
        <div>
          <h1 className="page-title">المشتريات</h1>
          <p className="muted">تسجيل فواتير الشراء وزيادة المخزون.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg-grid-cols-3 lg-gap-8 gap-4">
        {/* Invoice Info - Left Column (1/3) */}
        <div className="card h-fit">
          <div className="card-header">
            <h2 className="card-title">بيانات الفاتورة</h2>
          </div>
          <div className="d-flex flex-col gap-4">
            <div className="form-group">
              <label className="form-label" htmlFor="supplierName">المورد</label>
              <input
                id="supplierName"
                className="form-input"
                type="text"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="اسم المورد"
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="supplierInvoiceRef">رقم فاتورة المورد</label>
              <input
                id="supplierInvoiceRef"
                className="form-input"
                type="text"
                value={supplierInvoiceRef}
                onChange={(e) => setSupplierInvoiceRef(e.target.value)}
                placeholder="مثال: 12345"
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="invoiceDate">تاريخ الفاتورة</label>
              <input
                id="invoiceDate"
                className="form-input"
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="notes">ملاحظات</label>
              <textarea
                id="notes"
                className="form-input"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="ملاحظات إضافية"
                rows={3}
              />
            </div>
          </div>
        </div>

        {/* Invoice Items - Right Column (2/3) */}
        <div className="card lg-col-span-2">
          <div className="card-header">
            <h2 className="card-title">عناصر الفاتورة</h2>
            {searchLoading && <span className="muted">...جاري التحميل</span>}
          </div>

          {saveError && (
            <div className="error-text mb-4" role="alert">
              {saveError}
            </div>
          )}
          {searchError && (
            <div className="error-text mb-4" role="alert">
              {searchError}
            </div>
          )}
          {successMessage && <div className="badge badge-success mb-4 p-3 w-full block text-base">{successMessage}</div>}

          {/* Product Search & Add */}
          <div className="border border-gray-200 rounded-lg p-4 mb-6 bg-gray-50">
            <div className="grid grid-cols-1 md-grid-cols-2 gap-4 mb-4">
              <div className="form-group">
                <label className="form-label" htmlFor="productSearch">بحث بالاسم</label>
                <div className="d-flex gap-2">
                  <input
                    id="productSearch"
                    className="form-input flex-1"
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="اسم المنتج"
                  />
                  <button type="button" onClick={handleSearch} className="btn btn-secondary">
                    بحث
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="barcodeSearch">بحث بالباركود</label>
                <input
                  id="barcodeSearch"
                  className="form-input"
                  type="text"
                  value={barcodeSearch}
                  onChange={(e) => setBarcodeSearch(e.target.value)}
                  onKeyDown={handleBarcodeSearch}
                  placeholder="أدخل الباركود واضغط إنتر"
                />
              </div>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
               <div className="table-container mb-4 bg-white" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>المنتج</th>
                      <th>الباركود</th>
                      <th>السعر</th>
                      <th>إجراء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchResults.map((product) => (
                      <tr key={product.id ?? (product as any).product_id}>
                        <td>{product.name}</td>
                        <td>{product.barcode || '—'}</td>
                        <td>{product.cost_price ?? product.sale_price ?? 0}</td>
                        <td>
                          <button type="button" className="btn btn-primary btn-sm py-1" onClick={() => handleSelectProduct(product)}>
                            اختيار
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Selected Product Form */}
            <div className="d-flex flex-col md-flex-row gap-4 items-end">
              <div className="form-group flex-1 w-full">
                <label className="form-label">المنتج المحدد</label>
                <div className="form-input bg-gray-100 text-gray-700">
                  {selectedProduct ? selectedProduct.name : 'لم يتم اختيار منتج بعد'}
                </div>
              </div>
              <div className="form-group w-full md-w-auto" style={{ width: '120px' }}>
                <label className="form-label" htmlFor="lineQty">الكمية</label>
                <input
                  id="lineQty"
                  className="form-input"
                  type="number"
                  min={1}
                  value={lineQty}
                  onChange={(e) => setLineQty(e.target.value)}
                />
              </div>
              <div className="form-group w-full md-w-auto" style={{ width: '160px' }}>
                <label className="form-label" htmlFor="lineCost">سعر الشراء للوحدة</label>
                <input
                  id="lineCost"
                  className="form-input"
                  type="number"
                  min={0}
                  value={lineCost}
                  onChange={(e) => setLineCost(e.target.value)}
                />
              </div>
              <div className="form-group w-full md-w-auto">
                <button type="button" className="btn btn-primary w-full whitespace-nowrap" onClick={handleAddLine} disabled={!selectedProduct}>
                  إضافة للقائمة
                </button>
              </div>
            </div>
          </div>

          {/* Added Lines Table */}
          <div className="table-container mb-4">
            <table className="table">
              <thead>
                <tr>
                  <th>المنتج</th>
                  <th>الكمية</th>
                  <th>سعر الشراء</th>
                  <th>إجمالي السطر</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.productId}>
                    <td>
                      <div className="font-bold">{line.name}</div>
                      <div className="muted text-xs">
                        {line.barcode || '—'}
                      </div>
                    </td>
                    <td>
                      <input
                        type="number"
                        min={1}
                        value={line.qty}
                        onChange={(e) => handleLineChange(line.productId, 'qty', e.target.value)}
                        className="form-input p-1"
                        style={{ width: '80px' }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        value={line.unitCost}
                        onChange={(e) => handleLineChange(line.productId, 'unitCost', e.target.value)}
                        className="form-input p-1"
                        style={{ width: '100px' }}
                      />
                    </td>
                    <td>{calculateLineTotal(line).toFixed(2)}</td>
                    <td>
                      <button type="button" className="btn btn-ghost btn-sm text-error p-1" onClick={() => handleDeleteLine(line.productId)}>
                        حذف
                      </button>
                    </td>
                  </tr>
                ))}
                {!lines.length && (
                  <tr>
                    <td colSpan={5} className="text-center p-6 muted">
                      لم تتم إضافة أي عناصر بعد
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Totals & Actions */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
             <div className="d-flex flex-col md-flex-row justify-between items-center gap-4 mb-4">
               <div className="text-sm">
                 إجمالي عدد الأصناف: <span className="font-bold">{lines.length}</span>
               </div>
               <div className="text-xl font-bold text-primary">
                 إجمالي الفاتورة: {totalCost.toFixed(2)}
               </div>
             </div>
             <button type="button" className="btn btn-primary w-full md-w-auto px-8" onClick={handleSavePurchase}>
                حفظ عملية الشراء
             </button>
          </div>
        </div>
      </div>
    </section>
  )
}
