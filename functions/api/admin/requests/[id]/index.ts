// GET  /api/admin/requests/:id  — request detail
// DELETE /api/admin/requests/:id — hard delete + audit log
import type { PagesFunction } from '@cloudflare/workers-types'
import type { Env } from '../../../_middleware'
import { requireAdmin, isResponse } from '../../_auth'

export const onRequestGet: PagesFunction<Env> = async ({ request, env, params }) => {
  const auth = await requireAdmin(request, env.JWT_SECRET)
  if (isResponse(auth)) return auth

  const id = Number((params as any).id)
  const row = await env.DB.prepare(
    `SELECT er.*, s.store_name, s.region,
            GROUP_CONCAT(rp.photo_url) as photo_urls
     FROM exclusion_requests er
     JOIN stores s ON s.store_id = er.store_id
     LEFT JOIN request_photos rp ON rp.exclusion_request_id = er.id
     WHERE er.id = ? GROUP BY er.id`
  ).bind(id).first<any>()

  if (!row) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json({ ...row, photos: row.photo_urls ? row.photo_urls.split(',') : [] })
}

export const onRequestDelete: PagesFunction<Env> = async ({ request, env, params }) => {
  const auth = await requireAdmin(request, env.JWT_SECRET)
  if (isResponse(auth)) return auth

  const id = Number((params as any).id)
  const row = await env.DB.prepare(
    'SELECT * FROM exclusion_requests WHERE id = ?'
  ).bind(id).first<any>()
  if (!row) return Response.json({ error: 'Not found' }, { status: 404 })

  // Write audit log before deleting
  await env.DB.prepare(
    `INSERT INTO deletion_audit_log
       (request_id, store_id, model, requester_name, reason, status_at_delete, deleted_by)
     VALUES (?,?,?,?,?,?,?)`
  ).bind(id, row.store_id, row.model, row.requester_name, row.reason, row.status, auth.username).run()

  await env.DB.prepare('DELETE FROM exclusion_requests WHERE id = ?').bind(id).run()
  return Response.json({ ok: true })
}
