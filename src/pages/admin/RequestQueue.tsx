import { useState, useEffect, useCallback } from 'react'
import { api } from '../../lib/api'
import type { ExclusionRequest } from '../../types'
import Header from '../../components/Header'
import StatusChip from '../../components/StatusChip'
import { REASON_LABELS } from '../../lib/kpi'

const STATUSES = ['', 'pending', 'approved', 'rejected', 'needs_resubmit']
const STATUS_LABELS: Record<string, string> = {
  '': 'ทั้งหมด', pending: 'รอพิจารณา', approved: 'อนุมัติแล้ว',
  rejected: 'ไม่อนุมัติ', needs_resubmit: 'ต้องส่งใหม่',
}

export default function AdminRequestQueue() {
  const [requests, setRequests] = useState<ExclusionRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<ExclusionRequest | null>(null)
  const [comment, setComment] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [filters, setFilters] = useState({ status: '', region: '' })
  const [regions, setRegions] = useState<string[]>([])
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [actionDone, setActionDone] = useState('')

  useEffect(() => {
    api.getRegions().then(setRegions).catch(console.error)
  }, [])

  const loadRequests = useCallback(async () => {
    setLoading(true)
    const params: Record<string, string> = {}
    if (filters.status) params.status = filters.status
    if (filters.region) params.region = filters.region
    try {
      const data = await api.adminGetRequests(params)
      setRequests(data)
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => { loadRequests() }, [loadRequests])

  const doAction = async (action: 'approve' | 'reject' | 'needs_resubmit' | 'delete') => {
    if (!selected) return
    if ((action === 'reject' || action === 'needs_resubmit') && !comment.trim()) {
      alert('กรุณากรอก Admin Comment')
      return
    }
    setActionLoading(true)
    try {
      if (action === 'approve') await api.adminApprove(selected.id)
      else if (action === 'reject') await api.adminReject(selected.id, comment)
      else if (action === 'needs_resubmit') await api.adminNeedsResubmit(selected.id, comment)
      else if (action === 'delete') {
        if (!deleteConfirm) { setDeleteConfirm(true); setActionLoading(false); return }
        await api.adminDeleteRequest(selected.id)
        setSelected(null)
        setDeleteConfirm(false)
      }
      setActionDone(action)
      setComment('')
      setTimeout(() => setActionDone(''), 2000)
      await loadRequests()
      if (action !== 'delete' && selected) {
        const updated = await api.adminGetRequest(selected.id).catch(() => null)
        if (updated) setSelected(updated)
      }
    } catch (e: any) {
      alert(e.message ?? 'เกิดข้อผิดพลาด')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header adminMode title="Exclusion Requests" />
      <div className="max-w-7xl mx-auto px-4 py-6 flex gap-4">

        {/* List panel */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-2 mb-4">
            {STATUSES.map(s => (
              <button
                key={s}
                onClick={() => setFilters(f => ({ ...f, status: s }))}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  filters.status === s
                    ? 'bg-[#0057A8] text-white border-[#0057A8]'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-[#0057A8]'
                }`}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
            <select
              value={filters.region}
              onChange={e => setFilters(f => ({ ...f, region: e.target.value }))}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
            >
              <option value="">ทุกภูมิภาค</option>
              {regions.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          {loading && (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white rounded-xl h-20 animate-pulse border border-gray-100" />
              ))}
            </div>
          )}

          {!loading && requests.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <div className="text-4xl mb-3">📋</div>
              <div>ไม่มีคำขอในตอนนี้</div>
            </div>
          )}

          <div className="space-y-2">
            {requests.map(r => (
              <div
                key={r.id}
                onClick={() => { setSelected(r); setComment(''); setDeleteConfirm(false) }}
                className={`bg-white rounded-xl border p-4 cursor-pointer hover:border-[#0057A8] transition-colors ${
                  selected?.id === r.id ? 'border-[#0057A8] ring-1 ring-[#0057A8]' : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate text-gray-900">{r.model}</div>
                    <div className="text-sm text-gray-500">{(r as any).store_name} · {(r as any).region}</div>
                    <div className="text-xs text-gray-400 mt-1">{REASON_LABELS[r.reason] ?? r.reason}</div>
                    <div className="text-xs text-gray-400">
                      {new Date(r.created_at).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                  <StatusChip status={r.status} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="w-96 shrink-0">
            <div className="bg-white rounded-xl border border-gray-200 p-5 sticky top-4 max-h-screen overflow-y-auto">
              <div className="flex items-start justify-between mb-4">
                <div className="min-w-0">
                  <div className="font-bold text-lg leading-tight">{selected.model}</div>
                  <div className="text-sm text-gray-500 truncate">{selected.product_name}</div>
                </div>
                <StatusChip status={selected.status} />
              </div>

              <div className="space-y-1.5 text-sm text-gray-700 mb-4 divide-y divide-gray-100">
                {[
                  ['Store', (selected as any).store_name],
                  ['Region', (selected as any).region],
                  ['เหตุผล', REASON_LABELS[selected.reason] ?? selected.reason],
                  ['รายละเอียด', selected.reason_detail],
                  ['วันที่เกิดเหตุ', selected.issue_date],
                  ['แผนการ', selected.clear_plan],
                  ['วันที่แก้ไข', selected.clear_plan_date],
                  ['ผู้ส่ง', `${selected.requester_name} (${selected.requester_phone})`],
                  ['ส่งเมื่อ', new Date(selected.created_at).toLocaleDateString('th-TH')],
                ].map(([label, val]) => val ? (
                  <div key={label} className="pt-1.5">
                    <span className="font-medium text-gray-500">{label}: </span>
                    <span>{val}</span>
                  </div>
                ) : null)}
              </div>

              {/* Photos */}
              {selected.photos && selected.photos.length > 0 && (
                <div className="mb-4">
                  <div className="text-sm font-medium text-gray-600 mb-2">รูปภาพ:</div>
                  <div className="flex gap-2 flex-wrap">
                    {selected.photos.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noreferrer">
                        <img
                          src={url}
                          alt={`Photo ${i + 1}`}
                          className="w-20 h-20 object-cover rounded-lg border hover:opacity-80 transition-opacity"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Admin comment input */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Admin Comment</label>
                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#0057A8]"
                  placeholder="Required for Reject / Needs Resubmit"
                />
              </div>

              {actionDone && (
                <div className="mb-3 text-green-600 text-sm font-medium">✅ Done: {actionDone}</div>
              )}

              {/* Action buttons */}
              <div className="space-y-2">
                <button
                  onClick={() => doAction('approve')}
                  disabled={actionLoading}
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60 transition-colors"
                >
                  ✅ Approve
                </button>
                <button
                  onClick={() => doAction('needs_resubmit')}
                  disabled={actionLoading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60 transition-colors"
                >
                  🔄 Needs Resubmit
                </button>
                <button
                  onClick={() => doAction('reject')}
                  disabled={actionLoading}
                  className="w-full bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60 transition-colors"
                >
                  ❌ Reject
                </button>
                {deleteConfirm ? (
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => doAction('delete')}
                      className="flex-1 bg-gray-800 text-white py-2 rounded-lg text-sm font-semibold"
                    >ยืนยันลบ</button>
                    <button
                      onClick={() => setDeleteConfirm(false)}
                      className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg text-sm"
                    >ยกเลิก</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteConfirm(true)}
                    className="w-full text-gray-400 hover:text-red-600 py-1 text-xs underline transition-colors"
                  >
                    🗑️ Delete request
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
