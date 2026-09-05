import type { KpiResult } from '../types'
import { formatTHB, formatAmount } from '../lib/kpi'

interface KpiSummaryBarProps {
  kpi: KpiResult | null
  loading?: boolean
  nonmoveCount?: number
  nonmoveAmount?: number
  requestedCount?: number
}

export default function KpiSummaryBar({
  kpi, loading, nonmoveCount, nonmoveAmount, requestedCount
}: KpiSummaryBarProps) {
  if (loading) {
    return (
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-200 p-4 animate-pulse">
        <div className="h-5 bg-blue-200 rounded w-3/4 mb-3" />
        <div className="grid grid-cols-2 gap-2">
          <div className="h-14 bg-blue-100 rounded-xl" />
          <div className="h-14 bg-blue-100 rounded-xl" />
        </div>
      </div>
    )
  }

  const isReward = kpi && kpi.bucket_type === 'reward'
  const isPenalty = kpi && kpi.bucket_type === 'penalty'

  return (
    <div className="bg-white border-b border-gray-200 shadow-sm">
      {/* Top Banner: KPI Reward / Penalty Result */}
      {kpi && (
        <div className={`p-4 ${
          isReward 
            ? 'bg-gradient-to-r from-emerald-600 to-green-600 text-white' 
            : isPenalty 
              ? 'bg-gradient-to-r from-rose-600 to-red-600 text-white'
              : 'bg-gradient-to-r from-gray-700 to-gray-800 text-white'
        }`}>
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-xs uppercase tracking-wider font-semibold opacity-90">
                {isReward ? '🎉 ผลประเมิน KPI (ได้เงินรางวัล)' : '⚠️ ผลประเมิน KPI (ปรับลดเงินรางวัล)'}
              </div>
              <div className="text-2xl font-black tracking-tight mt-0.5">
                {formatTHB(kpi.amount_thb)}
              </div>
              <div className="text-xs opacity-90 mt-0.5">
                {kpi.bucket_label} · {kpi.rank_label}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="inline-block bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold">
                % Gap: {kpi.pct_gap > 0 ? '+' : ''}{kpi.pct_gap.toFixed(1)}%
              </div>
              <div className="text-[11px] opacity-80 mt-1">
                เปรียบเทียบต้นเดือน vs ล่าสุด
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Comparison Details Grid */}
      <div className="p-3 bg-gray-50 border-b border-gray-100 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div className="bg-white p-2.5 rounded-xl border border-gray-200 shadow-2xs">
          <div className="text-gray-500 font-medium">📅 ยอดต้นเดือน ({kpi?.reference_date ? kpi.reference_date.slice(5) : '01'})</div>
          <div className="text-sm font-bold text-gray-800 mt-0.5">
            ฿{kpi ? formatAmount(kpi.reference_amount) : '-'}
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-xl border border-gray-200 shadow-2xs">
          <div className="text-gray-500 font-medium">📊 ยอดล่าสุด ({kpi?.latest_date ? kpi.latest_date.slice(5) : '-'})</div>
          <div className="text-sm font-bold text-gray-900 mt-0.5">
            ฿{kpi ? formatAmount(kpi.latest_amount) : (nonmoveAmount != null ? formatAmount(nonmoveAmount) : '-')}
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-xl border border-gray-200 shadow-2xs">
          <div className="text-gray-500 font-medium">📦 สินค้า Nonmove</div>
          <div className="text-sm font-bold text-gray-800 mt-0.5">
            {nonmoveCount ?? 0} <span className="text-xs font-normal text-gray-500">รายการ</span>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-xl border border-gray-200 shadow-2xs">
          <div className="text-gray-500 font-medium">📝 ยื่นขอยกเว้นแล้ว</div>
          <div className="text-sm font-bold text-amber-600 mt-0.5">
            {requestedCount ?? 0} <span className="text-xs font-normal text-gray-500">รายการ</span>
          </div>
        </div>
      </div>
    </div>
  )
}
