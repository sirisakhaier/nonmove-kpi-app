// ============================================================
// KPI calculation helpers (client-side display)
// ============================================================
import type { KpiRateRow } from '../types'

/**
 * Determine % gap bucket (1-8) from pct_gap value.
 * Buckets:
 *   1 = Increase 30%+    (pct >= 30) -> เงินค่าปรับ
 *   2 = Increase 20-29%  (20 <= pct < 30) -> เงินค่าปรับ
 *   3 = Increase 10-19%  (10 <= pct < 20) -> เงินค่าปรับ
 *   4 = Increase 0-9%    (0 <= pct < 10) -> เงินค่าปรับ
 *   5 = Reduce 0-9%      (-10 < pct < 0) -> เงินรางวัล
 *   6 = Reduce 10-19%    (-20 < pct <= -10) -> เงินรางวัล
 *   7 = Reduce 20-29%    (-30 < pct <= -20) -> เงินรางวัล
 *   8 = Reduce 30%+      (pct <= -30) -> เงินรางวัล
 */
export function getBucket(pctGap: number): number {
  if (pctGap >= 30) return 1
  if (pctGap >= 20) return 2
  if (pctGap >= 10) return 3
  if (pctGap >= 0) return 4
  if (pctGap > -10) return 5
  if (pctGap > -20) return 6
  if (pctGap > -30) return 7
  return 8
}

/**
 * Determine rank tier (1-4) from latest nonmove SKU amount.
 */
export function getRank(amount: number): number {
  if (amount < 150000) return 1
  if (amount < 250000) return 2
  if (amount < 300000) return 3
  return 4
}

/**
 * Calculate % gap between latest and reference amounts.
 * Formula: ((Last day total SKU amount - 1st day total SKU amount) / 1st day total SKU amount) * 100
 */
export function calcPctGap(latest: number, reference: number): number {
  if (reference === 0) {
    return latest > 0 ? 100 : 0
  }
  return ((latest - reference) / reference) * 100
}

/**
 * Look up THB amount from rate matrix rows.
 */
export function lookupRate(
  matrix: KpiRateRow[],
  rank: number,
  bucket: number,
  effectiveDate: string
): KpiRateRow | undefined {
  const versions = [...new Set(matrix.map(r => r.effective_from))]
    .filter(v => v <= effectiveDate)
    .sort()
    .reverse()
  if (versions.length === 0) return undefined
  const version = versions[0]
  return matrix.find(r => r.effective_from === version && r.rank_tier === rank && r.bucket === bucket)
}

/**
 * Format THB number with 2 decimals and 'บ.' suffix.
 */
export function formatAmount(amount: number | null | undefined): string {
  const num = Number(amount) || 0
  return num.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' บ.'
}

export function formatBaht(amount: number | null | undefined): string {
  return formatAmount(amount)
}

/**
 * Format THB for KPI Payout (with sign, 2 decimals, and 'บ.').
 */
export function formatTHB(amount: number | null | undefined): string {
  const num = Number(amount) || 0
  const abs = Math.abs(num)
  const formatted = abs.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' บ.'
  if (num < 0) return `- ${formatted}`
  if (num > 0) return `+ ${formatted}`
  return `0.00 บ.`
}

/**
 * PERIOD_CONFIG — color and order for nonmove period chips.
 */
export const PERIOD_CONFIG: Record<string, { color: string; order: number; label: string }> = {
  '121 up': { color: 'red', order: 0, label: '121 วันขึ้นไป' },
  '91-120': { color: 'orange', order: 1, label: '91-120 วัน' },
  '61-90': { color: 'yellow', order: 2, label: '61-90 วัน' },
  '30-60': { color: 'gray', order: 3, label: '30-60 วัน' },
}

/**
 * STATUS_CONFIG — colors and labels for request status chips.
 */
export const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  pending: { color: 'amber', label: 'รอพิจารณา' },
  approved: { color: 'green', label: 'อนุมัติแล้ว' },
  rejected: { color: 'red', label: 'ไม่อนุมัติ' },
  needs_resubmit: { color: 'blue', label: 'ต้องส่งใหม่' },
}

export const REASON_LABELS: Record<string, string> = {
  sold_wait_delivery: 'ขายแล้ว รอส่งมอบ',
  demo_unit: 'สินค้าโชว์',
  damaged: 'สินค้าชำรุด',
  system_error: 'ข้อมูลระบบไม่ตรงกับสต็อกจริง',
  other: 'อื่นๆ',
}

