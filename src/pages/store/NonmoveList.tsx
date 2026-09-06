import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { PERIOD_CONFIG, formatAmount } from '../../lib/kpi'
import type { StockSnapshot, KpiResult } from '../../types'
import Header from '../../components/Header'
import PeriodChip from '../../components/PeriodChip'
import StatusChip from '../../components/StatusChip'
import KpiSummaryBar from '../../components/KpiSummaryBar'

const PERIOD_ORDER = ['121 up', '91-120', '61-90', '30-60']

type FilterTab = 'all' | 'unrequested' | 'requested'

export default function NonmoveList() {
  const navigate = useNavigate()
  const sessionStr = sessionStorage.getItem('pc_session')
  const session = sessionStr ? JSON.parse(sessionStr) : null

  const [snapshots, setSnapshots] = useState<StockSnapshot[]>([])
  const [snapshotDate, setSnapshotDate] = useState<string | null>(null)
  const [kpi, setKpi] = useState<KpiResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState<FilterTab>('all')

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

  const filteredSnapshots = useMemo(() => {
    return snapshots.filter(item => {
      // Search filter
      const matchesSearch = !searchTerm.trim() || 
        item.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.product_name && item.product_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.product_code && item.product_code.toLowerCase().includes(searchTerm.toLowerCase()))

      if (!matchesSearch) return false

      // Tab filter
      if (activeTab === 'requested') {
        return !!item.request_status
      }
      if (activeTab === 'unrequested') {
        return !item.request_status
      }
      return true
    })
  }, [snapshots, searchTerm, activeTab])

  const grouped = useMemo(() => {
    return PERIOD_ORDER.map(period => ({
      period,
      items: filteredSnapshots.filter(s => s.nonmove_period === period),
    })).filter(g => g.items.length > 0)
  }, [filteredSnapshots])

  const totalAmount = snapshots.reduce((sum, s) => sum + (s.stock_amount ?? 0), 0)
  const requestedCount = snapshots.filter(s => s.request_status && s.request_status !== 'rejected').length
  const unrequestedCount = snapshots.length - requestedCount

  if (!session) return null

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col pb-20">
      <Header
        title={session.store_name}
        subtitle={`${session.region} · PC: ${session.name}`}
        showBack
        backTo="/"
      />

      {/* KPI Summary Banner */}
      <KpiSummaryBar
        kpi={kpi}
        loading={loading}
        nonmoveCount={snapshots.length}
        nonmoveAmount={totalAmount}
        requestedCount={requestedCount}
      />

      {/* Controls & Search */}
      <div className="max-w-3xl w-full mx-auto px-4 py-3 space-y-2">
        {/* Search Bar */}
        <div className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="🔍 ค้นหารุ่น Model / ชื่อสินค้า / รหัสสินค้า..."
            className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0057A8] shadow-2xs"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 text-sm"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-gray-200/80 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setActiveTab('all')}
            className={`py-2 rounded-lg transition-all text-center ${
              activeTab === 'all'
                ? 'bg-white text-[#0057A8] shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            ทั้งหมด ({snapshots.length})
          </button>
          <button
            onClick={() => setActiveTab('unrequested')}
            className={`py-2 rounded-lg transition-all text-center ${
              activeTab === 'unrequested'
                ? 'bg-white text-[#0057A8] shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            ยังไม่ขอ ({unrequestedCount})
          </button>
          <button
            onClick={() => setActiveTab('requested')}
            className={`py-2 rounded-lg transition-all text-center ${
              activeTab === 'requested'
                ? 'bg-white text-amber-600 shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            📝 ขอยกเว้นแล้ว ({requestedCount})
          </button>
        </div>

        {/* Info header */}
        <div className="flex items-center justify-between text-xs text-gray-500 pt-1">
          <div>
            {snapshotDate ? `ข้อมูล ณ วันที่ ${snapshotDate}` : ''}
          </div>
          <button
            onClick={() => navigate('/store/my-requests')}
            className="text-[#0057A8] font-bold flex items-center gap-1 hover:underline"
          >
            📋 ประวัติคำขอของฉัน ({requestedCount}) →
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-3xl w-full mx-auto px-4 space-y-3 flex-1">
        {loading && (
          <div className="py-6 space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-2xl h-24 animate-pulse border border-gray-200" />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-2xl p-4 my-3 text-center">
            {error}
          </div>
        )}

        {!loading && !error && filteredSnapshots.length === 0 && (
          <div className="py-16 text-center text-gray-400 bg-white rounded-2xl border border-gray-200 p-8 my-4">
            <div className="text-5xl mb-3">📦</div>
            <div className="font-bold text-gray-700 text-base">ไม่พบรายการสินค้า</div>
            <div className="text-xs text-gray-500 mt-1">
              {searchTerm ? 'ไม่พบรายการที่ตรงกับคำค้นหา' : 'ไม่มีสินค้า Nonmove ในหมวดนี้'}
            </div>
          </div>
        )}

        {/* Grouped SKU List */}
        {!loading && grouped.map(({ period, items }) => (
          <div key={period} className="space-y-2 mb-4">
            <div className="sticky top-14 z-20 bg-gray-100/95 backdrop-blur-sm py-1.5 flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <PeriodChip period={period} />
                <span className="text-xs font-bold text-gray-700">{items.length} รายการ</span>
              </div>
              <span className="text-xs font-semibold text-gray-600">
                รวม ฿{formatAmount(items.reduce((s, i) => s + (i.stock_amount ?? 0), 0))}
              </span>
            </div>

            <div className="space-y-2.5">
              {items.map((item) => {
                const isApproved = item.request_status === 'approved'
                const isPending = item.request_status === 'pending'
                const isRejected = item.request_status === 'rejected'
                const isNeedsResubmit = item.request_status === 'needs_resubmit'

                return (
                  <div
                    key={item.id}
                    onClick={() => navigate(`/store/request/${item.id}`, { state: { item, snapshotDate } })}
                    className={`bg-white rounded-2xl border p-4 shadow-2xs transition-all active:scale-[0.99] cursor-pointer ${
                      isApproved 
                        ? 'border-emerald-300 bg-emerald-50/20' 
                        : isPending 
                          ? 'border-amber-300 bg-amber-50/20'
                          : isNeedsResubmit
                            ? 'border-blue-300 bg-blue-50/20'
                            : isRejected
                              ? 'border-red-300 bg-red-50/10'
                              : 'border-gray-200 hover:border-[#0057A8]'
                    }`}
                  >
                    {/* Top Row: Period Group Badge & Status */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <PeriodChip period={item.nonmove_period || period} />
                        {item.stock_type && (
                          <span className="text-[10px] font-bold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md">
                            {item.stock_type}
                          </span>
                        )}
                      </div>
                      {item.request_status && (
                        <StatusChip status={item.request_status} />
                      )}
                    </div>

                    {/* Middle Row: Model & Product Name */}
                    <div className="space-y-1">
                      <div className="font-bold text-base text-gray-900 leading-snug">
                        {item.model}
                      </div>
                      <div className="text-xs text-gray-600 line-clamp-1">
                        {item.product_name || '-'}
                      </div>
                      <div className="text-[11px] text-gray-400">
                        {item.product_code ? `รหัส: ${item.product_code} · ` : ''}
                        {item.category}{item.subcategory ? ` / ${item.subcategory}` : ''}
                        {item.assortment ? ` · ${item.assortment}` : ''}
                      </div>
                    </div>

                    {/* Metrics Grid: SKU Amount, Stock QTY, and Total Stock Amount */}
                    <div className="grid grid-cols-3 gap-2 mt-3 pt-2.5 border-t border-gray-100 bg-gray-50/70 p-2.5 rounded-xl text-center">
                      <div className="text-left">
                        <div className="text-[10px] text-gray-500 font-medium">ราคาต่อชิ้น (SKU Amount)</div>
                        <div className="text-xs font-bold text-gray-800 mt-0.5">
                          {formatAmount(item.sku_amount ?? (item.stock_qty ? (item.stock_amount ?? 0) / item.stock_qty : 0))}
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] text-gray-500 font-medium">จำนวนสต็อก (Unit)</div>
                        <div className="text-xs font-black text-[#0057A8] mt-0.5">
                          {item.stock_qty ?? 1} เครื่อง
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-[10px] text-gray-500 font-medium">มูลค่ารวม (Stock Amount)</div>
                        <div className={`text-xs font-black mt-0.5 ${isApproved ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                          {formatAmount(item.stock_amount ?? 0)}
                        </div>
                      </div>
                    </div>

                    {/* Action Callout Bar */}
                    <div className="mt-2.5 pt-2 flex items-center justify-between">
                      {item.request_status ? (
                        <span className="text-[11px] font-medium text-gray-500">
                          {isApproved && '✓ ได้รับการยกเว้นจาก KPI แล้ว'}
                          {isPending && '⏳ Admin กำลังตรวจสอบ'}
                          {isNeedsResubmit && '⚠️ กรุณากดเพื่อส่งข้อมูลเพิ่ม'}
                          {isRejected && '❌ ไม่อนุมัติ (กดเพื่อยื่นใหม่)'}
                        </span>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs text-[#0057A8] font-bold">
                          <span>➕ ขอยกเว้นรายการนี้</span>
                        </div>
                      )}

                      <span className="text-gray-400 text-xs">
                        ดูรายละเอียด →
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Floating Bottom Bar for Mobile */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-200 px-4 py-2.5 z-30 shadow-lg">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <div className="text-xs text-gray-600">
            <div>สาขา: <strong className="text-gray-900">{session.store_name}</strong></div>
            <div className="text-gray-500">Nonmove ทั้งหมด {snapshots.length} SKU</div>
          </div>
          <button
            onClick={() => navigate('/store/my-requests')}
            className="bg-[#0057A8] hover:bg-[#004A8F] text-white px-5 py-2 rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-colors"
          >
            <span>📋 คำขอของฉัน</span>
            <span className="bg-white/20 px-1.5 py-0.5 rounded-full text-[10px]">
              {requestedCount}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
