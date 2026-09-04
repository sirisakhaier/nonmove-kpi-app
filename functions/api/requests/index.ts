// GET  /api/requests/mine  — PC's own requests
// POST /api/requests       — create new exclusion request (multipart)
import type { PagesFunction } from '@cloudflare/workers-types'
import type { Env } from '../_middleware'
import { verifyJwt } from '../_middleware'

async function getSession(request: Request, secret: string) {
  const auth = request.headers.get('Authorization') ?? ''
  const token = auth.replace('Bearer ', '')
  if (!token) return null
  return verifyJwt(token, secret)
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const session = await getSession(request, env.JWT_SECRET)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { results } = await env.DB.prepare(
    `SELECT er.*, GROUP_CONCAT(rp.photo_url) as photo_urls
     FROM exclusion_requests er
     LEFT JOIN request_photos rp ON rp.exclusion_request_id = er.id
     WHERE er.store_id = ? AND er.requester_name = ? AND er.requester_phone = ?
     GROUP BY er.id
     ORDER BY er.created_at DESC`
  ).bind(session.sub, session.name, session.phone).all()

  const enriched = (results as any[]).map(r => ({
    ...r,
    photos: r.photo_urls ? r.photo_urls.split(',') : [],
  }))
  return Response.json(enriched)
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const session = await getSession(request, env.JWT_SECRET)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const form = await request.formData()
  const stock_snapshot_id = form.get('stock_snapshot_id')
  const snapshot_date = form.get('snapshot_date') as string
  const model = form.get('model') as string
  const product_name = form.get('product_name') as string | null
  const reason = form.get('reason') as string
  const reason_detail = form.get('reason_detail') as string
  const issue_date = form.get('issue_date') as string | null
  const clear_plan = form.get('clear_plan') as string | null
  const clear_plan_date = form.get('clear_plan_date') as string | null

  if (!snapshot_date || !model || !reason || !reason_detail) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Check no existing active request for this model+store+date
  const existing = await env.DB.prepare(
    `SELECT id FROM exclusion_requests
     WHERE store_id = ? AND model = ? AND snapshot_date = ?
       AND status NOT IN ('rejected')`
  ).bind(session.sub, model, snapshot_date).first()
  if (existing) {
    return Response.json({ error: 'A request for this SKU already exists' }, { status: 409 })
  }

  // Insert request
  const { meta } = await env.DB.prepare(
    `INSERT INTO exclusion_requests
       (stock_snapshot_id, store_id, snapshot_date, model, product_name,
        requester_name, requester_phone, reason, reason_detail, issue_date,
        clear_plan, clear_plan_date, status)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'pending')`
  ).bind(
    stock_snapshot_id ?? null,
    session.sub as string,
    snapshot_date, model,
    product_name ?? null,
    session.name as string,
    session.phone as string,
    reason, reason_detail,
    issue_date ?? null,
    clear_plan ?? null,
    clear_plan_date ?? null
  ).run()

  const requestId = meta.last_row_id

  // Upload photos to R2
  const photos = form.getAll('photos')
  let photoOrder = 0
  for (const photo of photos) {
    if (!(photo instanceof File)) continue
    const key = `requests/${requestId}/${photoOrder}_${Date.now()}_${photo.name}`
    await env.PHOTOS.put(key, photo.stream(), {
      httpMetadata: { contentType: photo.type },
    })
    const photoUrl = `/api/photos/${key}`
    await env.DB.prepare(
      'INSERT INTO request_photos (exclusion_request_id, photo_url, sort_order) VALUES (?,?,?)'
    ).bind(requestId, photoUrl, photoOrder).run()
    photoOrder++
  }

  return Response.json({ id: requestId, status: 'pending' }, { status: 201 })
}
