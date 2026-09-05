// GET /api/admin/kpi?region=&ref_date= — full per-store KPI table
import type { PagesFunction } from '@cloudflare/workers-types'
import type { Env } from '../_middleware'
import { requireAdmin, isResponse } from './_auth'
import { calcAllStoresKpi } from '../_kpi_calc'

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const auth = await requireAdmin(request, (env.JWT_SECRET ?? 'haier-nonmove-kpi-secret-2024-xYz9abcDEF'))
  if (isResponse(auth)) return auth

  const url = new URL(request.url)
  const regionFilter = url.searchParams.get('region')
  const refDate = url.searchParams.get('ref_date')

  const results = await calcAllStoresKpi(env.DB, {
    region: regionFilter,
    refDate,
  })

  return Response.json(results)
}

