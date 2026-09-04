// ============================================================
// KPI calculation helper — shared between store and admin KPI endpoints
// ============================================================
import type { D1Database } from '@cloudflare/workers-types'

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

  // Get latest date for this store
  const latestRow = await db.prepare(
    'SELECT MAX(snapshot_date) as date FROM stock_snapshots WHERE store_id = ?'
  ).bind(store_id).first<{ date: string | null }>()
  const latestDate = latestRow?.date
  if (!latestDate) return null

  // Reference date: default = 1st of current month
  const now = new Date()
  const defaultRef = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const refDate = referenceDate ?? defaultRef

  // Get approved exclusion models
  const { results: approved } = await db.prepare(
    `SELECT DISTINCT model FROM exclusion_requests WHERE store_id = ? AND status = 'approved'`
  ).bind(store_id).all<{ model: string }>()
  const excludedModels = approved.map(r => r.model)
  const excludePlaceholders = excludedModels.length > 0
    ? `AND model NOT IN (${excludedModels.map(() => '?').join(',')})` : ''

  // Nonmove SKU Amount for a given date
  async function getAmount(date: string): Promise<number> {
    const params = [store_id, date, ...includedTypes, ...excludedModels]
    const row = await db.prepare(
      `SELECT COALESCE(SUM(stock_amount), 0) as total
       FROM stock_snapshots
       WHERE store_id = ?
         AND snapshot_date = ?
         AND nonmove_flag = 'Nonmove'
         AND stock_type IN (${placeholders})
         ${excludePlaceholders}`
    ).bind(...params).first<{ total: number }>()
    return row?.total ?? 0
  }

  const [latestAmt, refAmt] = await Promise.all([getAmount(latestDate), getAmount(refDate)])

  // % gap
  let pctGap: number
  if (refAmt === 0) {
    pctGap = latestAmt > 0 ? 100 : 0  // edge case: ref=0
  } else {
    pctGap = ((latestAmt - refAmt) / refAmt) * 100
  }

  const bucket = getBucket(pctGap)

  // Get KPI rate matrix (effective version for this month)
  const effectiveMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const rateRow = await db.prepare(
    `SELECT rank_tier, rank_label, bucket, bucket_label, bucket_type, amount_thb
     FROM kpi_rate_matrix
     WHERE effective_from <= ?
       AND bucket = ?
       AND ? BETWEEN rank_min_amount AND COALESCE(rank_max_amount, 9999999999)
     ORDER BY effective_from DESC
     LIMIT 1`
  ).bind(effectiveMonth, bucket, latestAmt).first<{
    rank_tier: number; rank_label: string; bucket: number
    bucket_label: string; bucket_type: string; amount_thb: number
  }>()

  return {
    store_id: store.store_id,
    store_name: store.store_name,
    region: store.region,
    reference_date: refDate,
    reference_amount: refAmt,
    latest_date: latestDate,
    latest_amount: latestAmt,
    pct_gap: Math.round(pctGap * 100) / 100,
    rank_tier: rateRow?.rank_tier ?? 0,
    rank_label: rateRow?.rank_label ?? '-',
    bucket: rateRow?.bucket ?? bucket,
    bucket_label: rateRow?.bucket_label ?? '-',
    bucket_type: (rateRow?.bucket_type as 'penalty' | 'reward') ?? 'penalty',
    amount_thb: rateRow?.amount_thb ?? 0,
  }
}
