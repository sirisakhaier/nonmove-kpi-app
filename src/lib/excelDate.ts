import * as XLSX from 'xlsx'

/**
 * Extracts the exact date from Excel Date column without any timezone shift.
 * Handles Excel serial numbers, DD/MM/YYYY, YYYY-MM-DD, and Date objects.
 */
export function extractExactDate(rawVal: any, formattedText?: string): string {
  // 1. If formatted cell string is available e.g. "05/09/2026" or "2026-09-05"
  if (formattedText && typeof formattedText === 'string') {
    const t = formattedText.trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t
    const ddmmyyyy = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (ddmmyyyy) {
      const d = ddmmyyyy[1].padStart(2, '0')
      const m = ddmmyyyy[2].padStart(2, '0')
      const y = ddmmyyyy[3]
      return `${y}-${m}-${d}`
    }
  }

  // 2. If Excel serial date code (e.g. 46270 for 2026-09-05)
  if (typeof rawVal === 'number') {
    const parsed = XLSX.SSF.parse_date_code(rawVal)
    if (parsed && parsed.y) {
      const y = parsed.y
      const m = String(parsed.m).padStart(2, '0')
      const d = String(parsed.d).padStart(2, '0')
      return `${y}-${m}-${d}`
    }
  }

  // 3. If Date object
  if (rawVal instanceof Date) {
    const y = rawVal.getFullYear()
    const m = String(rawVal.getMonth() + 1).padStart(2, '0')
    const d = String(rawVal.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  // 4. If string value
  if (typeof rawVal === 'string') {
    const t = rawVal.trim()
    if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10)
    const ddmmyyyy = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
    if (ddmmyyyy) {
      return `${ddmmyyyy[3]}-${ddmmyyyy[2].padStart(2, '0')}-${ddmmyyyy[1].padStart(2, '0')}`
    }
  }

  return ''
}
