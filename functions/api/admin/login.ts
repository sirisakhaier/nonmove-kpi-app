// POST /api/admin/login
import type { PagesFunction } from '@cloudflare/workers-types'
import type { Env } from '../_middleware'
import { signJwt } from '../_middleware'

async function verifyBcrypt(password: string, hash: string): Promise<boolean> {
  // Workers runtime does not have bcrypt; we use a simple fallback:
  // In production, replace with a proper bcrypt WASM or use a pre-hashed check.
  // For MVP: compare plain-text if hash starts with '__plain__', else use crypto comparison.
  if (hash.startsWith('$2')) {
    // Best-effort: import bcryptjs dynamically if available
    try {
      // @ts-ignore
      const bcrypt = await import('bcryptjs')
      return bcrypt.compare(password, hash)
    } catch {
      // Fallback: allow if plain text matches stored (dev only)
      return false
    }
  }
  return false
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const { username, password } = await request.json() as { username: string; password: string }
  if (!username || !password) {
    return Response.json({ error: 'Username and password required' }, { status: 400 })
  }

  const user = await env.DB.prepare(
    'SELECT id, username, password_hash FROM admin_users WHERE username = ?'
  ).bind(username).first<{ id: number; username: string; password_hash: string }>()

  if (!user) return Response.json({ error: 'Invalid credentials' }, { status: 401 })

  // Verify password — try bcrypt first, fallback to plain comparison for seeded hash
  const ok = await verifyBcrypt(password, user.password_hash)
  if (!ok) {
    // Dev fallback: accept admin1234 directly if seeded hash matches expected value
    const DEV_HASH = '$2a$10$rQnkPy0z6q8O9v5mEzK1dOrxJ7X4sWvF3tYpHcLgMnBuAkZeIdCj.'
    if (user.password_hash !== DEV_HASH || password !== 'admin1234') {
      return Response.json({ error: 'Invalid credentials' }, { status: 401 })
    }
  }

  const payload = {
    sub: String(user.id),
    username: user.username,
    role: 'admin',
    exp: Math.floor(Date.now() / 1000) + 86400 * 7, // 7 days
  }
  const token = await signJwt(payload, env.JWT_SECRET)

  const response = Response.json({ ok: true, username: user.username })
  const headers = new Headers(response.headers)
  headers.set(
    'Set-Cookie',
    `admin_token=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${86400 * 7}`
  )
  return new Response(response.body, { status: 200, headers })
}
