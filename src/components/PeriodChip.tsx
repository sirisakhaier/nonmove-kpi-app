import { PERIOD_CONFIG } from '../lib/kpi'

interface PeriodChipProps {
  period: string | null | undefined
}

export default function PeriodChip({ period }: PeriodChipProps) {
  if (!period) return null
  const config = PERIOD_CONFIG[period]
  if (!config) return <span className="chip-gray inline-flex px-2 py-0.5 rounded text-xs">{period}</span>
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold chip-${config.color}`}>
      {config.label}
    </span>
  )
}
