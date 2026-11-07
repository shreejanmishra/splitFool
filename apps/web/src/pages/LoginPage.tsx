import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Receipt, ShieldCheck, ArrowRight } from 'lucide-react'
import { useAuthStore } from '@splitfool/store'
import { webApi } from '../api/client'

export const LoginPage: React.FC = () => {
  const navigate = useNavigate()
  const { devLogin } = useAuthStore()

  const [devEmail, setDevEmail] = useState('')
  const [devName, setDevName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleOAuthLogin = async (provider: 'google' | 'github') => {
    try {
      setLoading(true)
      setError(null)
      const res = await webApi.post<{ url: string }>(`/api/auth/${provider}/start`, {
        platform: 'web',
      })
      if (res.url) {
        window.location.href = res.url
      }
    } catch (err: any) {
      setError(err.message || 'Failed to start OAuth login')
      setLoading(false)
    }
  }

  const handleDevLogin = async (email: string, name: string) => {
    try {
      setLoading(true)
      setError(null)
      await devLogin(email, name)
      navigate('/')
    } catch (err: any) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const handleCustomDevSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!devEmail || !devName) return
    handleDevLogin(devEmail, devName)
  }

  return (
    <div className="min-h-screen w-full bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
      {/* Background glowing orb accents */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main card */}
      <div className="relative w-full max-w-md bg-slate-900/80 border border-slate-800 backdrop-blur-2xl rounded-3xl p-8 shadow-2xl z-10">
        {/* Brand header */}
        <div className="text-center mb-8">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-400 via-cyan-500 to-rose-500 p-0.5 shadow-xl shadow-teal-500/20 mb-4 animate-pulse">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
              <Receipt className="w-7 h-7 text-teal-400" />
            </div>
          </div>
          <h1 className="font-display font-extrabold text-3xl tracking-tight text-white mb-2">
            split<span className="text-teal-400">Fool</span>
          </h1>
          <p className="text-slate-400 text-sm">
            Share expenses, settle up with friends, and simplify debts effortlessly.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium text-center">
            {error}
          </div>
        )}

        {/* OAuth Social Login Buttons */}
        <div className="space-y-3 mb-6">
          <button
            type="button"
            disabled={loading}
            onClick={() => handleOAuthLogin('google')}
            className="flex items-center justify-center gap-3 w-full py-3 px-4 rounded-xl font-semibold text-sm bg-white hover:bg-slate-100 text-slate-900 shadow-md active:scale-98 transition-all disabled:opacity-50 cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.15z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.04 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
            <span>Continue with Google</span>
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => handleOAuthLogin('github')}
            className="flex items-center justify-center gap-3 w-full py-3 px-4 rounded-xl font-semibold text-sm bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 shadow-md active:scale-98 transition-all disabled:opacity-50 cursor-pointer"
          >
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            <span>Continue with GitHub</span>
          </button>
        </div>

        {/* Dev Login Section */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-800" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-slate-900 px-3 text-slate-500 font-semibold tracking-wider">
              1-Click Dev Testing
            </span>
          </div>
        </div>

        {/* Quick test accounts */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { name: 'Alice', email: 'alice@test.com' },
            { name: 'Bob', email: 'bob@test.com' },
            { name: 'Charlie', email: 'charlie@test.com' },
          ].map((acc) => (
            <button
              key={acc.email}
              type="button"
              disabled={loading}
              onClick={() => handleDevLogin(acc.email, acc.name)}
              className="flex flex-col items-center justify-center py-2.5 px-2 rounded-xl bg-slate-950/60 hover:bg-slate-800 border border-slate-800/80 hover:border-teal-500/40 text-slate-200 transition-all cursor-pointer group"
            >
              <div className="w-6 h-6 rounded-full bg-teal-500/10 text-teal-400 group-hover:bg-teal-500 group-hover:text-slate-950 flex items-center justify-center text-xs font-bold transition-colors mb-1">
                {acc.name[0]}
              </div>
              <span className="text-xs font-semibold">{acc.name}</span>
            </button>
          ))}
        </div>

        {/* Custom dev user login form */}
        <form onSubmit={handleCustomDevSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Name"
              value={devName}
              onChange={(e) => setDevName(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-teal-500 transition-colors"
            />
            <input
              type="email"
              placeholder="Email"
              value={devEmail}
              onChange={(e) => setDevEmail(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-teal-500 transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !devEmail || !devName}
            className="w-full py-2 px-3 rounded-xl text-xs font-semibold bg-teal-500/10 text-teal-400 border border-teal-500/20 hover:bg-teal-500/20 transition-all disabled:opacity-40 cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span>Sign in as Custom User</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        {/* Security footer */}
        <div className="mt-8 pt-4 border-t border-slate-800/60 flex items-center justify-center gap-2 text-slate-500 text-[11px]">
          <ShieldCheck className="w-3.5 h-3.5 text-teal-500/60" />
          <span>Server-side rotating sessions with CSRF protection</span>
        </div>
      </div>
    </div>
  )
}
