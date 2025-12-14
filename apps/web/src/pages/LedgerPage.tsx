import { useEffect, useMemo, useState } from 'react'
import type { Product, StockMovement, MovementType } from '@core/index'
import { fetchProducts } from '../api/productsApi'
import { fetchProductLedger } from '../api/ledgerApi'

const todayLocal = () => new Date().toISOString().slice(0, 10)
const startOfDayIso = (day: string) => `${day}T00:00:00.000Z`
const endOfDayIso = (day: string) => `${day}T23:59:59.999Z`

export default function LedgerPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProductId, setSelectedProductId] = useState<number | ''>('')
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [startDate, setStartDate] = useState(todayLocal())
  const [endDate, setEndDate] = useState(todayLocal())
  const [movementType, setMovementType] = useState<MovementType | ''>('')

  useEffect(() => {
    // Load active products for selector
    fetchProducts({ activeOnly: true }).then(setProducts).catch(console.error)
  }, [])

  useEffect(() => {
    if (!selectedProductId) {
      setMovements([])
      return
    }
    loadLedger()
  }, [selectedProductId, startDate, endDate, movementType])

  async function loadLedger() {
    if (!selectedProductId) return

    setLoading(true)
    setError(null)
    try {
      const data = await fetchProductLedger({
        productId: Number(selectedProductId),
        startIso: startOfDayIso(startDate),
        endIso: endOfDayIso(endDate),
        type: movementType || undefined,
      })
      setMovements(data)
    } catch (err) {
      console.error(err)
      setError('تعذر تحميل سجل الحركات.')
    } finally {
      setLoading(false)
    }
  }

  const selectedProduct = useMemo(
    () => products.find((p) => (p.id ?? (p as any).product_id) === Number(selectedProductId)),
    [products, selectedProductId]
  )

  const typeLabels: Record<string, string> = {
    SALE: 'مبيعات',
    PURCHASE: 'مشتريات',
    SALES_RETURN: 'مرتجع مبيعات',
    ADJUSTMENT: 'تسوية مخزنية',
    OPENING_BALANCE: 'رصيد افتتاحي',
  }

  function renderReference(m: StockMovement) {
    if (!m.reference_type) return '—'
    const refId = m.reference_id ?? '?'
    switch (m.reference_type) {
      case 'INVOICE':
        return `فاتورة #${refId}` // Ideally we would show invoice_number, but we only have ID here for now
      case 'PURCHASE':
        return `شراء #${refId}`
      case 'SALES_RETURN':
        return `مرتجع #${refId}`
      case 'ADJUSTMENT':
        return 'تسوية'
      default:
        return `${m.reference_type} #${refId}`
    }
  }

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <h1>سجل حركات الصنف</h1>
          <p className="muted">تتبع تاريخ حركة المخزون لكل منتج.</p>
        </div>
      </div>

      <div className="grid-layout">
        <div className="card">
          <div className="card-header">
            <h2>خيارات البحث</h2>
          </div>
          <div className="filters-grid">
            <label className="form-field">
              <span>اختر الصنف</span>
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(Number(e.target.value) || '')}
              >
                <option value="">-- اختر منتجاً --</option>
                {products.map((p) => (
                  <option key={p.id ?? (p as any).product_id} value={p.id ?? (p as any).product_id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-field">
              <span>نوع الحركة</span>
              <select
                value={movementType}
                onChange={(e) => setMovementType(e.target.value as MovementType | '')}
              >
                <option value="">الكل</option>
                <option value="SALE">مبيعات</option>
                <option value="PURCHASE">مشتريات</option>
                <option value="SALES_RETURN">مرتجع مبيعات</option>
                <option value="ADJUSTMENT">تسوية مخزنية</option>
              </select>
            </label>

            <label className="form-field">
              <span>من تاريخ</span>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </label>

            <label className="form-field">
              <span>إلى تاريخ</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </label>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <h2>سجل الحركات: {selectedProduct?.name ?? '...'}</h2>
              {selectedProduct && (
                <p className="muted">الرصيد الحالي: {selectedProduct.stock_qty}</p>
              )}
            </div>
            {loading && <span className="muted">جارٍ التحميل...</span>}
          </div>

          {error && <div className="error-text">{error}</div>}

          {!loading && !error && !selectedProductId && (
            <div className="muted p-4">يرجى اختيار صنف لعرض سجل حركاته.</div>
          )}

          {!loading && !error && selectedProductId && movements.length === 0 && (
            <div className="muted p-4">لا توجد حركات في الفترة المحددة.</div>
          )}

          {!loading && !error && movements.length > 0 && (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>التاريخ والوقت</th>
                    <th>النوع</th>
                    <th>تغيير الكمية</th>
                    <th>الرصيد بعد الحركة</th>
                    <th>المرجع</th>
                    <th>ملاحظات</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m.movement_id}>
                      <td style={{ direction: 'ltr', textAlign: 'right' }}>
                        {new Date(m.datetime).toLocaleString('en-GB')}
                      </td>
                      <td>
                        <span className={`badge badge-${m.type === 'SALE' ? 'danger' : m.type === 'PURCHASE' ? 'success' : 'neutral'}`}>
                          {typeLabels[m.type] ?? m.type}
                        </span>
                      </td>
                      <td style={{ direction: 'ltr', color: m.qty_change > 0 ? 'green' : m.qty_change < 0 ? 'red' : 'inherit', fontWeight: 'bold' }}>
                        {m.qty_change > 0 ? `+${m.qty_change}` : m.qty_change}
                      </td>
                      <td>{m.new_balance}</td>
                      <td>{renderReference(m)}</td>
                      <td className="muted">{m.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
