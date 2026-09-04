import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import type { KpiRateRow } from '../../types'
import Header from '../../components/Header'

const BUCKET_LABELS = [
  'Increase 30%+', 'Increase 20-29%', 'Increase 10-19%', 'Increase 0-9%',
  'Reduce 0-9%', 'Reduce 10-19%', 'Reduce 20-29%', 'Reduce 30%+',
]
const RANK_LABELS = ['Lower 150K', '150K-249K', '250K-299K', '300K up']

export default function AdminKpiRateConfig() {
  const [current, setCurrent] = useState<KpiRateRow[]>([])
  const [versions, setVersions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [effectiveFrom, setEffectiveFrom] = useState('')
  const [matrix, setMatrix] = useState<number[][]>(
    Array.from({ length: 4 }, () => Array(8).fill(0))
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.adminGetKpiRate()
      .then(r => {
        setVersions(r.versions as string[])
        setCurrent(r.current)
        const m: number[][] = Array.from({ length: 4 }, () => Array(8).fill(0))
        r.current.forEach((row: KpiRateRow) => {
          if (row.rank_tier >= 1 && row.rank_tier <= 4 && row.bucket >= 1 && row.bucket <= 8) {
            m[row.rank_tier - 1][row.bucket - 1] = row.amount_thb
          }
        })
        setMatrix(m)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const updateCell = (rank: number, bucket: number, value: string) => {
    const num = parseFloat(value)
    setMatrix(prev => {
      const next = prev.map(r => [...r])
      next[rank][bucket] = isNaN(num) ? 0 : num
      return next
    })
  }

  const handleSave = async () => {
    if (!effectiveFrom) { setError('กรุณาระบุ Effective From date'); return }
    setSaving(true); setSaved(false); setError('')
    try {
      const matrixRows = []
      for (let r = 0; r < 4; r++) {
        const rankSample = current.find(c => c.rank_tier === r + 1)
        for (let b = 0; b < 8; b++) {
          const bucketSample = current.find(c => c.rank_tier === r + 1 && c.bucket === b + 1)
          matrixRows.push({
            rank_tier: r + 1,
            rank_label: RANK_LABELS[r],
            rank_min_amount: rankSample?.rank_min_amount ?? [0, 150000, 250000, 300000][r],
            rank_max_amount: rankSample?.rank_max_amount ?? [149999.99, 249999.99, 299999.99, null][r],
            bucket: b + 1,
            bucket_label: BUCKET_LABELS[b],
            bucket_type: (b < 4 ? 'penalty' : 'reward') as 'penalty' | 'reward',
            pct_min: bucketSample?.pct_min ?? null,
            pct_max: bucketSample?.pct_max ?? null,
            amount_thb: matrix[r][b],
          })
        }
      }
      await api.adminUpdateKpiRate({ effective_from: effectiveFrom, matrix: matrixRows })
      setSaved(true)
      setVersions(prev => [effectiveFrom, ...prev])
      setTimeout(() => setSaved(false), 3000)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header adminMode title="KPI Rate Config" />
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Penalty / Reward Rate Matrix</h1>
            <p className="text-sm text-gray-500 mt-1">หน่วย: THB ต่อ PC ต่อ Store</p>
          </div>
          <div className="text-right text-sm text-gray-400">
            <div className="font-medium">Versions on file:</div>
            <div>{versions.length > 0 ? versions.slice(0, 3).join(', ') : '-'}</div>
          </div>
        </div>

        {loading && <div className="text-gray-400 py-8 text-center">Loading...</div>}
        {error && <div className="text-red-600 text-sm mb-4 bg-red-50 rounded-lg p-3">{error}</div>}

        {!loading && (
          <>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="px-3 py-3 text-left text-gray-600 font-semibold border-b border-r border-gray-200 bg-gray-50 whitespace-nowrap">
                        Rank ↓ \ Bucket →
                      </th>
                      {BUCKET_LABELS.map((b, i) => (
                        <th key={i} className={`px-2 py-2 text-center text-xs font-medium border-b border-gray-200 whitespace-nowrap ${
                          i < 4 ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
                        }`}>
                          {b}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {RANK_LABELS.map((rankLabel, r) => (
                      <tr key={r} className="border-b border-gray-100 last:border-0">
                        <td className="px-3 py-2 font-semibold text-gray-700 whitespace-nowrap border-r border-gray-200 bg-gray-50">
                          {r + 1}. {rankLabel}
                        </td>
                        {Array.from({ length: 8 }, (_, b) => (
                          <td key={b} className={`px-1 py-1.5 ${b < 4 ? 'bg-red-50/40' : 'bg-green-50/40'}`}>
                            <input
                              type="number"
                              value={matrix[r]?.[b] ?? 0}
                              onChange={e => updateCell(r, b, e.target.value)}
                              className={`w-20 text-center border border-gray-200 rounded-lg px-1 py-1.5 text-sm font-bold focus:outline-none focus:ring-2 ${
                                b < 4
                                  ? 'text-red-600 focus:ring-red-300'
                                  : 'text-green-700 focus:ring-green-300'
                              }`}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Save new version */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-700 mb-3">บันทึก Version ใหม่</h2>
              <p className="text-sm text-gray-500 mb-4">
                การเปลี่ยนแปลงจะมีผลตั้งแต่วันที่ระบุ — ไม่กระทบ KPI ที่คำนวณไปแล้ว
              </p>
              <div className="flex items-center gap-4 flex-wrap">
                <div>
                  <label className="text-sm font-medium text-gray-700 mr-2">Effective From:</label>
                  <input
                    type="date"
                    value={effectiveFrom}
                    onChange={e => setEffectiveFrom(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0057A8]"
                  />
                </div>
                {saved && <span className="text-green-600 font-medium">✅ Saved as {effectiveFrom}</span>}
                <button
                  onClick={handleSave}
                  disabled={saving || !effectiveFrom}
                  className="ml-auto bg-[#0057A8] hover:bg-[#004A8F] text-white px-6 py-2.5 rounded-lg font-semibold text-sm disabled:opacity-60 transition-colors"
                >
                  {saving ? 'Saving...' : 'Save New Version'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
