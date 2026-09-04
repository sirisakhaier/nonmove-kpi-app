import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import Header from '../../components/Header'

const STOCK_TYPES = ['SELLABLE', 'ONLINE', 'DEMO']

export default function AdminSettings() {
  const [included, setIncluded] = useState<string[]>(['SELLABLE', 'ONLINE'])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.adminGetSettings()
      .then(s => setIncluded(s.included_stock_types))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const toggle = (type: string) => {
    setIncluded(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    )
  }

  const handleSave = async () => {
    setSaving(true); setSaved(false); setError('')
    try {
      await api.adminUpdateSettings(included)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header adminMode title="Settings" />
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">KPI Settings</h1>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold mb-3">Stock Types ที่นับในการคำนวณ KPI</h2>
          {loading ? <div className="text-gray-400">Loading...</div> : (
            <div className="space-y-2">
              {STOCK_TYPES.map(t => (
                <label key={t} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={included.includes(t)}
                    onChange={() => toggle(t)}
                    className="w-5 h-5 rounded text-[#0057A8]"
                  />
                  <span className="font-medium">{t}</span>
                  {t === 'DEMO' && <span className="text-xs text-gray-400">(ปกติไม่รวมใน KPI)</span>}
                </label>
              ))}
            </div>
          )}
          {error && <div className="text-red-600 text-sm mt-3">{error}</div>}
          {saved && <div className="text-green-600 text-sm mt-3">✅ บันทึกแล้ว</div>}
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="mt-6 bg-[#0057A8] text-white px-6 py-2 rounded-lg font-semibold disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  )
}
