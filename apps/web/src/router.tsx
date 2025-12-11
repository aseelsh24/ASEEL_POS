import { Navigate, Route, Routes } from 'react-router-dom'
import PosPage from './pages/PosPage'
import ProductsPage from './pages/ProductsPage'
import PurchasesPage from './pages/PurchasesPage'
import ReturnsPage from './pages/ReturnsPage'
import ReportsPage from './pages/ReportsPage'
import SettingsPage from './pages/SettingsPage'

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/pos" replace />} />
      <Route path="/pos" element={<PosPage />} />
      <Route path="/products" element={<ProductsPage />} />
      <Route path="/purchases" element={<PurchasesPage />} />
      <Route path="/returns" element={<ReturnsPage />} />
      <Route path="/reports" element={<ReportsPage />} />
      <Route path="/settings" element={<SettingsPage />} />
    </Routes>
  )
}
