import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  User,
  Shield,
  Laptop,
  LogOut,
  CheckCircle,
  AlertCircle,
  Trash2,
} from 'lucide-react'
import { CURRENCIES } from '@splitfool/shared'
import { useAuthStore } from '@splitfool/store'
import { webApi } from '../api/client'

interface SessionItem {
  id: string
  kind?: string
  device?: { ua?: string; ip?: string }
  createdAt: string
  lastUsedAt: string
  current?: boolean
}

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate()
  const { user, fetchMe, logoutAll } = useAuthStore()

  const [name, setName] = useState(user?.name || '')
  const [currency, setCurrency] = useState(user?.defaultCurrency || 'INR')
  const [sessions, setSessions] = useState<SessionItem[]>([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (user) {
      setName(user.name)
      setCurrency(user.defaultCurrency)
    }
  }, [user])

  const fetchSessions = async () => {
    try {
      const res = await webApi.get<{ sessions: SessionItem[] }>('/api/auth/sessions')
      setSessions(res.sessions || [])
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    fetchSessions()
  }, [])

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setLoading(true)
      setMsg(null)
      await webApi.patch('/api/auth/me', { name: name.trim(), defaultCurrency: currency })
      await fetchMe()
      setMsg({ type: 'success', text: 'Profile updated successfully!' })
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Failed to update profile' })
    } finally {
      setLoading(false)
    }
  }

  const handleRevokeSession = async (sessionId: string) => {
    try {
      await webApi.delete(`/api/auth/sessions/${sessionId}`)
      fetchSessions()
    } catch (err: any) {
      alert(err.message || 'Failed to revoke session')
    }
  }

  const handleLogoutAll = async () => {
    if (!confirm('Log out of all devices?')) return
    await logoutAll()
    navigate('/login')
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold font-display text-white">Account Settings</h1>
        <p className="text-sm text-slate-400">
          Manage your profile, preferred currency, and active security sessions.
        </p>
      </div>

      {msg && (
        <div
          className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
            msg.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
              : 'bg-rose-500/10 border border-rose-500/20 text-rose-300'
          }`}
        >
          {msg.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Profile & Currency Form */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl">
        <div className="flex items-center gap-2.5 mb-5 pb-4 border-b border-slate-800">
          <User className="w-5 h-5 text-teal-400" />
          <h2 className="font-display font-bold text-base text-white">Profile & Preferences</h2>
        </div>

        <form onSubmit={handleUpdateProfile} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Email</label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full bg-slate-950/60 border border-slate-800/80 rounded-xl px-3.5 py-2 text-xs text-slate-500 cursor-not-allowed"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">
              Default Currency
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full sm:w-1/2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500 cursor-pointer"
            >
              {Object.keys(CURRENCIES).map((c) => (
                <option key={c} value={c}>
                  {c} - {CURRENCIES[c].name} ({CURRENCIES[c].symbol})
                </option>
              ))}
            </select>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-teal-500 text-slate-950 hover:bg-teal-400 transition-all disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Active Sessions & Security */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl">
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <Shield className="w-5 h-5 text-teal-400" />
            <div>
              <h2 className="font-display font-bold text-base text-white">Active Sessions</h2>
              <p className="text-xs text-slate-400">
                Logged in devices using server-side rotating cookies
              </p>
            </div>
          </div>

          <button
            onClick={handleLogoutAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Log out everywhere</span>
          </button>
        </div>

        <div className="space-y-2.5">
          {sessions.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950 border border-slate-800"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-800 text-slate-300 flex items-center justify-center">
                  <Laptop className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-white flex items-center gap-2">
                    <span>{s.device?.ua?.slice(0, 45) || 'Web Browser'}</span>
                    {s.current && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-500/15 text-teal-400 font-bold">
                        Current
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Active: {new Date(s.lastUsedAt).toLocaleString()}
                  </p>
                </div>
              </div>

              <button
                onClick={() => handleRevokeSession(s.id)}
                title="Revoke session"
                className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
