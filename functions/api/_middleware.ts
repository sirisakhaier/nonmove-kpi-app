// ============================================================
// _middleware.ts — Admin JWT verification + CORS
// ============================================================
import type { PagesFunction, EventContext } from '@cloudflare/workers-types'

export interface Env {
  DB: D1Database
  PHOTOS: R2Bucket
  JWT_SECRET: string
}

// Simple JWT sign/verify using Web Crypto (Workers-compatible)
async function signJwt(payload: Record<string, unknown>, secret: string): Promise<string> {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = btoa(JSON.stringify(payload))
  const data = `${header}.${body}`
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
  return `${data}.${sigB64}`
}

async function verifyJwt(token: string, secret: string): Promise<Record<string, unknown> | null> {
  try {
    const [header, body, sig] = token.split('.')
    const data = `${header}.${body}`
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    )
    const sigBytes = Uint8Array.from(atob(sig), c => c.charCodeAt(0))
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(data))
    if (!valid) return null
    return JSON.parse(atob(body))
  } catch {
    return null
  }
}

export { signJwt, verifyJwt }

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export const onRequest: PagesFunction<Env> = async (context) => {
  // Handle preflight
  if (context.request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  // Add CORS to all responses
  const response = await context.next()
  const newHeaders = new Headers(response.headers)
  Object.entries(CORS_HEADERS).forEach(([k, v]) => newHeaders.set(k, v))
  return new Response(response.body, {
    status: response.status,
    headers: newHeaders,
  })
}
