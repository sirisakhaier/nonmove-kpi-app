// ============================================================
// KPI calculation helper — shared between store and admin KPI endpoints
// ============================================================
import type { D1Database } from '@cloudflare/workers-types'

export interface PeriodMetrics {
  sku_count: number
  qty: number
  amount: number
}

export interface PeriodDetail {
  reference: PeriodMetrics
  latest: PeriodMetrics
  diff_amount: number
  pct_gap: number
}

export interface PeriodMatrix {
  reference_date: string
  latest_date: string
  periods: {
    '121 up': PeriodDetail
    '91-120': PeriodDetail
    '61-90': PeriodDetail
    '30-60': PeriodDetail
    'total': PeriodDetail
  }
}

export interface KpiResult {
  store_id: string
  store_name: string
  region: string
  reference_date: string
  reference_amount: number
  latest_date: string
  latest_amount: number
  pct_gap: number
  rank_tier: number
  rank_label: string
  bucket: number
  bucket_label: string
  bucket_type: 'penalty' | 'reward'
  amount_thb: number
  matrix?: PeriodMatrix
}

function getBucket(pctGap: number): number {
  if (pctGap >= 30) return 1
  if (pctGap >= 20) return 2
  if (pctGap >= 10) return 3
  if (pctGap >= 0)  return 4
  if (pctGap > -10) return 5
  if (pctGap > -20) return 6
  if (pctGap > -30) return 7
  return 8
}

