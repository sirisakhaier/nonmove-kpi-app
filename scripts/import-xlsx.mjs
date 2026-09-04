#!/usr/bin/env node
// ============================================================
// scripts/import-xlsx.mjs
// Bulk-import Stock_Daily_GH_for_Nonmove_KPI.xlsx into D1 (local)
//
// Usage:
//   node scripts/import-xlsx.mjs path/to/Stock_Daily_GH_for_Nonmove_KPI.xlsx [--remote]
//
// Requirements:
//   npm install xlsx   (already in package.json devDependencies)
// ============================================================

import { readFileSync, existsSync } from 'fs'
import { execSync } from 'child_process'
import { join, resolve } from 'path'
import { fileURLToPath } from 'url'
import XLSX from 'xlsx'

const __dir = fileURLToPath(new URL('.', import.meta.url))
const args = process.argv.slice(2)
const filePath = args.find(a => !a.startsWith('--')) ?? join(__dir, '../Stock Daily GH for Nonmove KPI.xlsx')
const isRemote = args.includes('--remote')

if (!existsSync(filePath)) {
  console.error(`File not found: ${filePath}`)
  process.exit(1)
}

console.log(`Reading: ${filePath}`)
const wb = XLSX.readFile(filePath, { cellDates: true })
const ws = wb.Sheets[wb.SheetNames[0]]
const rows = XLSX.utils.sheet_to_json(ws)

console.log(`Total rows: ${rows.length}`)

// Group by date
const byDate = new Map()
for (const row of rows) {
  const d = row['Date'] instanceof Date
    ? row['Date'].toISOString().split('T')[0]
    : String(row['Date']).split('T')[0]
  if (!byDate.has(d)) byDate.set(d, [])
  byDate.get(d).push(row)
}

console.log(`Dates found: ${[...byDate.keys()].join(', ')}`)

const flag = isRemote ? '--remote' : '--local'
const dbName = 'nonmove-kpi-db'

function execD1(sql) {
  const escaped = sql.replace(/'/g, "''")
  const tmpFile = `/tmp/nonmove_import_${Date.now()}.sql`
  const { writeFileSync } = await import('fs')
  writeFileSync(tmpFile, sql)
  execSync(`npx wrangler d1 execute ${dbName} ${flag} --file=${tmpFile}`, { stdio: 'inherit' })
}

// Build and run SQL in batches
for (const [date, dateRows] of byDate) {
  console.log(`\nImporting date: ${date} (${dateRows.length} rows)`)

  // Upsert stores
  const stores = new Map()
  for (const r of dateRows) {
    const sid = String(r['Store Id'] ?? '').trim()
    if (sid && !stores.has(sid)) {
      stores.set(sid, {
        store_id: sid,
        store_name: String(r['Store Name'] ?? '').trim().replace(/'/g, "''"),
        region: String(r['Region'] ?? '').trim().replace(/'/g, "''"),
        province: String(r['Province'] ?? '').trim().replace(/'/g, "''"),
        supervisor: String(r['Supervisor'] ?? '').trim().replace(/'/g, "''") || 'NULL',
      })
    }
  }

  let storeSql = ''
  for (const s of stores.values()) {
    storeSql += `INSERT OR REPLACE INTO stores (store_id,store_name,region,province,supervisor) VALUES ('${s.store_id}','${s.store_name}','${s.region}','${s.province}',${s.supervisor === 'NULL' ? 'NULL' : `'${s.supervisor}'`});\n`
  }

  // Delete existing date then insert
  let snapshotSql = `DELETE FROM stock_snapshots WHERE snapshot_date='${date}';\n`
  const batchSize = 50
  for (let i = 0; i < dateRows.length; i += batchSize) {
    const batch = dateRows.slice(i, i + batchSize)
    for (const r of batch) {
      const sid = String(r['Store Id'] ?? '').trim().replace(/'/g, "''")
      const model = String(r['Model'] ?? '').trim().replace(/'/g, "''")
      const pname = String(r['Product Name'] ?? '').trim().replace(/'/g, "''")
      const pcode = String(r['Product Code'] ?? '').trim()
      const cat = String(r['Category'] ?? '').trim().replace(/'/g, "''")
      const subcat = String(r['SubCategory'] ?? '').trim().replace(/'/g, "''")
      const stype = String(r['Stock type'] ?? '').trim()
      const assort = String(r['Assortment'] ?? '').trim()
      const period = String(r['Nonmove Period'] ?? '').trim()
      const nmFlag = String(r['Nonmove or normal'] ?? '').trim()
      const qty = parseInt(r['Stock QTY']) || 0
      const amt = parseFloat(r['Stock Amount']) || 0
      const sku = parseFloat(r['SKU Amount']) || 0

      snapshotSql += `INSERT INTO stock_snapshots (snapshot_date,store_id,category,subcategory,model,product_code,product_name,stock_type,assortment,nonmove_period,nonmove_flag,stock_qty,stock_amount,sku_amount) VALUES ('${date}','${sid}','${cat}','${subcat}','${model}','${pcode}','${pname}','${stype}','${assort}','${period}','${nmFlag}',${qty},${amt},${sku});\n`
    }
  }

  // Write to temp file and execute
  const { writeFileSync, unlinkSync } = await import('fs')
  const tmpStore = `/tmp/store_${date}.sql`
  const tmpSnap = `/tmp/snap_${date}.sql`
  writeFileSync(tmpStore, storeSql)
  writeFileSync(tmpSnap, snapshotSql)

  console.log('  Upserting stores...')
  execSync(`npx wrangler d1 execute ${dbName} ${flag} --file=${tmpStore}`, { stdio: 'inherit' })
  console.log('  Inserting snapshots...')
  execSync(`npx wrangler d1 execute ${dbName} ${flag} --file=${tmpSnap}`, { stdio: 'inherit' })

  unlinkSync(tmpStore)
  unlinkSync(tmpSnap)
  console.log(`  Done: ${date}`)
}

console.log('\n✅ Import complete!')
