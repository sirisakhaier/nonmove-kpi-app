// PUT /api/requests/:id — resubmit a needs_resubmit request
import type { PagesFunction } from '@cloudflare/workers-types'
import type { Env } from '../_middleware'
import { verifyJwt } from '../_middleware'

export const onRequestPut: PagesFunction<Env> = async ({ request, env, params }) => {
  const auth = request.headers.get('Authorization') ?? ''
  const token = auth.replace('Bearer ', '')
  const session = await verifyJwt(token, (env.JWT_SECRET ?? 'haier-nonmove-kpi-secret-2024-xYz9abcDEF'))
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const id = Number((params as any).id)
  const existing = await env.DB.prepare(
    `SELECT * FROM exclusion_requests WHERE id = ? AND store_id = ?`
  ).bind(id, session.sub).first<any>()

  if (!existing) return Response.json({ error: 'Not found' }, { status: 404 })
  if (existing.status !== 'needs_resubmit') {
    return Response.json({ error: 'Can only edit requests with needs_resubmit status' }, { status: 400 })
  }

  const form = await request.formData()
  const reason = form.get('reason') as string
  const reason_detail = form.get('reason_detail') as string
  const issue_date = form.get('issue_date') as string | null
  const clear_plan = form.get('clear_plan') as string | null
  const clear_plan_date = form.get('clear_plan_date') as string | null

  await env.DB.prepare(
    `UPDATE exclusion_requests
     SET reason=?, reason_detail=?, issue_date=?, clear_plan=?, clear_plan_date=?,
         status='pending', admin_comment=NULL, updated_at=datetime('now')
     WHERE id=?`
  ).bind(reason, reason_detail, issue_date ?? null, clear_plan ?? null, clear_plan_date ?? null, id).run()

  // Replace photos if new ones provided
  const photos = form.getAll('photos')
  if (photos.length > 0 && photos[0] instanceof File) {
    await env.DB.prepare('DELETE FROM request_photos WHERE exclusion_request_id=?').bind(id).run()
    let photoOrder = 0
    for (const photo of photos) {
      if (!(photo instanceof File)) continue
      const key = `requests/${id}/${photoOrder}_${Date.now()}_${photo.name}`
      await env.PHOTOS.put(key, photo.stream(), { httpMetadata: { contentType: photo.type } })
      await env.DB.prepare(
        'INSERT INTO request_photos (exclusion_request_id, photo_url, sort_order) VALUES (?,?,?)'
      ).bind(id, `/api/photos/${key}`, photoOrder).run()
      photoOrder++
    }
  }

  return Response.json({ id, status: 'pending' })
}
