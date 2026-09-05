// GET /api/admin/dashboard?region=&store=
import type { PagesFunction } from '@cloudflare/workers-types'
import type { Env } from '../_middleware'
import { requireAdmin, isResponse } from './_auth'
import { calcAllStoresKpi } from '../_kpi_calc'

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const auth = await requireAdmin(request, (env.JWT_SECRET ?? 'haier-nonmove-kpi-secret-2024-xYz9abcDEF'))
  if (isResponse(auth)) return auth

  const url = new URL(request.url)
  const regionFilter = url.searchParams.get('region')
  const storeFilter = url.searchParams.get('store')
  const refDate = url.searchParams.get('ref_date')

  // Run KPI calculation, pending count, and trend in parallel
  const [kpi_rows, pendingRow, trendResult] = await Promise.all([
    calcAllStoresKpi(env.DB, {
      region: regionFilter,
      store_id: storeFilter,
      refDate,
    }),
    env.DB.prepare(
      "SELECT COUNT(*) as cnt FROM exclusion_requests WHERE status = 'pending'"
    ).first<{ cnt: number }>(),
    env.DB.prepare(
      `SELECT snapshot_date as date,
              SUM(stock_amount) as total_amount,
              COUNT(DISTINCT store_id) as store_count
       FROM stock_snapshots
       WHERE nonmove_flag = 'Nonmove' AND COALESCE(is_active, 1) = 1
       GROUP BY snapshot_date
       ORDER BY snapshot_date`
    ).all(),
  ])

  return Response.json({
    kpi_rows,
    trend: trendResult.results || [],
    pending_count: pendingRow?.cnt ?? 0,
  })
}

