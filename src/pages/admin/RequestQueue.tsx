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
  const [zoomPhoto, setZoomPhoto] = useState<string | null>(null)

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
      alert('กรุณากรอก Admin Comment ระบุเหตุผลให้ผู้ยื่นทราบ')
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
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Header adminMode title="รายการคำขอยกเว้น Nonmove" />

      <div className="max-w-7xl w-full mx-auto px-4 py-6 flex-1 flex flex-col lg:flex-row gap-6">
        {/* Left: Requests List Panel */}
        <div className="flex-1 min-w-0 space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {STATUSES.map(s => (
                <button
                  key={s}
                  onClick={() => setFilters(f => ({ ...f, status: s }))}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                    filters.status === s
                      ? 'bg-[#0057A8] text-white border-[#0057A8] shadow-xs'
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-[#0057A8]'
                  }`}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>

            <select
              value={filters.region}
              onChange={e => setFilters(f => ({ ...f, region: e.target.value }))}
              className="border border-gray-300 rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0057A8]"
            >
              <option value="">ทุกภูมิภาค</option>
              {regions.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          {loading && (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white rounded-2xl h-24 animate-pulse border border-gray-200" />
              ))}
            </div>
          )}

          {!loading && requests.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-400">
              <div className="text-5xl mb-3">📋</div>
              <div className="font-bold text-gray-700 text-base">ไม่พบรายการคำขอ</div>
              <div className="text-xs text-gray-500 mt-1">ไม่มีคำขอที่ตรงกับเงื่อนไขตัวกรอง</div>
            </div>
          )}

          <div className="space-y-2.5">
            {requests.map(r => {
              const isSelected = selected?.id === r.id
              return (
                <div
                  key={r.id}
                  onClick={() => { setSelected(r); setComment(''); setDeleteConfirm(false) }}
                  className={`bg-white rounded-2xl border p-4 cursor-pointer transition-all shadow-2xs hover:shadow-sm ${
                    isSelected
                      ? 'border-[#0057A8] ring-2 ring-[#0057A8]/20 bg-blue-50/10'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base text-gray-900 truncate">{r.model}</span>
                        <StatusChip status={r.status} />
                      </div>
                      <div className="text-xs text-gray-600 mt-0.5 font-medium">
                        {(r as any).store_name} · {(r as any).region}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        สาเหตุ: <strong className="text-gray-700">{REASON_LABELS[r.reason] ?? r.reason}</strong>
                      </div>
                      <div className="text-[11px] text-gray-400 mt-1 flex items-center gap-3">
                        <span>👤 {r.requester_name} ({r.requester_phone})</span>
                        <span>🗓️ {new Date(r.created_at).toLocaleDateString('th-TH')}</span>
                        {r.photos && r.photos.length > 0 && (
                          <span className="text-blue-600 font-bold">📸 {r.photos.length} รูป</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right: Selected Request Review Panel */}
        {selected ? (
          <div className="w-full lg:w-[420px] shrink-0">
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto space-y-4">
              <div className="flex items-start justify-between border-b border-gray-100 pb-3">
                <div className="min-w-0">
                  <div className="text-xs text-gray-400">คำขอเลขที่ #{selected.id}</div>
                  <div className="font-black text-xl text-gray-900 leading-tight truncate">{selected.model}</div>
                  <div className="text-xs text-gray-500 truncate mt-0.5">{selected.product_name || '-'}</div>
                </div>
                <StatusChip status={selected.status} />
              </div>

              {/* Information Rows */}
              <div className="space-y-2 text-xs text-gray-700 divide-y divide-gray-100">
                <div className="pt-1 flex justify-between">
                  <span className="text-gray-500 font-medium">สาขา:</span>
                  <span className="font-bold text-gray-900">{(selected as any).store_name}</span>
                </div>
                <div className="pt-2 flex justify-between">
                  <span className="text-gray-500 font-medium">ภูมิภาค:</span>
                  <span className="font-semibold text-gray-800">{(selected as any).region}</span>
                </div>
                <div className="pt-2 flex justify-between">
                  <span className="text-gray-500 font-medium">สาเหตุ:</span>
                  <span className="font-bold text-[#0057A8]">{REASON_LABELS[selected.reason] ?? selected.reason}</span>
                </div>
                <div className="pt-2">
                  <span className="text-gray-500 font-medium block mb-0.5">รายละเอียดปัญหา:</span>
                  <div className="bg-gray-50 p-2.5 rounded-xl text-gray-800 font-medium whitespace-pre-wrap">
                    {selected.reason_detail}
                  </div>
                </div>
                {selected.issue_date && (
                  <div className="pt-2 flex justify-between">
                    <span className="text-gray-500 font-medium">วันที่เกิดเหตุ:</span>
                    <span>{selected.issue_date}</span>
                  </div>
                )}
                {selected.clear_plan && (
                  <div className="pt-2">
                    <span className="text-gray-500 font-medium block mb-0.5">แผนการแก้ไข:</span>
                    <div className="bg-gray-50 p-2.5 rounded-xl text-gray-800">
                      {selected.clear_plan} ({selected.clear_plan_date ? `กำหนด: ${selected.clear_plan_date}` : ''})
                    </div>
                  </div>
                )}
                <div className="pt-2 flex justify-between">
                  <span className="text-gray-500 font-medium">ผู้ส่งคำขอ:</span>
                  <span className="font-semibold">{selected.requester_name} ({selected.requester_phone})</span>
                </div>
              </div>

              {/* Attached Photos */}
              <div>
                <div className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>📸 รูปภาพประกอบ ({selected.photos?.length ?? 0} รูป)</span>
                  <span className="text-[10px] text-gray-400 font-normal">คลิกที่รูปเพื่อขยาย</span>
                </div>
                {selected.photos && selected.photos.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                    {selected.photos.map((url, i) => (
                      <div
                        key={i}
                        onClick={() => setZoomPhoto(url)}
                        className="relative group cursor-pointer aspect-square rounded-xl overflow-hidden border border-gray-200 bg-gray-100 hover:opacity-90 shadow-2xs"
                      >
                        <img
                          src={url}
                          alt={`Evidence ${i + 1}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-all"
                        />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition-opacity">
                          🔍 ขยาย
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-gray-50 p-4 rounded-xl text-center text-xs text-gray-400">
                    ไม่มีรูปภาพแนบ
                  </div>
                )}
              </div>

              {/* Admin Comment Input */}
              <div className="space-y-1 pt-1">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                  ข้อความตอบกลับ (Admin Comment)
                </label>
                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  rows={2}
                  placeholder="จำเป็นสำหรับ ไม่อนุมัติ / ขอข้อมูลเพิ่ม"
                  className="w-full border border-gray-300 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#0057A8] resize-none bg-gray-50/50"
                />
              </div>

              {actionDone && (
                <div className="text-emerald-700 bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl text-xs font-bold text-center">
                  ✓ ดำเนินการเรียบร้อย: {actionDone}
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-2 pt-2 border-t border-gray-100">
                <button
                  onClick={() => doAction('approve')}
                  disabled={actionLoading}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white py-2.5 rounded-xl text-xs font-bold shadow-xs transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5"
                >
                  <span>✓</span>
                  <span>อนุมัติคำขอ (Approve)</span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => doAction('needs_resubmit')}
                    disabled={actionLoading}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-xl text-xs font-bold shadow-xs transition-colors disabled:opacity-60"
                  >
                    🔄 ขอข้อมูลเพิ่ม
                  </button>
                  <button
                    onClick={() => doAction('reject')}
                    disabled={actionLoading}
                    className="w-full bg-rose-600 hover:bg-rose-700 text-white py-2 rounded-xl text-xs font-bold shadow-xs transition-colors disabled:opacity-60"
                  >
                    ✕ ไม่อนุมัติ
                  </button>
                </div>

                {deleteConfirm ? (
                  <div className="flex gap-2 pt-2 border-t border-gray-100">
                    <button
                      onClick={() => doAction('delete')}
                      className="flex-1 bg-gray-900 hover:bg-black text-white py-2 rounded-xl text-xs font-bold"
                    >
                      ยืนยันลบคำขอ
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(false)}
                      className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-xl text-xs font-semibold"
                    >
                      ยกเลิก
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteConfirm(true)}
                    className="w-full text-gray-400 hover:text-rose-600 pt-2 text-[11px] underline text-center block transition-colors"
                  >
                    🗑️ ลบคำขอนี้ออกจากระบบ
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="hidden lg:flex w-[420px] shrink-0 bg-white/60 border border-dashed border-gray-300 rounded-2xl items-center justify-center p-8 text-center text-gray-400">
            <div>
              <div className="text-4xl mb-2">👈</div>
              <div className="font-bold text-sm text-gray-600">เลือกคำขอจากรายการ</div>
              <div className="text-xs text-gray-400 mt-0.5">เพื่อตรวจสอบรูปภาพและอนุมัติ / ปฏิเสธ</div>
            </div>
          </div>
        )}
      </div>

      {/* Image Modal Lightbox Zoom */}
      {zoomPhoto && (
        <div
          className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => setZoomPhoto(null)}
        >
          <div className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center">
            <img
              src={zoomPhoto}
              alt="Enlarged evidence"
              className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl"
            />
            <button
              onClick={() => setZoomPhoto(null)}
              className="mt-3 bg-white/20 hover:bg-white/30 text-white px-5 py-2 rounded-full text-xs font-bold backdrop-blur-sm"
            >
              ✕ ปิดหน้าต่างขยายรูป
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
