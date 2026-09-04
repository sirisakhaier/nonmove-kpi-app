// POST /api/admin/logout
import type { PagesFunction } from '@cloudflare/workers-types'
import type { Env } from '../_middleware'

export const onRequestPost: PagesFunction<Env> = async () => {
  const headers = new Headers()
  headers.set('Set-Cookie', 'admin_token=; Path=/; HttpOnly; Max-Age=0')
  headers.set('Content-Type', 'application/json')
  return new Response(JSON.stringify({ ok: true }), { headers })
}
