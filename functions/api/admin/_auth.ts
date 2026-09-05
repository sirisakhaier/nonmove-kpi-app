// Admin JWT auth helper for Pages Functions
import { verifyJwt } from '../_middleware'

const FALLBACK_SECRET = 'haier-nonmove-kpi-secret-2024-xYz9abcDEF'

export async function requireAdmin(
  request: Request,
  jwtSecret?: string
): Promise<{ username: string } | Response> {
  const secret = jwtSecret || FALLBACK_SECRET
  
  // 1. Check Authorization: Bearer <token>
  const authHeader = request.headers.get('Authorization') ?? ''
  let token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null

  // 2. Check Cookie: admin_token=<token>
  if (!token) {
    const cookie = request.headers.get('Cookie') ?? ''
    const match = cookie.match(/admin_token=([^;]+)/)
    token = match?.[1] ? match[1].trim() : null
  }

  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const payload = await verifyJwt(token, secret)
  if (!payload || payload.role !== 'admin') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return { username: payload.username as string }
}

export function isResponse(v: unknown): v is Response {
  return v instanceof Response
}
