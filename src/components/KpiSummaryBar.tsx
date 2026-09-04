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
      <div className="bg-haier-light border-b border-blue-200 px-4 py-3 animate-pulse">
        <div className="h-4 bg-blue-200 rounded w-3/4 mb-2" />
        <div className="h-3 bg-blue-100 rounded w-1/2" />
      </div>
    )
  }

  const isReward = kpi && kpi.bucket_type === 'reward'
  const isPenalty = kpi && kpi.bucket_type === 'penalty'

  return (
    <div className="bg-haier-light border-b border-blue-200 px-4 py-3">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <div className="flex items-center gap-1">
          <span className="text-gray-500">SKU:</span>
          <span className="font-semibold">{nonmoveCount ?? '-'}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-gray-500">มูลค่า:</span>
          <span className="font-semibold">฿{nonmoveAmount != null ? formatAmount(nonmoveAmount) : '-'}</span>
        </div>
        {requestedCount != null && (
          <div className="flex items-center gap-1">
            <span className="text-gray-500">ขอยกเว้น:</span>
            <span className="font-semibold text-amber-600">{requestedCount} รายการ</span>
          </div>
        )}
      </div>
      {kpi && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <div className="flex items-center gap-1">
            <span className="text-gray-500">Rank:</span>
            <span className="font-semibold">{kpi.rank_label}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-gray-500">% Gap:</span>
            <span className={`font-semibold ${
              kpi.pct_gap > 0 ? 'text-red-600' : kpi.pct_gap < 0 ? 'text-green-600' : ''
            }`}>
              {kpi.pct_gap > 0 ? '+' : ''}{kpi.pct_gap.toFixed(1)}%
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-gray-500">KPI:</span>
            <span className={`font-bold text-base ${
              isReward ? 'text-green-600' : isPenalty ? 'text-red-600' : ''
            }`}>
              {formatTHB(kpi.amount_thb)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
