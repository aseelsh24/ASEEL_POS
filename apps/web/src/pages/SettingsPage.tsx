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
    return (
      <div className="flex justify-center items-center h-full">
         <p className="muted">جارِ تحميل الإعدادات...</p>
      </div>
    )
  }

  if (!settings) {
    return (
      <section className="container max-w-lg mx-auto py-2">
        <div className="card text-center">
          <h1 className="card-title">الإعدادات</h1>
          <p className="mb-4">
            لم يتم تهيئة الإعدادات بعد.
          </p>
          <Link to="/first-run" className="btn btn-primary">ابدأ إعداد النظام</Link>
        </div>
      </section>
    )
  }

  return (
    <div className="container max-w-2xl mx-auto flex flex-col gap-6">

      <header className="page-header text-center md-text-start">
        <h1 className="page-title">الإعدادات</h1>
        <p className="muted">إدارة إعدادات المتجر والنسخ الاحتياطي.</p>
      </header>

      <section className="card">
        <div className="card-header border-b border-gray-200 pb-4 mb-4">
           <h2 className="card-title">إعدادات المتجر</h2>
        </div>
        <dl className="d-flex flex-col gap-4">
          <div className="d-flex justify-between items-center py-2 border-b border-gray-200">
            <dt className="font-bold">اسم المتجر</dt>
            <dd>{settings.store_name}</dd>
          </div>
          <div className="d-flex justify-between items-center py-2 border-b border-gray-200">
            <dt className="font-bold">رمز العملة</dt>
            <dd>{settings.currency_code}</dd>
          </div>
          <div className="d-flex justify-between items-center py-2 border-b border-gray-200">
            <dt className="font-bold">وضع التقريب</dt>
            <dd>{settings.rounding_mode}</dd>
          </div>
          <div className="d-flex justify-between items-center py-2">
            <dt className="font-bold">قفل الخمول (دقائق)</dt>
            <dd>{settings.idle_lock_minutes}</dd>
          </div>
        </dl>

        <div className="mt-6 pt-4 border-t border-gray-200">
          <Link to="/first-run" className="btn btn-secondary w-full justify-center md-w-auto">تعديل الإعدادات</Link>
        </div>
      </section>

      <section className="card">
          <div className="card-header border-b border-gray-200 pb-4 mb-4">
             <h2 className="card-title">إدارة البيانات</h2>
          </div>
          <p className="muted mb-6">يمكنك تنزيل نسخة احتياطية من جميع بيانات النظام أو استعادة نسخة سابقة.</p>

          <div className="d-flex flex-col md-flex-row gap-4">
              <button className="btn btn-primary flex-1 justify-center" onClick={handleExport}>
                  تنزيل نسخة احتياطية
              </button>

              <div className="flex-1 w-full">
                  <input
                      type="file"
                      accept=".json"
                      onChange={handleImport}
                      style={{ display: 'none' }}
                      ref={fileInputRef}
                      id="restore-backup-input"
                  />
                  <button className="btn btn-secondary w-full justify-center" onClick={() => fileInputRef.current?.click()}>
                      استعادة نسخة احتياطية
                  </button>
              </div>
          </div>
      </section>
    </div>
  )
}
