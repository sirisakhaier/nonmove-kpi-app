import { STATUS_CONFIG } from '../lib/kpi'

interface StatusChipProps {
  status: string | null
}

export default function StatusChip({ status }: StatusChipProps) {
  if (!status) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium chip-gray">
        ยังไม่ได้ขอ
      </span>
    )
  }
  const config = STATUS_CONFIG[status]
  if (!config) return null
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium chip-${config.color}`}>
      {config.label}
    </span>
  )
}
