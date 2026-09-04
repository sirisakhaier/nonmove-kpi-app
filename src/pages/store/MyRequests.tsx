import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import type { ExclusionRequest } from '../../types'
import Header from '../../components/Header'
import StatusChip from '../../components/StatusChip'
import { REASON_LABELS, formatAmount } from '../../lib/kpi'

export default function MyRequests() {
  const navigate = useNavigate()
  const [requests, setRequests] = useState<ExclusionRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.getMyRequests()
      .then(setRequests)
      .catch(e => setError(e.message ?? 'ไม่สามารถโหลดข้อมูลได้'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="คำขอของฉัน" showBack backTo="/store" />
      <div className="max-w-lg mx-auto px-4 py-4">
        {loading && <div className="py-8 text-center text-gray-400">กำลังโหลด...</div>}
        {error && <div className="text-red-500 text-sm py-4">{error}</div>}
        {!loading && requests.length === 0 && (
          <div className="py-12 text-center text-gray-400">
            <div className="text-4xl mb-3">📋</div>
            <div>ยังไม่มีคำขอ</div>
          </div>
        )}
        {requests.map(r => (
          <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-4 mb-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{r.model}</div>
                <div className="text-sm text-gray-500">{r.product_name}</div>
                <div className="text-xs text-gray-400 mt-1">{REASON_LABELS[r.reason] ?? r.reason}</div>
                <div className="text-xs text-gray-400">
                  {new Date(r.created_at).toLocaleDateString('th-TH')}
                </div>
              </div>
              <StatusChip status={r.status} />
            </div>
            {r.admin_comment && (
              <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm text-blue-800">
                <span className="font-medium">Admin: </span>{r.admin_comment}
              </div>
            )}
            {r.status === 'needs_resubmit' && (
              <button
                onClick={() => navigate(`/store/request/${r.stock_snapshot_id}`, {
                  state: { item: { id: r.stock_snapshot_id, model: r.model, product_name: r.product_name }, editRequest: r }
                })}
                className="mt-3 w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold"
              >
                แก้ไขและส่งใหม่
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
