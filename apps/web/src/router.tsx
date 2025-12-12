import type { ReactElement } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import PosPage from './pages/PosPage'
import ProductsPage from './pages/ProductsPage'
import PurchasesPage from './pages/PurchasesPage'
import ReturnsPage from './pages/ReturnsPage'
import ReportsPage from './pages/ReportsPage'
import SettingsPage from './pages/SettingsPage'
import FirstRunWizardPage from './pages/FirstRunWizardPage'
import { useAppState } from './state/AppStateProvider'

export function AppRouter() {
  const { settingsInitialized, settingsLoading } = useAppState()

  if (settingsLoading) {
    return <div aria-live="polite">... جارِ التحقق من الإعدادات</div>
  }

  const guard = (element: ReactElement) =>
    settingsInitialized ? element : <Navigate to="/first-run" replace />

  return (
    <Routes>
      <Route
        path="/"
        element={<Navigate to={settingsInitialized ? '/pos' : '/first-run'} replace />}
      />
      <Route path="/first-run" element={<FirstRunWizardPage />} />
      <Route path="/pos" element={guard(<PosPage />)} />
      <Route path="/products" element={guard(<ProductsPage />)} />
      <Route path="/purchases" element={guard(<PurchasesPage />)} />
      <Route path="/returns" element={guard(<ReturnsPage />)} />
      <Route path="/reports" element={guard(<ReportsPage />)} />
      <Route path="/settings" element={guard(<SettingsPage />)} />
    </Routes>
  )
}
