// POST /api/admin/import-data — high-performance chunked JSON data import
import type { PagesFunction } from '@cloudflare/workers-types'
import type { Env } from '../_middleware'
import { requireAdmin, isResponse } from './_auth'

interface StorePayload {
  store_id: string
  store_name: string
  region: string
  province: string
  supervisor?: string | null
}

interface SnapshotRowPayload {
  store_id: string
  model: string
  category?: string | null
  subcategory?: string | null
  product_code?: string | null
  product_name?: string | null
  stock_type?: string | null
  assortment?: string | null
  nonmove_period?: string | null
  nonmove_flag?: string | null
  stock_qty: number
  stock_amount: number
  sku_amount: number
}

interface ImportDataPayload {
  snapshot_date: string
  is_first_chunk: boolean
  replace: boolean
  stores?: StorePayload[]
  rows: SnapshotRowPayload[]
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const auth = await requireAdmin(request, (env.JWT_SECRET ?? 'haier-nonmove-kpi-secret-2024-xYz9abcDEF'))
    if (isResponse(auth)) return auth

    let body: ImportDataPayload
    try {
      body = await request.json() as ImportDataPayload
    } catch {
      return Response.json({ error: 'Invalid JSON payload' }, { status: 400 })
    }

    const { snapshot_date, is_first_chunk, replace, stores, rows } = body

    if (!snapshot_date || !Array.isArray(rows)) {
      return Response.json({ error: 'snapshot_date and rows required' }, { status: 400 })
    }

    // 1. If first chunk and replace requested, clear existing data for this date
    if (is_first_chunk && replace) {
      await env.DB.prepare(
        `DELETE FROM stock_snapshots WHERE snapshot_date = ?`
      ).bind(snapshot_date).run()
    }

    // 2. Upsert stores in smaller batches if provided
    if (stores && stores.length > 0) {
      const storeBatchSize = 25
      for (let i = 0; i < stores.length; i += storeBatchSize) {
        const sub = stores.slice(i, i + storeBatchSize)
        const storeStmts = sub.map(s =>
          env.DB.prepare(
            `INSERT OR REPLACE INTO stores (store_id, store_name, region, province, supervisor)
             VALUES (?,?,?,?,?)`
          ).bind(s.store_id, s.store_name, s.region, s.province, s.supervisor ?? null)
        )
        if (storeStmts.length > 0) {
          await env.DB.batch(storeStmts)
        }
      }
    }

    // 3. Insert snapshot rows in safe batches of 25
    let inserted = 0
    const batchSize = 25

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize)
      const stmts = batch.map(row => {
        const qty = Number(row.stock_qty) || 0
        const stockAmt = Number(row.stock_amount) || 0
        const skuAmt = Number(row.sku_amount) || 0

        return env.DB.prepare(
          `INSERT INTO stock_snapshots
             (snapshot_date, store_id, category, subcategory, model, product_code,
              product_name, stock_type, assortment, nonmove_period, nonmove_flag,
              stock_qty, stock_amount, sku_amount, is_active)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`
        ).bind(
          snapshot_date,
          row.store_id,
          row.category ?? null,
          row.subcategory ?? null,
          row.model,
          row.product_code ?? null,
          row.product_name ?? null,
          row.stock_type ?? null,
          row.assortment ?? null,
          row.nonmove_period ?? null,
          row.nonmove_flag ?? null,
          qty,
          stockAmt,
          skuAmt
        )
      })

      if (stmts.length > 0) {
        await env.DB.batch(stmts)
        inserted += stmts.length
      }
    }

    return Response.json({
      ok: true,
      snapshot_date,
      rows_inserted: inserted,
    })
  } catch (err: any) {
    return Response.json({ error: err.message ?? 'Internal server error during import' }, { status: 500 })
  }
}
