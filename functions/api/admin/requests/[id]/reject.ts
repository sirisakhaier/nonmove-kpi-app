// POST /api/admin/requests/:id/reject
import type { PagesFunction } from '@cloudflare/workers-types'
import type { Env } from '../../../_middleware'
import { requireAdmin, isResponse } from '../../_auth'

export const onRequestPost: PagesFunction<Env> = async ({ request, env, params }) => {
  const auth = await requireAdmin(request, (env.JWT_SECRET ?? 'haier-nonmove-kpi-secret-2024-xYz9abcDEF'))
  if (isResponse(auth)) return auth

  const id = Number((params as any).id)
  const { comment } = await request.json() as { comment: string }
  if (!comment) return Response.json({ error: 'comment required' }, { status: 400 })

  await env.DB.prepare(
    `UPDATE exclusion_requests
     SET status='rejected', admin_comment=?, updated_at=datetime('now')
     WHERE id=?`
  ).bind(comment, id).run()
  return Response.json({ ok: true, id, status: 'rejected' })
}
