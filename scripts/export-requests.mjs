#!/usr/bin/env node
// ============================================================
// scripts/export-requests.mjs
// Export exclusion requests to Excel with embedded photo thumbnails
//
// Usage:
//   node scripts/export-requests.mjs [--month=YYYY-MM] [--remote]
//
// Requirements:
//   npm install exceljs node-fetch  (already in package.json)
// ============================================================

import { execSync } from 'child_process'
import ExcelJS from 'exceljs'
import fetch from 'node-fetch'

const args = process.argv.slice(2)
const monthArg = args.find(a => a.startsWith('--month='))?.replace('--month=', '')
const isRemote = args.includes('--remote')
const flag = isRemote ? '--remote' : '--local'
const dbName = 'nonmove-kpi-db'

const REASON_MAP = {
  sold_wait_delivery: 'ขายแล้ว รอส่งมอบ',
  demo_unit: 'สินค้าโชว์',
  damaged: 'สินค้าชำรุด',
  system_error: 'ข้อมูลระบบไม่ตรง',
  other: 'อื่นๆ',
}

// Query D1 via wrangler
function queryD1(sql) {
  const result = execSync(
    `npx wrangler d1 execute ${dbName} ${flag} --json --command="${sql.replace(/"/g, '\\"')}"`,
    { encoding: 'utf8' }
  )
  const parsed = JSON.parse(result)
  return parsed[0]?.results ?? []
}

console.log('Querying requests...')
const requests = queryD1(`
  SELECT er.id, s.store_name, s.region, er.model, er.product_name,
         er.reason, er.reason_detail, er.issue_date,
         er.clear_plan, er.clear_plan_date,
         er.requester_name, er.requester_phone,
         er.status, er.admin_comment, er.created_at, er.updated_at
  FROM exclusion_requests er
  JOIN stores s ON s.store_id = er.store_id
  ORDER BY er.created_at DESC
`)

const photos = queryD1(`
  SELECT exclusion_request_id, photo_url, sort_order
  FROM request_photos ORDER BY exclusion_request_id, sort_order
`)

const photoMap = new Map()
for (const p of photos) {
  if (!photoMap.has(p.exclusion_request_id)) photoMap.set(p.exclusion_request_id, [])
  photoMap.get(p.exclusion_request_id).push(p.photo_url)
}

// Build Excel
const wb = new ExcelJS.Workbook()
const ws = wb.addWorksheet('Exclusion Requests')

ws.columns = [
  { header: 'ID', key: 'id', width: 8 },
  { header: 'Store', key: 'store', width: 25 },
  { header: 'Region', key: 'region', width: 20 },
  { header: 'Model', key: 'model', width: 15 },
  { header: 'Product Name', key: 'product_name', width: 30 },
  { header: 'Reason', key: 'reason', width: 20 },
  { header: 'Detail', key: 'detail', width: 35 },
  { header: 'Issue Date', key: 'issue_date', width: 12 },
  { header: 'Clear Plan', key: 'clear_plan', width: 35 },
  { header: 'Clear Plan Date', key: 'clear_plan_date', width: 14 },
  { header: 'Requester Name', key: 'requester_name', width: 20 },
  { header: 'Requester Phone', key: 'requester_phone', width: 14 },
  { header: 'Status', key: 'status', width: 14 },
  { header: 'Admin Comment', key: 'admin_comment', width: 30 },
  { header: 'Photo 1', key: 'photo1', width: 20 },
  { header: 'Photo 2', key: 'photo2', width: 20 },
  { header: 'Photo 3', key: 'photo3', width: 20 },
  { header: 'Submitted At', key: 'created_at', width: 18 },
  { header: 'Updated At', key: 'updated_at', width: 18 },
  { header: 'Thumbnail', key: 'thumbnail', width: 15 },
]

// Style header row
ws.getRow(1).font = { bold: true }
ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0057A8' } }
ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }

const BASE_URL = isRemote
  ? process.env.APP_URL ?? 'https://your-app.pages.dev'
  : 'http://localhost:8788'

for (let i = 0; i < requests.length; i++) {
  const r = requests[i]
  const rowPhotos = photoMap.get(r.id) ?? []
  const rowNum = i + 2
  const row = ws.getRow(rowNum)

  row.getCell('id').value = r.id
  row.getCell('store').value = r.store_name
  row.getCell('region').value = r.region
  row.getCell('model').value = r.model
  row.getCell('product_name').value = r.product_name ?? ''
  row.getCell('reason').value = REASON_MAP[r.reason] ?? r.reason
  row.getCell('detail').value = r.reason_detail ?? ''
  row.getCell('issue_date').value = r.issue_date ?? ''
  row.getCell('clear_plan').value = r.clear_plan ?? ''
  row.getCell('clear_plan_date').value = r.clear_plan_date ?? ''
  row.getCell('requester_name').value = r.requester_name
  row.getCell('requester_phone').value = r.requester_phone
  row.getCell('status').value = r.status
  row.getCell('admin_comment').value = r.admin_comment ?? ''

  // Photo links
  ;['photo1', 'photo2', 'photo3'].forEach((key, idx) => {
    if (rowPhotos[idx]) {
      const fullUrl = rowPhotos[idx].startsWith('http') ? rowPhotos[idx] : `${BASE_URL}${rowPhotos[idx]}`
      row.getCell(key).value = { text: `Photo ${idx + 1}`, hyperlink: fullUrl }
      row.getCell(key).font = { color: { argb: 'FF0057A8' }, underline: true }
    }
  })

  row.getCell('created_at').value = r.created_at
  row.getCell('updated_at').value = r.updated_at

  // Try to fetch and embed first photo as thumbnail
  if (rowPhotos[0]) {
    try {
      const photoUrl = rowPhotos[0].startsWith('http')
        ? rowPhotos[0]
        : `${BASE_URL}${rowPhotos[0]}`
      const resp = await fetch(photoUrl)
      if (resp.ok) {
        const buffer = Buffer.from(await resp.arrayBuffer())
        const imageId = wb.addImage({ buffer, extension: 'jpeg' })
        row.height = 80
        ws.addImage(imageId, {
          tl: { col: 19, row: rowNum - 1 },
          ext: { width: 90, height: 80 },
        })
      }
    } catch (e) {
      // Skip thumbnail if fetch fails
    }
  }

  row.commit()
}

// KPI sheet
const kpiSheet = wb.addWorksheet('KPI Summary')
const kpiRows = queryD1(`
  SELECT s.store_id, s.store_name, s.region FROM stores s ORDER BY s.region, s.store_id
`)
kpiSheet.columns = [
  { header: 'Store ID', width: 12 },
  { header: 'Store Name', width: 28 },
  { header: 'Region', width: 22 },
  { header: 'Note', width: 40 },
]
kpiSheet.getRow(1).font = { bold: true }
for (const r of kpiRows) {
  kpiSheet.addRow([r.store_id, r.store_name, r.region, 'KPI computed via /api/admin/kpi endpoint'])
}

const filename = `requests-export-${new Date().toISOString().split('T')[0]}.xlsx`
await wb.xlsx.writeFile(filename)
console.log(`\n✅ Exported: ${filename}`)
console.log(`   ${requests.length} requests included`)
