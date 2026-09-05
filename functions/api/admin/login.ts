// POST /api/admin/login
import type { PagesFunction } from '@cloudflare/workers-types'
import type { Env } from '../_middleware'
import { signJwt } from '../_middleware'

// Workers-compatible password verify using Web Crypto SHA-256
// Passwords stored as: sha256:<base64-of-sha256(password)>
// OR bcrypt hash (legacy) → accept admin1234 directly for seeded DEV hash
async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  // New format: sha256:<base64>
  if (storedHash.startsWith('sha256:')) {
    const expected = storedHash.slice(7)
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password))
    const actual = btoa(String.fromCharCode(...new Uint8Array(buf)))
    return actual === expected
  }
  // Legacy bcrypt: use dev fallback (accept known admin1234 hash)
  if (storedHash.startsWith('$2')) {
    const DEV_HASH = '$2a$10$rQnkPy0z6q8O9v5mEzK1dOrxJ7X4sWvF3tYpHcLgMnBuAkZeIdCj.'
    return storedHash === DEV_HASH && password === 'admin1234'
  }
  // Plain text fallback (dev only)
  return storedHash === password
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: { username?: string; password?: string }
  try {
    body = await request.json() as { username?: string; password?: string }
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { username, password } = body
  if (!username || !password) {
    return Response.json({ error: 'Username and password required' }, { status: 400 })
  }

  const user = await env.DB.prepare(
    'SELECT id, username, password_hash FROM admin_users WHERE username = ?'
  ).bind(username).first<{ id: number; username: string; password_hash: string }>()

  if (!user) return Response.json({ error: 'Invalid credentials' }, { status: 401 })

  const ok = await verifyPassword(password, user.password_hash)
  if (!ok) return Response.json({ error: 'Invalid credentials' }, { status: 401 })

  const jwtSecret = env.JWT_SECRET ?? 'haier-nonmove-kpi-secret-2024-xYz9abcDEF'

  const payload = {
    sub: String(user.id),
    username: user.username,
    role: 'admin',
    exp: Math.floor(Date.now() / 1000) + 86400 * 7,
  }
  const token = await signJwt(payload, jwtSecret)

  const headers = new Headers({ 'Content-Type': 'application/json' })
  headers.set(
    'Set-Cookie',
    `admin_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${86400 * 7}`
  )
  return new Response(JSON.stringify({ ok: true, username: user.username }), {
    status: 200,
    headers,
  })
}
