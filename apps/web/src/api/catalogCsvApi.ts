import type { ProductFilters } from '@backend/ServiceLayer_POS_Grocery_MVP'
import type { Category, Product } from '@core/index'
import { createCategory, fetchCategories } from './categoriesApi'
import { createProduct, fetchProducts, updateProduct } from './productsApi'

type RawCsvRow = Record<string, string>

export interface ParsedCsvRow {
  rowNumber: number
  values: RawCsvRow
}

export interface ImportSummary {
  created: number
  updated: number
  skipped: number
  errors: string[]
}

const REQUIRED_HEADERS = ['name', 'sale_price']
const OPTIONAL_HEADERS = [
  'barcode',
  'category_name',
  'cost_price',
  'unit',
  'min_stock_alert',
  'max_discount',
  'is_active',
]
const ALL_HEADERS = [...REQUIRED_HEADERS, ...OPTIONAL_HEADERS]

function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const next = line[i + 1]

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"'
        i++
        continue
      }
      inQuotes = !inQuotes
      continue
    }

    if (char === ',' && !inQuotes) {
      cells.push(current)
      current = ''
      continue
    }

    current += char
  }

  cells.push(current)
  return cells
}

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase()
}

export async function parseProductsCsv(file: File): Promise<ParsedCsvRow[]> {
  const text = await file.text()
  const lines = text.split(/\r?\n/).filter((ln) => ln.trim() !== '')
  if (lines.length === 0) throw new Error('ملف CSV فارغ')

  const headerCells = parseCsvLine(lines[0]).map(normalizeHeader)
  const missing = REQUIRED_HEADERS.filter((h) => !headerCells.includes(h))
  if (missing.length > 0) {
    throw new Error(`الأعمدة المطلوبة مفقودة: ${missing.join(', ')}`)
  }

  const rows: ParsedCsvRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i])
    const values: RawCsvRow = {}
    headerCells.forEach((header, idx) => {
      values[header] = (cells[idx] ?? '').trim()
    })
    rows.push({ rowNumber: i + 1, values })
  }
  return rows
}

function parseBoolean(value?: string): boolean | undefined {
  if (value === undefined) return undefined
  const normalized = value.trim().toLowerCase()
  if (!normalized) return undefined
  return ['true', '1', 'yes', 'y', 'نعم'].includes(normalized)
    ? true
    : ['false', '0', 'no', 'n', 'لا'].includes(normalized)
      ? false
      : undefined
}

function parseNumber(value?: string): number | undefined {
  if (value === undefined) return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const num = Number(trimmed)
  return Number.isNaN(num) ? undefined : num
}

async function ensureCategoryId(
  categoryName: string | undefined,
  categoriesByName: Map<string, Category>,
): Promise<number | undefined> {
  if (!categoryName?.trim()) return undefined
  const key = categoryName.trim().toLowerCase()
  const cached = categoriesByName.get(key)
  const cachedId = cached?.id ?? (cached as any)?.category_id
  if (cachedId !== undefined && cachedId !== null) return Number(cachedId)

  const created = await createCategory({ name: categoryName.trim() })
  if (created.success && created.data) {
    const createdId = (created.data as any).id ?? (created.data as any).category_id
    categoriesByName.set(key, created.data)
    if (createdId !== undefined && createdId !== null) return Number(createdId)
  }

  return undefined
}

async function findProductByBarcode(barcode?: string): Promise<Product | undefined> {
  if (!barcode) return undefined
  const matches = await fetchProducts({ barcode, activeOnly: false })
  return matches[0]
}

export async function importProductsFromCsv(rows: ParsedCsvRow[]): Promise<ImportSummary> {
  const categories = await fetchCategories({ includeInactive: true })
  const categoriesByName = new Map<string, Category>()
  categories.forEach((cat) => categoriesByName.set(cat.name.trim().toLowerCase(), cat))

  const summary: ImportSummary = { created: 0, updated: 0, skipped: 0, errors: [] }

  for (const row of rows) {
    const values = row.values
    const name = values.name?.trim()
    const salePriceNum = parseNumber(values.sale_price)

    if (!name || salePriceNum === undefined || salePriceNum <= 0) {
      summary.skipped += 1
      summary.errors.push(`تم تخطي الصف ${row.rowNumber} بسبب نقص البيانات المطلوبة`)
      continue
    }

    try {
      const barcode = values.barcode?.trim() || undefined
      const categoryId = await ensureCategoryId(values.category_name, categoriesByName)
      const payload = {
        name,
        barcode,
        categoryId,
        sale_price: salePriceNum,
        cost_price: parseNumber(values.cost_price),
        unit: values.unit?.trim() || undefined,
        min_stock_alert: parseNumber(values.min_stock_alert),
        max_discount: parseNumber(values.max_discount),
        is_active: parseBoolean(values.is_active),
      }

      if (barcode) {
        const existing = await findProductByBarcode(barcode)
        const existingId = existing?.id ?? (existing as any)?.product_id
        if (existing && existingId !== undefined) {
          const result = await updateProduct(existingId, payload)
          if (result.success) {
            summary.updated += 1
            continue
          }
          throw new Error(result.error ?? 'فشل تحديث المنتج')
        }
      }

      const created = await createProduct(payload)
      if (!created.success) {
        throw new Error(created.error ?? 'فشل إنشاء المنتج')
      }
      summary.created += 1
    } catch (err: any) {
      summary.skipped += 1
      summary.errors.push(`خطأ في الصف ${row.rowNumber}: ${err.message ?? err}`)
    }
  }

  return summary
}

function escapeCsvValue(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"'
  }
  return str
}

export async function exportProductsToCsv(filters?: ProductFilters): Promise<string> {
  const products = await fetchProducts(filters)
  const categories = await fetchCategories({ includeInactive: true })
  const categoryLookup = new Map<number, Category>()
  categories.forEach((cat) => {
    const categoryId = cat.id ?? (cat as any)?.category_id
    if (categoryId !== undefined && categoryId !== null) {
      categoryLookup.set(Number(categoryId), cat)
    }
  })

  const header = ALL_HEADERS.join(',')
  const lines = products.map((product) => {
    const categoryId = product.categoryId ?? (product as any).category_id
    const categoryName = categoryId ? categoryLookup.get(Number(categoryId))?.name ?? '' : ''
    const row = [
      escapeCsvValue(product.name ?? ''),
      escapeCsvValue(product.sale_price ?? ''),
      escapeCsvValue(product.barcode ?? ''),
      escapeCsvValue(categoryName),
      escapeCsvValue(product.cost_price ?? ''),
      escapeCsvValue(product.unit ?? ''),
      escapeCsvValue(product.min_stock_alert ?? ''),
      escapeCsvValue(product.max_discount ?? ''),
      escapeCsvValue(product.is_active ?? true),
    ]
    return row.join(',')
  })

  return [header, ...lines].join('\n')
}
