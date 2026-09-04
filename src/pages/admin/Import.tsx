import { useState, useRef } from 'react'
import { api } from '../../lib/api'
import Header from '../../components/Header'

export default function AdminImport() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')
  const [needsConfirm, setNeedsConfirm] = useState(false)

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
    } catch (e: any) {
      if (e.message?.includes('needs_confirm')) {
        setNeedsConfirm(true)
      } else {
        // Try to parse needs_confirm from response
        setError(e.message ?? 'Import failed')
        if (e.message?.includes('already exists')) setNeedsConfirm(true)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header adminMode title="Data Import" />
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Import Stock Snapshot</h1>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-4">
            อัปโหลดไฟล์ Excel (.xlsx) ในรูปแบบเดียวกับ <code>Stock_Daily_GH_for_Nonmove_KPI.xlsx</code>
            (หนึ่งไฟล์ต่อวัน)
          </p>

          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-[#0057A8] hover:bg-blue-50 transition-colors"
          >
            <div className="text-4xl mb-2">📁</div>
            {file ? (
              <div>
                <div className="font-medium text-gray-800">{file.name}</div>
                <div className="text-sm text-gray-400 mt-1">{(file.size / 1024).toFixed(1)} KB</div>
              </div>
            ) : (
              <div className="text-gray-400">
                <div>คลิกเพื่อเลือกไฟล์ .xlsx</div>
              </div>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={e => { setFile(e.target.files?.[0] ?? null); setResult(null); setError(''); setNeedsConfirm(false) }}
          />

          {needsConfirm && (
            <div className="mt-4 bg-amber-50 border border-amber-300 rounded-xl p-4">
              <div className="text-amber-800 font-semibold mb-2">⚠️ วันที่นี้มีข้อมูลอยู่แล้ว</div>
              <p className="text-sm text-amber-700 mb-3">
                ต้องการแทนที่ข้อมูลเดิมหรือไม่?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => doImport(true)}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-700"
                >
                  แทนที่ข้อมูลเดิม
                </button>
                <button
                  onClick={() => setNeedsConfirm(false)}
                  className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm"
                >
                  ยกเลิก
                </button>
              </div>
            </div>
          )}

          {error && !needsConfirm && (
            <div className="mt-4 text-red-600 text-sm bg-red-50 rounded-xl p-3">{error}</div>
          )}

          {result && (
            <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="font-semibold text-green-800 mb-2">✅ Import สำเร็จ</div>
              <div className="text-sm text-green-700 space-y-1">
                <div>วันที่: <strong>{result.date}</strong></div>
                <div>Rows imported: <strong>{result.rows_imported}</strong></div>
                <div>Stores updated: <strong>{result.stores_upserted}</strong></div>
                {result.errors?.length > 0 && (
                  <div className="text-red-600 mt-2">
                    Errors: {result.errors.join(', ')}
                  </div>
                )}
              </div>
            </div>
          )}

          <button
            onClick={() => doImport(false)}
            disabled={!file || loading}
            className="mt-4 w-full bg-[#0057A8] hover:bg-[#004A8F] text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-60"
          >
            {loading ? 'กำลัง Import...' : 'Import ข้อมูล'}
          </button>
        </div>
      </div>
    </div>
  )
}
