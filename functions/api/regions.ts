// GET /api/regions — list distinct regions from stores table
import type { PagesFunction } from '@cloudflare/workers-types'
import type { Env } from './_middleware'

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const { results } = await env.DB.prepare(
    'SELECT DISTINCT region FROM stores ORDER BY region'
  ).all<{ region: string }>()
  const regions = results.map(r => r.region)
  return Response.json(regions)
}
