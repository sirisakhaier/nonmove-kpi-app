// GET /api/admin/export/requests — download xlsx of all filtered requests (no thumbnails)
import type { PagesFunction } from '@cloudflare/workers-types'
import type { Env } from '../../_middleware'
import { requireAdmin, isResponse } from '../_auth'

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const auth = await requireAdmin(request, env.JWT_SECRET)
  if (isResponse(auth)) return auth

  const url = new URL(request.url)
  const region = url.searchParams.get('region')
  const store = url.searchParams.get('store')
  const status = url.searchParams.get('status')

  let q = `
    SELECT er.id, s.store_name, s.region, er.model, er.product_name,
           er.reason, er.reason_detail, er.issue_date, er.clear_plan, er.clear_plan_date,
           er.requester_name, er.requester_phone, er.status, er.admin_comment,
           er.created_at, er.updated_at,
           GROUP_CONCAT(rp.photo_url) as photo_urls
    FROM exclusion_requests er
    JOIN stores s ON s.store_id = er.store_id
    LEFT JOIN request_photos rp ON rp.exclusion_request_id = er.id
    WHERE 1=1
  `
  const binds: string[] = []
  if (region) { q += ' AND s.region = ?'; binds.push(region) }
  if (store) { q += ' AND er.store_id = ?'; binds.push(store) }
  if (status) { q += ' AND er.status = ?'; binds.push(status) }
  q += ' GROUP BY er.id ORDER BY er.created_at DESC'

  const stmt = binds.length > 0 ? env.DB.prepare(q).bind(...binds) : env.DB.prepare(q)
  const { results } = await stmt.all()

  // Build CSV (SheetJS not bundled for export edge fn; use CSV for Workers-compatible export)
  const headers = [
    'ID', 'Store', 'Region', 'Model', 'Product Name', 'Reason', 'Detail',
    'Issue Date', 'Clear Plan', 'Clear Plan Date', 'Requester Name', 'Requester Phone',
    'Status', 'Admin Comment', 'Photo Links', 'Submitted At', 'Updated At'
  ]
  const REASON_MAP: Record<string, string> = {
    sold_wait_delivery: 'ขายแล้ว รอส่งมอบ',
    demo_unit: 'สินค้าโชว์',
    damaged: 'สินค้าชำรุด',
    system_error: 'ข้อมูลระบบไม่ตรง',
    other: 'อื่นๆ',
  }

  const csvRows = [headers.map(h => `"${h}"`).join(',')]
  for (const r of results as any[]) {
    const cols = [
      r.id, r.store_name, r.region, r.model, r.product_name ?? '',
      REASON_MAP[r.reason] ?? r.reason, r.reason_detail ?? '',
      r.issue_date ?? '', r.clear_plan ?? '', r.clear_plan_date ?? '',
      r.requester_name, r.requester_phone,
      r.status, r.admin_comment ?? '',
      r.photo_urls ?? '',
      r.created_at, r.updated_at
    ].map(v => `"${String(v).replace(/"/g, '""')}"`)
    csvRows.push(cols.join(','))
  }

  const csv = '\uFEFF' + csvRows.join('\n')  // BOM for Excel Thai encoding
  const filename = `requests-${new Date().toISOString().split('T')[0]}.csv`

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
