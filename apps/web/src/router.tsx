import type { ReactElement } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import PosPage from './pages/PosPage'
import ProductsPage from './pages/ProductsPage'
import PurchasesPage from './pages/PurchasesPage'
import ReturnsPage from './pages/ReturnsPage'
import ReportsPage from './pages/ReportsPage'
import SettingsPage from './pages/SettingsPage'
import FirstRunWizardPage from './pages/FirstRunWizardPage'
import LoginPage from './pages/LoginPage'
import { useAppState } from './state/AppStateProvider'

export function AppRouter() {
  const { settingsInitialized, settingsLoading, auth } = useAppState()

  if (settingsLoading) {
    return <div aria-live="polite">... جارِ التحقق من الإعدادات</div>
  }

  const guard = (element: ReactElement) => {
    if (!settingsInitialized) return <Navigate to="/first-run" replace />
    if (!auth.isAuthenticated) return <Navigate to="/login" replace />
    return element
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          settingsInitialized ? (
            auth.isAuthenticated ? <Navigate to="/pos" replace /> : <Navigate to="/login" replace />
          ) : (
            <Navigate to="/first-run" replace />
          )
        }
      />
      <Route path="/first-run" element={<FirstRunWizardPage />} />
      <Route
        path="/login"
        element={
          settingsInitialized ? (
            auth.isAuthenticated ? <Navigate to="/pos" replace /> : <LoginPage />
          ) : (
            <Navigate to="/first-run" replace />
          )
        }
      />
      <Route path="/pos" element={guard(<PosPage />)} />
      <Route path="/products" element={guard(<ProductsPage />)} />
      <Route path="/purchases" element={guard(<PurchasesPage />)} />
      <Route path="/returns" element={guard(<ReturnsPage />)} />
      <Route path="/reports" element={guard(<ReportsPage />)} />
      <Route path="/settings" element={guard(<SettingsPage />)} />
    </Routes>
  )
}
