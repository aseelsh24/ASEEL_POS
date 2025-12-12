import { useEffect, useMemo, useState } from 'react'
import type { Category, Product } from '@core/index'
import {
  createCategory,
  disableCategory,
  fetchCategories,
  updateCategory,
} from '../api/categoriesApi'
import {
  createProduct,
  fetchProducts,
  toggleProductActive,
  updateProduct,
} from '../api/productsApi'
import { exportProductsToCsv, importProductsFromCsv, parseProductsCsv } from '../api/catalogCsvApi'

interface ProductFormState {
  name: string
  barcode: string
  categoryId: string
  sale_price: string
  cost_price: string
  unit: string
  min_stock_alert: string
  max_discount: string
}

const defaultProductForm: ProductFormState = {
  name: '',
  barcode: '',
  categoryId: '',
  sale_price: '',
  cost_price: '',
  unit: '',
  min_stock_alert: '5',
  max_discount: '',
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [filters, setFilters] = useState({ name: '', barcode: '', categoryId: '', activeOnly: true })
  const [productForm, setProductForm] = useState<ProductFormState>(defaultProductForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [productError, setProductError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [categoryError, setCategoryError] = useState<string | null>(null)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [showInactiveCategories, setShowInactiveCategories] = useState(false)

  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvError, setCsvError] = useState<string | null>(null)
  const [csvSummary, setCsvSummary] = useState<{
    created: number
    updated: number
    skipped: number
    errors: string[]
  } | null>(null)
  const [csvLoading, setCsvLoading] = useState(false)

  useEffect(() => {
    void loadCategories()
  }, [])

  useEffect(() => {
    void loadProducts()
  }, [filters])

  const categoryOptions = useMemo(
    () => categories.filter((c) => c.is_active),
    [categories],
  )

  const categoryLookup = useMemo(() => {
    const map = new Map<number, Category>()
    categories.forEach((c) => {
      const id = c.id ?? (c as any).category_id
      if (id !== undefined && id !== null) map.set(Number(id), c)
    })
    return map
  }, [categories])

  async function loadCategories() {
    try {
      const data = await fetchCategories({ includeInactive: true })
      setCategories(data)
    } catch (err) {
      console.error('Unable to load categories', err)
      setCategoryError('تعذر تحميل الفئات')
    }
  }

  async function loadProducts() {
    setLoading(true)
    try {
      const data = await fetchProducts({
        name: filters.name || undefined,
        barcode: filters.barcode || undefined,
        categoryId: filters.categoryId || undefined,
        activeOnly: filters.activeOnly,
      })
      setProducts(data)
    } catch (err) {
      console.error('Unable to load products', err)
    } finally {
      setLoading(false)
    }
  }

  function resetProductForm() {
    setProductForm(defaultProductForm)
    setEditingId(null)
    setProductError(null)
  }

  function startEdit(product: Product) {
    const categoryId = product.categoryId ?? (product as any).category_id ?? ''
    setProductForm({
      name: product.name ?? '',
      barcode: product.barcode ?? '',
      categoryId: categoryId ? String(categoryId) : '',
      sale_price: String(product.sale_price ?? ''),
      cost_price: product.cost_price != null ? String(product.cost_price) : '',
      unit: product.unit ?? '',
      min_stock_alert: String(product.min_stock_alert ?? ''),
      max_discount: product.max_discount != null ? String(product.max_discount) : '',
    })
    setEditingId(product.id ?? (product as any).product_id ?? null)
    setProductError(null)
  }

  async function handleProductSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setProductError(null)

    const payload = {
      name: productForm.name.trim(),
      barcode: productForm.barcode.trim() || undefined,
      categoryId: productForm.categoryId ? Number(productForm.categoryId) : undefined,
      sale_price: Number(productForm.sale_price),
      cost_price: productForm.cost_price ? Number(productForm.cost_price) : undefined,
      unit: productForm.unit.trim() || undefined,
      min_stock_alert: productForm.min_stock_alert ? Number(productForm.min_stock_alert) : undefined,
      max_discount: productForm.max_discount ? Number(productForm.max_discount) : undefined,
    }

    if (!payload.name) {
      setProductError('اسم المنتج مطلوب')
      return
    }
    if (!payload.sale_price || Number.isNaN(payload.sale_price)) {
      setProductError('سعر البيع مطلوب')
      return
    }

    const action = editingId ? updateProduct(editingId, payload) : createProduct(payload)
    const result = await action

    if (!result.success) {
      setProductError(result.error ?? 'تعذر حفظ المنتج')
      return
    }

    resetProductForm()
    await loadProducts()
  }

  async function handleToggleProduct(product: Product) {
    const id = product.id ?? (product as any).product_id
    if (!id) return
    const result = await toggleProductActive(id, !product.is_active)
    if (!result.success) {
      setProductError(result.error ?? 'تعذر تحديث حالة المنتج')
      return
    }
    await loadProducts()
  }

  async function handleCreateCategory(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setCategoryError(null)
    if (!newCategoryName.trim()) {
      setCategoryError('اسم الفئة مطلوب')
      return
    }
    const result = await createCategory({ name: newCategoryName.trim() })
    if (!result.success) {
      setCategoryError(result.error ?? 'تعذر إنشاء الفئة')
      return
    }
    setNewCategoryName('')
    await loadCategories()
  }

  async function handleRenameCategory(id: number, currentName: string) {
    const next = window.prompt('اسم جديد للفئة', currentName)
    if (next === null) return
    const trimmed = next.trim()
    if (!trimmed) {
      setCategoryError('اسم الفئة مطلوب')
      return
    }
    const result = await updateCategory(id, { name: trimmed })
    if (!result.success) {
      setCategoryError(result.error ?? 'تعذر تحديث الفئة')
      return
    }
    await loadCategories()
    await loadProducts()
  }

  async function handleCsvImport() {
    if (!csvFile) {
      setCsvError('يرجى اختيار ملف CSV أولاً')
      return
    }
    setCsvError(null)
    setCsvSummary(null)
    setCsvLoading(true)

    try {
      const parsedRows = await parseProductsCsv(csvFile)
      const summary = await importProductsFromCsv(parsedRows)
      setCsvSummary(summary)
      await loadCategories()
      await loadProducts()
    } catch (err: any) {
      setCsvError(err?.message ?? 'تعذر استيراد الملف')
    } finally {
      setCsvLoading(false)
    }
  }

  async function handleCsvExport() {
    setCsvError(null)
    setCsvLoading(true)
    try {
      const csvText = await exportProductsToCsv({
        name: filters.name || undefined,
        barcode: filters.barcode || undefined,
        categoryId: filters.categoryId || undefined,
        activeOnly: filters.activeOnly,
      })
      const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `products-export-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.csv`
      link.click()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      setCsvError(err?.message ?? 'تعذر تصدير المنتجات')
    } finally {
      setCsvLoading(false)
    }
  }

  async function handleDisableCategory(id: number) {
    const confirmDisable = window.confirm('هل أنت متأكد من تعطيل الفئة؟')
    if (!confirmDisable) return
    const result = await disableCategory(id)
    if (!result.success) {
      setCategoryError(result.error ?? 'تعذر تعطيل الفئة')
      return
    }
    await loadCategories()
    await loadProducts()
  }

  function renderCategoryName(product: Product) {
    const id = product.categoryId ?? (product as any).category_id
    if (!id) return '—'
    const found = categoryLookup.get(Number(id))
    if (!found) return 'فئة غير معروفة'
    return found.name + (found.is_active ? '' : ' (غير نشطة)'
    )
  }

  return (
    <section className="catalog-page">
      <header className="page-header">
        <div>
          <h1>إدارة الأصناف</h1>
          <p>إنشاء وتعديل المنتجات والفئات مع التحكم في التفعيل.</p>
        </div>
      </header>

      <div className="grid-layout">
        <div className="card">
          <div className="card-header">
            <h2>أدوات CSV</h2>
            {csvLoading && <span className="muted">جارٍ المعالجة...</span>}
          </div>
          <div className="csv-tools-grid">
            <label className="form-field">
              <span>ملف المنتجات (CSV)</span>
              <input type="file" accept=".csv" onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)} />
            </label>
            <div className="csv-actions">
              <button type="button" onClick={handleCsvImport} disabled={csvLoading}>
                استيراد من CSV
              </button>
              <button type="button" className="secondary" onClick={handleCsvExport} disabled={csvLoading}>
                تصدير المنتجات إلى CSV
              </button>
            </div>
          </div>
          {csvSummary && (
            <div className="csv-summary">
              <div className="muted">
                تم إضافة {csvSummary.created} منتجات، تحديث {csvSummary.updated} منتجات، وتخطي {csvSummary.skipped} صف.
              </div>
              {csvSummary.errors.length > 0 && (
                <ul className="error-list">
                  {csvSummary.errors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {csvError && <div className="error-text">{csvError}</div>}
        </div>

        <div className="card">
          <div className="card-header">
            <h2>تصفية المنتجات</h2>
          </div>
          <div className="filters-grid">
            <label className="form-field">
              <span>بحث بالاسم</span>
              <input
                type="text"
                value={filters.name}
                onChange={(e) => setFilters((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="أدخل جزءاً من الاسم"
              />
            </label>
            <label className="form-field">
              <span>بحث بالباركود</span>
              <input
                type="text"
                value={filters.barcode}
                onChange={(e) => setFilters((prev) => ({ ...prev, barcode: e.target.value }))}
                placeholder="123456789"
              />
            </label>
            <label className="form-field">
              <span>الفئة</span>
              <select
                value={filters.categoryId}
                onChange={(e) => setFilters((prev) => ({ ...prev, categoryId: e.target.value }))}
              >
                <option value="">كل الفئات</option>
                {categories.map((cat) => (
                  <option key={cat.id ?? (cat as any).category_id} value={cat.id ?? (cat as any).category_id}>
                    {cat.name} {cat.is_active ? '' : '(معطلة)'}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field checkbox-field">
              <input
                type="checkbox"
                checked={filters.activeOnly}
                onChange={(e) => setFilters((prev) => ({ ...prev, activeOnly: e.target.checked }))}
              />
              <span>إظهار المنتجات النشطة فقط</span>
            </label>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>{editingId ? 'تعديل منتج' : 'إضافة منتج جديد'}</h2>
          </div>
          <form className="form-grid" onSubmit={handleProductSubmit}>
            <label className="form-field">
              <span>اسم المنتج *</span>
              <input
                required
                value={productForm.name}
                onChange={(e) => setProductForm((prev) => ({ ...prev, name: e.target.value }))}
              />
            </label>
            <label className="form-field">
              <span>الباركود</span>
              <input
                value={productForm.barcode}
                onChange={(e) => setProductForm((prev) => ({ ...prev, barcode: e.target.value }))}
                placeholder="اختياري"
              />
            </label>
            <label className="form-field">
              <span>الفئة</span>
              <select
                value={productForm.categoryId}
                onChange={(e) => setProductForm((prev) => ({ ...prev, categoryId: e.target.value }))}
              >
                <option value="">بدون فئة</option>
                {categoryOptions.map((cat) => (
                  <option key={cat.id ?? (cat as any).category_id} value={cat.id ?? (cat as any).category_id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span>سعر البيع *</span>
              <input
                type="number"
                min="0"
                required
                value={productForm.sale_price}
                onChange={(e) => setProductForm((prev) => ({ ...prev, sale_price: e.target.value }))}
              />
            </label>
            <label className="form-field">
              <span>سعر التكلفة</span>
              <input
                type="number"
                min="0"
                value={productForm.cost_price}
                onChange={(e) => setProductForm((prev) => ({ ...prev, cost_price: e.target.value }))}
              />
            </label>
            <label className="form-field">
              <span>الوحدة</span>
              <input
                value={productForm.unit}
                onChange={(e) => setProductForm((prev) => ({ ...prev, unit: e.target.value }))}
                placeholder="قطعة / علبة ..."
              />
            </label>
            <label className="form-field">
              <span>حد تنبيه المخزون</span>
              <input
                type="number"
                min="0"
                value={productForm.min_stock_alert}
                onChange={(e) => setProductForm((prev) => ({ ...prev, min_stock_alert: e.target.value }))}
              />
            </label>
            <label className="form-field">
              <span>أقصى خصم مسموح</span>
              <input
                type="number"
                min="0"
                value={productForm.max_discount}
                onChange={(e) => setProductForm((prev) => ({ ...prev, max_discount: e.target.value }))}
              />
            </label>
            {productError && <div className="error-text">{productError}</div>}
            <div className="form-actions">
              <button type="submit">{editingId ? 'تحديث المنتج' : 'حفظ المنتج'}</button>
              {editingId && (
                <button type="button" className="secondary" onClick={resetProductForm}>
                  إلغاء التعديل
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>قائمة المنتجات</h2>
            {loading && <span className="muted">جارِ التحميل...</span>}
          </div>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>الاسم</th>
                  <th>الباركود</th>
                  <th>الفئة</th>
                  <th>سعر البيع</th>
                  <th>الكمية</th>
                  <th>الحالة</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 && (
                  <tr>
                    <td colSpan={7} className="muted">
                      لا توجد منتجات مطابقة
                    </td>
                  </tr>
                )}
                {products.map((product) => (
                  <tr key={product.id ?? (product as any).product_id}>
                    <td>{product.name}</td>
                    <td>{product.barcode || '—'}</td>
                    <td>{renderCategoryName(product)}</td>
                    <td>{product.sale_price}</td>
                    <td>{product.stock_qty ?? 0}</td>
                    <td>
                      <span className={`badge ${product.is_active ? 'badge-success' : 'badge-muted'}`}>
                        {product.is_active ? 'نشط' : 'معطل'}
                      </span>
                    </td>
                    <td className="actions-cell">
                      <button type="button" onClick={() => startEdit(product)}>
                        تعديل
                      </button>
                      <button type="button" className="secondary" onClick={() => handleToggleProduct(product)}>
                        {product.is_active ? 'تعطيل' : 'تفعيل'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>إدارة الفئات</h2>
          </div>
          <form className="form-grid" onSubmit={handleCreateCategory}>
            <label className="form-field">
              <span>اسم الفئة</span>
              <input value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} />
            </label>
            <div className="form-actions">
              <button type="submit">إضافة فئة</button>
            </div>
            <label className="form-field checkbox-field">
              <input
                type="checkbox"
                checked={showInactiveCategories}
                onChange={(e) => setShowInactiveCategories(e.target.checked)}
              />
              <span>إظهار الفئات المعطلة</span>
            </label>
            {categoryError && <div className="error-text">{categoryError}</div>}
          </form>

          <div className="category-list">
            {categories
              .filter((c) => (showInactiveCategories ? true : c.is_active))
              .map((cat) => {
                const id = cat.id ?? (cat as any).category_id
                return (
                  <div key={id} className="category-row">
                    <div>
                      <div className="category-name">{cat.name}</div>
                      {!cat.is_active && <div className="muted">معطلة</div>}
                    </div>
                    <div className="category-actions">
                      <button type="button" onClick={() => handleRenameCategory(Number(id), cat.name)}>
                        إعادة تسمية
                      </button>
                      {cat.is_active && (
                        <button type="button" className="secondary" onClick={() => handleDisableCategory(Number(id))}>
                          تعطيل
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      </div>
    </section>
  )
}