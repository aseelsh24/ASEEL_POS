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
        return `فاتورة #${refId}`
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
    <section>
      <header className="page-header">
        <div>
          <h1 className="page-title">سجل حركات الصنف</h1>
          <p className="muted">تتبع تاريخ حركة المخزون لكل منتج.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg-grid-cols-12 gap-6">
        {/* Filters Panel (Compact) - 3 Columns on Desktop */}
        <div className="card lg-col-span-4 h-fit">
          <div className="card-header">
            <h2 className="card-title">خيارات البحث</h2>
          </div>
          <div className="flex flex-col gap-4">
            <div className="form-group">
              <label className="form-label">اختر الصنف</label>
              <select
                className="form-select"
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
            </div>

            <div className="form-group">
              <label className="form-label">نوع الحركة</label>
              <select
                className="form-select"
                value={movementType}
                onChange={(e) => setMovementType(e.target.value as MovementType | '')}
              >
                <option value="">الكل</option>
                <option value="SALE">مبيعات</option>
                <option value="PURCHASE">مشتريات</option>
                <option value="SALES_RETURN">مرتجع مبيعات</option>
                <option value="ADJUSTMENT">تسوية مخزنية</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="form-group">
                <label className="form-label">من تاريخ</label>
                <input className="form-input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>

              <div className="form-group">
                <label className="form-label">إلى تاريخ</label>
                <input className="form-input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>

            {/* Show current stock for quick reference if selected */}
            {selectedProduct && (
              <div className="bg-white border border-gray-200 p-4 rounded-lg mt-2">
                <div className="text-sm muted mb-1">الرصيد الحالي</div>
                <div className="text-2xl font-bold text-primary">{selectedProduct.stock_qty} <span className="text-sm font-normal text-muted">{selectedProduct.unit}</span></div>
              </div>
            )}
          </div>
        </div>

        {/* Results Panel (Wider) - 9 Columns on Desktop */}
        <div className="card lg-col-span-8 min-h-400">
          <div className="card-header">
            <div>
              <h2 className="card-title">سجل الحركات: {selectedProduct?.name ?? '...'}</h2>
            </div>
            {loading && <span className="muted">جارٍ التحميل...</span>}
          </div>

          {error && <div className="error-text">{error}</div>}

          {!loading && !error && !selectedProductId && (
            <div className="d-flex flex-col items-center justify-center h-full text-center muted" style={{ minHeight: '300px' }}>
               <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>📋</div>
               <p>يرجى اختيار صنف من القائمة الجانبية لعرض سجل حركاته.</p>
            </div>
          )}

          {!loading && !error && selectedProductId && movements.length === 0 && (
            <div className="d-flex flex-col items-center justify-center h-full text-center muted" style={{ minHeight: '300px' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>📭</div>
              <p>لا توجد حركات في الفترة المحددة.</p>
            </div>
          )}

          {!loading && !error && movements.length > 0 && (
            <div className="table-container">
              <table className="table">
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
                  {movements.map((m) => {
                     let badgeClass = 'badge-muted';
                     if (m.type === 'SALE') badgeClass = 'badge text-error';
                     else if (m.type === 'PURCHASE') badgeClass = 'badge-success';
                     else if (m.type === 'SALES_RETURN') badgeClass = 'badge-success';

                     const isPositive = m.qty_change > 0;
                     const isNegative = m.qty_change < 0;
                     const qtyColor = isPositive ? 'var(--color-success-text)' : isNegative ? 'var(--color-error-text)' : 'inherit';

                     return (
                      <tr key={m.movement_id}>
                        <td style={{ direction: 'ltr', textAlign: 'right' }}>
                          {new Date(m.datetime).toLocaleString('en-GB')}
                        </td>
                        <td>
                          <span className={`badge ${badgeClass}`}>
                            {typeLabels[m.type] ?? m.type}
                          </span>
                        </td>
                        <td style={{ direction: 'ltr', color: qtyColor, fontWeight: 'bold' }}>
                          {isPositive ? `+${m.qty_change}` : m.qty_change}
                        </td>
                        <td className="font-bold">{m.new_balance}</td>
                        <td>{renderReference(m)}</td>
                        <td className="muted text-sm">{m.notes || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
