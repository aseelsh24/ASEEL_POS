import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Settings } from '@core/index'
import type { SettingsInput } from '@backend/ServiceLayer_POS_Grocery_MVP'
import { saveSettings } from '../api/settingsApi'
import { useAppState } from '../state/AppStateProvider'

const roundingModeOptions: Array<{ value: Settings['rounding_mode']; label: string }> = [
  { value: 'NEAREST', label: 'تقريب لأقرب عدد صحيح' },
  { value: 'NONE', label: 'بدون تقريب' },
  { value: 'CUSTOM', label: 'مخصص (لاحقاً)' },
]

interface WizardFormState extends SettingsInput {
  auto_print: boolean
}

const defaultValues: WizardFormState = {
  store_name: '',
  currency_code: 'YER',
  rounding_mode: 'NEAREST',
  idle_lock_minutes: 5,
  auto_print: false,
}

export default function FirstRunWizardPage() {
  const { settings, settingsLoading, refreshSettings } = useAppState()
  const [formState, setFormState] = useState<WizardFormState>(defaultValues)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (settings) {
      setFormState((prev) => ({
        ...prev,
        store_name: settings.store_name,
        currency_code: settings.currency_code,
        rounding_mode: settings.rounding_mode,
        idle_lock_minutes: settings.idle_lock_minutes,
        auto_print: settings.auto_print,
      }))
    }
  }, [settings])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    if (!formState.store_name.trim()) {
      setError('يرجى إدخال اسم المتجر')
      return
    }

    setSaving(true)
    try {
      const payload: SettingsInput = {
        store_name: formState.store_name.trim(),
        currency_code: formState.currency_code.trim() || 'YER',
        rounding_mode: formState.rounding_mode,
        idle_lock_minutes: Number(formState.idle_lock_minutes) || 0,
        auto_print: formState.auto_print,
      }

      await saveSettings(payload)
      await refreshSettings()
      navigate('/pos', { replace: true })
    } catch (err) {
      console.error('Failed to submit settings', err)
      setError('تعذّر حفظ الإعدادات. حاول مرة أخرى.')
    } finally {
      setSaving(false)
    }
  }

  const updateField = <K extends keyof WizardFormState>(key: K, value: WizardFormState[K]) => {
    setFormState((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <section className="card" aria-busy={saving} style={{ maxWidth: 520 }}>
      <h1>إعداد النظام لأول مرة</h1>
      <p>أدخل بيانات المتجر قبل البدء باستخدام نقطة البيع.</p>

      {settingsLoading && <div>جارِ تحميل الإعدادات الحالية...</div>}
      {error && <div className="error-text" role="alert">{error}</div>}

      <form onSubmit={handleSubmit} className="form-grid">
        <label className="form-field">
          <span>اسم المتجر *</span>
          <input
            type="text"
            value={formState.store_name}
            onChange={(e) => updateField('store_name', e.target.value)}
            required
            placeholder="مثال: بقالة الحي"
          />
        </label>

        <label className="form-field">
          <span>رمز العملة</span>
          <input
            type="text"
            value={formState.currency_code}
            onChange={(e) => updateField('currency_code', e.target.value.toUpperCase())}
            placeholder="مثال: YER"
          />
        </label>

        <label className="form-field">
          <span>وضع التقريب</span>
          <select
            value={formState.rounding_mode}
            onChange={(e) => updateField('rounding_mode', e.target.value as Settings['rounding_mode'])}
          >
            {roundingModeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="form-field">
          <span>مدة قفل الخمول (بالدقائق)</span>
          <input
            type="number"
            min={1}
            value={formState.idle_lock_minutes}
            onChange={(e) => updateField('idle_lock_minutes', Number(e.target.value))}
          />
        </label>

        <label className="form-field checkbox-field">
          <input
            type="checkbox"
            checked={formState.auto_print}
            onChange={(e) => updateField('auto_print', e.target.checked)}
          />
          <span>تشغيل الطباعة التلقائية للفواتير</span>
        </label>

        <div className="form-actions">
          <button type="submit" disabled={saving}>
            {saving ? 'جارِ الحفظ...' : 'حفظ الإعدادات والبدء'}
          </button>
        </div>
      </form>
    </section>
  )
}
