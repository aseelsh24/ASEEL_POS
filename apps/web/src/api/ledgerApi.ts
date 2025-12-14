import type { StockMovement, MovementType } from '@core/index'
import { appServices } from './appServices'

export interface LedgerFilters {
  productId: number
  startIso?: string
  endIso?: string
  type?: MovementType
}

export async function fetchProductLedger(filters: LedgerFilters): Promise<StockMovement[]> {
  const { productId, startIso, endIso, type } = filters
  return appServices.stockLedger.getLedger(productId, startIso, endIso, type)
}
