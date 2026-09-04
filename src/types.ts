// ============================================================
// Shared TypeScript types for the Nonmove KPI App
// ============================================================

export interface Store {
  store_id: string
  store_name: string
  region: string
  province: string
  supervisor?: string
}

export interface StockSnapshot {
  id: number
  snapshot_date: string
  store_id: string
  category?: string
  subcategory?: string
  model: string
  product_code?: string
  product_name?: string
  stock_type?: string
  assortment?: string
  nonmove_period?: string
  nonmove_flag?: string
  stock_qty?: number
  stock_amount?: number
  sku_amount?: number
}

export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'needs_resubmit'

export type RequestReason =
  | 'sold_wait_delivery'
  | 'demo_unit'
  | 'damaged'
  | 'system_error'
  | 'other'

export interface ExclusionRequest {
  id: number
  stock_snapshot_id?: number
  store_id: string
  snapshot_date: string
  model: string
  product_name?: string
  requester_name: string
  requester_phone: string
  reason: RequestReason
  reason_detail: string
  issue_date?: string
  clear_plan?: string
  clear_plan_date?: string
  status: RequestStatus
  admin_comment?: string
  created_at: string
  updated_at: string
  photos?: string[]       // photo_url array
  store_name?: string     // joined
  region?: string         // joined
}

export interface KpiResult {
  store_id: string
  store_name: string
  region: string
  reference_amount: number
  latest_amount: number
  pct_gap: number
  rank_tier: number
  rank_label: string
  bucket: number
  bucket_label: string
  bucket_type: 'penalty' | 'reward'
  amount_thb: number
}

export interface KpiRateRow {
  id: number
  effective_from: string
  rank_tier: number
  rank_label: string
  rank_min_amount: number
  rank_max_amount: number | null
  bucket: number
  bucket_label: string
  bucket_type: 'penalty' | 'reward'
  pct_min: number | null
  pct_max: number | null
  amount_thb: number
}

export interface KpiSettings {
  id: number
  included_stock_types: string[]  // parsed from JSON
  updated_at: string
}

export interface Session {
  token: string
  store_id: string
  store_name: string
  region: string
  name: string
  phone: string
}
