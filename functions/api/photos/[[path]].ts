// GET /api/photos/* — serve photos from R2 bucket
import type { PagesFunction } from '@cloudflare/workers-types'
import type { Env } from '../_middleware'

export const onRequestGet: PagesFunction<Env> = async ({ params, env }) => {
  const pathParam = params.path
  const key = Array.isArray(pathParam) ? pathParam.join('/') : (pathParam as string)
  
  if (!key) {
    return new Response('Not found', { status: 404 })
  }

  const obj = await env.PHOTOS.get(key)
  if (!obj) {
    return new Response('Photo not found', { status: 404 })
  }

  const headers = new Headers()
  headers.set('Content-Type', obj.httpMetadata?.contentType || 'image/jpeg')
  headers.set('Cache-Control', 'public, max-age=31536000, immutable')
  if (obj.etag) {
    headers.set('ETag', obj.etag)
  }

  return new Response(obj.body, { headers })
}
