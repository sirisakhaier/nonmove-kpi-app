import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import NonmoveList from './pages/store/NonmoveList'
import RequestForm from './pages/store/RequestForm'
import MyRequests from './pages/store/MyRequests'
import AdminLogin from './pages/admin/Login'
import AdminDashboard from './pages/admin/Dashboard'
import AdminImport from './pages/admin/Import'
import AdminRequestQueue from './pages/admin/RequestQueue'
import AdminKpiRateConfig from './pages/admin/KpiRateConfig'
import AdminExport from './pages/admin/Export'
import AdminSettings from './pages/admin/Settings'

function RequireSession({ children }: { children: React.ReactNode }) {
  const token = sessionStorage.getItem('pc_token')
  if (!token) return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* PC Flow */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/store" element={<RequireSession><NonmoveList /></RequireSession>} />
        <Route path="/store/request/:snapshotId" element={<RequireSession><RequestForm /></RequireSession>} />
        <Route path="/store/my-requests" element={<RequireSession><MyRequests /></RequireSession>} />

        {/* Admin Flow */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/import" element={<AdminImport />} />
        <Route path="/admin/requests" element={<AdminRequestQueue />} />
        <Route path="/admin/kpi-rate" element={<AdminKpiRateConfig />} />
        <Route path="/admin/export" element={<AdminExport />} />
        <Route path="/admin/settings" element={<AdminSettings />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
