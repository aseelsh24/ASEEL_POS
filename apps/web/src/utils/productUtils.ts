import type { Product } from '@core/index'

export interface ProductIdentity {
  productId: number
  name: string
  barcode?: string
  unitPrice: number
  unit?: string
}

export function resolveProductIdentity(product: Product): ProductIdentity | null {
  if (!product) return null

  // Try all known variants of ID
  const rawId = (product as any).product_id ?? (product as any).productId ?? product.id

  // Convert to number safely
  const id = rawId != null ? Number(rawId) : NaN

  if (!Number.isFinite(id) || id <= 0) {
    return null
  }

  return {
    productId: id,
    name: product.name ?? 'منتج',
    barcode: product.barcode ?? undefined,
    unitPrice: Number(product.sale_price) || 0,
    unit: product.unit || undefined,
  }
}
