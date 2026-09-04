import { useState, useRef } from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import { api } from '../../lib/api'
import Header from '../../components/Header'
import PeriodChip from '../../components/PeriodChip'

const REASONS = [
  { value: 'sold_wait_delivery', label: 'ขายแล้ว รอส่งมอบ' },
  { value: 'demo_unit', label: 'สินค้าโชว์ (Demo unit)' },
  { value: 'damaged', label: 'สินค้าชำรุด' },
  { value: 'system_error', label: 'ข้อมูลระบบไม่ตรงกับสต็อกจริง' },
  { value: 'other', label: 'อื่นๆ' },
]

export default function RequestForm() {
  const { snapshotId } = useParams()
  const { state } = useLocation()
  const navigate = useNavigate()
  const sessionStr = sessionStorage.getItem('pc_session')
  const session = sessionStr ? JSON.parse(sessionStr) : null

  const item = state?.item
  const snapshotDate = state?.snapshotDate

  const [reason, setReason] = useState('')
  const [detail, setDetail] = useState('')
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0])
  const [clearPlan, setClearPlan] = useState('')
  const [clearPlanDate, setClearPlanDate] = useState('')
  const [photos, setPhotos] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handlePhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    const remaining = 3 - photos.length
    const toAdd = files.slice(0, remaining)
    setPhotos(prev => [...prev, ...toAdd])
    toAdd.forEach(f => {
      const reader = new FileReader()
      reader.onload = ev => setPreviews(prev => [...prev, ev.target?.result as string])
      reader.readAsDataURL(f)
    })
  }

  const removePhoto = (idx: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== idx))
    setPreviews(prev => prev.filter((_, i) => i !== idx))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!reason) { setError('กรุณาเลือกเหตุผล'); return }
    if (!detail.trim()) { setError('กรุณากรอกรายละเอียด'); return }
    if (photos.length === 0) { setError('กรุณาถ่ายรูปอย่างน้อย 1 รูป'); return }
    if (!clearPlan.trim()) { setError('กรุณากรอกแผนการดำเนินการ'); return }
    if (!clearPlanDate) { setError('กรุณาระบุวันที่คาดว่าจะแก้ไขได้'); return }

    setSubmitting(true)
    try {
      const form = new FormData()
      form.append('stock_snapshot_id', String(item?.id ?? ''))
      form.append('snapshot_date', snapshotDate ?? '')
      form.append('model', item?.model ?? '')
      form.append('product_name', item?.product_name ?? '')
      form.append('reason', reason)
      form.append('reason_detail', detail)
      form.append('issue_date', issueDate)
      form.append('clear_plan', clearPlan)
      form.append('clear_plan_date', clearPlanDate)
      photos.forEach(p => form.append('photos', p))

      await api.createRequest(form)
      setSuccess(true)
    } catch (err: any) {
      setError(err.message ?? 'เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="ส่งคำขอแล้ว" showBack backTo="/store" />
        <div className="max-w-md mx-auto px-4 py-12 text-center">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">ส่งคำขอเรียบร้อยแล้ว</h2>
          <p className="text-gray-500 text-sm mb-8">คำขอของคุณอยู่ในสถานะ &quot;รอพิจารณา&quot;</p>
          <button
            onClick={() => navigate('/store')}
            className="bg-[#0057A8] text-white px-8 py-3 rounded-xl font-semibold"
          >
            กลับหน้าหลัก
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="ขอยกเว้น Nonmove" showBack backTo="/store" />

      {/* SKU Info Card */}
      {item && (
        <div className="bg-white border-b border-gray-200 px-4 py-3">
          <div className="flex items-start justify-between">
            <div>
              <div className="font-bold text-gray-900">{item.model}</div>
              <div className="text-sm text-gray-500">{item.product_name}</div>
              <div className="text-xs text-gray-400 mt-1">{item.product_code}</div>
            </div>
            <PeriodChip period={item.nonmove_period} />
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="max-w-lg mx-auto px-4 py-4 space-y-4 pb-24">
        {/* Reason */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">เหตุผล *</label>
          <select
            value={reason}
            onChange={e => setReason(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#0057A8]"
            required
          >
            <option value="">-- เลือกเหตุผล --</option>
            {REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>

        {/* Detail */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">รายละเอียด *</label>
          <textarea
            value={detail}
            onChange={e => setDetail(e.target.value)}
            rows={3}
            placeholder="อธิบายรายละเอียดของปัญหา"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#0057A8] resize-none"
            required
          />
        </div>

        {/* Issue Date */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">วันที่เกิดเหตุ *</label>
          <input
            type="date"
            value={issueDate}
            onChange={e => setIssueDate(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#0057A8]"
            required
          />
        </div>

        {/* Photos */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            รูปภาพประกอบ * ({photos.length}/3)
          </label>
          <div className="flex gap-2 flex-wrap">
            {previews.map((src, idx) => (
              <div key={idx} className="relative">
                <img src={src} alt="" className="w-24 h-24 object-cover rounded-lg border" />
                <button
                  type="button"
                  onClick={() => removePhoto(idx)}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center"
                >×</button>
              </div>
            ))}
            {photos.length < 3 && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 text-xs gap-1 active:bg-gray-50"
              >
                <span className="text-2xl">📷</span>
                <span>ถ่ายรูป</span>
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="hidden"
            onChange={handlePhotos}
          />
        </div>

        {/* Clear Plan */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">แผนการดำเนินการ *</label>
          <textarea
            value={clearPlan}
            onChange={e => setClearPlan(e.target.value)}
            rows={3}
            placeholder="จะดำเนินการอย่างไรเพื่อแก้ไขปัญหา"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#0057A8] resize-none"
            required
          />
        </div>

        {/* Clear Plan Date */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">วันที่คาดว่าจะแก้ไขได้ *</label>
          <input
            type="date"
            value={clearPlanDate}
            onChange={e => setClearPlanDate(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#0057A8]"
            required
          />
        </div>

        {/* Submitted by (read-only) */}
        <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-600">
          <span className="font-medium">ผู้ส่ง:</span> {session?.name} ({session?.phone})
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        {/* Submit */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3">
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#0057A8] hover:bg-[#004A8F] text-white font-semibold py-4 rounded-xl text-base transition-colors disabled:opacity-60"
          >
            {submitting ? 'กำลังส่งคำขอ...' : 'ส่งคำขอยกเว้น Nonmove'}
          </button>
        </div>
      </form>
    </div>
  )
}
