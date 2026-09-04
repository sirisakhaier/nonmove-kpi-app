// GET /api/stores?region= — list stores for a region
import type { PagesFunction } from '@cloudflare/workers-types'
import type { Env } from './_middleware'

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url)
  const region = url.searchParams.get('region')
  if (!region) {
    const { results } = await env.DB.prepare(
      'SELECT store_id, store_name, region, province FROM stores ORDER BY store_name'
    ).all()
    return Response.json(results)
  }
  const { results } = await env.DB.prepare(
    'SELECT store_id, store_name, region, province FROM stores WHERE region = ? ORDER BY store_name'
  ).bind(region).all()
  return Response.json(results)
}
