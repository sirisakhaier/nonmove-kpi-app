// GET /api/stock/nonmove?store_id= or ?id=
import type { PagesFunction } from '@cloudflare/workers-types'
import type { Env } from '../_middleware'

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url)
  const idParam = url.searchParams.get('id')
  const store_id = url.searchParams.get('store_id')

  // If queried by specific snapshot ID
  if (idParam) {
    const item = await env.DB.prepare(
      `SELECT * FROM stock_snapshots WHERE id = ?`
    ).bind(Number(idParam)).first()
    if (!item) return Response.json({ error: 'Item not found' }, { status: 404 })
    return Response.json({ item })
  }

  if (!store_id) return Response.json({ error: 'store_id required' }, { status: 400 })

  // Get latest active snapshot date for this store
  const latest = await env.DB.prepare(
    `SELECT MAX(snapshot_date) as date FROM stock_snapshots 
     WHERE store_id = ? AND COALESCE(is_active, 1) = 1`
  ).bind(store_id).first<{ date: string | null }>()

  if (!latest?.date) {
    return Response.json({ snapshots: [], date: null })
  }

  // Get approved exclusions for this store (all-time, model level)
  const { results: approved } = await env.DB.prepare(
    `SELECT DISTINCT model FROM exclusion_requests
     WHERE store_id = ? AND status = 'approved'`
  ).bind(store_id).all<{ model: string }>()
  const approvedModels = new Set(approved.map(r => r.model))

  // Get nonmove rows for latest date
  const { results } = await env.DB.prepare(
    `SELECT id, snapshot_date, store_id, category, subcategory, model, product_code,
            product_name, stock_type, assortment, nonmove_period, nonmove_flag,
            stock_qty, stock_amount, sku_amount
     FROM stock_snapshots
     WHERE store_id = ? AND snapshot_date = ? AND nonmove_flag = 'Nonmove' AND COALESCE(is_active, 1) = 1
     ORDER BY
       CASE nonmove_period
         WHEN '121 up' THEN 0
         WHEN '91-120' THEN 1
         WHEN '61-90'  THEN 2
         WHEN '30-60'  THEN 3
         ELSE 4
       END, model`
  ).bind(store_id, latest.date).all()

  // Enrich with request status
  const { results: requests } = await env.DB.prepare(
    `SELECT model, status FROM exclusion_requests
     WHERE store_id = ? AND snapshot_date = ?
     ORDER BY updated_at DESC`
  ).bind(store_id, latest.date).all<{ model: string; status: string }>()
  const requestMap = new Map<string, string>()
  requests.forEach(r => { if (!requestMap.has(r.model)) requestMap.set(r.model, r.status) })

  const enriched = results.map((row: any) => ({
    ...row,
    request_status: requestMap.get(row.model) ?? null,
    is_excluded: approvedModels.has(row.model),
  }))

  return Response.json({ snapshots: enriched, date: latest.date })
}
