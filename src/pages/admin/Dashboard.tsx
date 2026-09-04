import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import type { KpiResult } from '../../types'
import Header from '../../components/Header'
import { formatTHB, formatAmount } from '../../lib/kpi'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'

export default function AdminDashboard() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [region, setRegion] = useState('')
  const [regions, setRegions] = useState<string[]>([])
  const [refDate, setRefDate] = useState('')

  useEffect(() => {
    api.getRegions().then(setRegions).catch(console.error)
  }, [])

  useEffect(() => {
    setLoading(true)
    const params: Record<string, string> = {}
    if (region) params.region = region
    if (refDate) params.ref_date = refDate
    api.adminDashboard(params)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [region, refDate])

  const kpiRows: KpiResult[] = data?.kpi_rows ?? []
  const trend = data?.trend ?? []

  return (
    <div className="min-h-screen bg-gray-50">
      <Header adminMode title="Dashboard" />
      <div className="max-w-7xl mx-auto px-4 py-6">

        {/* Pending badge */}
        {data?.pending_count > 0 && (
          <div className="mb-4 bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 flex items-center gap-3">
            <span className="text-amber-600 font-bold text-xl">{data.pending_count}</span>
            <span className="text-amber-800">คำขอรอพิจารณา</span>
            <a href="/admin/requests" className="ml-auto text-sm text-[#0057A8] underline">ดูทั้งหมด</a>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <select
            value={region}
            onChange={e => setRegion(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">ทุกภูมิภาค</option>
            {regions.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">วันอ้างอิง:</label>
            <input
              type="date"
              value={refDate}
              onChange={e => setRefDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            {refDate && (
              <button onClick={() => setRefDate('')} className="text-xs text-gray-400 underline">Reset</button>
            )}
          </div>
        </div>

        {loading && <div className="py-12 text-center text-gray-400">กำลังโหลด...</div>}
        {error && <div className="text-red-600 text-sm mb-4 bg-red-50 rounded-lg p-3">{error}</div>}

        {/* Trend Chart */}
        {!loading && trend.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
            <h2 className="font-semibold text-gray-700 mb-3">Nonmove Amount Trend</h2>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1e6).toFixed(1)}M`} />
                <Tooltip formatter={(v: number) => [`฿${formatAmount(v)}`, 'Nonmove Amount']} />
                <Line
                  type="monotone"
                  dataKey="total_amount"
                  stroke="#0057A8"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* KPI Table */}
        {!loading && kpiRows.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-700">KPI per Store</h2>
              <span className="text-sm text-gray-400">{kpiRows.length} ร้าน</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">ร้านค้า</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">ภูมิภาค</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-600">Ref Amount</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-600">Latest Amount</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-600">% Gap</th>
                    <th className="px-4 py-2 text-center font-medium text-gray-600">Rank</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-600">Penalty/Reward</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {kpiRows.map(row => (
                    <tr
                      key={row.store_id}
                      className={`hover:bg-gray-50 ${row.bucket_type === 'reward' ? 'bg-green-50/30' : 'bg-red-50/20'}`}
                    >
                      <td className="px-4 py-2 font-medium text-gray-800">{row.store_name}</td>
                      <td className="px-4 py-2 text-gray-500 text-xs">{row.region}</td>
                      <td className="px-4 py-2 text-right text-gray-500">฿{formatAmount(row.reference_amount)}</td>
                      <td className="px-4 py-2 text-right font-medium">฿{formatAmount(row.latest_amount)}</td>
                      <td className={`px-4 py-2 text-right font-semibold ${
                        row.pct_gap > 0 ? 'text-red-600' : row.pct_gap < 0 ? 'text-green-600' : 'text-gray-500'
                      }`}>
                        {row.pct_gap > 0 ? '+' : ''}{row.pct_gap.toFixed(1)}%
                      </td>
                      <td className="px-4 py-2 text-center">
                        <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-medium">
                          {row.rank_label}
                        </span>
                      </td>
                      <td className={`px-4 py-2 text-right font-bold text-base ${
                        row.bucket_type === 'reward' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {formatTHB(row.amount_thb)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && kpiRows.length === 0 && !error && (
          <div className="text-center py-16 text-gray-400">
            <div className="text-5xl mb-3">📊</div>
            <div>ยังไม่มีข้อมูล — กรุณา Import ข้อมูลก่อน</div>
            <a href="/admin/import" className="mt-3 inline-block text-[#0057A8] underline text-sm">ไปที่ Import</a>
          </div>
        )}
      </div>
    </div>
  )
}
