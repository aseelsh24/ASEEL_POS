import { appServices } from './appServices'

export interface SalesSummaryResponse {
  total_sales: number
  invoices_count: number
  avg_invoice: number
}

export interface TopProductItem {
  product_id: number
  name: string
  qty: number
  value: number
}

export interface LowStockAlertItem {
  product_id: number
  name: string
  stock_qty: number
  min_stock_alert: number
}

export interface EstimatedProfitResponse {
  estimated_profit: number
  revenue: number
  cost_basis: number
}

export async function getSalesSummary(params: { startIso: string; endIso: string }): Promise<SalesSummaryResponse> {
  try {
    return await appServices.reportsService.getSalesSummary(params.startIso, params.endIso)
  } catch (err) {
    console.error('Failed to fetch sales summary', err)
    throw new Error('تعذر تحميل ملخص المبيعات')
  }
}

export async function getTopProducts(params: {
  startIso: string
  endIso: string
  limit?: number
}): Promise<TopProductItem[]> {
  try {
    return await appServices.reportsService.getTopProducts(params.startIso, params.endIso, params.limit ?? 10)
  } catch (err) {
    console.error('Failed to fetch top products', err)
    throw new Error('تعذر تحميل أفضل الأصناف')
  }
}

export async function getLowStockAlerts(): Promise<LowStockAlertItem[]> {
  try {
    return await appServices.reportsService.getLowStockAlerts()
  } catch (err) {
    console.error('Failed to fetch low stock alerts', err)
    throw new Error('تعذر تحميل تنبيهات المخزون')
  }
}

export async function getEstimatedProfit(params: {
  startIso: string
  endIso: string
}): Promise<EstimatedProfitResponse> {
  try {
    return await appServices.reportsService.getEstimatedProfit(params.startIso, params.endIso)
  } catch (err) {
    console.error('Failed to fetch estimated profit', err)
    throw new Error('تعذر حساب الربح التقديري')
  }
}
