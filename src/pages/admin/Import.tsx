import { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '../../lib/api'
import type { SnapshotDateInfo } from '../../types'
import Header from '../../components/Header'
import { formatAmount } from '../../lib/kpi'

export default function AdminImport() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')
  const [needsConfirm, setNeedsConfirm] = useState(false)

  // Snapshot dates management state
  const [snapshots, setSnapshots] = useState<SnapshotDateInfo[]>([])
  const [loadingSnapshots, setLoadingSnapshots] = useState(true)
  const [togglingDate, setTogglingDate] = useState<string | null>(null)
  const [deletingDate, setDeletingDate] = useState<string | null>(null)
  const [dateToDelete, setDateToDelete] = useState<string | null>(null)

  const loadSnapshots = useCallback(async () => {
    setLoadingSnapshots(true)
    try {
      const data = await api.adminGetSnapshots()
      setSnapshots(data)
    } catch (e: any) {
      console.error('Failed to load snapshots:', e)
    } finally {
      setLoadingSnapshots(false)
    }
  }, [])

  useEffect(() => {
    loadSnapshots()
  }, [loadSnapshots])

  const doImport = async (replace = false) => {
    if (!file) return
    setLoading(true)
    setError('')
    setResult(null)
    setNeedsConfirm(false)
    try {
      const form = new FormData()
      form.append('file', file)
      if (replace) form.append('replace', 'true')
      const r = await api.adminImport(form)
      setResult(r)
      setFile(null)
      await loadSnapshots()
    } catch (e: any) {
      if (e.message?.includes('already exists') || e.message?.includes('needs_confirm')) {
        setNeedsConfirm(true)
      } else {
        setError(e.message ?? 'Import failed')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = async (date: string, currentActive: number) => {
    setTogglingDate(date)
    try {
      const nextActive = currentActive === 1 ? 0 : 1
      await api.adminToggleSnapshot(date, nextActive)
      await loadSnapshots()
    } catch (e: any) {
      alert('เกิดข้อผิดพลาดในการเปลี่ยนสถานะ: ' + (e.message ?? 'Unknown error'))
    } finally {
      setTogglingDate(null)
    }
  }

  const handleDelete = async () => {
    if (!dateToDelete) return
    setDeletingDate(dateToDelete)
    try {
      await api.adminDeleteSnapshot(dateToDelete)
      setDateToDelete(null)
      await loadSnapshots()
    } catch (e: any) {
      alert('เกิดข้อผิดพลาดในการลบข้อมูล: ' + (e.message ?? 'Unknown error'))
    } finally {
      setDeletingDate(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col pb-16">
      <Header adminMode title="จัดการข้อมูล & นำเข้า Excel" />

      <div className="max-w-7xl w-full mx-auto px-4 py-8 space-y-8">
        {/* Top: Import Box & Summary Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Import Card */}
          <div className="lg:col-span-6 bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-1 flex items-center gap-2">
              <span>📥 นำเข้าไฟล์ Stock รายวัน (.xlsx)</span>
            </h2>
            <p className="text-xs text-gray-500 mb-4">
              อัปโหลดไฟล์ Excel ในรูปแบบ <code>Stock Daily GH for Nonmove KPI.xlsx</code> ระบบจะบันทึกข้อมูลและอัปเดตรายชื่อสาขาอัตโนมัติ
            </p>

            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center cursor-pointer hover:border-[#0057A8] hover:bg-blue-50/50 transition-all group"
            >
              <div className="text-4xl mb-2 group-hover:scale-110 transition-transform">📁</div>
              {file ? (
                <div>
                  <div className="font-bold text-gray-800 text-sm">{file.name}</div>
                  <div className="text-xs text-gray-400 mt-1">{(file.size / 1024).toFixed(1)} KB</div>
                </div>
              ) : (
                <div>
                  <div className="text-xs font-bold text-[#0057A8]">คลิกเพื่อเลือกไฟล์ Excel หรือลากไฟล์มาวาง</div>
                  <div className="text-[11px] text-gray-400 mt-1">รองรับนามสกุล .xlsx</div>
                </div>
              )}
            </div>

            <input
              ref={fileRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={e => {
                setFile(e.target.files?.[0] ?? null)
                setResult(null)
                setError('')
                setNeedsConfirm(false)
              }}
            />

            {needsConfirm && (
              <div className="mt-4 bg-amber-50 border border-amber-300 rounded-xl p-4 text-xs">
                <div className="text-amber-900 font-bold mb-1">⚠️ วันที่นี้มีข้อมูลอยู่ในระบบแล้ว</div>
                <p className="text-amber-700 mb-3 leading-relaxed">
                  คุณต้องการลบข้อมูลเดิมของวันที่นี้แล้วบันทึกข้อมูลใหม่แทนที่หรือไม่?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => doImport(true)}
                    className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-lg font-bold"
                  >
                    ยืนยันเขียนทับข้อมูลเดิม
                  </button>
                  <button
                    onClick={() => setNeedsConfirm(false)}
                    className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium"
                  >
                    ยกเลิก
                  </button>
                </div>
              </div>
            )}

            {error && !needsConfirm && (
              <div className="mt-4 text-rose-700 text-xs bg-rose-50 border border-rose-200 rounded-xl p-3">
                {error}
              </div>
            )}

            {result && (
              <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-xs text-emerald-800">
                <div className="font-bold mb-1 flex items-center gap-1.5">
                  <span>✓</span>
                  <span>นำเข้าข้อมูลสำเร็จ!</span>
                </div>
                <div className="space-y-0.5 mt-2">
                  <div>รอบวันที่: <strong>{result.date}</strong></div>
                  <div>จำนวนข้อมูลที่บันทึก: <strong>{result.rows_imported?.toLocaleString()} แถว</strong></div>
                  <div>สาขาที่อัปเดต: <strong>{result.stores_upserted} สาขา</strong></div>
                  {result.replaced && <div className="text-amber-700">*(เขียนทับข้อมูลเดิมเรียบร้อย)</div>}
                </div>
              </div>
            )}

            <button
              onClick={() => doImport(false)}
              disabled={!file || loading}
              className="mt-4 w-full bg-[#0057A8] hover:bg-[#004A8F] active:bg-[#003D75] text-white font-bold py-3 rounded-xl text-sm transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="animate-spin">⏳</span>
                  <span>กำลังประมวลผล...</span>
                </>
              ) : (
                <span>🚀 บันทึกข้อมูลเข้าสู่ระบบ</span>
              )}
            </button>
          </div>

          {/* Quick Guide Card */}
          <div className="lg:col-span-6 bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex flex-col justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">💡 คำแนะนำวันที่ในข้อมูล (Stock Dates Guide)</h2>
              <div className="text-xs text-gray-600 space-y-3 mt-3 leading-relaxed">
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                  <strong className="text-[#0057A8] block mb-1">1. การเปรียบเทียบ KPI:</strong>
                  ระบบจะใช้วันที่ 1 ของเดือน (หรือวันแรกสุดที่มีข้อมูลในเดือน) เป็น <strong>ยอดอ้างอิงต้นเดือน (1st Date of Month)</strong> และใช้วันที่ล่าสุดที่มีสถานะ Active เป็น <strong>ยอดประเมินผลล่าสุด (Latest Date)</strong>
                </div>

                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                  <strong className="text-emerald-800 block mb-1">2. การเปิด/ปิดสถานะ (Active / Inactive):</strong>
                  สามารถคลิกสวิตช์เพื่อปิดวันที่ยังไม่ต้องการนำมาคำนวณ KPI ได้โดยไม่ต้องลบข้อมูล
                </div>

                <div className="bg-rose-50 border border-rose-100 rounded-xl p-3">
                  <strong className="text-rose-800 block mb-1">3. การลบข้อมูลทั้งวันที่:</strong>
                  หากอัปโหลดไฟล์ผิด สามารถกดปุ่มลบข้อมูลทั้งหมดของวันที่นั้นได้ทันที
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom: Snapshot Dates Management Table (Requirement #5) */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-gray-100">
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <span>📅 จัดการวันที่ในข้อมูล ({snapshots.length} วันที่)</span>
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                เปิด/ปิดการใช้งาน หรือลบข้อมูลของแต่ละวันที่ในระบบ D1 Database
              </p>
            </div>
            <button
              onClick={loadSnapshots}
              className="self-start text-xs font-semibold text-[#0057A8] hover:bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200 transition-colors"
            >
              🔄 รีเฟรชรายการ
            </button>
          </div>

          {loadingSnapshots && (
            <div className="py-12 text-center text-gray-400 space-y-2">
              <div className="animate-spin text-3xl">⏳</div>
              <div className="text-xs">กำลังโหลดข้อมูล...</div>
            </div>
          )}

          {!loadingSnapshots && snapshots.length === 0 && (
            <div className="py-12 text-center text-gray-400">
              <div className="text-4xl mb-2">📂</div>
              <div className="font-bold text-gray-600 text-sm">ยังไม่มีข้อมูลในระบบ</div>
              <div className="text-xs text-gray-400 mt-1">กรุณานำเข้าไฟล์ Excel ด้านบน</div>
            </div>
          )}

          {!loadingSnapshots && snapshots.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 font-bold border-b border-gray-200">
                    <th className="py-3 px-4 rounded-l-xl">วันที่ในข้อมูล (Date)</th>
                    <th className="py-3 px-4 text-center">จำนวนข้อมูล (Rows)</th>
                    <th className="py-3 px-4 text-center">จำนวนสาขา (Stores)</th>
                    <th className="py-3 px-4 text-right">ยอดรวม Nonmove (THB)</th>
                    <th className="py-3 px-4 text-center">สถานะการใช้งาน</th>
                    <th className="py-3 px-4 text-center rounded-r-xl">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {snapshots.map(s => {
                    const isActive = s.is_active === 1
                    const isToggling = togglingDate === s.snapshot_date
                    const isDeleting = deletingDate === s.snapshot_date

                    return (
                      <tr key={s.snapshot_date} className={`hover:bg-gray-50 transition-colors ${!isActive ? 'opacity-50 bg-gray-50/50' : ''}`}>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-sm text-gray-900">{s.snapshot_date}</div>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="bg-gray-100 px-2.5 py-1 rounded-lg text-gray-700 font-bold">
                            {s.total_rows.toLocaleString()}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="text-gray-700 font-semibold">{s.store_count} สาขา</span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-gray-900">
                          ฿{formatAmount(s.total_amount)}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => handleToggle(s.snapshot_date, s.is_active)}
                            disabled={isToggling}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-2xs ${
                              isActive
                                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                            }`}
                          >
                            <span>{isActive ? '🟢 Active (ใช้งาน)' : '⚪ Inactive (ปิดอยู่)'}</span>
                            {isToggling && <span className="animate-spin text-[10px]">⏳</span>}
                          </button>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => setDateToDelete(s.snapshot_date)}
                            disabled={isDeleting}
                            className="bg-rose-50 hover:bg-rose-100 text-rose-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border border-rose-200"
                          >
                            🗑️ ลบทั้งวันที่
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {dateToDelete && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center text-2xl mx-auto">
              ⚠️
            </div>
            <div className="text-center">
              <h3 className="font-bold text-lg text-gray-900">ยืนยันลบข้อมูลวันที่ {dateToDelete}?</h3>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                ข้อมูลสต็อก Nonmove ทั้งหมดของวันที่ <strong>{dateToDelete}</strong> จะถูกลบออกจากระบบอย่างถาวร
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={handleDelete}
                disabled={!!deletingDate}
                className="bg-rose-600 hover:bg-rose-700 text-white py-2.5 rounded-xl text-xs font-bold shadow-xs"
              >
                {deletingDate ? 'กำลังลบ...' : 'ยืนยันลบข้อมูล'}
              </button>
              <button
                onClick={() => setDateToDelete(null)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-xl text-xs font-semibold"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
