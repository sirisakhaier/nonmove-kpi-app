// POST /api/admin/import-requests — bulk update status/comment from xlsx/csv
import type { PagesFunction } from '@cloudflare/workers-types'
import type { Env } from '../_middleware'
import { requireAdmin, isResponse } from './_auth'

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const auth = await requireAdmin(request, (env.JWT_SECRET ?? 'haier-nonmove-kpi-secret-2024-xYz9abcDEF'))
  if (isResponse(auth)) return auth

  const form = await request.formData()
  const file = form.get('file') as File | null
  if (!file) return Response.json({ error: 'file required' }, { status: 400 })

  const XLSX = await import('xlsx')
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows: any[] = XLSX.utils.sheet_to_json(ws)

  const VALID_STATUSES = ['pending', 'approved', 'rejected', 'needs_resubmit']
  let updated = 0
  const skipped: string[] = []
  const errors: string[] = []

  for (const row of rows) {
    const id = parseInt(row['ID'] ?? row['id'] ?? '')
    const newStatus = (row['Status'] ?? row['status'] ?? '').toLowerCase().replace(/ /g, '_')
    const comment = row['Admin Comment'] ?? row['admin_comment'] ?? null

    if (!id || isNaN(id)) { errors.push(`Row skipped: missing ID`); continue }
    if (!VALID_STATUSES.includes(newStatus)) { skipped.push(`ID ${id}: invalid status '${newStatus}'`); continue }

    const existing = await env.DB.prepare(
      'SELECT id FROM exclusion_requests WHERE id = ?'
    ).bind(id).first()
    if (!existing) { skipped.push(`ID ${id}: not found`); continue }

    await env.DB.prepare(
      `UPDATE exclusion_requests SET status=?, admin_comment=?, updated_at=datetime('now') WHERE id=?`
    ).bind(newStatus, comment, id).run()
    updated++
  }

  return Response.json({ updated, skipped: skipped.length, errors: [...skipped, ...errors] })
}
