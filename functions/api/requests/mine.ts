// GET /api/requests/mine — PC user's own submitted requests
import type { PagesFunction } from '@cloudflare/workers-types'
import type { Env } from '../_middleware'
import { verifyJwt } from '../_middleware'

async function getSession(request: Request, secret: string) {
  const auth = request.headers.get('Authorization') ?? ''
  const token = auth.replace('Bearer ', '').trim()
  if (!token) return null
  return verifyJwt(token, secret)
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const session = await getSession(request, (env.JWT_SECRET ?? 'haier-nonmove-kpi-secret-2024-xYz9abcDEF'))
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // User only sees their own requests (by phone and store_id)
  const { results } = await env.DB.prepare(
    `SELECT er.*, GROUP_CONCAT(rp.photo_url) as photo_urls
     FROM exclusion_requests er
     LEFT JOIN request_photos rp ON rp.exclusion_request_id = er.id
     WHERE er.store_id = ? AND er.requester_phone = ?
     GROUP BY er.id
     ORDER BY er.created_at DESC`
  ).bind(session.sub, session.phone).all()

  const enriched = (results as any[]).map(r => ({
    ...r,
    photos: r.photo_urls ? r.photo_urls.split(',') : [],
  }))

  return Response.json(enriched)
}
