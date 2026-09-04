import { Link, useNavigate } from 'react-router-dom'

interface HeaderProps {
  adminMode?: boolean
  showBack?: boolean
  backTo?: string
  title?: string
}

export default function Header({ adminMode, showBack, backTo = '/', title }: HeaderProps) {
  const navigate = useNavigate()

  const handleAdminLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' })
    navigate('/admin/login')
  }

  return (
    <header className="bg-[#0057A8] text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {showBack && (
            <button
              onClick={() => navigate(backTo)}
              className="text-white/80 hover:text-white text-2xl leading-none"
              aria-label="Back"
            >
              &#8592;
            </button>
          )}
          <div>
            <div className="font-bold text-lg leading-tight">
              {title ?? 'Nonmove Stock KPI'}
            </div>
            <div className="text-xs text-blue-200 leading-tight">
              Sell-out department, Haier Thailand
            </div>
          </div>
        </div>

        {adminMode && (
          <nav className="flex items-center gap-4 text-sm">
            <Link to="/admin" className="hover:text-blue-200">Dashboard</Link>
            <Link to="/admin/import" className="hover:text-blue-200">Import</Link>
            <Link to="/admin/requests" className="hover:text-blue-200">Requests</Link>
            <Link to="/admin/kpi-rate" className="hover:text-blue-200">KPI Rate</Link>
            <Link to="/admin/export" className="hover:text-blue-200">Export</Link>
            <Link to="/admin/settings" className="hover:text-blue-200">Settings</Link>
            <button
              onClick={handleAdminLogout}
              className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded text-sm"
            >
              Logout
            </button>
          </nav>
        )}
      </div>
    </header>
  )
}
