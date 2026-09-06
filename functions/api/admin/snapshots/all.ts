// DELETE /api/admin/snapshots/all — delete all snapshot data across all dates
import type { PagesFunction } from '@cloudflare/workers-types'
import type { Env } from '../../_middleware'
import { requireAdmin, isResponse } from '../_auth'

export const onRequestDelete: PagesFunction<Env> = async ({ request, env }) => {
  const auth = await requireAdmin(request, (env.JWT_SECRET ?? 'haier-nonmove-kpi-secret-2024-xYz9abcDEF'))
  if (isResponse(auth)) return auth

  try {
    // 1. Unlink any exclusion requests to prevent foreign key errors
    await env.DB.prepare(
      `UPDATE exclusion_requests SET stock_snapshot_id = NULL`
    ).run().catch(() => {})

    // 2. Delete all stock snapshots
    const result = await env.DB.prepare(
      `DELETE FROM stock_snapshots`
    ).run()

    return Response.json({
      ok: true,
      deleted_rows: result.meta.changes,
      message: 'All snapshot data successfully deleted',
    })
  } catch (err: any) {
    return Response.json({ error: err.message ?? 'Failed to delete snapshots' }, { status: 500 })
  }
}
