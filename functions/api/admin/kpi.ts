// GET /api/admin/kpi?region=&ref_date= — full per-store KPI table
import type { PagesFunction } from '@cloudflare/workers-types'
import type { Env } from '../_middleware'
import { requireAdmin, isResponse } from './_auth'
import { calcStoreKpi } from '../_kpi_calc'

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const auth = await requireAdmin(request, env.JWT_SECRET)
  if (isResponse(auth)) return auth

  const url = new URL(request.url)
  const regionFilter = url.searchParams.get('region')
  const refDate = url.searchParams.get('ref_date')

  let query = 'SELECT store_id FROM stores WHERE 1=1'
  const binds: string[] = []
  if (regionFilter) { query += ' AND region = ?'; binds.push(regionFilter) }

  const stmt = binds.length > 0 ? env.DB.prepare(query).bind(...binds) : env.DB.prepare(query)
  const { results: stores } = await stmt.all<{ store_id: string }>()

  const results = await Promise.all(stores.map(s => calcStoreKpi(env.DB, s.store_id, refDate)))
  return Response.json(results.filter(Boolean))
}
