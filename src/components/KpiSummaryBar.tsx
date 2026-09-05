import type { KpiResult } from '../types'
import { formatTHB, formatAmount } from '../lib/kpi'

interface KpiSummaryBarProps {
  kpi: KpiResult | null
  loading?: boolean
  nonmoveCount?: number
  nonmoveAmount?: number
  requestedCount?: number
}

const PERIOD_COLUMNS = [
  { key: '121 up', label: '121 วันขึ้นไป', bgHeader: 'bg-rose-50 text-rose-800' },
  { key: '91-120', label: '91-120 วัน', bgHeader: 'bg-amber-50 text-amber-800' },
  { key: '61-90',  label: '61-90 วัน', bgHeader: 'bg-yellow-50 text-yellow-800' },
  { key: '30-60',  label: '30-60 วัน', bgHeader: 'bg-blue-50 text-blue-800' },
  { key: 'total',  label: 'รวมทั้งหมด', bgHeader: 'bg-gray-100 text-gray-900 font-black' },
] as const

export default function KpiSummaryBar({
  kpi, loading, nonmoveCount, nonmoveAmount, requestedCount
}: KpiSummaryBarProps) {
  if (loading) {
    return (
      <div className="bg-white border-b border-gray-200 p-4 animate-pulse space-y-3">
        <div className="h-16 bg-gray-100 rounded-2xl w-full" />
        <div className="h-32 bg-gray-50 rounded-2xl w-full" />
      </div>
    )
  }

  const isReward = kpi && kpi.bucket_type === 'reward'
  const isPenalty = kpi && kpi.bucket_type === 'penalty'
  const matrix = kpi?.matrix

  return (
    <div className="bg-white border-b border-gray-200 shadow-sm">
      {/* 1. KPI Reward / Penalty Header Banner */}
      {kpi && (
        <div className={`p-4 ${
          isReward 
            ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 text-white' 
            : isPenalty 
              ? 'bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 text-white'
              : 'bg-gradient-to-r from-gray-700 to-gray-800 text-white'
        }`}>
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider opacity-90">
                {isReward ? '🎉 ผลการประเมิน KPI (ได้รับเงินรางวัล)' : '⚠️ ผลการประเมิน KPI (ปรับลดเงินรางวัล)'}
              </div>
              <div className="text-3xl font-black tracking-tight mt-0.5">
                {formatTHB(kpi.amount_thb)}
              </div>
              <div className="text-xs opacity-95 mt-1 flex flex-wrap items-center gap-2">
                <span className="bg-white/20 px-2.5 py-0.5 rounded-full font-bold">
                  {kpi.rank_label}
                </span>
                <span>{kpi.bucket_label}</span>
              </div>
            </div>

            <div className="sm:text-right bg-black/15 p-3 rounded-2xl backdrop-blur-xs flex sm:flex-col items-center sm:items-end justify-between gap-2">
              <div className="text-xs font-bold">
                ผลต่าง (% Gap):{' '}
                <span className={`text-base font-black ${kpi.pct_gap > 0 ? 'text-rose-200' : 'text-emerald-200'}`}>
                  {kpi.pct_gap > 0 ? '+' : ''}{kpi.pct_gap.toFixed(1)}%
                </span>
              </div>
              <div className="text-[11px] opacity-80">
                เปรียบเทียบ: วันที่ {kpi.reference_date} vs {kpi.latest_date}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Detailed Cross-Table Breakdown Matrix (Requirement #1) */}
      <div className="max-w-4xl mx-auto p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
            <span>📊 ตารางเปรียบเทียบรายละเอียด 4 ช่วงอายุ Nonmove</span>
          </h3>
          <span className="text-[11px] text-gray-400">เลื่อนตารางเพื่อดูครบทุกช่วง ↔</span>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-gray-200 shadow-2xs bg-white">
          <table className="w-full text-xs text-center border-collapse min-w-[620px]">
            <thead>
              <tr className="border-b border-gray-200 divide-x divide-gray-200">
                <th className="py-2.5 px-3 text-left bg-gray-50 text-gray-600 font-bold w-36">
                  รอบวันที่ (Date)
                </th>
                {PERIOD_COLUMNS.map(col => (
                  <th key={col.key} className={`py-2.5 px-2 font-bold ${col.bgHeader}`}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-gray-800 font-medium">
              {/* Row 1: 1st Date of Month */}
              <tr className="divide-x divide-gray-200 hover:bg-gray-50/60">
                <td className="py-2.5 px-3 text-left font-bold bg-gray-50 text-gray-700">
                  <div className="text-xs text-[#0057A8]">📅 วันที่ต้นเดือน</div>
                  <div className="text-[11px] text-gray-500 font-mono">{kpi?.reference_date || '-'}</div>
                </td>
                {PERIOD_COLUMNS.map(col => {
                  const p = matrix?.periods[col.key]?.reference
                  return (
                    <td key={col.key} className="py-2 px-2 bg-white">
                      <div className="font-bold text-gray-900">
                        ฿{p ? formatAmount(p.amount) : '0'}
                      </div>
                      <div className="text-[10px] text-gray-500 mt-0.5">
                        {p?.sku_count ?? 0} SKU · {p?.qty ?? 0} ชิ้น
                      </div>
                    </td>
                  )
                })}
              </tr>

              {/* Row 2: Latest Date */}
              <tr className="divide-x divide-gray-200 hover:bg-gray-50/60 bg-blue-50/20">
                <td className="py-2.5 px-3 text-left font-bold bg-blue-50/50 text-gray-900">
                  <div className="text-xs text-[#0057A8]">📊 วันที่ล่าสุด</div>
                  <div className="text-[11px] text-gray-600 font-mono font-bold">{kpi?.latest_date || '-'}</div>
                </td>
                {PERIOD_COLUMNS.map(col => {
                  const p = matrix?.periods[col.key]?.latest
                  return (
                    <td key={col.key} className="py-2 px-2">
                      <div className="font-black text-gray-900">
                        ฿{p ? formatAmount(p.amount) : '0'}
                      </div>
                      <div className="text-[10px] text-gray-600 font-semibold mt-0.5">
                        {p?.sku_count ?? 0} SKU · {p?.qty ?? 0} ชิ้น
                      </div>
                    </td>
                  )
                })}
              </tr>

              {/* Row 3: Difference & % Gap */}
              <tr className="divide-x divide-gray-200 bg-gray-50/80 font-bold">
                <td className="py-2.5 px-3 text-left text-gray-700 bg-gray-100 font-bold">
                  <div>ผลต่าง (% Gap)</div>
                  <div className="text-[10px] text-gray-500 font-normal">เพิ่ม/ลด เทียบต้นเดือน</div>
                </td>
                {PERIOD_COLUMNS.map(col => {
                  const item = matrix?.periods[col.key]
                  const diff = item?.diff_amount ?? 0
                  const gap = item?.pct_gap ?? 0
                  const isUp = diff > 0
                  const isDown = diff < 0

                  return (
                    <td key={col.key} className="py-2 px-2">
                      <div className={`font-black ${isUp ? 'text-rose-600' : isDown ? 'text-emerald-600' : 'text-gray-600'}`}>
                        {isUp ? '+' : ''}{diff !== 0 ? `฿${formatAmount(Math.abs(diff))}` : '฿0'}
                      </div>
                      <div className={`text-[10px] font-bold mt-0.5 ${isUp ? 'text-rose-600' : isDown ? 'text-emerald-600' : 'text-gray-500'}`}>
                        ({isUp ? '+' : ''}{gap.toFixed(1)}%)
                      </div>
                    </td>
                  )
                })}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Quick Footer Stats */}
        <div className="flex flex-wrap items-center justify-between text-xs text-gray-500 pt-1 px-1">
          <div>
            สินค้า Nonmove ล่าสุด: <strong className="text-gray-900">{nonmoveCount ?? 0} SKU</strong> (มูลค่า ฿{formatAmount(nonmoveAmount ?? 0)})
          </div>
          <div>
            ยื่นขอยกเว้นแล้ว: <strong className="text-amber-600">{requestedCount ?? 0} รายการ</strong>
          </div>
        </div>
      </div>
    </div>
  )
}
