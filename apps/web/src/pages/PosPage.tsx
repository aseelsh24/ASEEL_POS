import { useEffect, useMemo, useState } from 'react'
import type { PaymentMethod, Product } from '@core/index'
import { fetchProducts } from '../api/productsApi'
import { createSale } from '../api/posApi'
import { resolveProductIdentity } from '../utils/productUtils'

type CartLine = {
  productId: number
  name: string
  barcode?: string
  unitPrice: number
  quantity: number
  discountAmount: number
}

function calculateCartTotals(lines: CartLine[]) {
  const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0)
  const totalDiscount = lines.reduce((sum, line) => sum + Math.max(0, line.discountAmount), 0)
  const grandTotal = Math.max(0, subtotal - totalDiscount)

  return { subtotal, totalDiscount, grandTotal }
}

const currencyFormatter = new Intl.NumberFormat('ar-EG', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const successBoxStyle = {
  background: 'var(--color-success-bg)',
  padding: '0.75rem 1rem',
  borderRadius: 'var(--radius-md)',
  color: 'var(--color-success-text)',
  border: '1px solid var(--color-border)',
}

export default function PosPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [cartLines, setCartLines] = useState<CartLine[]>([])
  const [nameQuery, setNameQuery] = useState('')
  const [barcodeQuery, setBarcodeQuery] = useState('')
  const [searchLoading, setSearchLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH')
  const [customerName, setCustomerName] = useState('')

  const totals = useMemo(() => calculateCartTotals(cartLines), [cartLines])

  useEffect(() => {
    void loadDefaultProducts()
  }, [])

  useEffect(() => {
    if (!nameQuery.trim()) return

    const timeout = setTimeout(() => {
      void performNameSearch()
    }, 300)

    return () => clearTimeout(timeout)
  }, [nameQuery])

  async function loadDefaultProducts() {
    setSearchLoading(true)
    try {
      const data = await fetchProducts({ activeOnly: true })
      setProducts(data.slice(0, 20))
    } catch (err) {
      console.error('Unable to load products', err)
      setError('تعذر تحميل المنتجات')
    } finally {
      setSearchLoading(false)
    }
  }

  async function performNameSearch() {
    setError(null)
    setSearchLoading(true)
    try {
      const data = await fetchProducts({
        name: nameQuery || undefined,
        activeOnly: true,
      })
      setProducts(data)
    } catch (err) {
      console.error('Unable to search products', err)
      setError('تعذر البحث عن المنتجات')
    } finally {
      setSearchLoading(false)
    }
  }

  async function handleBarcodeSearch() {
    if (!barcodeQuery.trim()) return
    setError(null)
    setSearchLoading(true)
    try {
      const data = await fetchProducts({ barcode: barcodeQuery.trim(), activeOnly: true })
      if (data.length === 1) {
        addProductToCart(data[0])
        setBarcodeQuery('')
      }
      setProducts(data)
    } catch (err) {
      console.error('Unable to search by barcode', err)
      setError('تعذر البحث بالباركود')
    } finally {
      setSearchLoading(false)
    }
  }

  function addProductToCart(product: Product) {
    const baseInfo = resolveProductIdentity(product)
    if (!baseInfo) {
      setError('تعذر تحديد المنتج لإضافته إلى السلة (المعرف مفقود أو غير صالح)')
      return
    }

    setCartLines((prev) => {
      const existing = prev.find((line) => line.productId === baseInfo.productId)
      if (existing) {
        return prev.map((line) =>
          line.productId === baseInfo.productId
            ? { ...line, quantity: line.quantity + 1 }
            : line,
        )
      }
      const newLine: CartLine = {
        ...baseInfo,
        quantity: 1,
        discountAmount: 0,
      }
      return [...prev, newLine]
    })
    setSuccessMessage(null)
    setError(null)
  }

  function updateLineQuantity(productId: number, value: number) {
    if (Number.isNaN(value) || value <= 0) return
    setCartLines((prev) =>
      prev.map((line) => {
        if (line.productId !== productId) return line
        const maxDiscount = value * line.unitPrice
        const discountAmount = Math.min(line.discountAmount, maxDiscount)
        return { ...line, quantity: value, discountAmount }
      }),
    )
  }

  function updateLineDiscount(productId: number, value: number) {
    if (Number.isNaN(value) || value < 0) return
    setCartLines((prev) =>
      prev.map((line) => {
        if (line.productId !== productId) return line
        const maxDiscount = line.quantity * line.unitPrice
        const discountAmount = Math.min(value, maxDiscount)
        return { ...line, discountAmount }
      }),
    )
  }

  function removeLine(productId: number) {
    setCartLines((prev) => prev.filter((line) => line.productId !== productId))
  }

  function clearCart() {
    setCartLines([])
    setSuccessMessage(null)
    setError(null)
  }

  async function handleCompleteSale() {
    setError(null)
    setSuccessMessage(null)

    if (!cartLines.length) {
      setError('السلة فارغة، أضف منتجات أولاً')
      return
    }

    const invalidQty = cartLines.some((line) => line.quantity <= 0)
    if (invalidQty) {
      setError('يرجى التأكد من أن الكميات أكبر من صفر')
      return
    }

    if (!['CASH', 'CREDIT'].includes(paymentMethod)) {
      setError('يرجى اختيار طريقة دفع صحيحة')
      return
    }

    try {
      const invoice = await createSale({
        cashier_user_id: 1,
        payment_method: paymentMethod,
        customer_name:
          paymentMethod === 'CREDIT' && customerName.trim()
            ? customerName.trim()
            : undefined,
        items: cartLines.map((line) => ({
          product_id: line.productId,
          qty: line.quantity,
          unit_price: line.unitPrice,
          discount: line.discountAmount,
        })),
      })

      setSuccessMessage(`تم تسجيل الفاتورة رقم ${invoice.invoice_number} بنجاح.`)
      setCartLines([])
    } catch (err) {
      console.error('Failed to complete sale', err)
      setError('تعذر إتمام البيع، يرجى المحاولة مجدداً')
    }
  }

  return (
    <section>
      <header className="page-header">
        <div>
          <h1 className="page-title">نقطة البيع</h1>
          <p className="muted">إدارة المبيعات اليومية وإضافة المنتجات للسلة</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg-grid-cols-2 lg-gap-6 gap-4">
        {/* Product Search Panel (First in DOM = Right in RTL) */}
        <div className="d-flex flex-col gap-4">
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">بحث عن المنتجات</h2>
              {searchLoading && <span className="muted text-sm">...جاري التحميل</span>}
            </div>

            {error && <div className="error-text mb-4" role="alert">{error}</div>}
            {successMessage && (
              <div className="mb-4" style={successBoxStyle}>
                {successMessage}
              </div>
            )}

            <div className="grid grid-cols-1 md-grid-cols-2 gap-4 mb-4">
              <div className="form-group">
                <label className="form-label" htmlFor="nameSearch">بحث بالاسم</label>
                <input
                  id="nameSearch"
                  className="form-input"
                  type="text"
                  value={nameQuery}
                  onChange={(e) => {
                    const value = e.target.value
                    setNameQuery(value)
                    if (!value.trim()) {
                      void loadDefaultProducts()
                    }
                  }}
                  placeholder="اكتب اسم المنتج"
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="barcodeSearch">بحث بالباركود</label>
                <input
                  id="barcodeSearch"
                  className="form-input"
                  type="text"
                  value={barcodeQuery}
                  onChange={(e) => setBarcodeQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      void handleBarcodeSearch()
                    }
                  }}
                  placeholder="امسح أو اكتب الباركود"
                />
              </div>
            </div>

            <div className="table-container" style={{ maxHeight: '600px', overflowY: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>اسم المنتج</th>
                    <th>الفئة</th>
                    <th>سعر البيع</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {products.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center muted p-4">
                        لا توجد منتجات مطابقة
                      </td>
                    </tr>
                  ) : (
                    products.map((product) => {
                      const id = product.id ?? (product as any).product_id
                      const categoryName = (product as any).category_name || ''
                      return (
                        <tr key={id}>
                          <td>
                            <div className="font-bold">{product.name}</div>
                            {product.barcode && <div className="text-xs muted">{product.barcode}</div>}
                          </td>
                          <td>{categoryName || '—'}</td>
                          <td className="font-bold text-primary">{currencyFormatter.format(Number(product.sale_price) || 0)}</td>
                          <td>
                            <button type="button" className="btn btn-primary btn-sm" onClick={() => addProductToCart(product)}>
                              إضافة
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Cart Column (Second in DOM = Left in RTL) */}
        <div className="card h-full" style={{ position: 'sticky', top: '90px', maxHeight: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
          <div className="card-header">
            <h2 className="card-title">سلة المشتريات</h2>
            <button type="button" className="btn btn-ghost btn-sm text-error" onClick={clearCart} disabled={!cartLines.length}>
              إلغاء السلة
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {cartLines.length === 0 ? (
              <div className="d-flex items-center justify-center h-full p-8 text-center muted flex-col">
                <div style={{ fontSize: '3rem', opacity: 0.2 }}>🛒</div>
                <p>السلة فارغة، ابدأ بإضافة المنتجات من القائمة.</p>
              </div>
            ) : (
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>الاسم</th>
                      <th>الكمية</th>
                      <th>السعر</th>
                      <th>الإجمالي</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cartLines.map((line) => (
                      <tr key={line.productId}>
                        <td>
                          <div className="font-bold">{line.name}</div>
                          <div className="muted text-sm">{currencyFormatter.format(line.unitPrice)}</div>
                        </td>
                        <td>
                          <div className="d-flex items-center gap-1">
                            <button className="btn btn-secondary btn-sm p-1" style={{ minWidth: '24px', height: '24px' }} onClick={() => updateLineQuantity(line.productId, Math.max(1, line.quantity - 1))}>-</button>
                            <input
                              type="number"
                              min={1}
                              value={line.quantity}
                              onChange={(e) => updateLineQuantity(line.productId, Number(e.target.value))}
                              className="form-input p-1 text-center"
                              style={{ width: '40px', minHeight: '28px' }}
                            />
                            <button className="btn btn-secondary btn-sm p-1" style={{ minWidth: '24px', height: '24px' }} onClick={() => updateLineQuantity(line.productId, line.quantity + 1)}>+</button>
                          </div>
                        </td>
                        <td>
                          <input
                             type="number"
                             min={0}
                             value={line.discountAmount}
                             onChange={(e) => updateLineDiscount(line.productId, Number(e.target.value))}
                             className="form-input p-1"
                             placeholder="خصم"
                             style={{ width: '60px', minHeight: '28px' }}
                          />
                        </td>
                        <td>{currencyFormatter.format(Math.max(0, line.quantity * line.unitPrice - line.discountAmount))}</td>
                        <td>
                          <button type="button" className="btn btn-ghost btn-sm text-error p-1" onClick={() => removeLine(line.productId)}>
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card mt-4">
            <div className="card-header">
              <h3 className="card-title">طريقة الدفع</h3>
            </div>
            <div className="form-group">
              <label className="form-label">اختر طريقة الدفع</label>
              <div className="d-flex items-center gap-4">
                <label className="d-flex items-center gap-2">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="CASH"
                    checked={paymentMethod === 'CASH'}
                    onChange={() => {
                      setPaymentMethod('CASH')
                      setCustomerName('')
                    }}
                  />
                  <span>نقدًا</span>
                </label>
                <label className="d-flex items-center gap-2">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="CREDIT"
                    checked={paymentMethod === 'CREDIT'}
                    onChange={() => setPaymentMethod('CREDIT')}
                  />
                  <span>آجل</span>
                </label>
              </div>
            </div>

            {paymentMethod === 'CREDIT' && (
              <div className="form-group">
                <label className="form-label" htmlFor="customerName">
                  اسم العميل (اختياري)
                </label>
                <input
                  id="customerName"
                  className="form-input"
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="مثال: محمد أحمد"
                />
              </div>
            )}
          </div>

          <div className="border-t border-gray-200 mt-4 pt-4">
             <div className="d-flex justify-between mb-2">
               <span className="muted">المجموع الفرعي</span>
               <span className="font-bold">{currencyFormatter.format(totals.subtotal)}</span>
             </div>
             <div className="d-flex justify-between mb-2">
               <span className="muted">إجمالي الخصم</span>
               <span className="text-error">{currencyFormatter.format(totals.totalDiscount)}</span>
             </div>
             <div className="d-flex justify-between mb-4 text-xl font-bold text-primary">
               <span>الإجمالي النهائي</span>
               <span>{currencyFormatter.format(totals.grandTotal)}</span>
             </div>

            <div className="grid grid-cols-2 gap-3">
              <button type="button" className="btn btn-primary w-full" onClick={handleCompleteSale} disabled={!cartLines.length}>
                إتمام البيع
              </button>
              <button type="button" className="btn btn-secondary w-full" onClick={clearCart} disabled={!cartLines.length}>
                إلغاء
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Sticky Footer for Actions */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 lg-hidden shadow-top z-50 d-flex justify-between items-center gap-4">
          <div className="flex flex-col">
              <span className="text-xs muted">الإجمالي</span>
              <span className="font-bold text-lg">{currencyFormatter.format(totals.grandTotal)}</span>
          </div>
          <button type="button" className="btn btn-primary flex-1" onClick={handleCompleteSale} disabled={!cartLines.length}>
            إتمام البيع ({cartLines.length})
          </button>
      </div>
      {/* Spacer for mobile footer */}
      <div className="h-24 lg:hidden"></div>
    </section>
  )
}
