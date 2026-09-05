// ============================================================
// _middleware.ts — Admin JWT verification + CORS + Unicode Base64
// ============================================================
import type { PagesFunction } from '@cloudflare/workers-types'

export interface Env {
  DB: D1Database
  PHOTOS: R2Bucket
  JWT_SECRET: string
}

export const FALLBACK_JWT_SECRET = 'haier-nonmove-kpi-secret-2024-xYz9abcDEF'

function base64UrlEncode(strOrBytes: string | Uint8Array): string {
  const bytes = typeof strOrBytes === 'string' ? new TextEncoder().encode(strOrBytes) : strOrBytes
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  while (base64.length % 4) {
    base64 += '='
  }
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new TextDecoder().decode(bytes)
}

// Simple JWT sign/verify using Web Crypto (Unicode & Workers compatible)
async function signJwt(payload: Record<string, unknown>, secret?: string): Promise<string> {
  const sec = secret || FALLBACK_JWT_SECRET
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = base64UrlEncode(JSON.stringify(payload))
  const data = `${header}.${body}`
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(sec),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  const sigB64 = base64UrlEncode(new Uint8Array(sig))
  return `${data}.${sigB64}`
}

async function verifyJwt(token: string, secret?: string): Promise<Record<string, unknown> | null> {
  try {
    const sec = secret || FALLBACK_JWT_SECRET
    const [header, body, sig] = token.split('.')
    if (!header || !body || !sig) return null
    const data = `${header}.${body}`
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(sec),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    )
    let base64 = sig.replace(/-/g, '+').replace(/_/g, '/')
    while (base64.length % 4) {
      base64 += '='
    }
    const binary = atob(base64)
    const sigBytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      sigBytes[i] = binary.charCodeAt(i)
    }

    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(data))
    if (!valid) return null
    return JSON.parse(base64UrlDecode(body))
  } catch {
    return null
  }
}

export { signJwt, verifyJwt }

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
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
