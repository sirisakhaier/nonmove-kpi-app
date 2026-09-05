import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import { api } from '../../lib/api'
import Header from '../../components/Header'
import PeriodChip from '../../components/PeriodChip'
import imageCompression from 'browser-image-compression'

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

  const [item, setItem] = useState<any>(state?.item || null)
  const [snapshotDate, setSnapshotDate] = useState<string>(state?.snapshotDate || '')
  const [loadingItem, setLoadingItem] = useState(!state?.item && !!snapshotId)

  const [reason, setReason] = useState('')
  const [detail, setDetail] = useState('')
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0])
  const [clearPlan, setClearPlan] = useState('')
  const [clearPlanDate, setClearPlanDate] = useState('')
  const [photos, setPhotos] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [compressing, setCompressing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Fetch item details if opened directly without state
  useEffect(() => {
    if (!item && snapshotId) {
      setLoadingItem(true)
      api.getStockItem(snapshotId)
        .then(res => {
          setItem(res.item)
          setSnapshotDate(res.item.snapshot_date)
        })
        .catch(err => {
          setError('ไม่พบข้อมูลสินค้ารายการนี้: ' + err.message)
        })
        .finally(() => setLoadingItem(false))
    }
  }, [snapshotId, item])

  const handlePhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFiles = Array.from(e.target.files ?? [])
    if (rawFiles.length === 0) return
    
    const remaining = 3 - photos.length
    const toAdd = rawFiles.slice(0, remaining)
    setCompressing(true)

    try {
      const compressedFiles: File[] = []
      const newPreviews: string[] = []

      for (const file of toAdd) {
        // Compress image to under 1MB / max 1920px
        const options = {
          maxSizeMB: 0.8,
          maxWidthOrHeight: 1600,
          useWebWorker: true,
        }
        let processedFile = file
        try {
          processedFile = await imageCompression(file, options)
        } catch {
          // fallback to original file if compression fails
        }
        compressedFiles.push(processedFile)
        
        // Generate preview
        const dataUrl = await imageCompression.getDataUrlFromFile(processedFile)
        newPreviews.push(dataUrl)
      }

      setPhotos(prev => [...prev, ...compressedFiles])
      setPreviews(prev => [...prev, ...newPreviews])
    } catch (err: any) {
      setError('เกิดข้อผิดพลาดในการโหลดรูปภาพ: ' + err.message)
    } finally {
      setCompressing(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const removePhoto = (idx: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== idx))
    setPreviews(prev => prev.filter((_, i) => i !== idx))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!reason) { setError('กรุณาเลือกเหตุผลในการขอยกเว้น'); return }
    if (!detail.trim()) { setError('กรุณากรอกรายละเอียดของปัญหา'); return }
    if (photos.length === 0) { setError('กรุณาแนบรูปภาพประกอบอย่างน้อย 1 รูป'); return }
    if (!clearPlan.trim()) { setError('กรุณากรอกแผนการดำเนินการแก้ไข'); return }
    if (!clearPlanDate) { setError('กรุณาระบุวันที่คาดว่าจะแก้ไขได้'); return }

    setSubmitting(true)
    try {
      const form = new FormData()
      form.append('stock_snapshot_id', String(item?.id ?? snapshotId ?? ''))
      form.append('snapshot_date', snapshotDate || (item?.snapshot_date ?? ''))
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
      setError(err.message ?? 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header title="ส่งคำขอแล้ว" showBack backTo="/store" />
        <div className="max-w-md w-full mx-auto px-6 py-16 text-center flex-1 flex flex-col justify-center items-center">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-4xl mb-4 shadow-sm">
            ✓
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">ส่งคำขอเรียบร้อยแล้ว</h2>
          <p className="text-gray-500 text-sm mb-8 leading-relaxed">
            คำขอของคุณสำหรับรุ่น <strong>{item?.model}</strong> ได้ถูกส่งให้ Admin ตรวจสอบแล้ว สถานะปัจจุบันคือ &quot;รอพิจารณา&quot;
          </p>
          <div className="w-full space-y-3">
            <button
              onClick={() => navigate('/store/my-requests')}
              className="w-full bg-[#0057A8] text-white py-3.5 rounded-xl font-bold text-sm shadow-sm"
            >
              ดูประวัติคำขอของฉัน
            </button>
            <button
              onClick={() => navigate('/store')}
              className="w-full bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold text-sm hover:bg-gray-200 transition-colors"
            >
              กลับหน้ารายการสินค้า Nonmove
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col pb-28">
      <Header title="ขอยกเว้น Nonmove" showBack backTo="/store" />

      {loadingItem ? (
        <div className="p-8 text-center text-gray-400">
          <div className="animate-spin text-3xl mb-2">⏳</div>
          <div>กำลังโหลดข้อมูลสินค้า...</div>
        </div>
      ) : (
        <>
          {/* SKU Info Card */}
          {item && (
            <div className="bg-white border-b border-gray-200 px-4 py-3.5 shadow-2xs">
              <div className="max-w-lg mx-auto flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-black text-lg text-gray-900 leading-tight truncate">
                    {item.model}
                  </div>
                  <div className="text-xs text-gray-600 mt-0.5 truncate">{item.product_name || '-'}</div>
                  <div className="text-[11px] text-gray-400 mt-1">
                    {item.product_code ? `รหัส: ${item.product_code} · ` : ''}
                    จำนวน: {item.stock_qty ?? 1} เครื่อง
                  </div>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-1">
                  <PeriodChip period={item.nonmove_period} />
                  <span className="text-xs font-bold text-gray-700">
                    ฿{item.stock_amount?.toLocaleString('th-TH') ?? 0}
                  </span>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="max-w-lg w-full mx-auto px-4 py-4 space-y-4 flex-1">
            {/* Reason selection */}
            <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-2xs space-y-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">
                1. สาเหตุที่ขอยกเว้น <span className="text-red-500">*</span>
              </label>
              <select
                value={reason}
                onChange={e => setReason(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0057A8] bg-gray-50/50"
                required
              >
                <option value="">-- กรุณาเลือกเหตุผล --</option>
                {REASONS.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            {/* Detail explanation */}
            <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-2xs space-y-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">
                2. รายละเอียดปัญหา <span className="text-red-500">*</span>
              </label>
              <textarea
                value={detail}
                onChange={e => setDetail(e.target.value)}
                rows={3}
                placeholder="ระบุรายละเอียด เช่น ลูกค้าจองแล้วรอส่งมอบบ้านเสร็จสิ้นเดือน, สินค้าชำรุดรอส่งเคลม..."
                className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0057A8] resize-none bg-gray-50/50"
                required
              />
            </div>

            {/* Issue date */}
            <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-2xs space-y-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">
                3. วันที่เกิดปัญหา / วันที่ลูกค้าซื้อ <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={issueDate}
                onChange={e => setIssueDate(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0057A8] bg-gray-50/50"
                required
              />
            </div>

            {/* Photo attachments */}
            <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600">
                  4. รูปภาพประกอบ <span className="text-red-500">*</span> ({photos.length}/3)
                </label>
                <span className="text-[11px] text-gray-400">สูงสุด 3 รูป</span>
              </div>
              <p className="text-xs text-gray-500">
                ถ่ายรูป Serial Number, สภาพสินค้า, เอกสารใบสั่งซื้อ หรือหน้าจอระบบ
              </p>

              <div className="flex gap-2.5 flex-wrap pt-1">
                {previews.map((src, idx) => (
                  <div key={idx} className="relative group">
                    <img src={src} alt={`Preview ${idx + 1}`} className="w-24 h-24 object-cover rounded-xl border border-gray-200 shadow-2xs" />
                    <button
                      type="button"
                      onClick={() => removePhoto(idx)}
                      className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-6 h-6 text-xs flex items-center justify-center shadow-md font-bold"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                
                {photos.length < 3 && (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={compressing}
                    className="w-24 h-24 border-2 border-dashed border-blue-300 bg-blue-50/40 hover:bg-blue-50 rounded-xl flex flex-col items-center justify-center text-[#0057A8] text-xs gap-1 transition-colors active:scale-95"
                  >
                    {compressing ? (
                      <span className="animate-spin text-xl">⏳</span>
                    ) : (
                      <>
                        <span className="text-2xl">📸</span>
                        <span className="font-bold">เพิ่มรูป</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handlePhotos}
              />
            </div>

            {/* Clear Plan & Date */}
            <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-2xs space-y-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">
                  5. แผนการแก้ไข / เคลียร์สต็อก <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={clearPlan}
                  onChange={e => setClearPlan(e.target.value)}
                  rows={2}
                  placeholder="เช่น กำหนดส่งมอบสินค้าวันที่ 25, รอส่งคืนคลัง..."
                  className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0057A8] resize-none bg-gray-50/50"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">
                  วันที่คาดว่าจะแก้ไขได้สำเร็จ <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={clearPlanDate}
                  onChange={e => setClearPlanDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0057A8] bg-gray-50/50"
                  required
                />
              </div>
            </div>

            {/* Submitter Info */}
            <div className="bg-gray-200/70 rounded-xl p-3 text-xs text-gray-600 flex items-center justify-between">
              <span>👤 ผู้ส่งคำขอ:</span>
              <strong className="text-gray-800">{session?.name} ({session?.phone})</strong>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-medium rounded-xl p-3 text-center">
                {error}
              </div>
            )}
          </form>

          {/* Sticky Bottom Submit Button */}
          <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-200 p-3 z-30 shadow-lg">
            <div className="max-w-lg mx-auto">
              <button
                onClick={handleSubmit}
                disabled={submitting || compressing}
                className="w-full bg-[#0057A8] hover:bg-[#004A8F] active:bg-[#003D75] text-white font-bold py-3.5 rounded-xl text-base transition-all shadow-md disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <span className="animate-spin text-lg">⏳</span>
                    <span>กำลังส่งคำขอ...</span>
                  </>
                ) : (
                  <span>🚀 ยืนยันส่งคำขอยกเว้น Nonmove</span>
                )}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
