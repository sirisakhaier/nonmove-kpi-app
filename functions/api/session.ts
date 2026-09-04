// POST /api/session — create a lightweight PC session token
import type { PagesFunction } from '@cloudflare/workers-types'
import type { Env } from './_middleware'
import { signJwt } from './_middleware'

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const { store_id, name, phone } = await request.json() as {
    store_id: string; name: string; phone: string
  }
  if (!store_id || !name || !phone) {
    return Response.json({ error: 'store_id, name, and phone are required' }, { status: 400 })
  }

  // Verify store exists
  const store = await env.DB.prepare(
    'SELECT store_id, store_name, region FROM stores WHERE store_id = ?'
  ).bind(store_id).first<{ store_id: string; store_name: string; region: string }>()
  if (!store) {
    return Response.json({ error: 'Store not found' }, { status: 404 })
  }

  // Sign a JWT with PC info (expires in 24h)
  const payload = {
    sub: store_id,
    store_id,
    store_name: store.store_name,
    region: store.region,
    name,
    phone,
    role: 'pc',
    exp: Math.floor(Date.now() / 1000) + 86400,
  }
  const token = await signJwt(payload, env.JWT_SECRET)
  return Response.json({ token, store_id, store_name: store.store_name, region: store.region, name, phone })
}
