import type { Product } from '@core/index'
import type { ProductFilters, ProductInput } from '@backend/ServiceLayer_POS_Grocery_MVP'
import { appServices } from './appServices'

const DUPLICATE_BARCODE_CODE = 'DUPLICATE_BARCODE'

function mapProductError(err: unknown): string {
  const code = (err as any)?.code
  if (code === DUPLICATE_BARCODE_CODE) {
    return 'الباركود مستخدم بالفعل لمنتج آخر'
  }
  const message = (err as any)?.message ?? String(err)
  return `تعذر حفظ المنتج: ${message}`
}

export async function fetchProducts(filters?: ProductFilters): Promise<Product[]> {
  return appServices.catalogService.listProducts(filters)
}

export async function createProduct(input: ProductInput): Promise<{ success: boolean; data?: Product; error?: string }> {
  try {
    const data = await appServices.catalogService.createProduct(input)
    return { success: true, data }
  } catch (err) {
    console.error('Failed to create product', err)
    return { success: false, error: mapProductError(err) }
  }
}

export async function updateProduct(
  id: number,
  input: Partial<ProductInput>,
): Promise<{ success: boolean; data?: Product; error?: string }> {
  try {
    const data = await appServices.catalogService.updateProduct(id, input)
    return { success: true, data }
  } catch (err) {
    console.error('Failed to update product', err)
    return { success: false, error: mapProductError(err) }
  }
}

export async function toggleProductActive(
  id: number,
  isActive: boolean,
): Promise<{ success: boolean; data?: Product; error?: string }> {
  try {
    const data = await appServices.catalogService.toggleProductActive(id, isActive)
    return { success: true, data }
  } catch (err) {
    console.error('Failed to toggle product active', err)
    return { success: false, error: 'تعذر تغيير حالة المنتج' }
  }
}
