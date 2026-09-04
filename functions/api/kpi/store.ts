// GET /api/kpi/store?store_id=&ref_date= — KPI for a single store
import type { PagesFunction } from '@cloudflare/workers-types'
import type { Env } from '../_middleware'
import { calcStoreKpi } from '../_kpi_calc'

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url)
  const store_id = url.searchParams.get('store_id')
  const ref_date = url.searchParams.get('ref_date')
  if (!store_id) return Response.json({ error: 'store_id required' }, { status: 400 })

  const result = await calcStoreKpi(env.DB, store_id, ref_date)
  if (!result) return Response.json({ error: 'Store not found or no data' }, { status: 404 })
  return Response.json(result)
}