export async function calcStoreKpi(
  db: D1Database,
  store_id: string,
  referenceDate?: string | null
): Promise<KpiResult | null> {
  // Get store info
  const store = await db.prepare(
    'SELECT store_id, store_name, region FROM stores WHERE store_id = ?'
  ).bind(store_id).first<{ store_id: string; store_name: string; region: string }>()
  if (!store) return null

  // Get KPI settings (included stock types)
  const settings = await db.prepare(
    'SELECT included_stock_types FROM kpi_settings ORDER BY id DESC LIMIT 1'
  ).first<{ included_stock_types: string }>()
  const includedTypes: string[] = settings
    ? JSON.parse(settings.included_stock_types)
    : ['SELLABLE', 'ONLINE']

  const placeholders = includedTypes.map(() => '?').join(',')

  // Get latest ACTIVE date for this store
  const latestRow = await db.prepare(
    'SELECT MAX(snapshot_date) as date FROM stock_snapshots WHERE store_id = ? AND COALESCE(is_active, 1) = 1'
  ).bind(store_id).first<{ date: string | null }>()
  const latestDate = latestRow?.date
  if (!latestDate) return null

  // Reference date:
  // 1. If explicitly passed, use it.
  // 2. Otherwise, check if ${month}-01 exists.
  // 3. If not, use the earliest active snapshot date in that same month.
  const latestMonth = latestDate.slice(0, 7) // e.g. "2026-08"
  let refDate = referenceDate

  if (!refDate) {
    const firstOfMonth = `${latestMonth}-01`
    const hasFirst = await db.prepare(
      'SELECT COUNT(*) as cnt FROM stock_snapshots WHERE store_id = ? AND snapshot_date = ? AND COALESCE(is_active, 1) = 1'
    ).bind(store_id, firstOfMonth).first<{ cnt: number }>()

    if (hasFirst && hasFirst.cnt > 0) {
      refDate = firstOfMonth
    } else {
      // Find earliest active date in that month
      const earliestRow = await db.prepare(
        `SELECT MIN(snapshot_date) as date FROM stock_snapshots 
         WHERE store_id = ? AND snapshot_date LIKE ? AND COALESCE(is_active, 1) = 1`
      ).bind(store_id, `${latestMonth}%`).first<{ date: string | null }>()
      refDate = earliestRow?.date ?? firstOfMonth
    }
  }

  // Get approved exclusion models
  const { results: approved } = await db.prepare(
    `SELECT DISTINCT model FROM exclusion_requests WHERE store_id = ? AND status = 'approved'`
  ).bind(store_id).all<{ model: string }>()
  const excludedModels = approved.map(r => r.model)
  const excludePlaceholders = excludedModels.length > 0
    ? `AND model NOT IN (${excludedModels.map(() => '?').join(',')})` : ''

  // Detailed breakdown per nonmove period for a given date
  async function getPeriodBreakdown(date: string): Promise<Record<string, PeriodMetrics>> {
    const params = [store_id, date, ...includedTypes, ...excludedModels]
    const { results } = await db.prepare(
      `SELECT 
         nonmove_period,
         COUNT(DISTINCT model) as sku_count,
         COALESCE(SUM(stock_qty), 0) as qty,
         COALESCE(SUM(stock_amount), 0) as amount
       FROM stock_snapshots
       WHERE store_id = ?
         AND snapshot_date = ?
         AND nonmove_flag = 'Nonmove'
         AND COALESCE(is_active, 1) = 1
         AND stock_type IN (${placeholders})
         ${excludePlaceholders}
       GROUP BY nonmove_period`
    ).bind(...params).all<{ nonmove_period: string; sku_count: number; qty: number; amount: number }>()

    const map: Record<string, PeriodMetrics> = {
      '121 up': { sku_count: 0, qty: 0, amount: 0 },
      '91-120': { sku_count: 0, qty: 0, amount: 0 },
      '61-90':  { sku_count: 0, qty: 0, amount: 0 },
      '30-60':  { sku_count: 0, qty: 0, amount: 0 },
    }

    for (const r of results) {
      if (r.nonmove_period && map[r.nonmove_period]) {
        map[r.nonmove_period] = {
          sku_count: r.sku_count,
          qty: r.qty,
          amount: r.amount,
        }
      }
    }
    return map
  }

  const [refPeriods, latestPeriods] = await Promise.all([
    getPeriodBreakdown(refDate),
    getPeriodBreakdown(latestDate),
  ])

  // Total amounts
  const refTotalAmt = Object.values(refPeriods).reduce((s, p) => s + p.amount, 0)
  const latestTotalAmt = Object.values(latestPeriods).reduce((s, p) => s + p.amount, 0)

  // Build matrix object
  const periodKeys: ('121 up' | '91-120' | '61-90' | '30-60')[] = ['121 up', '91-120', '61-90', '30-60']
  const matrixPeriods: any = {}

  let totalRefSku = 0, totalRefQty = 0
  let totalLatestSku = 0, totalLatestQty = 0

  for (const k of periodKeys) {
    const refP = refPeriods[k]
    const latP = latestPeriods[k]
    totalRefSku += refP.sku_count
    totalRefQty += refP.qty
    totalLatestSku += latP.sku_count
    totalLatestQty += latP.qty

    const diffAmt = latP.amount - refP.amount
    const gap = refP.amount > 0 ? (diffAmt / refP.amount) * 100 : (latP.amount > 0 ? 100 : 0)

    matrixPeriods[k] = {
      reference: refP,
      latest: latP,
      diff_amount: diffAmt,
      pct_gap: Math.round(gap * 100) / 100,
    }
  }

  const totalDiffAmt = latestTotalAmt - refTotalAmt
  const totalGap = refTotalAmt > 0 ? (totalDiffAmt / refTotalAmt) * 100 : (latestTotalAmt > 0 ? 100 : 0)

  matrixPeriods['total'] = {
    reference: { sku_count: totalRefSku, qty: totalRefQty, amount: refTotalAmt },
    latest: { sku_count: totalLatestSku, qty: totalLatestQty, amount: latestTotalAmt },
    diff_amount: totalDiffAmt,
    pct_gap: Math.round(totalGap * 100) / 100,
  }

  const bucket = getBucket(totalGap)

  // Get KPI rate matrix (effective version for this month)
  const effectiveMonth = `${latestMonth}-01`
  const rateRow = await db.prepare(
    `SELECT rank_tier, rank_label, bucket, bucket_label, bucket_type, amount_thb
     FROM kpi_rate_matrix
     WHERE effective_from <= ?
       AND bucket = ?
       AND ? BETWEEN rank_min_amount AND COALESCE(rank_max_amount, 9999999999)
     ORDER BY effective_from DESC
     LIMIT 1`
  ).bind(effectiveMonth, bucket, latestTotalAmt).first<{
    rank_tier: number; rank_label: string; bucket: number
    bucket_label: string; bucket_type: string; amount_thb: number
  }>()

  return {
    store_id: store.store_id,
    store_name: store.store_name,
    region: store.region,
    reference_date: refDate,
    reference_amount: refTotalAmt,
    latest_date: latestDate,
    latest_amount: latestTotalAmt,
    pct_gap: Math.round(totalGap * 100) / 100,
    rank_tier: rateRow?.rank_tier ?? 0,
    rank_label: rateRow?.rank_label ?? '-',
    bucket: rateRow?.bucket ?? bucket,
    bucket_label: rateRow?.bucket_label ?? '-',
    bucket_type: (rateRow?.bucket_type as 'penalty' | 'reward') ?? 'penalty',
    amount_thb: rateRow?.amount_thb ?? 0,
    matrix: {
      reference_date: refDate,
      latest_date: latestDate,
      periods: matrixPeriods,
    },
  }
}
