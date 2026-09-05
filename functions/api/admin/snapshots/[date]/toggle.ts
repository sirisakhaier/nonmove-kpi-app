// POST /api/admin/snapshots/:date/toggle — toggle is_active for an entire date
import type { PagesFunction } from '@cloudflare/workers-types'
import type { Env } from '../../../_middleware'
import { requireAdmin, isResponse } from '../../_auth'

export const onRequestPost: PagesFunction<Env> = async ({ request, env, params }) => {
  const auth = await requireAdmin(request, (env.JWT_SECRET ?? 'haier-nonmove-kpi-secret-2024-xYz9abcDEF'))
  if (isResponse(auth)) return auth

  const date = params.date as string
  if (!date) return Response.json({ error: 'date required' }, { status: 400 })

  const { is_active } = await request.json() as { is_active: number }

  await env.DB.prepare(
    `UPDATE stock_snapshots SET is_active = ? WHERE snapshot_date = ?`
  ).bind(is_active ? 1 : 0, date).run()

  return Response.json({ ok: true, snapshot_date: date, is_active: is_active ? 1 : 0 })
}
