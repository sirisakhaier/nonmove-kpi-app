// GET/PUT /api/admin/settings
import type { PagesFunction } from '@cloudflare/workers-types'
import type { Env } from '../_middleware'
import { requireAdmin, isResponse } from './_auth'

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const auth = await requireAdmin(request, (env.JWT_SECRET ?? 'haier-nonmove-kpi-secret-2024-xYz9abcDEF'))
  if (isResponse(auth)) return auth

  const row = await env.DB.prepare(
    'SELECT * FROM kpi_settings ORDER BY id DESC LIMIT 1'
  ).first<any>()
  if (!row) return Response.json({ id: 0, included_stock_types: ['SELLABLE', 'ONLINE'], updated_at: '' })
  return Response.json({ ...row, included_stock_types: JSON.parse(row.included_stock_types) })
}

export const onRequestPut: PagesFunction<Env> = async ({ request, env }) => {
  const auth = await requireAdmin(request, (env.JWT_SECRET ?? 'haier-nonmove-kpi-secret-2024-xYz9abcDEF'))
  if (isResponse(auth)) return auth

  const { included_stock_types } = await request.json() as { included_stock_types: string[] }
  if (!Array.isArray(included_stock_types)) {
    return Response.json({ error: 'included_stock_types must be an array' }, { status: 400 })
  }

  await env.DB.prepare(
    `INSERT INTO kpi_settings (included_stock_types) VALUES (?)`
  ).bind(JSON.stringify(included_stock_types)).run()

  return Response.json({ ok: true })
}
