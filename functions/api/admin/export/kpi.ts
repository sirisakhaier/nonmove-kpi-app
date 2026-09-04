// GET /api/admin/export/kpi?month=YYYY-MM — KPI payout sheet as CSV
import type { PagesFunction } from '@cloudflare/workers-types'
import type { Env } from '../../_middleware'
import { requireAdmin, isResponse } from '../_auth'
import { calcStoreKpi } from '../../_kpi_calc'

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const auth = await requireAdmin(request, env.JWT_SECRET)
  if (isResponse(auth)) return auth

  const url = new URL(request.url)
  const month = url.searchParams.get('month') // YYYY-MM
  const refDate = month ? `${month}-01` : undefined

  const { results: stores } = await env.DB.prepare(
    'SELECT store_id FROM stores ORDER BY region, store_id'
  ).all<{ store_id: string }>()

  const results = await Promise.all(stores.map(s => calcStoreKpi(env.DB, s.store_id, refDate)))
  const valid = results.filter(Boolean) as NonNullable<typeof results[0]>[]

  const headers = [
    'Store ID', 'Store Name', 'Region',
    'Reference Date', 'Reference Amount (THB)',
    'Latest Date', 'Latest Amount (THB)',
    '% Gap', 'Rank', 'Rank Label',
    'Bucket', 'Bucket Label', 'Type',
    'Penalty/Reward (THB)'
  ]

  const rows = [headers.map(h => `"${h}"`).join(',')]
  for (const r of valid) {
    rows.push([
      r.store_id, r.store_name, r.region,
      r.reference_date, r.reference_amount.toFixed(2),
      r.latest_date, r.latest_amount.toFixed(2),
      r.pct_gap.toFixed(2), r.rank_tier, r.rank_label,
      r.bucket, r.bucket_label, r.bucket_type,
      r.amount_thb
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
  }

  const csv = '\uFEFF' + rows.join('\n')
  const filename = `kpi-payout-${month ?? 'current'}.csv`

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
