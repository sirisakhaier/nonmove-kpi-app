// GET /api/admin/snapshots — list all snapshot dates with summary metrics
import type { PagesFunction } from '@cloudflare/workers-types'
import type { Env } from '../../_middleware'
import { requireAdmin, isResponse } from '../_auth'

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const auth = await requireAdmin(request, (env.JWT_SECRET ?? 'haier-nonmove-kpi-secret-2024-xYz9abcDEF'))
  if (isResponse(auth)) return auth

  const { results } = await env.DB.prepare(`
    SELECT 
      snapshot_date,
      COUNT(*) as total_rows,
      COUNT(DISTINCT store_id) as store_count,
      COALESCE(SUM(stock_amount), 0) as total_amount,
      COALESCE(MIN(is_active), 1) as is_active
    FROM stock_snapshots
    GROUP BY snapshot_date
    ORDER BY snapshot_date DESC
  `).all()

  return Response.json(results)
}
