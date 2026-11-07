import React, { useState } from 'react'
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  UserCheck,
  Activity as ActivityIcon,
  Settings,
  PlusCircle,
  LogOut,
  HandCoins,
  Receipt,
  Sparkles,
} from 'lucide-react'
import { useAuthStore } from '@splitfool/store'
import { AddExpenseModal } from '../modals/AddExpenseModal'
import { SettleUpModal } from '../modals/SettleUpModal'

export const AppLayout: React.FC = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [showSettleUp, setShowSettleUp] = useState(false)

  const navItems = [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard },
    { label: 'Groups', path: '/groups', icon: Users },
    { label: 'Friends', path: '/friends', icon: UserCheck },
    { label: 'Activity', path: '/activity', icon: ActivityIcon },
    { label: 'Settings', path: '/settings', icon: Settings },
  ]

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Desktop / Tablet Side Rail */}
      <aside className="hidden md:flex flex-col w-64 border-r border-slate-800/80 bg-slate-900/40 backdrop-blur-xl p-4 justify-between z-20">
        <div>
          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-3 px-3 py-4 mb-6 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-400 via-cyan-500 to-rose-500 p-0.5 shadow-lg shadow-teal-500/20 group-hover:scale-105 transition-transform">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Receipt className="w-5 h-5 text-teal-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-display font-extrabold text-xl tracking-tight text-white">
                  split<span className="text-teal-400">Fool</span>
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20">
                  PRO
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">Smart Debt Splitting</p>
            </div>
          </Link>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2 mb-6 px-1">
            <button
              onClick={() => setShowAddExpense(true)}
              className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl font-semibold text-sm bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-slate-950 shadow-lg shadow-teal-500/25 active:scale-98 transition-all cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 stroke-[2.5]" />
              <span>Add Expense</span>
            </button>
            <button
              onClick={() => setShowSettleUp(true)}
              className="flex items-center justify-center gap-2 w-full py-2 px-4 rounded-xl font-semibold text-xs bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
            >
              <HandCoins className="w-4 h-4 text-emerald-400" />
              <span>Settle Up</span>
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-col gap-1.5">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive =
                item.path === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(item.path)

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-150 ${
                    isActive
                      ? 'bg-teal-500/10 text-teal-300 border border-teal-500/20 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-teal-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </div>

        {/* User Card & Logout */}
        <div className="pt-4 border-t border-slate-800/80">
          <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/60 border border-slate-800/50">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-teal-500 to-cyan-500 flex items-center justify-center font-bold text-xs text-slate-950 flex-shrink-0">
                {user?.name ? user.name[0].toUpperCase() : 'U'}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white truncate">{user?.name || 'User'}</p>
                <p className="text-[11px] text-slate-400 truncate">{user?.email || ''}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Log out"
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-gradient-to-b from-slate-950 via-[#070b14] to-slate-950">
        {/* Top Header */}
        <header className="h-16 border-b border-slate-800/60 px-4 sm:px-6 flex items-center justify-between backdrop-blur-md bg-slate-950/60 z-10 flex-shrink-0">
          {/* Mobile Logo */}
          <div className="flex md:hidden items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-400 via-cyan-500 to-rose-500 p-0.5">
              <div className="w-full h-full bg-slate-950 rounded-[6px] flex items-center justify-center">
                <Receipt className="w-4 h-4 text-teal-400" />
              </div>
            </div>
            <span className="font-display font-extrabold text-lg text-white">
              split<span className="text-teal-400">Fool</span>
            </span>
          </div>

          <div className="hidden md:flex items-center gap-2 text-xs text-slate-400 font-medium">
            <Sparkles className="w-3.5 h-3.5 text-teal-400" />
            <span>Optimal debt simplification active</span>
          </div>

          {/* Quick Actions in Header */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setShowSettleUp(true)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all cursor-pointer"
            >
              <HandCoins className="w-3.5 h-3.5" />
              <span>Settle Up</span>
            </button>
            <button
              onClick={() => setShowAddExpense(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-teal-500 to-cyan-500 text-slate-950 hover:opacity-90 shadow-sm shadow-teal-500/20 transition-all cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Add Expense</span>
            </button>

            {/* Mobile Profile Avatar */}
            <div className="md:hidden flex items-center">
              <Link to="/settings" className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-xs text-teal-400 border border-slate-700">
                {user?.name ? user.name[0].toUpperCase() : 'U'}
              </Link>
            </div>
          </div>
        </header>

        {/* Scrollable View Content */}
        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-8 pb-24 md:pb-8">
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-slate-900/90 border-t border-slate-800 backdrop-blur-xl flex items-center justify-around px-2 z-30">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive =
            item.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.path)

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center w-14 py-1 rounded-lg transition-colors ${
                isActive ? 'text-teal-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-5 h-5 mb-0.5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Global Modals */}
      {showAddExpense && (
        <AddExpenseModal isOpen={showAddExpense} onClose={() => setShowAddExpense(false)} />
      )}
      {showSettleUp && (
        <SettleUpModal isOpen={showSettleUp} onClose={() => setShowSettleUp(false)} />
      )}
    </div>
  )
}
