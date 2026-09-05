// POST /api/admin/import — upload xlsx, parse, insert stock_snapshots
import type { PagesFunction } from '@cloudflare/workers-types'
import type { Env } from '../_middleware'
import { requireAdmin, isResponse } from './_auth'

// Minimal xlsx parser for Workers runtime
// We use the 'xlsx' (SheetJS) library bundled by Vite into the worker chunk.
// NOTE: xlsx must be bundled; it is not a native Worker API.

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const auth = await requireAdmin(request, (env.JWT_SECRET ?? 'haier-nonmove-kpi-secret-2024-xYz9abcDEF'))
  if (isResponse(auth)) return auth

  const form = await request.formData()
  const file = form.get('file') as File | null
  const replaceConfirmed = form.get('replace') === 'true'

  if (!file) return Response.json({ error: 'file required' }, { status: 400 })

  // Parse xlsx
  const XLSX = await import('xlsx')
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows: any[] = XLSX.utils.sheet_to_json(ws)

  if (rows.length === 0) return Response.json({ error: 'Empty file' }, { status: 400 })

  // Extract snapshot date
  const firstDate = rows[0]['Date']
  const snapshotDate: string = firstDate instanceof Date
    ? firstDate.toISOString().split('T')[0]
    : String(firstDate).split('T')[0]

  // Check if date already exists
  const existing = await env.DB.prepare(
    'SELECT COUNT(*) as cnt FROM stock_snapshots WHERE snapshot_date = ?'
  ).bind(snapshotDate).first<{ cnt: number }>()

  if (existing && existing.cnt > 0 && !replaceConfirmed) {
    return Response.json(
      { error: `Data for ${snapshotDate} already exists. Send replace=true to overwrite.`, needs_confirm: true },
      { status: 409 }
    )
  }

  if (existing && existing.cnt > 0 && replaceConfirmed) {
    await env.DB.prepare('DELETE FROM stock_snapshots WHERE snapshot_date = ?').bind(snapshotDate).run()
  }

  // Upsert stores
  const storeMap = new Map<string, any>()
  for (const row of rows) {
    const sid = String(row['Store Id'] ?? '').trim()
    if (sid && !storeMap.has(sid)) {
      storeMap.set(sid, {
        store_id: sid,
        store_name: String(row['Store Name'] ?? '').trim(),
        region: String(row['Region'] ?? '').trim(),
        province: String(row['Province'] ?? '').trim(),
        supervisor: String(row['Supervisor'] ?? '').trim() || null,
      })
    }
  }
  const storeStmts = [...storeMap.values()].map(s =>
    env.DB.prepare(
      `INSERT OR REPLACE INTO stores (store_id, store_name, region, province, supervisor)
       VALUES (?,?,?,?,?)`
    ).bind(s.store_id, s.store_name, s.region, s.province, s.supervisor)
  )
  if (storeStmts.length > 0) await env.DB.batch(storeStmts)

  // Insert snapshot rows in batches of 100
  const errors: string[] = []
  let imported = 0
  const batchSize = 100

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)
    const stmts = batch.map((row, idx) => {
      try {
        const sid = String(row['Store Id'] ?? '').trim()
        const model = String(row['Model'] ?? '').trim()
        const stockAmt = parseFloat(row['Stock Amount']) || 0
        const skuAmt = parseFloat(row['SKU Amount']) || 0
        const qty = parseInt(row['Stock QTY']) || 0

        return env.DB.prepare(
          `INSERT INTO stock_snapshots
             (snapshot_date, store_id, category, subcategory, model, product_code,
              product_name, stock_type, assortment, nonmove_period, nonmove_flag,
              stock_qty, stock_amount, sku_amount)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
        ).bind(
          snapshotDate, sid,
          String(row['Category'] ?? '').trim() || null,
          String(row['SubCategory'] ?? '').trim() || null,
          model,
          String(row['Product Code'] ?? '').trim() || null,
          String(row['Product Name'] ?? '').trim() || null,
          String(row['Stock type'] ?? '').trim() || null,
          String(row['Assortment'] ?? '').trim() || null,
          String(row['Nonmove Period'] ?? '').trim() || null,
          String(row['Nonmove or normal'] ?? '').trim() || null,
          qty, stockAmt, skuAmt
        )
      } catch (e) {
        errors.push(`Row ${i + idx + 2}: ${e}`)
        return null
      }
    }).filter(Boolean) as D1PreparedStatement[]

    if (stmts.length > 0) {
      await env.DB.batch(stmts)
      imported += stmts.length
    }
  }

  return Response.json({
    date: snapshotDate,
    rows_imported: imported,
    stores_upserted: storeMap.size,
    errors,
    replaced: existing && existing.cnt > 0 && replaceConfirmed,
  })
}
