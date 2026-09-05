import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { api } from '../lib/api'

interface HeaderProps {
  adminMode?: boolean
  showBack?: boolean
  backTo?: string
  title?: string
  subtitle?: string
}

export default function Header({ adminMode, showBack, backTo = '/', title, subtitle }: HeaderProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleAdminLogout = async () => {
    try {
      await api.adminLogout()
    } catch {}
    navigate('/admin/login')
  }

  const adminNav = [
    { to: '/admin', label: '📊 Dashboard' },
    { to: '/admin/requests', label: '📋 Requests' },
    { to: '/admin/import', label: '📁 Data & Import' },
    { to: '/admin/kpi-rate', label: '📈 KPI Rates' },
    { to: '/admin/export', label: '📥 Export/Bulk' },
    { to: '/admin/settings', label: '⚙️ Settings' },
  ]

  return (
    <header className="bg-[#0057A8] text-white shadow-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          {showBack && (
            <button
              onClick={() => navigate(backTo)}
              className="text-white hover:bg-white/10 w-9 h-9 rounded-full flex items-center justify-center text-xl shrink-0 transition-colors"
              aria-label="Back"
            >
              ←
            </button>
          )}
          <div className="min-w-0">
            <div className="font-bold text-base md:text-lg leading-tight truncate">
              {title ?? 'Nonmove Stock KPI'}
            </div>
            <div className="text-xs text-blue-200 leading-tight truncate">
              {subtitle ?? 'Haier Thailand · Sell-out Department'}
            </div>
          </div>
        </div>

        {adminMode && (
          <>
            {/* Desktop Admin Nav */}
            <nav className="hidden lg:flex items-center gap-1 text-sm font-medium">
              {adminNav.map(item => {
                const isActive = location.pathname === item.to
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`px-3 py-1.5 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-white/20 text-white font-semibold shadow-inner'
                        : 'text-blue-100 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {item.label}
                  </Link>
                )
              })}
              <button
                onClick={handleAdminLogout}
                className="ml-2 bg-red-600/80 hover:bg-red-600 px-3 py-1.5 rounded-lg text-sm transition-colors text-white"
              >
                Logout
              </button>
            </nav>

            {/* Mobile Hamburger for Admin */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden text-white p-2 rounded-lg hover:bg-white/10 text-xl"
              aria-label="Menu"
            >
              {mobileMenuOpen ? '✕' : '☰'}
            </button>
          </>
        )}
      </div>

      {/* Mobile menu dropdown for Admin */}
      {adminMode && mobileMenuOpen && (
        <div className="lg:hidden bg-[#004A8F] border-t border-blue-400/30 px-4 py-3 space-y-1">
          {adminNav.map(item => {
            const isActive = location.pathname === item.to
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-2 rounded-lg text-sm font-medium ${
                  isActive ? 'bg-white/20 text-white font-semibold' : 'text-blue-100 hover:bg-white/10'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
          <button
            onClick={handleAdminLogout}
            className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-red-200 hover:bg-red-600/30"
          >
            🚪 Logout
          </button>
        </div>
      )}
    </header>
  )
}
