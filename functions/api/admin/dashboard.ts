// GET /api/admin/dashboard?region=&store=
import type { PagesFunction } from '@cloudflare/workers-types'
import type { Env } from '../_middleware'
import { requireAdmin, isResponse } from './_auth'
import { calcStoreKpi } from '../_kpi_calc'

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const auth = await requireAdmin(request, env.JWT_SECRET)
  if (isResponse(auth)) return auth

  const url = new URL(request.url)
  const regionFilter = url.searchParams.get('region')
  const storeFilter = url.searchParams.get('store')
  const refDate = url.searchParams.get('ref_date')

  // Get all stores (filtered)
  let query = 'SELECT store_id FROM stores WHERE 1=1'
  const binds: string[] = []
  if (regionFilter) { query += ' AND region = ?'; binds.push(regionFilter) }
  if (storeFilter) { query += ' AND store_id = ?'; binds.push(storeFilter) }

  const stmt = binds.length > 0
    ? env.DB.prepare(query).bind(...binds)
    : env.DB.prepare(query)
  const { results: stores } = await stmt.all<{ store_id: string }>()

  // Pending count
  const pendingRow = await env.DB.prepare(
    "SELECT COUNT(*) as cnt FROM exclusion_requests WHERE status = 'pending'"
  ).first<{ cnt: number }>()

  // KPI per store
  const kpi_rows = await Promise.all(
    stores.map(s => calcStoreKpi(env.DB, s.store_id, refDate))
  )

  // Trend: nonmove total amount per date
  const { results: trend } = await env.DB.prepare(
    `SELECT snapshot_date as date,
            SUM(stock_amount) as total_amount,
            COUNT(DISTINCT store_id) as store_count
     FROM stock_snapshots
     WHERE nonmove_flag = 'Nonmove'
     GROUP BY snapshot_date
     ORDER BY snapshot_date`
  ).all()

  return Response.json({
    kpi_rows: kpi_rows.filter(Boolean),
    trend,
    pending_count: pendingRow?.cnt ?? 0,
  })
}
