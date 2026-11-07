import React, { useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  TrendingUp,
  TrendingDown,
  Users,
  Receipt,
  ChevronRight,
} from 'lucide-react'
import { formatMoney } from '@splitfool/shared'
import { useAuthStore, useBalanceStore, useGroupStore, useExpenseStore } from '@splitfool/store'
import { CategoryDonutChart } from '../components/charts/CategoryDonutChart'
import { MonthlyBarChart } from '../components/charts/MonthlyBarChart'

export const DashboardPage: React.FC = () => {
  const { user } = useAuthStore()
  const { totals, stats, fetchBalances, fetchStats } = useBalanceStore()
  const { groups, fetchGroups } = useGroupStore()
  const { expenses, fetchExpenses } = useExpenseStore()

  useEffect(() => {
    fetchBalances()
    fetchStats()
    fetchGroups()
    fetchExpenses()
  }, [fetchBalances, fetchStats, fetchGroups, fetchExpenses])

  const defaultCurrency = user?.defaultCurrency || 'INR'
  const primaryTotal =
    totals.find((t) => t.currency === defaultCurrency) ??
    totals[0] ?? { currency: defaultCurrency, owedMinor: 0, oweMinor: 0 }

  const balanceCurrency = primaryTotal.currency
  const statsCurrency = stats?.currency || defaultCurrency
  const owedMinor = primaryTotal.owedMinor
  const oweMinor = primaryTotal.oweMinor
  const userNet = owedMinor - oweMinor
  const isNetPositive = userNet >= 0

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-900/80 to-teal-950/40 border border-slate-800/80 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-80 bg-teal-500/5 blur-2xl pointer-events-none" />
        <div className="relative z-10">
          <span className="text-xs font-bold text-teal-400 tracking-wider uppercase mb-1 block">
            Personal Financial Hub
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold font-display text-white">
            Welcome back, {user?.name?.split(' ')[0] || 'Friend'}!
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Here is your real-time debt summary and expense analytics across all groups.
          </p>
        </div>
      </div>

      {/* Top Balance Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Net Balance Card */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl relative group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400">Total Net Balance</span>
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                isNetPositive
                  ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20'
                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
              }`}
            >
              {isNetPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className={`text-2xl sm:text-3xl font-extrabold font-display ${
                isNetPositive ? 'text-teal-400' : 'text-rose-400'
              }`}
            >
              {formatMoney(Math.abs(userNet), balanceCurrency)}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {isNetPositive ? 'In total, you are owed money' : 'In total, you owe money overall'}
          </p>
        </div>

        {/* You Are Owed Card */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-teal-500/20 backdrop-blur-xl hover:border-teal-500/40 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-teal-300">You Are Owed</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-400">
              Receivable
            </span>
          </div>
          <span className="text-2xl sm:text-3xl font-extrabold font-display text-white">
            {formatMoney(owedMinor, balanceCurrency)}
          </span>
          <p className="text-xs text-slate-400 mt-1">Friends owe you from group expenses</p>
        </div>

        {/* You Owe Card */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-rose-500/20 backdrop-blur-xl hover:border-rose-500/40 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-rose-300">You Owe</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400">
              Payable
            </span>
          </div>
          <span className="text-2xl sm:text-3xl font-extrabold font-display text-white">
            {formatMoney(oweMinor, balanceCurrency)}
          </span>
          <p className="text-xs text-slate-400 mt-1">Pending repayments to friends</p>
        </div>
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Donut Chart Card */}
        <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 backdrop-blur-xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-display font-bold text-base text-white">Spending by Category</h3>
              <p className="text-xs text-slate-400">Breakdown of personal and shared expenses</p>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 font-medium">
              {statsCurrency}
            </span>
          </div>
          <CategoryDonutChart
            data={stats?.byCategory ?? []}
            currency={statsCurrency}
            size={220}
          />
        </div>

        {/* Monthly Trend Bar Chart Card */}
        <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 backdrop-blur-xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-display font-bold text-base text-white">Monthly Expense Trend</h3>
              <p className="text-xs text-slate-400">Spending history over recent months</p>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 font-medium">
              Monthly
            </span>
          </div>
          <MonthlyBarChart
            data={stats?.byMonth ?? []}
            currency={statsCurrency}
            height={200}
          />
        </div>
      </div>

      {/* Split Section: Groups & Recent Expenses */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Groups Preview */}
        <div className="lg:col-span-1 p-6 rounded-2xl bg-slate-900/50 border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold text-base text-white">Your Groups</h3>
            <Link to="/groups" className="text-xs font-semibold text-teal-400 hover:underline">
              View all
            </Link>
          </div>

          <div className="space-y-2.5">
            {groups.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>No groups created yet.</p>
                <Link
                  to="/groups"
                  className="mt-2 inline-block text-teal-400 font-semibold hover:underline"
                >
                  Create your first group
                </Link>
              </div>
            ) : (
              groups.slice(0, 4).map((g) => (
                <Link
                  key={g._id}
                  to={`/groups/${g._id}`}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 hover:bg-slate-800/60 border border-slate-800/80 hover:border-teal-500/30 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-800 text-teal-400 flex items-center justify-center font-bold text-xs">
                      {g.name[0]}
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-slate-200 group-hover:text-white transition-colors">
                        {g.name}
                      </h4>
                      <p className="text-[11px] text-slate-500 capitalize">
                        {g.type} · {g.members?.length || 0} members
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-teal-400 transition-colors" />
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Recent Expenses Ledger */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-slate-900/50 border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold text-base text-white">Recent Expenses</h3>
            <span className="text-xs text-slate-500">Live sync</span>
          </div>

          <div className="space-y-2.5">
            {expenses.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-xs">
                <Receipt className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>No recent expenses found.</p>
              </div>
            ) : (
              expenses.slice(0, 5).map((exp) => (
                <div
                  key={exp._id}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-800 text-teal-400 flex items-center justify-center flex-shrink-0">
                      <Receipt className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-white">{exp.description}</h4>
                      <p className="text-[11px] text-slate-500">
                        {new Date(exp.date).toLocaleDateString()} ·{' '}
                        <span className="capitalize">{exp.category}</span>
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-sm font-bold font-display text-white">
                      {formatMoney(exp.amountMinor, exp.currency)}
                    </span>
                    <span className="block text-[10px] text-slate-500 capitalize">
                      {exp.splitMethod} split
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
