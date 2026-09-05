import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '../lib/api'
import Header from '../components/Header'

export default function LandingPage() {
  const navigate = useNavigate()
  const [regions, setRegions] = useState<string[]>([])
  const [stores, setStores] = useState<{ store_id: string; store_name: string }[]>([])
  const [region, setRegion] = useState('')
  const [storeId, setStoreId] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.getRegions().then(setRegions).catch(console.error)
  }, [])

  useEffect(() => {
    if (!region) { setStores([]); setStoreId(''); return }
    api.getStores(region).then(setStores).catch(console.error)
  }, [region])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!storeId || !name.trim() || !phone.trim()) {
      setError('กรุณากรอกข้อมูลให้ครบทุกช่อง')
      return
    }
    if (!/^[0-9]{9,10}$/.test(phone.replace(/-/g, ''))) {
      setError('เบอร์โทรศัพท์ไม่ถูกต้อง (กรุณากรอก 9-10 หลัก)')
      return
    }
    setLoading(true)
    try {
      const session = await api.createSession({ store_id: storeId, name: name.trim(), phone: phone.trim() })
      sessionStorage.setItem('pc_token', session.token)
      sessionStorage.setItem('pc_session', JSON.stringify(session))
      navigate('/store')
    } catch (err: any) {
      setError(err.message ?? 'เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="ตรวจสอบ Nonmove Stock" />
      <div className="max-w-md mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-1">เข้าสู่ระบบ PC</h2>
          <p className="text-sm text-gray-500 mb-6">กรุณาระบุข้อมูลของคุณ</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Region */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ภูมิภาค</label>
              <select
                value={region}
                onChange={e => { setRegion(e.target.value); setStoreId('') }}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#0057A8]"
                required
              >
                <option value="">-- เลือกภูมิภาค --</option>
                {regions.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            {/* Store */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ร้านค้า</label>
              <select
                value={storeId}
                onChange={e => setStoreId(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#0057A8] disabled:bg-gray-100"
                required
                disabled={!region}
              >
                <option value="">-- เลือกร้าน --</option>
                {stores.map(s => <option key={s.store_id} value={s.store_id}>{s.store_name}</option>)}
              </select>
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อ</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="ชื่อ-นามสกุล"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#0057A8]"
                required
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">เบอร์โทรศัพท์ <span className="text-gray-400 text-xs">(10 หลัก)</span></label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="0812345678"
                maxLength={10}
                inputMode="numeric"
                pattern="[0-9]{9,10}"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#0057A8]"
                required
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#0057A8] hover:bg-[#004A8F] text-white font-semibold py-4 rounded-xl text-base transition-colors disabled:opacity-60 mt-2"
            >
              {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
            </button>
          </form>
        </div>

        {/* Admin link */}
        <div className="mt-8 text-center">
          <Link
            to="/admin/login"
            className="text-sm text-gray-400 hover:text-gray-600 underline"
          >
            เข้าสู่ระบบ Admin
          </Link>
        </div>
      </div>
    </div>
  )
}
