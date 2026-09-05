import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
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
  const [storeSearch, setStoreSearch] = useState('')

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

  const filteredKpiRows = useMemo(() => {
    if (!storeSearch.trim()) return kpiRows
    const q = storeSearch.toLowerCase()
    return kpiRows.filter(r => 
      r.store_name.toLowerCase().includes(q) ||
      r.store_id.toLowerCase().includes(q) ||
      r.region.toLowerCase().includes(q)
    )
  }, [kpiRows, storeSearch])

  // Summary calculation
  const totalLatestAmount = kpiRows.reduce((sum, r) => sum + (r.latest_amount ?? 0), 0)
  const totalRewardCount = kpiRows.filter(r => r.bucket_type === 'reward').length
  const totalPenaltyCount = kpiRows.filter(r => r.bucket_type === 'penalty').length
  const netPayoutAmount = kpiRows.reduce((sum, r) => sum + (r.amount_thb ?? 0), 0)

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col pb-16">
      <Header adminMode title="ภาพรวม Dashboard ประเมินผล KPI" />

      <div className="max-w-7xl w-full mx-auto px-4 py-6 space-y-6">
        {/* Pending Requests Alert Banner */}
        {data?.pending_count > 0 && (
          <div className="bg-amber-500 text-white rounded-2xl p-4 shadow-sm flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⏳</span>
              <div>
                <strong className="text-base font-bold">มี {data.pending_count} คำขอยกเว้นที่รอพิจารณา</strong>
                <div className="text-xs text-amber-100 mt-0.5">กรุณาตรวจสอบหลักฐานรูปภาพและดำเนินการอนุมัติ/ปฏิเสธ</div>
              </div>
            </div>
            <Link
              to="/admin/requests"
              className="bg-white text-amber-800 hover:bg-amber-50 px-4 py-2 rounded-xl text-xs font-bold shadow-xs transition-colors shrink-0"
            >
              ไปที่รายการคำขอ →
            </Link>
          </div>
        )}

        {/* Top Summary Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
            <div className="text-xs font-bold uppercase tracking-wider text-gray-400">🏪 จำนวนสาขาทั้งหมด</div>
            <div className="text-2xl font-black text-gray-900 mt-1">
              {kpiRows.length} <span className="text-sm font-normal text-gray-500">สาขา</span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              ครอบคลุมทุกภูมิภาค Global House
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
            <div className="text-xs font-bold uppercase tracking-wider text-gray-400">📦 มูลค่า Nonmove ล่าสุด</div>
            <div className="text-2xl font-black text-[#0057A8] mt-1">
              ฿{formatAmount(totalLatestAmount)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              ยอดรวมเฉพาะสถานะ Active
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
            <div className="text-xs font-bold uppercase tracking-wider text-gray-400">🏆 รางวัล / ปรับลด</div>
            <div className="text-2xl font-black text-emerald-600 mt-1">
              {totalRewardCount} <span className="text-xs font-bold text-gray-400">/</span> <span className="text-rose-600">{totalPenaltyCount}</span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              ได้รางวัล {totalRewardCount} สาขา · ปรับลด {totalPenaltyCount} สาขา
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
            <div className="text-xs font-bold uppercase tracking-wider text-gray-400">💰 ยอดสุทธิ Reward/Penalty</div>
            <div className={`text-2xl font-black mt-1 ${netPayoutAmount >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {formatTHB(netPayoutAmount)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              คำนวณจาก Rate Matrix ล่าสุด
            </div>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-0">
            <input
              type="text"
              value={storeSearch}
              onChange={e => setStoreSearch(e.target.value)}
              placeholder="🔍 ค้นหาสาขา (ชื่อ หรือ รหัส S00...)"
              className="border border-gray-300 rounded-xl px-3.5 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0057A8] w-64"
            />

            <select
              value={region}
              onChange={e => setRegion(e.target.value)}
              className="border border-gray-300 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0057A8]"
            >
              <option value="">ทุกภูมิภาค</option>
              {regions.map(r => <option key={r} value={r}>{r}</option>)}
            </select>

            <div className="flex items-center gap-2 text-xs text-gray-600">
              <label className="font-semibold">วันอ้างอิง:</label>
              <input
                type="date"
                value={refDate}
                onChange={e => setRefDate(e.target.value)}
                className="border border-gray-300 rounded-xl px-3 py-1.5 text-xs"
              />
              {refDate && (
                <button onClick={() => setRefDate('')} className="text-xs text-gray-400 hover:text-gray-600 underline">
                  รีเซ็ต
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/admin/export"
              className="bg-[#0057A8] hover:bg-[#004A8F] text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-xs transition-colors"
            >
              📥 ส่งออก Excel
            </Link>
          </div>
        </div>

        {loading && (
          <div className="py-12 text-center text-gray-400 space-y-2">
            <div className="animate-spin text-3xl">⏳</div>
            <div className="text-xs">กำลังประมวลผลข้อมูล...</div>
          </div>
        )}

        {error && (
          <div className="text-rose-700 text-xs bg-rose-50 border border-rose-200 rounded-2xl p-4 text-center">
            {error}
          </div>
        )}

        {/* Trend Chart */}
        {!loading && trend.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-2xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-bold text-base text-gray-900">📈 แนวโน้มมูลค่าสต็อก Nonmove รายวัน (Active Dates)</h2>
                <p className="text-xs text-gray-500">แสดงผลรวมมูลค่าสต็อกสินค้า Nonmove ในแต่ละรอบข้อมูล</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={trend} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1e6).toFixed(1)}M`} />
                <Tooltip formatter={(v: number) => [`฿${formatAmount(v)}`, 'Nonmove Amount']} />
                <Line
                  type="monotone"
                  dataKey="total_amount"
                  stroke="#0057A8"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#0057A8' }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* KPI Table per Store */}
        {!loading && filteredKpiRows.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xs overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-base text-gray-900">ตารางผลการประเมิน KPI รายสาขา</h2>
                <p className="text-xs text-gray-500">เปรียบเทียบยอดต้นเดือน vs ยอดล่าสุด</p>
              </div>
              <span className="text-xs bg-gray-100 px-3 py-1 rounded-full text-gray-700 font-bold">
                {filteredKpiRows.length} สาขา
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold">
                  <tr>
                    <th className="py-3 px-4">รหัสสาขา</th>
                    <th className="py-3 px-4">ชื่อสาขา</th>
                    <th className="py-3 px-4">ภูมิภาค</th>
                    <th className="py-3 px-4 text-right">ยอดต้นเดือน (Ref)</th>
                    <th className="py-3 px-4 text-right">ยอดล่าสุด</th>
                    <th className="py-3 px-4 text-right">% Gap</th>
                    <th className="py-3 px-4 text-center">Rank</th>
                    <th className="py-3 px-4 text-right">ผลประเมิน KPI (THB)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {filteredKpiRows.map(row => {
                    const isReward = row.bucket_type === 'reward'
                    const isPenalty = row.bucket_type === 'penalty'

                    return (
                      <tr
                        key={row.store_id}
                        className={`hover:bg-gray-50 transition-colors ${
                          isReward ? 'bg-emerald-50/20' : 'bg-rose-50/15'
                        }`}
                      >
                        <td className="py-3.5 px-4 font-mono font-bold text-gray-600">{row.store_id}</td>
                        <td className="py-3.5 px-4 font-bold text-gray-900">{row.store_name}</td>
                        <td className="py-3.5 px-4 text-gray-500">{row.region}</td>
                        <td className="py-3.5 px-4 text-right text-gray-500">฿{formatAmount(row.reference_amount)}</td>
                        <td className="py-3.5 px-4 text-right font-bold text-gray-900">฿{formatAmount(row.latest_amount)}</td>
                        <td className={`py-3.5 px-4 text-right font-bold ${
                          row.pct_gap > 0 ? 'text-rose-600' : row.pct_gap < 0 ? 'text-emerald-600' : 'text-gray-500'
                        }`}>
                          {row.pct_gap > 0 ? '+' : ''}{row.pct_gap.toFixed(1)}%
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full text-[11px] font-bold">
                            {row.rank_label}
                          </span>
                        </td>
                        <td className={`py-3.5 px-4 text-right font-black text-sm ${
                          isReward ? 'text-emerald-600' : isPenalty ? 'text-rose-600' : 'text-gray-700'
                        }`}>
                          {formatTHB(row.amount_thb)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && filteredKpiRows.length === 0 && !error && (
          <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border border-gray-200 p-12">
            <div className="text-5xl mb-3">📊</div>
            <div className="font-bold text-gray-700">ไม่พบข้อมูลตามเงื่อนไขที่เลือก</div>
            <div className="text-xs text-gray-400 mt-1">ลองเปลี่ยนภูมิภาคหรือค้นหาชื่อสาขาอื่น</div>
          </div>
        )}
      </div>
    </div>
  )
}
