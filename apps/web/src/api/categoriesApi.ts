import type { Category } from '@core/index'
import type { CategoryInput } from '@backend/ServiceLayer_POS_Grocery_MVP'
import { appServices } from './appServices'

export async function fetchCategories(options?: { includeInactive?: boolean }): Promise<Category[]> {
  return appServices.catalogService.listCategories(options)
}

export async function createCategory(input: CategoryInput): Promise<{ success: boolean; data?: Category; error?: string }> {
  try {
    const data = await appServices.catalogService.createCategory(input)
    return { success: true, data }
  } catch (err) {
    console.error('Failed to create category', err)
    return { success: false, error: 'تعذر إنشاء الفئة حالياً' }
  }
}

export async function updateCategory(
  id: number,
  input: Partial<CategoryInput>,
): Promise<{ success: boolean; data?: Category; error?: string }> {
  try {
    const data = await appServices.catalogService.updateCategory(id, input)
    return { success: true, data }
  } catch (err) {
    console.error('Failed to update category', err)
    return { success: false, error: 'تعذر تحديث الفئة' }
  }
}

export async function disableCategory(id: number): Promise<{ success: boolean; error?: string }> {
  try {
    await appServices.catalogService.softDeleteCategory(id)
    return { success: true }
  } catch (err) {
    console.error('Failed to disable category', err)
    return { success: false, error: 'تعذر تعطيل الفئة' }
  }
}
