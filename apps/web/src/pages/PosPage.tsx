import { useEffect, useMemo, useState } from 'react'
import type { Product } from '@core/index'
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
  background: '#ecfdf3',
  padding: '0.75rem 1rem',
  borderRadius: 10,
  color: '#166534',
  border: '1px solid #bbf7d0',
}

export default function PosPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [cartLines, setCartLines] = useState<CartLine[]>([])
  const [nameQuery, setNameQuery] = useState('')
  const [barcodeQuery, setBarcodeQuery] = useState('')
  const [searchLoading, setSearchLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

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

    try {
      const invoice = await createSale({
        cashier_user_id: 1,
        payment_method: 'CASH',
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
          <h1>نقطة البيع</h1>
          <p className="muted">إدارة المبيعات اليومية وإضافة المنتجات للسلة</p>
        </div>
      </header>

      <div className="grid-layout">
        <div className="card">
          <div className="card-header">
            <h2>بحث عن المنتجات</h2>
            {searchLoading && <span className="muted">...جاري التحميل</span>}
          </div>

          {error && <div className="error-text" role="alert">{error}</div>}
          {successMessage && (
            <div className="success-text" style={successBoxStyle}>
              {successMessage}
            </div>
          )}

          <div className="filters-grid" style={{ marginTop: '0.75rem' }}>
            <div className="form-group">
              <label htmlFor="nameSearch">بحث بالاسم</label>
              <input
                id="nameSearch"
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
              <label htmlFor="barcodeSearch">بحث بالباركود</label>
              <input
                id="barcodeSearch"
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

          <div className="table-responsive" style={{ marginTop: '1rem' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>اسم المنتج</th>
                  <th>الفئة</th>
                  <th>سعر البيع</th>
                  <th>إضافة</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="muted">
                      لا توجد منتجات مطابقة
                    </td>
                  </tr>
                ) : (
                  products.map((product) => {
                    const id = product.id ?? (product as any).product_id
                    const categoryName = (product as any).category_name || ''
                    return (
                      <tr key={id}>
                        <td>{product.name}</td>
                        <td>{categoryName || '—'}</td>
                        <td>{currencyFormatter.format(Number(product.sale_price) || 0)}</td>
                        <td>
                          <button type="button" onClick={() => addProductToCart(product)}>
                            إضافة إلى السلة
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

        <div className="card">
          <div className="card-header">
            <h2>سلة المشتريات</h2>
            <button type="button" className="secondary" onClick={clearCart} disabled={!cartLines.length}>
              إلغاء السلة
            </button>
          </div>

          {cartLines.length === 0 ? (
            <p className="muted">السلة فارغة، ابدأ بإضافة المنتجات من القائمة.</p>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>الاسم</th>
                    <th>الكمية</th>
                    <th>سعر الوحدة</th>
                    <th>الخصم</th>
                    <th>إجمالي السطر</th>
                    <th>إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {cartLines.map((line) => (
                    <tr key={line.productId}>
                      <td>{line.name}</td>
                      <td>
                        <input
                          type="number"
                          min={1}
                          value={line.quantity}
                          onChange={(e) => updateLineQuantity(line.productId, Number(e.target.value))}
                          style={{ width: '90px' }}
                        />
                      </td>
                      <td>{currencyFormatter.format(line.unitPrice)}</td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          value={line.discountAmount}
                          onChange={(e) => updateLineDiscount(line.productId, Number(e.target.value))}
                          style={{ width: '110px' }}
                        />
                      </td>
                      <td>{currencyFormatter.format(Math.max(0, line.quantity * line.unitPrice - line.discountAmount))}</td>
                      <td className="actions-cell">
                        <button type="button" onClick={() => updateLineQuantity(line.productId, line.quantity + 1)}>
                          +
                        </button>
                        <button
                          type="button"
                          onClick={() => updateLineQuantity(line.productId, Math.max(1, line.quantity - 1))}
                          className="secondary"
                        >
                          -
                        </button>
                        <button type="button" className="secondary" onClick={() => removeLine(line.productId)}>
                          حذف
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <dl style={{ marginTop: '1rem', display: 'grid', gap: '0.5rem' }}>
            <div className="field-row">
              <dt>المجموع الفرعي</dt>
              <dd>{currencyFormatter.format(totals.subtotal)}</dd>
            </div>
            <div className="field-row">
              <dt>إجمالي الخصم</dt>
              <dd>{currencyFormatter.format(totals.totalDiscount)}</dd>
            </div>
            <div className="field-row">
              <dt>الإجمالي النهائي</dt>
              <dd>{currencyFormatter.format(totals.grandTotal)}</dd>
            </div>
          </dl>

          <div className="form-actions" style={{ marginTop: '1rem', justifyContent: 'flex-start' }}>
            <button type="button" onClick={handleCompleteSale} disabled={!cartLines.length}>
              إتمام البيع
            </button>
            <button type="button" className="secondary" onClick={clearCart} disabled={!cartLines.length}>
              إلغاء السلة
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
