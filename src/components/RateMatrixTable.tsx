import { useState } from 'react'
import type { KpiResult } from '../types'

interface RateMatrixTableProps {
  kpi?: KpiResult | null
  defaultExpanded?: boolean
}

interface RateRowDef {
  bucket: number
  label: string
  pctRange: string
  type: 'penalty' | 'reward'
  rates: [number, number, number, number] // Rank 1, 2, 3, 4
}

const MATRIX_ROWS: RateRowDef[] = [
  // เงินค่าปรับ (Penalty)
  { bucket: 1, label: 'เพิ่มขึ้น 30% ขึ้นไป', pctRange: '≥ +30%', type: 'penalty', rates: [-700, -800, -900, -1000] },
  { bucket: 2, label: 'เพิ่มขึ้น 20% - 29%', pctRange: '+20% ถึง +29%', type: 'penalty', rates: [-500, -600, -700, -800] },
  { bucket: 3, label: 'เพิ่มขึ้น 10% - 19%', pctRange: '+10% ถึง +19%', type: 'penalty', rates: [-300, -400, -500, -600] },
  { bucket: 4, label: 'เพิ่มขึ้น 0% - 9%', pctRange: '0% ถึง +9%', type: 'penalty', rates: [-100, -200, -300, -400] },
  // เงินรางวัล (Reward)
  { bucket: 5, label: 'ลดลง 0% - 9%', pctRange: '0% ถึง -9%', type: 'reward', rates: [200, 600, 800, 1000] },
  { bucket: 6, label: 'ลดลง 10% - 19%', pctRange: '-10% ถึง -19%', type: 'reward', rates: [400, 800, 1000, 1500] },
  { bucket: 7, label: 'ลดลง 20% - 29%', pctRange: '-20% ถึง -29%', type: 'reward', rates: [600, 1000, 1500, 2000] },
  { bucket: 8, label: 'ลดลง 30% ขึ้นไป', pctRange: '≤ -30%', type: 'reward', rates: [800, 1500, 2000, 3000] },
]

const RANK_COLUMNS = [
  { rank: 1, label: 'Rank 1', desc: 'ต่ำกว่า 150K บ.' },
  { rank: 2, label: 'Rank 2', desc: '150K - 249K บ.' },
  { rank: 3, label: 'Rank 3', desc: '250K - 299K บ.' },
  { rank: 4, label: 'Rank 4', desc: '300K บ. ขึ้นไป' },
]

