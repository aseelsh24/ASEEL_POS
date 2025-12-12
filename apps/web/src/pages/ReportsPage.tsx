import { useEffect, useMemo, useState } from 'react'
import {
  getEstimatedProfit,
  getLowStockAlerts,
  getSalesSummary,
  getTopProducts,
  type EstimatedProfitResponse,
  type LowStockAlertItem,
  type SalesSummaryResponse,
  type TopProductItem,
} from '../api/reportsApi'

const todayLocal = () => new Date().toISOString().slice(0, 10)

// Assumption: append UTC boundaries so the backend treats the date as full-day range.
const startOfDayIso = (day: string) => `${day}T00:00:00.000Z`
const endOfDayIso = (day: string) => `${day}T23:59:59.999Z`

export default function ReportsPage() {
  const [startDate, setStartDate] = useState(todayLocal())
  const [endDate, setEndDate] = useState(todayLocal())

  const [salesSummary, setSalesSummary] = useState<SalesSummaryResponse | null>(null)
  const [salesLoading, setSalesLoading] = useState(false)
  const [salesError, setSalesError] = useState<string | null>(null)

  const [topProducts, setTopProducts] = useState<TopProductItem[]>([])
  const [topLoading, setTopLoading] = useState(false)
  const [topError, setTopError] = useState<string | null>(null)

  const [lowStock, setLowStock] = useState<LowStockAlertItem[]>([])
  const [lowLoading, setLowLoading] = useState(false)
  const [lowError, setLowError] = useState<string | null>(null)

  const [estimatedProfit, setEstimatedProfit] = useState<EstimatedProfitResponse | null>(null)
  const [profitLoading, setProfitLoading] = useState(false)
  const [profitError, setProfitError] = useState<string | null>(null)

  const dateRange = useMemo(
    () => ({ startIso: startOfDayIso(startDate), endIso: endOfDayIso(endDate) }),
    [startDate, endDate],
  )

  useEffect(() => {
    loadSalesSummary()
    loadTopProducts()
    loadEstimatedProfit()
  }, [dateRange.startIso, dateRange.endIso])

  useEffect(() => {
    loadLowStock()
  }, [])

  async function loadSalesSummary() {
    setSalesLoading(true)
    setSalesError(null)
    try {
      const data = await getSalesSummary(dateRange)
      setSalesSummary(data)
    } catch (err) {
      console.error(err)
      setSalesError('تعذر تحميل بيانات التقرير. حاول مرة أخرى.')
    } finally {
      setSalesLoading(false)
    }
  }

  async function loadTopProducts() {
    setTopLoading(true)
    setTopError(null)
    try {
      const data = await getTopProducts({ ...dateRange, limit: 10 })
      setTopProducts(data)
    } catch (err) {
      console.error(err)
      setTopError('تعذر تحميل بيانات التقرير. حاول مرة أخرى.')
    } finally {
      setTopLoading(false)
    }
  }

  async function loadLowStock() {
    setLowLoading(true)
    setLowError(null)
    try {
      const data = await getLowStockAlerts()
      setLowStock(data)
    } catch (err) {
      console.error(err)
      setLowError('تعذر تحميل بيانات التقرير. حاول مرة أخرى.')
    } finally {
      setLowLoading(false)
    }
  }

  async function loadEstimatedProfit() {
    setProfitLoading(true)
    setProfitError(null)
    try {
      const data = await getEstimatedProfit(dateRange)
      setEstimatedProfit(data)
    } catch (err) {
      console.error(err)
      setProfitError('تعذر تحميل بيانات التقرير. حاول مرة أخرى.')
    } finally {
      setProfitLoading(false)
    }
  }

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <h1>التقارير</h1>
          <p className="muted">نظرة سريعة على أداء المبيعات والمخزون.</p>
        </div>
        <div className="filters-grid" style={{ maxWidth: '480px' }}>
          <label className="card">
            <span className="muted">من تاريخ</span>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label className="card">
            <span className="muted">إلى تاريخ</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
        </div>
      </div>

      <div className="grid-layout">
        <div className="card">
          <div className="card-header">
            <div>
              <h2>ملخص المبيعات</h2>
              <p className="muted">إجمالي المبيعات وعدد الفواتير ضمن الفترة.</p>
            </div>
          </div>
          {salesLoading && <p className="muted">جارٍ التحميل...</p>}
          {salesError && <p className="error-text">{salesError}</p>}
          {!salesLoading && !salesError && salesSummary && (
            <dl className="grid-layout" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
              <div>
                <dt>إجمالي المبيعات</dt>
                <dd>{salesSummary.total_sales.toFixed(2)}</dd>
              </div>
              <div>
                <dt>عدد الفواتير</dt>
                <dd>{salesSummary.invoices_count}</dd>
              </div>
              <div>
                <dt>متوسط قيمة الفاتورة</dt>
                <dd>{salesSummary.avg_invoice.toFixed(2)}</dd>
              </div>
            </dl>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <h2>أفضل 10 أصناف</h2>
              <p className="muted">مرتبة حسب الكمية المباعة.</p>
            </div>
          </div>
          {topLoading && <p className="muted">جارٍ التحميل...</p>}
          {topError && <p className="error-text">{topError}</p>}
          {!topLoading && !topError && (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>الصنف</th>
                    <th>الكمية المباعة</th>
                    <th>قيمة المبيعات</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.length === 0 && (
                    <tr>
                      <td colSpan={3} className="muted">
                        لا توجد بيانات في الفترة المحددة.
                      </td>
                    </tr>
                  )}
                  {topProducts.slice(0, 10).map((item) => (
                    <tr key={item.product_id}>
                      <td>{item.name}</td>
                      <td>{item.qty}</td>
                      <td>{item.value.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <h2>تنبيهات المخزون</h2>
              <p className="muted">الأصناف التي تحتاج إعادة طلب.</p>
            </div>
          </div>
          {lowLoading && <p className="muted">جارٍ التحميل...</p>}
          {lowError && <p className="error-text">{lowError}</p>}
          {!lowLoading && !lowError && (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>الصنف</th>
                    <th>الكمية الحالية</th>
                    <th>حد التنبيه</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStock.length === 0 && (
                    <tr>
                      <td colSpan={3} className="muted">
                        لا توجد أصناف منخفضة المخزون حالياً.
                      </td>
                    </tr>
                  )}
                  {lowStock.map((item) => (
                    <tr key={item.product_id} className={item.stock_qty <= item.min_stock_alert ? 'warning' : ''}>
                      <td>{item.name}</td>
                      <td>{item.stock_qty}</td>
                      <td>
                        {item.min_stock_alert}
                        {item.stock_qty <= item.min_stock_alert && (
                          <span style={{ marginInlineStart: '0.5rem', color: '#b91c1c' }}>بحاجة لطلبية</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <h2>ربح تقديري</h2>
              <p className="muted">الحساب يعتمد على آخر سعر شراء مسجل لكل صنف.</p>
            </div>
          </div>
          {profitLoading && <p className="muted">جارٍ التحميل...</p>}
          {profitError && <p className="error-text">{profitError}</p>}
          {!profitLoading && !profitError && estimatedProfit && (
            <dl className="grid-layout" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
              <div>
                <dt>إيرادات الفترة</dt>
                <dd>{estimatedProfit.revenue.toFixed(2)}</dd>
              </div>
              <div>
                <dt>تكلفة تقديرية</dt>
                <dd>{estimatedProfit.cost_basis.toFixed(2)}</dd>
              </div>
              <div>
                <dt>الربح التقديري</dt>
                <dd>{estimatedProfit.estimated_profit.toFixed(2)}</dd>
              </div>
            </dl>
          )}
        </div>
      </div>
    </section>
  )
}
