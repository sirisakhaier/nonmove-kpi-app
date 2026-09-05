// DELETE /api/admin/snapshots/:date — delete all snapshot data for a specific date
import type { PagesFunction } from '@cloudflare/workers-types'
import type { Env } from '../../../_middleware'
import { requireAdmin, isResponse } from '../../_auth'

export const onRequestDelete: PagesFunction<Env> = async ({ request, env, params }) => {
  const auth = await requireAdmin(request, (env.JWT_SECRET ?? 'haier-nonmove-kpi-secret-2024-xYz9abcDEF'))
  if (isResponse(auth)) return auth

  const date = params.date as string
  if (!date) return Response.json({ error: 'date required' }, { status: 400 })

  const result = await env.DB.prepare(
    `DELETE FROM stock_snapshots WHERE snapshot_date = ?`
  ).bind(date).run()

  return Response.json({ ok: true, snapshot_date: date, deleted_rows: result.meta.changes })
}
