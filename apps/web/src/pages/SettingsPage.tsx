import { Link } from 'react-router-dom'
import { useAppState } from '../state/AppStateProvider'

export default function SettingsPage() {
  const { settings, settingsLoading } = useAppState()

  if (settingsLoading) {
    return <p>جارِ تحميل الإعدادات...</p>
  }

  if (!settings) {
    return (
      <section>
        <h1>الإعدادات</h1>
        <p>
          لم يتم تهيئة الإعدادات بعد.{' '}
          <Link to="/first-run">ابدأ إعداد النظام</Link>
        </p>
      </section>
    )
  }

  return (
    <section className="card" style={{ maxWidth: 520 }}>
      <h1>الإعدادات</h1>
      <dl>
        <div className="field-row">
          <dt>اسم المتجر</dt>
          <dd>{settings.store_name}</dd>
        </div>
        <div className="field-row">
          <dt>رمز العملة</dt>
          <dd>{settings.currency_code}</dd>
        </div>
        <div className="field-row">
          <dt>وضع التقريب</dt>
          <dd>{settings.rounding_mode}</dd>
        </div>
        <div className="field-row">
          <dt>قفل الخمول (دقائق)</dt>
          <dd>{settings.idle_lock_minutes}</dd>
        </div>
      </dl>

      <p>
        <Link to="/first-run">تعديل الإعدادات</Link>
      </p>
    </section>
  )
}
