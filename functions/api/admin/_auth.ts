// Admin JWT auth helper for Pages Functions
import type { D1Database } from '@cloudflare/workers-types'
import { verifyJwt } from '../_middleware'

export async function requireAdmin(
  request: Request,
  jwtSecret: string
): Promise<{ username: string } | Response> {
  // Check cookie
  const cookie = request.headers.get('Cookie') ?? ''
  const match = cookie.match(/admin_token=([^;]+)/)
  const token = match?.[1]
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const payload = await verifyJwt(token, jwtSecret)
  if (!payload || payload.role !== 'admin') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return { username: payload.username as string }
}

export function isResponse(v: unknown): v is Response {
  return v instanceof Response
}
