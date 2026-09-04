import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { PERIOD_CONFIG, formatAmount } from '../../lib/kpi'
import type { StockSnapshot, KpiResult } from '../../types'
import Header from '../../components/Header'
import PeriodChip from '../../components/PeriodChip'
import StatusChip from '../../components/StatusChip'
import KpiSummaryBar from '../../components/KpiSummaryBar'

const PERIOD_ORDER = ['121 up', '91-120', '61-90', '30-60']

export default function NonmoveList() {
  const navigate = useNavigate()
  const sessionStr = sessionStorage.getItem('pc_session')
  const session = sessionStr ? JSON.parse(sessionStr) : null

  const [snapshots, setSnapshots] = useState<any[]>([])
  const [snapshotDate, setSnapshotDate] = useState<string | null>(null)
  const [kpi, setKpi] = useState<KpiResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadData = useCallback(async () => {
    if (!session?.store_id) return
    setLoading(true)
    try {
      const [nmData, kpiData] = await Promise.all([
        api.getStoreNonmove(session.store_id),
        api.getStoreKpi(session.store_id).catch(() => null),
      ])
      setSnapshots(nmData.snapshots)
      setSnapshotDate(nmData.date)
      setKpi(kpiData)
    } catch (e: any) {
      setError(e.message ?? 'ไม่สามารถโหลดข้อมูลได้')
    } finally {
      setLoading(false)
    }
  }, [session?.store_id])

  useEffect(() => { loadData() }, [loadData])

  const grouped = PERIOD_ORDER.map(period => ({
    period,
    items: snapshots.filter(s => s.nonmove_period === period),
  })).filter(g => g.items.length > 0)

  const totalAmount = snapshots.reduce((sum, s) => sum + (s.stock_amount ?? 0), 0)
  const requestedCount = snapshots.filter(s => s.request_status && s.request_status !== 'rejected').length

  if (!session) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        title={session.store_name}
        showBack
        backTo="/"
      />
      <KpiSummaryBar
        kpi={kpi}
        loading={loading}
        nonmoveCount={snapshots.length}
        nonmoveAmount={totalAmount}
        requestedCount={requestedCount}
      />

      <div className="px-4 py-2 flex items-center justify-between">
        <div className="text-xs text-gray-400">
          {snapshotDate ? `ข้อมูล ณ วันที่ ${snapshotDate}` : ''}
        </div>
        <button
          onClick={() => navigate('/store/my-requests')}
          className="text-xs text-[#0057A8] underline"
        >
          คำขอของฉัน
        </button>
      </div>

      {loading && (
        <div className="px-4 py-8 space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="bg-white rounded-xl h-20 animate-pulse border border-gray-100" />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="mx-4 my-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-4">
          {error}
        </div>
      )}

      {!loading && !error && snapshots.length === 0 && (
        <div className="px-4 py-16 text-center text-gray-400">
          <div className="text-4xl mb-3">✅</div>
          <div className="font-medium">ไม่มีสินค้า Nonmove</div>
          <div className="text-sm mt-1">ร้านนี้ไม่มีสินค้า Nonmove ในขณะนี้</div>
        </div>
      )}

      {!loading && grouped.map(({ period, items }) => (
        <div key={period} className="mb-2">
          <div className="px-4 py-2 bg-gray-100 flex items-center gap-2">
            <PeriodChip period={period} />
            <span className="text-sm text-gray-600">{items.length} รายการ</span>
            <span className="text-sm text-gray-500 ml-auto">
              ฿{formatAmount(items.reduce((s, i) => s + (i.stock_amount ?? 0), 0))}
            </span>
          </div>
          <div className="space-y-1 px-4 pb-2">
            {items.map((item: any) => (
              <div
                key={item.id}
                onClick={() => navigate(`/store/request/${item.id}`, { state: { item, snapshotDate } })}
                className="bg-white rounded-xl border border-gray-200 p-4 cursor-pointer active:bg-blue-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 truncate">{item.model}</div>
                    <div className="text-sm text-gray-500 truncate">{item.product_name}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      {item.category}{item.subcategory ? ` / ${item.subcategory}` : ''}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <StatusChip status={item.request_status} />
                    <div className="text-xs text-gray-500">QTY: {item.stock_qty}</div>
                    <div className="text-sm font-medium text-gray-800">
                      ฿{formatAmount(item.stock_amount ?? 0)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="h-8" />
    </div>
  )
}
