// ============================================================
// Typed API fetch wrappers
// ============================================================
import type {
  Store, StockSnapshot, ExclusionRequest,
  KpiResult, KpiRateRow, KpiSettings, SnapshotDateInfo, Session
} from '../types'

const BASE = ''

function authHeaders(): Record<string, string> {
  const adminToken = sessionStorage.getItem('admin_token')
  const pcToken = sessionStorage.getItem('pc_token')
  const token = adminToken || pcToken
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(BASE + url, {
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...options?.headers },
    credentials: 'include',
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error((err as any).error ?? res.statusText)
  }
  return res.json() as Promise<T>
}

// ---- Public / PC ----

export const api = {
  getRegions: () =>
    request<string[]>('/api/regions'),

  getStores: (region: string) =>
    request<Store[]>(`/api/stores?region=${encodeURIComponent(region)}`),

  createSession: (payload: { store_id: string; name: string; phone: string }) =>
    request<Session>('/api/session', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getStoreNonmove: (store_id: string) =>
    request<{ snapshots: StockSnapshot[]; date: string }>(
      `/api/stock/nonmove?store_id=${store_id}`,
      { headers: authHeaders() }
    ),

  getStockItem: (id: number | string) =>
    request<{ item: StockSnapshot }>(
      `/api/stock/nonmove?id=${id}`,
      { headers: authHeaders() }
    ),

  getStoreKpi: (store_id: string, ref_date?: string) =>
    request<KpiResult>(`/api/kpi/store?store_id=${store_id}${ref_date ? `&ref_date=${ref_date}` : ''}`, {
      headers: authHeaders(),
    }),

  getMyRequests: () =>
    request<ExclusionRequest[]>('/api/requests/mine', {
      headers: authHeaders(),
    }),

  createRequest: (formData: FormData) =>
    fetch('/api/requests', {
      method: 'POST',
      headers: authHeaders(),
      credentials: 'include',
      body: formData,
    }).then(async r => {
      if (!r.ok) {
        const e = await r.json().catch(() => ({ error: r.statusText }))
        throw new Error((e as any).error ?? r.statusText)
      }
      return r.json() as Promise<{ id: number; status: string }>
    }),

  updateRequest: (id: number, formData: FormData) =>
    fetch(`/api/requests/${id}`, {
      method: 'PUT',
      headers: authHeaders(),
      credentials: 'include',
      body: formData,
    }).then(async r => {
      if (!r.ok) {
        const e = await r.json().catch(() => ({ error: r.statusText }))
        throw new Error((e as any).error ?? r.statusText)
      }
      return r.json() as Promise<{ id: number; status: string }>
    }),

  // ---- Admin ----

  adminLogin: async (username: string, password: string) => {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
      credentials: 'include',
    })
    if (!res.ok) {
      const e = await res.json().catch(() => ({ error: res.statusText }))
      throw new Error((e as any).error ?? res.statusText)
    }
    const data = await res.json()
    if (data.token) {
      sessionStorage.setItem('admin_token', data.token)
    }
    return data
  },

  adminLogout: async () => {
    sessionStorage.removeItem('admin_token')
    return fetch('/api/admin/logout', { method: 'POST', credentials: 'include' })
  },

  adminDashboard: (params?: Record<string, string>) =>
    request<{
      kpi_rows: KpiResult[]
      trend: Array<{ date: string; total_amount: number; store_count: number }>
      pending_count: number
    }>('/api/admin/dashboard?' + new URLSearchParams(params ?? {}), {
      credentials: 'include',
    }),

  adminKpi: (params?: Record<string, string>) =>
    request<KpiResult[]>('/api/admin/kpi?' + new URLSearchParams(params ?? {}), {
      credentials: 'include',
    }),

  adminImport: (formData: FormData) =>
    fetch('/api/admin/import', {
      method: 'POST',
      headers: authHeaders(),
      credentials: 'include',
      body: formData,
    }).then(async r => {
      if (!r.ok) {
        const e = await r.json().catch(() => ({ error: r.statusText }))
        throw new Error((e as any).error ?? r.statusText)
      }
      return r.json() as Promise<{
        date: string
        rows_imported: number
        stores_upserted: number
        errors: string[]
        replaced: boolean
      }>
    }),

  adminImportData: (payload: {
    snapshot_date: string
    is_first_chunk: boolean
    replace: boolean
    stores?: any[]
    rows: any[]
  }) =>
    request<{ ok: boolean; snapshot_date: string; rows_inserted: number }>(
      '/api/admin/import-data',
      {
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify(payload),
      }
    ),

  adminGetSnapshots: () =>
    request<SnapshotDateInfo[]>('/api/admin/snapshots', { credentials: 'include' }),

  adminToggleSnapshot: (date: string, is_active: number) =>
    request<{ ok: boolean; snapshot_date: string; is_active: number }>(
      `/api/admin/snapshots/${date}/toggle`,
      {
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ is_active }),
      }
    ),

  adminDeleteSnapshot: (date: string) =>
    request<{ ok: boolean; snapshot_date: string; deleted_rows: number }>(
      `/api/admin/snapshots/${date}`,
      {
        method: 'DELETE',
        credentials: 'include',
      }
    ),

  adminGetRequests: (params?: Record<string, string>) =>
    request<ExclusionRequest[]>(
      '/api/admin/requests?' + new URLSearchParams(params ?? {}),
      { credentials: 'include' }
    ),

  adminGetRequest: (id: number) =>
    request<ExclusionRequest>(`/api/admin/requests/${id}`, {
      credentials: 'include',
    }),

  adminApprove: (id: number) =>
    request<{ ok: boolean }>(`/api/admin/requests/${id}/approve`, {
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({}),
    }),

  adminReject: (id: number, comment: string) =>
    request<{ ok: boolean }>(`/api/admin/requests/${id}/reject`, {
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ comment }),
    }),

  adminNeedsResubmit: (id: number, comment: string) =>
    request<{ ok: boolean }>(`/api/admin/requests/${id}/needs-resubmit`, {
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ comment }),
    }),

  adminDeleteRequest: (id: number) =>
    request<{ ok: boolean }>(`/api/admin/requests/${id}`, {
      method: 'DELETE',
      credentials: 'include',
      body: JSON.stringify({}),
    }),

  adminGetKpiRate: () =>
    request<{ versions: string[]; current: KpiRateRow[] }>('/api/admin/kpi-rate', {
      credentials: 'include',
    }),

  adminUpdateKpiRate: (payload: { effective_from: string; matrix: Partial<KpiRateRow>[] }) =>
    request<{ ok: boolean }>('/api/admin/kpi-rate', {
      method: 'PUT',
      credentials: 'include',
      body: JSON.stringify(payload),
    }),

  adminGetSettings: () =>
    request<KpiSettings>('/api/admin/settings', { credentials: 'include' }),

  adminUpdateSettings: (included_stock_types: string[]) =>
    request<{ ok: boolean }>('/api/admin/settings', {
      method: 'PUT',
      credentials: 'include',
      body: JSON.stringify({ included_stock_types }),
    }),

  adminExportRequests: (params?: Record<string, string>) => {
    const url = '/api/admin/export/requests?' + new URLSearchParams(params ?? {})
    return fetch(url, { headers: authHeaders(), credentials: 'include' }).then(r => {
      if (!r.ok) throw new Error('Export failed')
      return r.blob()
    })
  },

  adminImportRequests: (formData: FormData) =>
    fetch('/api/admin/import-requests', {
      method: 'POST',
      headers: authHeaders(),
      credentials: 'include',
      body: formData,
    }).then(async r => {
      if (!r.ok) {
        const e = await r.json().catch(() => ({ error: r.statusText }))
        throw new Error((e as any).error ?? r.statusText)
      }
      return r.json() as Promise<{ updated: number; skipped: number; errors: string[] }>
    }),

  adminExportKpi: (month: string) => {
    const url = `/api/admin/export/kpi?month=${month}`
    return fetch(url, { headers: authHeaders(), credentials: 'include' }).then(r => {
      if (!r.ok) throw new Error('Export failed')
      return r.blob()
    })
  },
}
