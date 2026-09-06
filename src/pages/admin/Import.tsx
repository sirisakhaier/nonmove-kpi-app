import { useState, useEffect, useRef, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { api } from '../../lib/api'
import type { SnapshotDateInfo } from '../../types'
import Header from '../../components/Header'
import { formatAmount } from '../../lib/kpi'
import { extractExactDate } from '../../lib/excelDate'

interface DateGroup {
  date: string
  rowsCount: number
  rows: any[]
}

interface ParsedFileInfo {
  file: File
  dateGroups: DateGroup[]
  allDates: string[]
  totalRowsCount: number
  storesCount: number
  stores: any[]
}

export default function AdminImport() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [parsing, setParsing] = useState(false)
  const [fileInfo, setFileInfo] = useState<ParsedFileInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressText, setProgressText] = useState('')
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')
  const [duplicateDates, setDuplicateDates] = useState<SnapshotDateInfo[]>([])

  // Snapshot dates management state
  const [snapshots, setSnapshots] = useState<SnapshotDateInfo[]>([])
  const [loadingSnapshots, setLoadingSnapshots] = useState(true)
  const [togglingDate, setTogglingDate] = useState<string | null>(null)
  const [deletingDate, setDeletingDate] = useState<string | null>(null)
  const [dateToDelete, setDateToDelete] = useState<string | null>(null)
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false)
  const [deletingAll, setDeletingAll] = useState(false)

  const loadSnapshots = useCallback(async () => {
    setLoadingSnapshots(true)
    try {
      const data = await api.adminGetSnapshots()
      setSnapshots(data)
      return data
    } catch (e: any) {
      console.error('Failed to load snapshots:', e)
      return []
    } finally {
      setLoadingSnapshots(false)
    }
  }, [])

  useEffect(() => {
    loadSnapshots()
  }, [loadSnapshots])

  // Handle file selection and client-side parsing per row
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setParsing(true)
    setError('')
    setResult(null)
    setDuplicateDates([])
    setFileInfo(null)

    try {
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array' })
      const wsName = wb.SheetNames[0]
      const ws = wb.Sheets[wsName]
      const rawRows: any[] = XLSX.utils.sheet_to_json(ws)

      if (rawRows.length === 0) {
        throw new Error('ไฟล์ Excel ว่างเปล่า ไม่มีข้อมูล')
      }

      const storesMap = new Map<string, any>()
      const dateGroupsMap = new Map<string, any[]>()
      let lastKnownDate = ''

      for (let i = 0; i < rawRows.length; i++) {
        const r = rawRows[i]
        const row: Record<string, any> = {}
        for (const [k, v] of Object.entries(r)) {
          row[k.trim()] = v
        }

        const sid = String(row['Store Id'] ?? row['store_id'] ?? '').trim()
        const model = String(row['Model'] ?? row['model'] ?? '').trim()
        if (!sid || !model) continue

        // Extract exact date per row
        const dateRawVal = row['Date'] ?? row['date'] ?? row['DATE']
        let rowDate = extractExactDate(dateRawVal)
        if (!rowDate && lastKnownDate) {
          rowDate = lastKnownDate
        } else if (rowDate) {
          lastKnownDate = rowDate
        }

        if (!rowDate) {
          continue // skip row if no valid date found
        }

        // Collect stores
        if (!storesMap.has(sid)) {
          storesMap.set(sid, {
            store_id: sid,
            store_name: String(row['Store Name'] ?? row['store_name'] ?? '').trim(),
            region: String(row['Region'] ?? row['region'] ?? '').trim(),
            province: String(row['Province'] ?? row['province'] ?? '').trim(),
            supervisor: String(row['Supervisor'] ?? row['supervisor'] ?? '').trim() || null,
          })
        }

        const qty = parseInt(row['Stock QTY'] ?? row['stock_qty'] ?? 0) || 0
        const stockAmt = parseFloat(row['Stock Amount'] ?? row['stock_amount'] ?? 0) || 0
        const skuAmt = parseFloat(row['SKU Amount'] ?? row['sku_amount'] ?? 0) || 0

        const cleanedRow = {
          store_id: sid,
          model,
          category: String(row['Category'] ?? row['category'] ?? '').trim() || null,
          subcategory: String(row['SubCategory'] ?? row['subcategory'] ?? '').trim() || null,
          product_code: String(row['Product Code'] ?? row['product_code'] ?? '').trim() || null,
          product_name: String(row['Product Name'] ?? row['product_name'] ?? '').trim() || null,
          stock_type: String(row['Stock type'] ?? row['stock_type'] ?? '').trim() || null,
          assortment: String(row['Assortment'] ?? row['assortment'] ?? '').trim() || null,
          nonmove_period: String(row['Nonmove Period'] ?? row['nonmove_period'] ?? '').trim() || null,
          nonmove_flag: String(row['Nonmove or normal'] ?? row['nonmove_flag'] ?? '').trim() || null,
          stock_qty: qty,
          stock_amount: stockAmt,
          sku_amount: skuAmt,
        }

        if (!dateGroupsMap.has(rowDate)) {
          dateGroupsMap.set(rowDate, [])
        }
        dateGroupsMap.get(rowDate)!.push(cleanedRow)
      }

      if (dateGroupsMap.size === 0) {
        throw new Error('ไม่พบข้อมูลคอลัมน์ "Date" หรือข้อมูลไม่ถูกต้องในไฟล์ Excel')
      }

      const dateGroups: DateGroup[] = Array.from(dateGroupsMap.entries())
        .map(([date, rows]) => ({
          date,
          rowsCount: rows.length,
          rows,
        }))
        .sort((a, b) => a.date.localeCompare(b.date))

      const allDates = dateGroups.map(g => g.date)
      const totalRowsCount = dateGroups.reduce((acc, g) => acc + g.rowsCount, 0)

      const parsed: ParsedFileInfo = {
        file,
        dateGroups,
        allDates,
        totalRowsCount,
        storesCount: storesMap.size,
        stores: Array.from(storesMap.values()),
      }

      setFileInfo(parsed)

      // Check duplicates against database
      const duplicates = snapshots.filter(s => allDates.includes(s.snapshot_date))
      if (duplicates.length > 0) {
        setDuplicateDates(duplicates)
      }
    } catch (err: any) {
      setError(err.message ?? 'เกิดข้อผิดพลาดในการอ่านไฟล์ Excel')
      if (fileRef.current) fileRef.current.value = ''
    } finally {
      setParsing(false)
    }
  }

  // Execute upload across all date groups
  const executeUpload = async (replace = false) => {
    if (!fileInfo) return

    setLoading(true)
    setError('')
    setResult(null)
    setDuplicateDates([])
    setProgress(0)

    try {
      const { dateGroups, stores, totalRowsCount } = fileInfo
      const chunkSize = 300
      let totalInserted = 0
      let processedRows = 0

      // Upload group by group
      for (const group of dateGroups) {
        const totalChunks = Math.ceil(group.rows.length / chunkSize)

        for (let i = 0; i < totalChunks; i++) {
          const chunkRows = group.rows.slice(i * chunkSize, (i + 1) * chunkSize)
          const isFirstChunk = i === 0

          processedRows += chunkRows.length
          const currentPct = Math.min(100, Math.round((processedRows / totalRowsCount) * 100))

          setProgressText(`กำลังบันทึกข้อมูลวันที่ ${group.date}... (${processedRows.toLocaleString()} / ${totalRowsCount.toLocaleString()} แถว)`)
          setProgress(currentPct)

          const res = await api.adminImportData({
            snapshot_date: group.date,
            is_first_chunk: isFirstChunk,
            replace: replace,
            stores: (group === dateGroups[0] && isFirstChunk) ? stores : undefined,
            rows: chunkRows,
          })

          totalInserted += res.rows_inserted
        }
      }

      setResult({
        dates: fileInfo.allDates,
        dateGroups: fileInfo.dateGroups,
        rows_imported: totalInserted,
        stores_upserted: stores.length,
        replaced: replace,
      })
      setFileInfo(null)
      if (fileRef.current) fileRef.current.value = ''
      await loadSnapshots()
    } catch (err: any) {
      setError(err.message ?? 'การนำเข้าข้อมูลล้มเหลว กรุณาลองใหม่อีกครั้ง')
    } finally {
      setLoading(false)
      setProgress(0)
      setProgressText('')
    }
  }

  const cancelDuplicateUpload = () => {
    setDuplicateDates([])
    setFileInfo(null)
    if (fileRef.current) fileRef.current.value = ''
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

  const handleDeleteAll = async () => {
    setDeletingAll(true)
    try {
      await api.adminDeleteAllSnapshots()
      setShowDeleteAllModal(false)
      await loadSnapshots()
      alert('ลบข้อมูลสต็อกทั้งหมดในระบบเรียบร้อยแล้ว')
    } catch (e: any) {
      alert('เกิดข้อผิดพลาดในการลบข้อมูลทั้งหมด: ' + (e.message ?? 'Unknown error'))
    } finally {
      setDeletingAll(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col pb-16">
      <Header adminMode title="จัดการข้อมูล & นำเข้า Excel" />

      <div className="max-w-7xl w-full mx-auto px-4 py-8 space-y-8">
        {/* Top: Import Box & Summary Guide */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Import Card */}
          <div className="lg:col-span-6 bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex flex-col justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-1 flex items-center gap-2">
                <span>📥 นำเข้าไฟล์ Stock รายวัน (.xlsx)</span>
              </h2>
              <p className="text-xs text-gray-500 mb-4">
                รองรับไฟล์ที่มี <strong>วันที่เดียว หรือหลายวันที่ในไฟล์เดียวกัน</strong> ระบบจะแยกและบันทึกตามคอลัมน์ <strong>Date</strong> ของแต่ละแถวโดยตรง
              </p>

              <div
                onClick={() => !loading && !parsing && fileRef.current?.click()}
                className={`border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center cursor-pointer transition-all ${
                  loading || parsing ? 'bg-gray-50 cursor-not-allowed' : 'hover:border-[#0057A8] hover:bg-blue-50/50 group'
                }`}
              >
                <div className="text-4xl mb-2 group-hover:scale-110 transition-transform">
                  {parsing ? '⏳' : '📁'}
                </div>
                {parsing ? (
                  <div>
                    <div className="font-bold text-[#0057A8] text-sm">กำลังตรวจสอบข้อมูลในไฟล์ Excel...</div>
                    <div className="text-xs text-gray-400 mt-1">กรุณารอสักครู่</div>
                  </div>
                ) : fileInfo ? (
                  <div>
                    <div className="font-bold text-emerald-800 text-sm">{fileInfo.file.name}</div>
                    <div className="text-xs text-gray-600 mt-2 space-y-1">
                      <div>
                        📅 พบ <strong>{fileInfo.allDates.length} วันที่</strong> ในไฟล์:
                      </div>
                      <div className="flex flex-wrap justify-center gap-1.5 mt-1">
                        {fileInfo.dateGroups.map(g => (
                          <span key={g.date} className="bg-blue-100 text-[#0057A8] font-bold px-2 py-0.5 rounded-md text-[11px]">
                            {g.date} ({g.rowsCount.toLocaleString()} แถว)
                          </span>
                        ))}
                      </div>
                      <div className="text-[11px] text-gray-500 pt-1">
                        รวมทั้งหมด: <strong>{fileInfo.totalRowsCount.toLocaleString()} แถว</strong> · <strong>{fileInfo.storesCount} สาขา</strong>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="text-xs font-bold text-[#0057A8]">คลิกเพื่อเลือกไฟล์ Excel หรือลากไฟล์มาวาง</div>
                    <div className="text-[11px] text-gray-400 mt-1">รองรับนามสกุล .xlsx (อ่านวันที่รายแถว ไม่มีการ Merge วันที่)</div>
                  </div>
                )}
              </div>

              <input
                ref={fileRef}
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={handleFileChange}
              />

              {/* Progress Bar when uploading */}
              {loading && (
                <div className="mt-4 space-y-1.5">
                  <div className="flex justify-between text-xs font-bold text-gray-700">
                    <span>{progressText}</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-[#0057A8] h-3 rounded-full transition-all duration-200"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              {error && (
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
                  <div className="space-y-1 mt-2 font-medium">
                    <div>วันที่นำเข้า: <strong>{result.dates?.join(', ')}</strong></div>
                    <div>จำนวนข้อมูลทั้งหมด: <strong>{result.rows_imported?.toLocaleString()} แถว</strong></div>
                    <div>สาขาที่อัปเดต: <strong>{result.stores_upserted} สาขา</strong></div>
                    {result.replaced && <div className="text-amber-800 font-bold mt-1">*(เขียนทับข้อมูลเดิมของวันที่ที่ซ้ำเรียบร้อย)</div>}
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            {fileInfo && duplicateDates.length === 0 && (
              <button
                onClick={() => executeUpload(false)}
                disabled={loading || parsing}
                className="mt-6 w-full bg-[#0057A8] hover:bg-[#004A8F] active:bg-[#003D75] text-white font-bold py-3.5 rounded-xl text-sm transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    <span>กำลังบันทึกข้อมูล...</span>
                  </>
                ) : (
                  <span>🚀 ยืนยันนำเข้าข้อมูล {fileInfo.allDates.join(' & ')} ({fileInfo.totalRowsCount.toLocaleString()} แถว)</span>
                )}
              </button>
            )}
          </div>

          {/* Guide Card */}
          <div className="lg:col-span-6 bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex flex-col justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">💡 คำแนะนำการจัดการข้อมูลสต็อก</h2>
              <div className="text-xs text-gray-600 space-y-3 mt-3 leading-relaxed">
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                  <strong className="text-[#0057A8] block mb-1">1. อ่านวันที่รายแถว (Row-by-Row Date Extraction):</strong>
                  ระบบจะอ่านวันที่จากคอลัมน์ <strong>Date</strong> ของแต่ละแถวโดยตรง ทำให้ไฟล์ที่มีข้อมูลหลายวัน (เช่น 01/09/2026 และ 05/09/2026) ถูกแยกจัดเก็บตามวันที่จริงอย่างถูกต้อง ไม่มีการรวมวันที่
                </div>

                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                  <strong className="text-amber-800 block mb-1">2. ตรวจสอบข้อมูลซ้ำอัตโนมัติ:</strong>
                  หากวันที่ที่อัปโหลดมีอยู่ในระบบแล้ว ระบบจะแสดงตัวเลือกว่าต้องการ <strong>"แทนที่ข้อมูลเดิม (Replace)"</strong> หรือ <strong>"ยกเลิก (Cancel)"</strong>
                </div>

                <div className="bg-rose-50 border border-rose-100 rounded-xl p-3">
                  <strong className="text-rose-800 block mb-1">3. ลบและนำเข้าใหม่อย่างอิสระ:</strong>
                  Admin สามารถลบข้อมูลเฉพาะวันที่ หรือลบข้อมูลสต็อกทั้งหมดในระบบได้ทันที โดยไม่มีข้อจำกัดหรือ Error ใดๆ
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom: Snapshot Dates Management Table */}
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
            <div className="flex items-center gap-2">
              {snapshots.length > 0 && (
                <button
                  onClick={() => setShowDeleteAllModal(true)}
                  className="text-xs font-bold text-rose-700 hover:bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-200 transition-colors"
                >
                  🗑️ ลบข้อมูลทั้งหมด (Delete All)
                </button>
              )}
              <button
                onClick={loadSnapshots}
                className="text-xs font-semibold text-[#0057A8] hover:bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200 transition-colors"
              >
                🔄 รีเฟรชรายการ
              </button>
            </div>
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

      {/* Duplicate Dates Alert Modal */}
      {duplicateDates.length > 0 && fileInfo && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-14 h-14 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center text-3xl mx-auto">
              ⚠️
            </div>
            <div className="text-center">
              <h3 className="font-bold text-lg text-gray-900">
                พบข้อมูลวันที่ซ้ำในระบบ
              </h3>
              <div className="text-xs text-gray-600 mt-2 leading-relaxed">
                วันที่พบข้อมูลซ้ำในระบบ:
                <div className="font-bold text-gray-900 my-1.5 space-y-1">
                  {duplicateDates.map(d => (
                    <div key={d.snapshot_date} className="bg-amber-50 text-amber-900 p-1.5 rounded border border-amber-200">
                      📅 วันที่ {d.snapshot_date} (มีอยู่แล้ว {d.total_rows.toLocaleString()} แถว)
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 mt-3 text-left">
                💡 <strong>ต้องการดำเนินการอย่างไร?</strong>
                <ul className="list-disc list-inside mt-1 space-y-0.5 text-amber-800">
                  <li><strong>แทนที่ข้อมูลเดิม (Replace):</strong> ลบข้อมูลเดิมของวันที่ซ้ำออก แล้วบันทึกข้อมูลจากไฟล์ใหม่แทนที่</li>
                  <li><strong>ยกเลิก (Cancel):</strong> ไม่นำเข้าไฟล์นี้ ข้อมูลเดิมในระบบจะคงเดิม</li>
                </ul>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => executeUpload(true)}
                disabled={loading}
                className="bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white py-3 rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-1.5"
              >
                <span>🔄 แทนที่ข้อมูลเดิม (Replace)</span>
              </button>
              <button
                onClick={cancelDuplicateUpload}
                disabled={loading}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-xl text-xs font-semibold"
              >
                ✕ ยกเลิก (Cancel)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Single Date Confirmation Modal */}
      {dateToDelete && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center text-2xl mx-auto">
              🗑️
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

      {/* Delete ALL Data Confirmation Modal */}
      {showDeleteAllModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4 border-2 border-rose-500">
            <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center text-3xl mx-auto">
              ⚠️
            </div>
            <div className="text-center">
              <h3 className="font-bold text-lg text-rose-700">ยืนยันลบข้อมูลสต็อกทั้งหมด?</h3>
              <p className="text-xs text-gray-600 mt-2 leading-relaxed">
                ข้อมูลสต็อก Nonmove <strong>ทุกวันที่ในระบบ ({snapshots.length} วันที่)</strong> จะถูกลบออกทั้งหมดอย่างถาวร เพื่อให้สามารถเริ่มนำเข้าข้อมูลใหม่ได้อย่างสมบูรณ์
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={handleDeleteAll}
                disabled={deletingAll}
                className="bg-rose-600 hover:bg-rose-700 text-white py-2.5 rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-1"
              >
                {deletingAll ? 'กำลังลบทั้งหมด...' : '🗑️ ยืนยันลบทั้งหมด'}
              </button>
              <button
                onClick={() => setShowDeleteAllModal(false)}
                disabled={deletingAll}
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

