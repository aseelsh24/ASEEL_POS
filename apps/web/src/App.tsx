import { NavLink } from 'react-router-dom'
import { AppRouter } from './router'
import './App.css'

const navItems = [
  { path: '/pos', label: 'نقطة البيع' },
  { path: '/products', label: 'الأصناف' },
  { path: '/purchases', label: 'المشتريات' },
  { path: '/returns', label: 'المرتجعات' },
  { path: '/reports', label: 'التقارير' },
  { path: '/settings', label: 'الإعدادات' },
]

function App() {
  return (
    <div className="app-shell" dir="rtl">
      <header className="app-header">
        <div className="app-title">ASEEL POS</div>
        <nav className="app-nav" aria-label="التنقل الرئيسي">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `nav-link${isActive ? ' nav-link-active' : ''}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="app-content">
        <AppRouter />
      </main>
    </div>
  )
}

export default App
