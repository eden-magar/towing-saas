'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Building2,
  Users,
  Truck,
  DollarSign,
  Calendar,
  Download,
  Loader2,
  RefreshCw
} from 'lucide-react'

interface MonthlyStats {
  month: string
  companies: number
  users: number
  tows: number
  revenue: number
}

interface PlanDistribution {
  name: string
  display_name: string
  count: number
  percentage: number
  color: string
}

interface TopCompany {
  id: string
  name: string
  tows_count: number
  revenue: number
}

export default function SuperAdminReportsPage() {
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'quarter' | 'year'>('month')
  
  // Stats
  const [totalStats, setTotalStats] = useState({
    companies: 0,
    users: 0,
    drivers: 0,
    tows: 0,
    revenue: 0
  })
  
  const [growthStats, setGrowthStats] = useState({
    companies: 0,
    users: 0,
    tows: 0,
    revenue: 0
  })

  const [monthlyData, setMonthlyData] = useState<MonthlyStats[]>([])
  const [planDistribution, setPlanDistribution] = useState<PlanDistribution[]>([])
  const [topCompanies, setTopCompanies] = useState<TopCompany[]>([])

  useEffect(() => {
    loadReports()
  }, [dateRange])

  const loadReports = async () => {
    setLoading(true)
    try {
      await Promise.all([
        loadTotalStats(),
        loadMonthlyData(),
        loadPlanDistribution(),
        loadTopCompanies()
      ])
    } catch (error) {
      console.error('Error loading reports:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadTotalStats = async () => {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0).toISOString()

    // Total counts
    const [companies, users, drivers, tows] = await Promise.all([
      supabase.from('companies').select('*', { count: 'exact', head: true }),
      supabase.from('users').select('*', { count: 'exact', head: true }).neq('role', 'super_admin'),
      supabase.from('drivers').select('*', { count: 'exact', head: true }),
      supabase.from('tows').select('*', { count: 'exact', head: true })
    ])

    // This month counts
    const [companiesThisMonth, usersThisMonth, towsThisMonth] = await Promise.all([
      supabase.from('companies').select('*', { count: 'exact', head: true }).gte('created_at', startOfMonth),
      supabase.from('users').select('*', { count: 'exact', head: true }).gte('created_at', startOfMonth),
      supabase.from('tows').select('*', { count: 'exact', head: true }).gte('created_at', startOfMonth)
    ])

    // Last month counts
    const [companiesLastMonth, usersLastMonth, towsLastMonth] = await Promise.all([
      supabase.from('companies').select('*', { count: 'exact', head: true })
        .gte('created_at', startOfLastMonth).lt('created_at', startOfMonth),
      supabase.from('users').select('*', { count: 'exact', head: true })
        .gte('created_at', startOfLastMonth).lt('created_at', startOfMonth),
      supabase.from('tows').select('*', { count: 'exact', head: true })
        .gte('created_at', startOfLastMonth).lt('created_at', startOfMonth)
    ])

    setTotalStats({
      companies: companies.count || 0,
      users: users.count || 0,
      drivers: drivers.count || 0,
      tows: tows.count || 0,
      revenue: 0 // Would come from billing_history
    })

    // Calculate growth percentages
    const calcGrowth = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0
      return Math.round(((current - previous) / previous) * 100)
    }

    setGrowthStats({
      companies: calcGrowth(companiesThisMonth.count || 0, companiesLastMonth.count || 0),
      users: calcGrowth(usersThisMonth.count || 0, usersLastMonth.count || 0),
      tows: calcGrowth(towsThisMonth.count || 0, towsLastMonth.count || 0),
      revenue: 0
    })
  }

  const loadMonthlyData = async () => {
    const months: MonthlyStats[] = []
    const now = new Date()

    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0)
      
      const monthName = monthStart.toLocaleDateString('he-IL', { month: 'short' })

      const [companies, users, tows] = await Promise.all([
        supabase.from('companies').select('*', { count: 'exact', head: true })
          .gte('created_at', monthStart.toISOString())
          .lte('created_at', monthEnd.toISOString()),
        supabase.from('users').select('*', { count: 'exact', head: true })
          .gte('created_at', monthStart.toISOString())
          .lte('created_at', monthEnd.toISOString()),
        supabase.from('tows').select('*', { count: 'exact', head: true })
          .gte('created_at', monthStart.toISOString())
          .lte('created_at', monthEnd.toISOString())
      ])

      months.push({
        month: monthName,
        companies: companies.count || 0,
        users: users.count || 0,
        tows: tows.count || 0,
        revenue: 0
      })
    }

    setMonthlyData(months)
  }

  const loadPlanDistribution = async () => {
    const { data: subscriptions } = await supabase
      .from('company_subscriptions')
      .select(`
        plan_id,
        plan:subscription_plans (name, display_name)
      `)

    const planCounts: Record<string, { name: string, display_name: string, count: number }> = {}
    
    subscriptions?.forEach((sub: any) => {
      const planName = sub.plan?.name || 'unknown'
      const displayName = sub.plan?.display_name || planName
      if (!planCounts[planName]) {
        planCounts[planName] = { name: planName, display_name: displayName, count: 0 }
      }
      planCounts[planName].count++
    })

    const total = Object.values(planCounts).reduce((sum, p) => sum + p.count, 0)
    
    const colors: Record<string, string> = {
      'basic': '#64748b',
      'pro': '#3b82f6',
      'enterprise': '#8b5cf6'
    }

    const distribution: PlanDistribution[] = Object.values(planCounts).map(p => ({
      name: p.name,
      display_name: p.display_name,
      count: p.count,
      percentage: total > 0 ? Math.round((p.count / total) * 100) : 0,
      color: colors[p.name] || '#64748b'
    }))

    setPlanDistribution(distribution)
  }

  const loadTopCompanies = async () => {
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

    const { data: companies } = await supabase
      .from('companies')
      .select('id, name')
      .eq('status', 'active')

    if (!companies) {
      setTopCompanies([])
      return
    }

    const companiesWithTows = await Promise.all(
      companies.map(async (company) => {
        const { count } = await supabase
          .from('tows')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', company.id)
          .gte('created_at', startOfMonth)

        return {
          id: company.id,
          name: company.name,
          tows_count: count || 0,
          revenue: 0
        }
      })
    )

    const sorted = companiesWithTows
      .sort((a, b) => b.tows_count - a.tows_count)
      .slice(0, 5)

    setTopCompanies(sorted)
  }

  const maxTows = Math.max(...monthlyData.map(m => m.tows), 1)

  return (
    <div>
      {/* Header */}
      <header className="bg-slate-800/50 border-b border-slate-700 sticky top-0 z-40 backdrop-blur">
        <div className="px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">דוחות</h2>
            <p className="text-slate-400 text-sm">סטטיסטיקות וניתוח ביצועים</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Date Range */}
            <div className="flex items-center gap-1 bg-slate-700 rounded-xl p-1">
              {[
                { id: 'week', label: 'שבוע' },
                { id: 'month', label: 'חודש' },
                { id: 'quarter', label: 'רבעון' },
                { id: 'year', label: 'שנה' },
              ].map((range) => (
                <button
                  key={range.id}
                  onClick={() => setDateRange(range.id as any)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    dateRange === range.id
                      ? 'bg-violet-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {range.label}
                </button>
              ))}
            </div>

            <button
              onClick={loadReports}
              disabled={loading}
              className="p-2 text-slate-400 hover:text-white bg-slate-700 rounded-xl"
            >
              <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
            </button>

            <button className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl">
              <Download size={18} />
              ייצא
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="p-6 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-5 gap-4">
              {[
                { label: 'חברות', value: totalStats.companies, growth: growthStats.companies, icon: Building2, color: 'violet' },
                { label: 'משתמשים', value: totalStats.users, growth: growthStats.users, icon: Users, color: 'blue' },
                { label: 'נהגים', value: totalStats.drivers, growth: 0, icon: Users, color: 'cyan' },
                { label: 'גרירות', value: totalStats.tows, growth: growthStats.tows, icon: Truck, color: 'amber' },
                { label: 'הכנסות', value: `₪${totalStats.revenue.toLocaleString()}`, growth: growthStats.revenue, icon: DollarSign, color: 'emerald' },
              ].map((stat, idx) => {
                const Icon = stat.icon
                return (
                  <div key={idx} className="bg-slate-800 rounded-xl border border-slate-700 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className={`w-10 h-10 bg-${stat.color}-500/20 rounded-lg flex items-center justify-center`}>
                        <Icon className={`text-${stat.color}-400`} size={20} />
                      </div>
                      {stat.growth !== 0 && (
                        <div className={`flex items-center gap-1 text-sm ${
                          stat.growth > 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}>
                          {stat.growth > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                          {Math.abs(stat.growth)}%
                        </div>
                      )}
                    </div>
                    <p className="text-2xl font-bold text-white">{stat.value}</p>
                    <p className="text-sm text-slate-400">{stat.label}</p>
                  </div>
                )
              })}
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-3 gap-6">
              {/* Tows Chart */}
              <div className="col-span-2 bg-slate-800 rounded-xl border border-slate-700 p-6">
                <h3 className="font-bold text-white mb-6">גרירות לפי חודש</h3>
                <div className="flex items-end justify-between gap-4 h-48">
                  {monthlyData.map((month, idx) => (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                      <div className="w-full bg-slate-700 rounded-t-lg relative" style={{ height: '160px' }}>
                        <div 
                          className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-violet-600 to-violet-400 rounded-t-lg transition-all duration-500"
                          style={{ height: `${(month.tows / maxTows) * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-xs text-slate-400">{month.month}</span>
                      <span className="text-sm font-medium text-white">{month.tows}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Plan Distribution */}
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                <h3 className="font-bold text-white mb-6">התפלגות חבילות</h3>
                
                {/* Pie Chart Placeholder */}
                <div className="flex items-center justify-center mb-6">
                  <div className="relative w-32 h-32">
                    <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                      <circle cx="50" cy="50" r="40" fill="none" stroke="#334155" strokeWidth="20" />
                      {planDistribution.map((plan, idx) => {
                        const offset = planDistribution
                          .slice(0, idx)
                          .reduce((sum, p) => sum + p.percentage, 0)
                        return (
                          <circle
                            key={plan.name}
                            cx="50"
                            cy="50"
                            r="40"
                            fill="none"
                            stroke={plan.color}
                            strokeWidth="20"
                            strokeDasharray={`${plan.percentage * 2.51} 251`}
                            strokeDashoffset={-offset * 2.51}
                          />
                        )
                      })}
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <p className="text-xl font-bold text-white">{totalStats.companies}</p>
                        <p className="text-xs text-slate-400">חברות</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Legend */}
                <div className="space-y-2">
                  {planDistribution.map((plan) => (
                    <div key={plan.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded" style={{ backgroundColor: plan.color }}></span>
                        <span className="text-slate-300">{plan.display_name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium">{plan.count}</span>
                        <span className="text-slate-500 text-sm">({plan.percentage}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Row */}
            <div className="grid grid-cols-2 gap-6">
              {/* Top Companies */}
              <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-700">
                  <h3 className="font-bold text-white">חברות מובילות החודש</h3>
                </div>
                <div className="divide-y divide-slate-700">
                  {topCompanies.map((company, idx) => (
                    <div key={company.id} className="px-5 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          idx === 0 ? 'bg-amber-500 text-amber-900' :
                          idx === 1 ? 'bg-slate-400 text-slate-800' :
                          idx === 2 ? 'bg-amber-700 text-amber-100' :
                          'bg-slate-700 text-slate-400'
                        }`}>
                          {idx + 1}
                        </span>
                        <span className="font-medium text-white">{company.name}</span>
                      </div>
                      <div className="text-left">
                        <span className="text-white font-medium">{company.tows_count}</span>
                        <span className="text-slate-500 text-sm mr-1">גרירות</span>
                      </div>
                    </div>
                  ))}
                  {topCompanies.length === 0 && (
                    <div className="px-5 py-8 text-center text-slate-500">
                      אין נתונים
                    </div>
                  )}
                </div>
              </div>

              {/* Monthly Growth */}
              <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-700">
                  <h3 className="font-bold text-white">צמיחה חודשית</h3>
                </div>
                <div className="p-5 space-y-4">
                  {[
                    { label: 'חברות חדשות', current: monthlyData[5]?.companies || 0, previous: monthlyData[4]?.companies || 0 },
                    { label: 'משתמשים חדשים', current: monthlyData[5]?.users || 0, previous: monthlyData[4]?.users || 0 },
                    { label: 'גרירות', current: monthlyData[5]?.tows || 0, previous: monthlyData[4]?.tows || 0 },
                  ].map((item, idx) => {
                    const growth = item.previous > 0 
                      ? Math.round(((item.current - item.previous) / item.previous) * 100)
                      : item.current > 0 ? 100 : 0
                    
                    return (
                      <div key={idx} className="flex items-center justify-between">
                        <span className="text-slate-400">{item.label}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-white font-medium">{item.current}</span>
                          <span className={`flex items-center gap-1 text-sm ${
                            growth >= 0 ? 'text-emerald-400' : 'text-red-400'
                          }`}>
                            {growth >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                            {Math.abs(growth)}%
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Simple Trend Line */}
                <div className="px-5 pb-5">
                  <div className="h-20 flex items-end gap-1">
                    {monthlyData.map((month, idx) => (
                      <div 
                        key={idx}
                        className="flex-1 bg-violet-500/30 hover:bg-violet-500/50 rounded-t transition-colors"
                        style={{ height: `${Math.max((month.tows / maxTows) * 100, 5)}%` }}
                        title={`${month.month}: ${month.tows} גרירות`}
                      ></div>
                    ))}
                  </div>
                  <div className="flex justify-between mt-2 text-xs text-slate-500">
                    {monthlyData.map((month, idx) => (
                      <span key={idx}>{month.month}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}