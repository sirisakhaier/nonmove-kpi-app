// ============================================================
// KPI calculation helper — shared between store and admin KPI endpoints
// Ultra-optimized: Uses single-query bulk aggregation to prevent D1 row read exhaustion
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

interface KpiRateRow {
  effective_from: string
  rank_tier: number
  rank_label: string
  rank_min_amount: number
  rank_max_amount: number | null
  bucket: number
  bucket_label: string
  bucket_type: string
  amount_thb: number
}

export function getBucket(pctGap: number): number {
  if (pctGap >= 30) return 1
  if (pctGap >= 20) return 2
  if (pctGap >= 10) return 3
  if (pctGap >= 0)  return 4
  if (pctGap > -10) return 5
  if (pctGap > -20) return 6
  if (pctGap > -30) return 7
  return 8
}

export interface CalcKpiOptions {
  store_id?: string | null
  region?: string | null
  refDate?: string | null
}

/**
 * Bulk KPI calculation: Computes KPI for all stores (or filtered) in 3 fast queries total.
 */
export async function calcAllStoresKpi(
  db: D1Database,
  options: CalcKpiOptions = {}
): Promise<KpiResult[]> {
  const { store_id, region, refDate: customRefDate } = options

  // 1. Fetch settings, rates, and active dates in parallel
  const [settingsRow, ratesResult, latestDateRow] = await Promise.all([
    db.prepare('SELECT included_stock_types FROM kpi_settings ORDER BY id DESC LIMIT 1')
      .first<{ included_stock_types: string }>(),
    db.prepare('SELECT effective_from, rank_tier, rank_label, rank_min_amount, rank_max_amount, bucket, bucket_label, bucket_type, amount_thb FROM kpi_rate_matrix ORDER BY effective_from DESC')
      .all<KpiRateRow>(),
    db.prepare('SELECT MAX(snapshot_date) as max_date FROM stock_snapshots WHERE COALESCE(is_active, 1) = 1')
      .first<{ max_date: string | null }>(),
  ])

  const includedTypes: string[] = settingsRow?.included_stock_types
    ? JSON.parse(settingsRow.included_stock_types)
    : ['SELLABLE', 'ONLINE']

  const allRates: KpiRateRow[] = ratesResult.results || []
  const latestDate = latestDateRow?.max_date
  if (!latestDate) return []

  const latestMonth = latestDate.slice(0, 7) // e.g. "2026-09"
  let refDate = customRefDate

  // Determine reference date if not provided
  if (!refDate) {
    const firstOfMonth = `${latestMonth}-01`
    const hasFirst = await db.prepare(
      'SELECT 1 FROM stock_snapshots WHERE snapshot_date = ? AND COALESCE(is_active, 1) = 1 LIMIT 1'
    ).bind(firstOfMonth).first()

    if (hasFirst) {
      refDate = firstOfMonth
    } else {
      const earliestRow = await db.prepare(
        'SELECT MIN(snapshot_date) as min_date FROM stock_snapshots WHERE snapshot_date LIKE ? AND COALESCE(is_active, 1) = 1'
      ).bind(`${latestMonth}%`).first<{ min_date: string | null }>()
      refDate = earliestRow?.min_date ?? firstOfMonth
    }
  }

  // 2. Query stores matching filter
  let storeQuery = 'SELECT store_id, store_name, region FROM stores WHERE 1=1'
  const storeBinds: string[] = []
  if (region) {
    storeQuery += ' AND region = ?'
    storeBinds.push(region)
  }
  if (store_id) {
    storeQuery += ' AND store_id = ?'
    storeBinds.push(store_id)
  }
  storeQuery += ' ORDER BY region, store_id'

  const { results: stores } = storeBinds.length > 0
    ? await db.prepare(storeQuery).bind(...storeBinds).all<{ store_id: string; store_name: string; region: string }>()
    : await db.prepare(storeQuery).all<{ store_id: string; store_name: string; region: string }>()

  if (!stores || stores.length === 0) return []

  // 3. Single aggregated query for ALL relevant stores across refDate and latestDate
  const stockTypePlaceholders = includedTypes.map(() => '?').join(',')
  const queryParams: any[] = [...includedTypes, refDate, latestDate]

  let aggQuery = `
    SELECT 
      ss.store_id,
      ss.snapshot_date,
      ss.nonmove_period,
      COUNT(DISTINCT ss.model) as sku_count,
      COALESCE(SUM(ss.stock_qty), 0) as qty,
      COALESCE(SUM(ss.stock_amount), 0) as amount
    FROM stock_snapshots ss
    LEFT JOIN exclusion_requests er 
      ON er.store_id = ss.store_id 
     AND er.model = ss.model 
     AND er.status = 'approved'
    WHERE ss.nonmove_flag = 'Nonmove'
      AND COALESCE(ss.is_active, 1) = 1
      AND ss.stock_type IN (${stockTypePlaceholders})
      AND er.id IS NULL
      AND ss.snapshot_date IN (?, ?)
  `

  if (store_id) {
    aggQuery += ' AND ss.store_id = ?'
    queryParams.push(store_id)
  }

  aggQuery += ' GROUP BY ss.store_id, ss.snapshot_date, ss.nonmove_period'

  const { results: aggRows } = await db.prepare(aggQuery).bind(...queryParams).all<{
    store_id: string
    snapshot_date: string
    nonmove_period: string
    sku_count: number
    qty: number
    amount: number
  }>()

  // Map aggregated data: store_id -> snapshot_date -> nonmove_period -> PeriodMetrics
  const storeDataMap = new Map<string, Map<string, Record<string, PeriodMetrics>>>()

  for (const row of (aggRows || [])) {
    if (!storeDataMap.has(row.store_id)) {
      storeDataMap.set(row.store_id, new Map())
    }
    const dateMap = storeDataMap.get(row.store_id)!
    if (!dateMap.has(row.snapshot_date)) {
      dateMap.set(row.snapshot_date, {
        '121 up': { sku_count: 0, qty: 0, amount: 0 },
        '91-120': { sku_count: 0, qty: 0, amount: 0 },
        '61-90':  { sku_count: 0, qty: 0, amount: 0 },
        '30-60':  { sku_count: 0, qty: 0, amount: 0 },
      })
    }
    const periods = dateMap.get(row.snapshot_date)!
    if (row.nonmove_period && periods[row.nonmove_period]) {
      periods[row.nonmove_period] = {
        sku_count: Number(row.sku_count) || 0,
        qty: Number(row.qty) || 0,
        amount: Number(row.amount) || 0,
      }
    }
  }

  const periodKeys: ('121 up' | '91-120' | '61-90' | '30-60')[] = ['121 up', '91-120', '61-90', '30-60']
  const effectiveMonth = `${latestMonth}-01`

  // 4. Build KpiResult for each store in memory
  const results: KpiResult[] = []

  for (const store of stores) {
    const dateMap = storeDataMap.get(store.store_id)
    const refPeriods = dateMap?.get(refDate) || {
      '121 up': { sku_count: 0, qty: 0, amount: 0 },
      '91-120': { sku_count: 0, qty: 0, amount: 0 },
      '61-90':  { sku_count: 0, qty: 0, amount: 0 },
      '30-60':  { sku_count: 0, qty: 0, amount: 0 },
    }
    const latestPeriods = dateMap?.get(latestDate) || {
      '121 up': { sku_count: 0, qty: 0, amount: 0 },
      '91-120': { sku_count: 0, qty: 0, amount: 0 },
      '61-90':  { sku_count: 0, qty: 0, amount: 0 },
      '30-60':  { sku_count: 0, qty: 0, amount: 0 },
    }

    const refTotalAmt = Object.values(refPeriods).reduce((s, p) => s + p.amount, 0)
    const latestTotalAmt = Object.values(latestPeriods).reduce((s, p) => s + p.amount, 0)

    let totalRefSku = 0, totalRefQty = 0
    let totalLatestSku = 0, totalLatestQty = 0
    const matrixPeriods: any = {}

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

    // Match rate row
    const rateRow = allRates.find(r =>
      r.effective_from <= effectiveMonth &&
      r.bucket === bucket &&
      latestTotalAmt >= r.rank_min_amount &&
      (r.rank_max_amount === null || r.rank_max_amount === undefined || latestTotalAmt <= r.rank_max_amount)
    )

    results.push({
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
    })
  }

  return results
}

/**
 * Single store helper: returns KPI for one store.
 */
export async function calcStoreKpi(
  db: D1Database,
  store_id: string,
  referenceDate?: string | null
): Promise<KpiResult | null> {
  const results = await calcAllStoresKpi(db, { store_id, refDate: referenceDate })
  return results.length > 0 ? results[0] : null
}
