import { useState } from 'react'
import { api } from '../../lib/api'
import Header from '../../components/Header'

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

export default function AdminExport() {
  const [exportLoading, setExportLoading] = useState(false)
  const [kpiMonth, setKpiMonth] = useState(new Date().toISOString().slice(0, 7))
  const [kpiLoading, setKpiLoading] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importResult, setImportResult] = useState<any>(null)
  const [importLoading, setImportLoading] = useState(false)
  const [error, setError] = useState('')

  const handleExportRequests = async () => {
    setExportLoading(true); setError('')
    try {
      const blob = await api.adminExportRequests()
      downloadBlob(blob, `requests-${new Date().toISOString().split('T')[0]}.csv`)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setExportLoading(false)
    }
  }

  const handleExportKpi = async () => {
    setKpiLoading(true); setError('')
    try {
      const blob = await api.adminExportKpi(kpiMonth)
      downloadBlob(blob, `kpi-payout-${kpiMonth}.csv`)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setKpiLoading(false)
    }
  }

  const handleImportRequests = async () => {
    if (!importFile) return
    setImportLoading(true); setError(''); setImportResult(null)
    try {
      const form = new FormData()
      form.append('file', importFile)
      const r = await api.adminImportRequests(form)
      setImportResult(r)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setImportLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header adminMode title="Export / Import" />
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl font-bold text-gray-800">Export & Bulk Import</h1>

        {error && (
          <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl p-4">{error}</div>
        )}

        {/* Export Requests */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-lg mb-1">Export Exclusion Requests</h2>
          <p className="text-sm text-gray-500 mb-1">ดาวน์โหลด CSV ของคำขอทั้งหมด (พร้อม Photo Links)</p>
          <p className="text-xs text-gray-400 mb-4">
            💡 สำหรับไฟล์ Excel ที่มีรูปภาพ thumbnail ฝังอยู่ในเซลล์ ให้รัน:
            <code className="bg-gray-100 px-1 rounded ml-1">node scripts/export-requests.mjs</code>
          </p>
          <button
            onClick={handleExportRequests}
            disabled={exportLoading}
            className="bg-[#0057A8] hover:bg-[#004A8F] text-white px-6 py-2.5 rounded-lg font-semibold text-sm disabled:opacity-60 transition-colors"
          >
            {exportLoading ? 'Exporting...' : '⬇️ Download Requests CSV'}
          </button>
        </div>

        {/* Export KPI Payout */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-lg mb-1">Export KPI Payout Sheet</h2>
          <p className="text-sm text-gray-500 mb-4">
            ดาวน์โหลด KPI สรุปรายร้านสำหรับเดือนที่เลือก (Rank, % Gap, THB)
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <div>
              <label className="text-sm font-medium text-gray-700 mr-2">เดือน:</label>
              <input
                type="month"
                value={kpiMonth}
                onChange={e => setKpiMonth(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>
            <button
              onClick={handleExportKpi}
              disabled={kpiLoading}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-lg font-semibold text-sm disabled:opacity-60 transition-colors"
            >
              {kpiLoading ? 'Exporting...' : '⬇️ Download KPI CSV'}
            </button>
          </div>
        </div>

        {/* Bulk Import Requests (status/comment update) */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-lg mb-1">Bulk Update Requests (Import)</h2>
          <p className="text-sm text-gray-500 mb-4">
            อัปโหลดไฟล์ CSV/XLSX เพื่ออัปเดต Status และ Admin Comment
            ของหลายคำขอพร้อมกัน (match โดย ID column)
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <input
              type="file"
              accept=".xlsx,.csv"
              onChange={e => { setImportFile(e.target.files?.[0] ?? null); setImportResult(null) }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:bg-gray-100 file:text-gray-700"
            />
            <button
              onClick={handleImportRequests}
              disabled={!importFile || importLoading}
              className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-2.5 rounded-lg font-semibold text-sm disabled:opacity-60 transition-colors"
            >
              {importLoading ? 'Importing...' : '⬆️ Import Updates'}
            </button>
          </div>
          {importResult && (
            <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-4 text-sm">
              <div className="text-green-700 font-semibold mb-1">✅ Import complete</div>
              <div>Updated: <strong>{importResult.updated}</strong></div>
              <div>Skipped: <strong>{importResult.skipped}</strong></div>
              {importResult.errors?.length > 0 && (
                <div className="text-red-600 mt-2 text-xs space-y-0.5">
                  {importResult.errors.slice(0, 5).map((e: string, i: number) => (
                    <div key={i}>{e}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
