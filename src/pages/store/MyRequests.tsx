import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import type { ExclusionRequest } from '../../types'
import Header from '../../components/Header'
import StatusChip from '../../components/StatusChip'
import { REASON_LABELS } from '../../lib/kpi'

export default function MyRequests() {
  const navigate = useNavigate()
  const [requests, setRequests] = useState<ExclusionRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null)

  useEffect(() => {
    api.getMyRequests()
      .then(setRequests)
      .catch(e => setError(e.message ?? 'ไม่สามารถโหลดข้อมูลได้'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col pb-12">
      <Header title="คำขอของฉัน" subtitle="ประวัติการยื่นขอยกเว้น Nonmove" showBack backTo="/store" />

      <div className="max-w-lg w-full mx-auto px-4 py-4 space-y-3 flex-1">
        {loading && (
          <div className="py-8 text-center text-gray-400 space-y-3">
            <div className="animate-spin text-3xl">⏳</div>
            <div>กำลังโหลดข้อมูล...</div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-2xl p-4 text-center">
            {error}
          </div>
        )}

        {!loading && requests.length === 0 && !error && (
          <div className="py-16 text-center text-gray-400 bg-white rounded-2xl border border-gray-200 p-8 my-4">
            <div className="text-5xl mb-3">📋</div>
            <div className="font-bold text-gray-700 text-base">ยังไม่มีประวัติการยื่นคำขอ</div>
            <div className="text-xs text-gray-500 mt-1">
              คุณสามารถยื่นคำขอยกเว้นรายการ Nonmove ได้จากหน้ารายการสินค้า
            </div>
            <button
              onClick={() => navigate('/store')}
              className="mt-6 bg-[#0057A8] text-white px-6 py-2.5 rounded-xl font-bold text-xs"
            >
              ไปที่รายการ Nonmove
            </button>
          </div>
        )}

        {requests.map(r => (
          <div key={r.id} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-2xs space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-bold text-base text-gray-900 leading-tight truncate">{r.model}</div>
                <div className="text-xs text-gray-500 mt-0.5 truncate">{r.product_name || '-'}</div>
                <div className="text-xs text-gray-700 font-medium mt-1">
                  สาเหตุ: <span className="font-semibold text-gray-900">{REASON_LABELS[r.reason] ?? r.reason}</span>
                </div>
              </div>
              <StatusChip status={r.status} />
            </div>

            <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-600 space-y-1">
              <div><strong className="text-gray-700">รายละเอียด:</strong> {r.reason_detail}</div>
              {r.clear_plan && (
                <div><strong className="text-gray-700">แผนแก้ไข:</strong> {r.clear_plan} ({r.clear_plan_date || '-'})</div>
              )}
              <div className="text-[11px] text-gray-400 pt-1">
                ยื่นเมื่อ: {new Date(r.created_at).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>

            {/* Photos thumbnail preview */}
            {r.photos && r.photos.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-gray-500 mb-1.5">รูปภาพที่แนบ ({r.photos.length} รูป):</div>
                <div className="flex gap-2 flex-wrap">
                  {r.photos.map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      alt={`Photo ${i + 1}`}
                      onClick={() => setSelectedPhoto(url)}
                      className="w-16 h-16 object-cover rounded-xl border border-gray-200 cursor-pointer hover:opacity-80 active:scale-95 transition-all"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Admin comment callout */}
            {r.admin_comment && (
              <div className={`rounded-xl p-3 text-xs border ${
                r.status === 'rejected'
                  ? 'bg-red-50 border-red-200 text-red-800'
                  : r.status === 'needs_resubmit'
                    ? 'bg-blue-50 border-blue-200 text-blue-800'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              }`}>
                <div className="font-bold mb-0.5">💬 ข้อความจาก Admin:</div>
                <div>{r.admin_comment}</div>
              </div>
            )}

            {/* Resubmit button for needs_resubmit */}
            {r.status === 'needs_resubmit' && (
              <button
                onClick={() => navigate(`/store/request/${r.stock_snapshot_id}`, {
                  state: { item: { id: r.stock_snapshot_id, model: r.model, product_name: r.product_name }, editRequest: r }
                })}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl text-xs font-bold shadow-xs transition-colors"
              >
                🔄 แก้ไขและส่งข้อมูลใหม่
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Photo Modal Zoom */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="relative max-w-lg w-full">
            <img src={selectedPhoto} alt="Zoomed" className="w-full h-auto max-h-[85vh] object-contain rounded-2xl shadow-2xl" />
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute top-2 right-2 bg-black/60 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
