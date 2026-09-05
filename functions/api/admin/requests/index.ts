// GET /api/admin/requests — list all exclusion requests with filters
import type { PagesFunction } from '@cloudflare/workers-types'
import type { Env } from '../../_middleware'
import { requireAdmin, isResponse } from '../_auth'

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const auth = await requireAdmin(request, (env.JWT_SECRET ?? 'haier-nonmove-kpi-secret-2024-xYz9abcDEF'))
  if (isResponse(auth)) return auth

  const url = new URL(request.url)
  const region = url.searchParams.get('region')
  const store = url.searchParams.get('store')
  const status = url.searchParams.get('status')
  const reason = url.searchParams.get('reason')
  const period = url.searchParams.get('period')
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')

  let q = `
    SELECT er.*, s.store_name, s.region,
           GROUP_CONCAT(rp.photo_url) as photo_urls
    FROM exclusion_requests er
    JOIN stores s ON s.store_id = er.store_id
    LEFT JOIN request_photos rp ON rp.exclusion_request_id = er.id
  `
  if (period) {
    q += ' JOIN stock_snapshots ss ON ss.id = er.stock_snapshot_id'
  }

  q += ' WHERE 1=1'
  const binds: (string | null)[] = []

  if (region) { q += ' AND s.region = ?'; binds.push(region) }
  if (store) { q += ' AND er.store_id = ?'; binds.push(store) }
  if (status) { q += ' AND er.status = ?'; binds.push(status) }
  if (reason) { q += ' AND er.reason = ?'; binds.push(reason) }
  if (period) { q += ' AND ss.nonmove_period = ?'; binds.push(period) }
  if (from) { q += ' AND er.created_at >= ?'; binds.push(from) }
  if (to) { q += ' AND er.created_at <= ?'; binds.push(to + ' 23:59:59') }

  q += ' GROUP BY er.id ORDER BY er.created_at DESC'

  const stmt = binds.length > 0 ? env.DB.prepare(q).bind(...binds) : env.DB.prepare(q)
  const { results } = await stmt.all()

  const enriched = (results as any[]).map(r => ({
    ...r,
    photos: r.photo_urls ? r.photo_urls.split(',') : [],
  }))
  return Response.json(enriched)
}