export default function RateMatrixTable({ kpi, defaultExpanded = false }: RateMatrixTableProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  const currentRank = kpi?.rank_tier ?? 0
  const currentBucket = kpi?.bucket ?? 0

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-2xs transition-all">
      {/* Header Toggle Button */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50/50 hover:bg-blue-100/50 flex items-center justify-between transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">📋</span>
          <div>
            <div className="text-xs font-black text-[#0057A8] uppercase tracking-wide flex items-center gap-2">
              <span>ตารางอัตราเงินค่าปรับ / เงินรางวัล (Table rate of Penalty/Reward)</span>
              {kpi && (
                <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  สาขาของคุณ: {kpi.rank_label} · Bucket {kpi.bucket}
                </span>
              )}
            </div>
            <div className="text-[11px] text-gray-500 mt-0.5">
              เกณฑ์คำนวณเงินรางวัล (Reward) และเงินค่าปรับ (Penalty) ประจำเดือน
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs font-bold text-[#0057A8]">
          <span>{expanded ? 'ย่อตาราง ▲' : 'ดูเกณฑ์ทั้งหมด ▼'}</span>
        </div>
      </button>

      {/* Expandable Table Content */}
      {expanded && (
        <div className="p-3 border-t border-gray-200 space-y-3">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-center border-collapse min-w-[540px]">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-gray-700 font-bold">
                  <th className="py-2.5 px-3 text-left w-44">เกณฑ์ % ผลต่าง (% Gap)</th>
                  {RANK_COLUMNS.map(col => (
                    <th
                      key={col.rank}
                      className={`py-2 px-2 border-l border-gray-200 ${
                        currentRank === col.rank ? 'bg-blue-100/80 text-[#0057A8] font-black' : ''
                      }`}
                    >
                      <div>{col.label}</div>
                      <div className="text-[10px] font-normal text-gray-500">{col.desc}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-800 font-medium">
                {/* Penalty Group Header */}
                <tr className="bg-rose-50/70 text-rose-800 font-bold">
                  <td colSpan={5} className="py-1 px-3 text-left text-[11px] flex items-center gap-1.5">
                    <span>⚠️</span>
                    <span>เงินค่าปรับ (Penalty) — ยอดสต็อก Nonmove เพิ่มขึ้น</span>
                  </td>
                </tr>

                {MATRIX_ROWS.slice(0, 4).map(row => {
                  const isCurrentRow = currentBucket === row.bucket
                  return (
                    <tr
                      key={row.bucket}
                      className={`hover:bg-gray-50 transition-colors ${
                        isCurrentRow ? 'bg-amber-50/60 font-bold' : ''
                      }`}
                    >
                      <td className="py-2 px-3 text-left">
                        <div className="text-gray-900 font-bold">{row.label}</div>
                        <div className="text-[10px] text-gray-400 font-mono">{row.pctRange}</div>
                      </td>
                      {row.rates.map((rate, idx) => {
                        const rankNum = idx + 1
                        const isMatch = currentRank === rankNum && currentBucket === row.bucket
                        return (
                          <td
                            key={rankNum}
                            className={`py-2 px-2 border-l border-gray-200 font-bold text-rose-600 ${
                              isMatch
                                ? 'bg-rose-600 text-white font-black ring-2 ring-rose-700 rounded-md scale-95 shadow-xs'
                                : currentRank === rankNum
                                  ? 'bg-blue-50/50'
                                  : ''
                            }`}
                          >
                            {Math.abs(rate).toLocaleString()} บ.
                            {isMatch && <span className="block text-[9px] text-rose-100">★ ปัจจุบัน</span>}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}

                {/* Reward Group Header */}
                <tr className="bg-emerald-50/70 text-emerald-800 font-bold">
                  <td colSpan={5} className="py-1 px-3 text-left text-[11px] flex items-center gap-1.5">
                    <span>🎉</span>
                    <span>เงินรางวัล (Reward) — ยอดสต็อก Nonmove ลดลง</span>
                  </td>
                </tr>

                {MATRIX_ROWS.slice(4).map(row => {
                  const isCurrentRow = currentBucket === row.bucket
                  return (
                    <tr
                      key={row.bucket}
                      className={`hover:bg-gray-50 transition-colors ${
                        isCurrentRow ? 'bg-emerald-50/60 font-bold' : ''
                      }`}
                    >
                      <td className="py-2 px-3 text-left">
                        <div className="text-gray-900 font-bold">{row.label}</div>
                        <div className="text-[10px] text-gray-400 font-mono">{row.pctRange}</div>
                      </td>
                      {row.rates.map((rate, idx) => {
                        const rankNum = idx + 1
                        const isMatch = currentRank === rankNum && currentBucket === row.bucket
                        return (
                          <td
                            key={rankNum}
                            className={`py-2 px-2 border-l border-gray-200 font-bold text-emerald-700 ${
                              isMatch
                                ? 'bg-emerald-600 text-white font-black ring-2 ring-emerald-700 rounded-md scale-95 shadow-xs'
                                : currentRank === rankNum
                                  ? 'bg-blue-50/50'
                                  : ''
                            }`}
                          >
                            +{rate.toLocaleString()} บ.
                            {isMatch && <span className="block text-[9px] text-emerald-100">★ ปัจจุบัน</span>}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between text-[11px] text-gray-500 bg-gray-50 p-2.5 rounded-xl">
            <div>
              💡 <strong>สูตร % Gap:</strong> ((ยอด Nonmove ล่าสุด - ยอด Nonmove ต้นเดือน) / ยอดต้นเดือน) × 100
            </div>
            <div>
              * จำนวนเงินรางวัล / ค่าปรับ ต่อ 1 สาขา
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
