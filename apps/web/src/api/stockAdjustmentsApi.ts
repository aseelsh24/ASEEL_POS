import { appServices } from './appServices'

export interface CreateStockAdjustmentInput {
  product_id: number
  qty_delta: number
  reason: string
  note?: string
}

export async function createStockAdjustment(input: CreateStockAdjustmentInput) {
  return appServices.adjustmentService.adjustStock({
    product_id: input.product_id,
    qty_change: input.qty_delta,
    reason: input.reason,
    user_id: 1,
  })
}
