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
    <section>
      <header className="page-header">
        <div>
          <h1 className="page-title">التقارير</h1>
          <p className="muted">نظرة سريعة على أداء المبيعات والمخزون.</p>
        </div>
        <div className="d-flex gap-4 items-center bg-white p-2 rounded-lg shadow-sm">
          <div className="d-flex items-center gap-2">
             <span className="muted text-sm">من</span>
             <input className="form-input p-1" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="d-flex items-center gap-2">
             <span className="muted text-sm">إلى</span>
             <input className="form-input p-1" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>
      </header>

      {/*
        Grid Layout:
        Desktop: 4 cards in row (Sales Summary)
        Tablet: 2x2
        Mobile: stacked
      */}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md-grid-cols-2 lg-grid-cols-4 gap-4 mb-6">
        <div className="card">
          <div className="card-header mb-2">
            <h3 className="card-title text-base font-normal muted">إجمالي المبيعات</h3>
          </div>
          {salesLoading ? <p className="muted">...</p> :
          salesError ? <p className="error-text text-xs">{salesError}</p> :
          salesSummary && (
             <div className="text-2xl font-bold text-primary">{salesSummary.total_sales.toFixed(2)}</div>
          )}
        </div>

        <div className="card">
          <div className="card-header mb-2">
            <h3 className="card-title text-base font-normal muted">عدد الفواتير</h3>
          </div>
          {salesLoading ? <p className="muted">...</p> :
          salesError ? <p className="error-text text-xs">{salesError}</p> :
          salesSummary && (
             <div className="text-2xl font-bold">{salesSummary.invoices_count}</div>
          )}
        </div>

        <div className="card">
           <div className="card-header mb-2">
            <h3 className="card-title text-base font-normal muted">متوسط الفاتورة</h3>
          </div>
          {salesLoading ? <p className="muted">...</p> :
          salesError ? <p className="error-text text-xs">{salesError}</p> :
          salesSummary && (
             <div className="text-2xl font-bold">{salesSummary.avg_invoice.toFixed(2)}</div>
          )}
        </div>

         <div className="card">
           <div className="card-header mb-2">
            <h3 className="card-title text-base font-normal muted">الربح التقديري</h3>
          </div>
          {profitLoading ? <p className="muted">...</p> :
          profitError ? <p className="error-text text-xs">{profitError}</p> :
          estimatedProfit && (
             <div className="text-2xl font-bold text-success">{estimatedProfit.estimated_profit.toFixed(2)}</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg-grid-cols-2 gap-6">
        {/* Top Products */}
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">أفضل 10 أصناف</h2>
              <p className="muted text-sm">مرتبة حسب الكمية المباعة.</p>
            </div>
          </div>
          {topLoading && <p className="muted">جارٍ التحميل...</p>}
          {topError && <p className="error-text">{topError}</p>}
          {!topLoading && !topError && (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>الصنف</th>
                    <th>الكمية</th>
                    <th>القيمة</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.length === 0 && (
                    <tr>
                      <td colSpan={3} className="muted text-center p-4">
                        لا توجد بيانات في الفترة المحددة.
                      </td>
                    </tr>
                  )}
                  {topProducts.slice(0, 10).map((item, idx) => (
                    <tr key={item.product_id}>
                      <td className="d-flex gap-2">
                        <span className="muted w-4">{idx + 1}.</span>
                        <span className="font-bold">{item.name}</span>
                      </td>
                      <td>{item.qty}</td>
                      <td>{item.value.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Low Stock Alerts */}
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">تنبيهات المخزون</h2>
              <p className="muted text-sm">الأصناف التي تحتاج إعادة طلب.</p>
            </div>
          </div>
          {lowLoading && <p className="muted">جارٍ التحميل...</p>}
          {lowError && <p className="error-text">{lowError}</p>}
          {!lowLoading && !lowError && (
            <div className="table-container">
              <table className="table">
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
                      <td colSpan={3} className="muted text-center p-4">
                        لا توجد أصناف منخفضة المخزون حالياً.
                      </td>
                    </tr>
                  )}
                  {lowStock.map((item) => (
                    <tr key={item.product_id}>
                      <td className="font-bold">{item.name}</td>
                      <td className="text-error font-bold">{item.stock_qty}</td>
                      <td>
                         <div className="d-flex justify-between items-center">
                            <span>{item.min_stock_alert}</span>
                            {item.stock_qty <= item.min_stock_alert && (
                              <span className="badge text-xs text-warning bg-warning">اطلب الآن</span>
                            )}
                         </div>
                      </td>
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
