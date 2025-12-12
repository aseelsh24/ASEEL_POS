import { useState } from 'react'
import type { FormEvent } from 'react'
import { verifyPassword } from '../api/authApi'
import { useAppState } from '../state/AppStateProvider'

export function IdleLockOverlay() {
  const { idleLock, auth, unlockIdle, recordActivity } = useAppState()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!idleLock.isLocked) return null

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const isValid = await verifyPassword(auth.username, password)
    setSubmitting(false)
    if (isValid) {
      unlockIdle()
      recordActivity()
      setPassword('')
    } else {
      setError('كلمة المرور غير صحيحة. حاول مرة أخرى.')
    }
  }

  return (
    <div className="idle-lock-overlay" role="dialog" aria-modal="true" dir="rtl">
      <div className="idle-lock-card">
        <h2>تم قفل النظام بسبب الخمول</h2>
        <p>أدخل كلمة المرور للمتابعة.</p>
        <form onSubmit={handleSubmit} className="idle-lock-form">
          <label className="form-field">
            <span>كلمة المرور</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
              dir="rtl"
            />
          </label>
          {error && (
            <div className="error-text" role="alert">
              {error}
            </div>
          )}
          <button type="submit" disabled={submitting}>
            {submitting ? '... جارٍ التحقق' : 'فتح القفل'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default IdleLockOverlay
