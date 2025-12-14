import { Link } from 'react-router-dom'
import { useAppState } from '../state/AppStateProvider'
import React, { useRef } from 'react'

export default function SettingsPage() {
  const { settings, settingsLoading, services } = useAppState()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleExport = async () => {
    try {
      const blobOrString = await services.db.backup.exportBackupBlob()
      const blob = blobOrString instanceof Blob
        ? blobOrString
        : new Blob([blobOrString as string], { type: 'application/json' })

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `backup_${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error(e)
      alert('حدث خطأ أثناء التصدير')
    }
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!confirm('سيتم استبدال جميع البيانات الحالية بالبيانات الموجودة في النسخة الاحتياطية. هل أنت متأكد؟')) {
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    try {
      const text = await file.text()
      await services.db.backup.importBackup(text)
      alert('تم استعادة النسخة الاحتياطية بنجاح. سيتم إعادة تحميل الصفحة.')
      window.location.reload()
    } catch (err) {
      console.error(err)
      alert('حدث خطأ أثناء استعادة النسخة الاحتياطية: ' + (err as Error).message)
    } finally {
        if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
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

    <section className="card" style={{ maxWidth: 520 }}>
        <h1>إدارة البيانات</h1>
        <p>يمكنك تنزيل نسخة احتياطية من جميع بيانات النظام أو استعادة نسخة سابقة.</p>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginTop: '1rem' }}>
            <button onClick={handleExport}>
                تنزيل نسخة احتياطية
            </button>

            <div style={{ position: 'relative' }}>
                <input
                    type="file"
                    accept=".json"
                    onChange={handleImport}
                    style={{ display: 'none' }}
                    ref={fileInputRef}
                    id="restore-backup-input"
                />
                <button onClick={() => fileInputRef.current?.click()}>
                    استعادة نسخة احتياطية
                </button>
            </div>
        </div>
    </section>
    </div>
  )
}
