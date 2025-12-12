import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '../api/authApi'
import { useAppState } from '../state/AppStateProvider'

export default function LoginPage() {
  const navigate = useNavigate()
  const { markAuthenticated } = useAppState()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const result = await login(username.trim(), password)
    setSubmitting(false)
    if (result.success) {
      markAuthenticated(username.trim())
      navigate('/pos', { replace: true })
    } else {
      setError(result.error ?? 'اسم المستخدم أو كلمة المرور غير صحيحة')
    }
  }

  return (
    <div className="page" dir="rtl" style={{ maxWidth: 360, margin: '0 auto' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '1rem' }}>تسجيل الدخول</h1>
      <form onSubmit={handleSubmit} className="card" style={{ padding: '1rem', display: 'grid', gap: '0.75rem' }}>
        <label style={{ display: 'grid', gap: 4 }}>
          <span>اسم المستخدم</span>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoComplete="username"
            dir="rtl"
          />
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          <span>كلمة المرور</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            dir="rtl"
          />
        </label>
        {error && (
          <div role="alert" style={{ color: 'darkred', fontWeight: 600 }}>
            {error}
          </div>
        )}
        <button type="submit" disabled={submitting}>
          {submitting ? '... جارٍ التحقق' : 'دخول'}
        </button>
      </form>
    </div>
  )
}
