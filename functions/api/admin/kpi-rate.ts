// GET/PUT /api/admin/kpi-rate — versioned rate matrix
import type { PagesFunction } from '@cloudflare/workers-types'
import type { Env } from '../_middleware'
import { requireAdmin, isResponse } from './_auth'

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const auth = await requireAdmin(request, env.JWT_SECRET)
  if (isResponse(auth)) return auth

  const { results } = await env.DB.prepare(
    'SELECT * FROM kpi_rate_matrix ORDER BY effective_from DESC, rank_tier, bucket'
  ).all()

  const versions = [...new Set(results.map((r: any) => r.effective_from))]
  const current = results.filter((r: any) => r.effective_from === versions[0])

  return Response.json({ versions, current, all: results })
}

export const onRequestPut: PagesFunction<Env> = async ({ request, env }) => {
  const auth = await requireAdmin(request, env.JWT_SECRET)
  if (isResponse(auth)) return auth

  const { effective_from, matrix } = await request.json() as {
    effective_from: string
    matrix: Array<{
      rank_tier: number; rank_label: string; rank_min_amount: number; rank_max_amount: number | null
      bucket: number; bucket_label: string; bucket_type: string; pct_min: number | null; pct_max: number | null
      amount_thb: number
    }>
  }

  if (!effective_from || !Array.isArray(matrix)) {
    return Response.json({ error: 'effective_from and matrix required' }, { status: 400 })
  }

  // Check date not already used
  const existing = await env.DB.prepare(
    'SELECT COUNT(*) as cnt FROM kpi_rate_matrix WHERE effective_from = ?'
  ).bind(effective_from).first<{ cnt: number }>()
  if (existing && existing.cnt > 0) {
    return Response.json({ error: `Version ${effective_from} already exists` }, { status: 409 })
  }

  // Insert all 32 rows
  const stmts = matrix.map(row =>
    env.DB.prepare(
      `INSERT INTO kpi_rate_matrix
         (effective_from, rank_tier, rank_label, rank_min_amount, rank_max_amount,
          bucket, bucket_label, bucket_type, pct_min, pct_max, amount_thb)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(
      effective_from, row.rank_tier, row.rank_label, row.rank_min_amount,
      row.rank_max_amount ?? null, row.bucket, row.bucket_label, row.bucket_type,
      row.pct_min ?? null, row.pct_max ?? null, row.amount_thb
    )
  )
  await env.DB.batch(stmts)
  return Response.json({ ok: true, version: effective_from })
}
