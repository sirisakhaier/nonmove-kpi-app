#!/usr/bin/env node
// Fixed import script — imports Excel data into D1 (remote)
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'fs'
import { execSync } from 'child_process'
import { join } from 'path'
import { fileURLToPath } from 'url'
import XLSX from 'xlsx'

const __dir = fileURLToPath(new URL('.', import.meta.url))
const args = process.argv.slice(2)
const filePath = args.find(a => !a.startsWith('--'))
  ?? join(__dir, '../Stock Daily GH for Nonmove KPI.xlsx')
const isRemote = args.includes('--remote')
const flag = isRemote ? '--remote' : '--local'
const dbName = 'nonmove-kpi-db'

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
  const raw = row['Date']
  const d = raw instanceof Date
    ? raw.toISOString().split('T')[0]
    : String(raw ?? '').split('T')[0]
  if (!d || d === 'undefined') continue
  if (!byDate.has(d)) byDate.set(d, [])
  byDate.get(d).push(row)
}
console.log(`Dates found: ${[...byDate.keys()].join(', ')}`)

function esc(v) {
  return String(v ?? '').replace(/'/g, "''")
}

function runSql(sql, tag) {
  const tmp = `/tmp/nm_import_${Date.now()}.sql`
  writeFileSync(tmp, sql)
  try {
    execSync(`npx wrangler d1 execute ${dbName} ${flag} --file=${tmp}`, { stdio: 'inherit' })
  } finally {
    try { unlinkSync(tmp) } catch {}
  }
}

for (const [date, dateRows] of byDate) {
  console.log(`\nImporting ${date} (${dateRows.length} rows)...`)

  // Collect unique stores
  const stores = new Map()
  for (const r of dateRows) {
    const sid = esc(r['Store Id'] ?? r['store_id'] ?? '')
    if (!sid) continue
    if (!stores.has(sid)) {
      stores.set(sid, {
        store_id: sid,
        store_name: esc(r['Store Name'] ?? r['store_name'] ?? ''),
        region: esc(r['Region'] ?? r['region'] ?? ''),
        province: esc(r['Province'] ?? r['province'] ?? ''),
        supervisor: esc(r['Supervisor'] ?? r['supervisor'] ?? ''),
      })
    }
  }

  // Store upserts
  let storeSql = ''
  for (const s of stores.values()) {
    const sup = s.supervisor ? `'${s.supervisor}'` : 'NULL'
    storeSql += `INSERT OR REPLACE INTO stores (store_id,store_name,region,province,supervisor) VALUES ('${s.store_id}','${s.store_name}','${s.region}','${s.province}',${sup});\n`
  }
  if (storeSql) {
    console.log(`  Upserting ${stores.size} stores...`)
    runSql(storeSql)
  }

  // Snapshot inserts — delete existing date first, then batch insert
  let snapSql = `DELETE FROM stock_snapshots WHERE snapshot_date='${date}';\n`
  for (const r of dateRows) {
    const sid = esc(r['Store Id'] ?? r['store_id'] ?? '')
    if (!sid) continue
    const model  = esc(r['Model'] ?? r['model'] ?? '')
    const pname  = esc(r['Product Name'] ?? r['product_name'] ?? '')
    const pcode  = esc(r['Product Code'] ?? r['product_code'] ?? '')
    const cat    = esc(r['Category'] ?? r['category'] ?? '')
    const subcat = esc(r['SubCategory'] ?? r['subcategory'] ?? '')
    const stype  = esc(r['Stock type'] ?? r['stock_type'] ?? '')
    const assort = esc(r['Assortment'] ?? r['assortment'] ?? '')
    const period = esc(r['Nonmove Period'] ?? r['nonmove_period'] ?? '')
    const nmFlag = esc(r['Nonmove or normal'] ?? r['nonmove_flag'] ?? '')
    const qty    = parseInt(r['Stock QTY'] ?? r['stock_qty'] ?? 0) || 0
    const amt    = parseFloat(r['Stock Amount'] ?? r['stock_amount'] ?? 0) || 0
    const sku    = parseFloat(r['SKU Amount'] ?? r['sku_amount'] ?? 0) || 0
    snapSql += `INSERT INTO stock_snapshots (snapshot_date,store_id,category,subcategory,model,product_code,product_name,stock_type,assortment,nonmove_period,nonmove_flag,stock_qty,stock_amount,sku_amount) VALUES ('${date}','${sid}','${cat}','${subcat}','${model}','${pcode}','${pname}','${stype}','${assort}','${period}','${nmFlag}',${qty},${amt},${sku});\n`
  }
  console.log(`  Inserting ${dateRows.length} snapshots...`)
  runSql(snapSql)
  console.log(`  ✅ Done: ${date}`)
}

console.log('\n✅ Import complete!')
