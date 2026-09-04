// POST /api/admin/requests/:id/approve
import type { PagesFunction } from '@cloudflare/workers-types'
import type { Env } from '../../../_middleware'
import { requireAdmin, isResponse } from '../../_auth'

export const onRequestPost: PagesFunction<Env> = async ({ request, env, params }) => {
  const auth = await requireAdmin(request, env.JWT_SECRET)
  if (isResponse(auth)) return auth

  const id = Number((params as any).id)
  const result = await env.DB.prepare(
    `UPDATE exclusion_requests
     SET status='approved', admin_comment=NULL, updated_at=datetime('now')
     WHERE id=?`
  ).bind(id).run()

  if (result.meta.changes === 0) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json({ ok: true, id, status: 'approved' })
}
