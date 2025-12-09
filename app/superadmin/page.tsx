'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabase'
import { 
  getDashboardStats, 
  getRecentCompanies, 
  getTopCompanies,
  type DashboardStats,
  type CompanyWithSubscription
} from '../lib/superadmin'
import {
  Building2,
  Users,
  Truck,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  RefreshCw,
  Loader2
} from 'lucide-react'

interface PlanDistribution {
  name: string
  display_name: string
  count: number
  percent: number
  color: string
}

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentCompanies, setRecentCompanies] = useState<CompanyWithSubscription[]>([])
  const [topCompanies, setTopCompanies] = useState<any[]>([])
  const [planDistribution, setPlanDistribution] = useState<PlanDistribution[]>([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState('month')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [statsData, recent, top] = await Promise.all([
        getDashboardStats(),
        getRecentCompanies(5),
        getTopCompanies(5)
      ])
      setStats(statsData)
      setRecentCompanies(recent)
      setTopCompanies(top)
      
      // Load plan distribution
      await loadPlanDistribution()
    } catch (error) {
      console.error('Error loading dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadPlanDistribution = async () => {
    const { data } = await supabase
      .from('subscription_plans')
      .select(`
        name,
        display_name,
        company_subscriptions (id)
      `)
      .eq('is_active', true)

    if (data) {
      const colors: Record<string, string> = {
        'enterprise': 'bg-violet-500',
        'pro': 'bg-blue-500',
        'basic': 'bg-emerald-500'
      }

      const total = data.reduce((sum, plan) => sum + (plan.company_subscriptions?.length || 0), 0)

      const distribution: PlanDistribution[] = data.map(plan => ({
        name: plan.name,
        display_name: plan.display_name,
        count: plan.company_subscriptions?.length || 0,
        percent: total > 0 ? Math.round(((plan.company_subscriptions?.length || 0) / total) * 100) : 0,
        color: colors[plan.name] || 'bg-slate-500'
      }))

      setPlanDistribution(distribution)
    }
  }

  const getPlanBadge = (planName: string) => {
    switch (planName) {
      case 'enterprise': return 'bg-violet-500/20 text-violet-400 border-violet-500/30'
      case 'pro': return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      case 'basic': return 'bg-slate-600/50 text-slate-400 border-slate-500/30'
      default: return 'bg-slate-600/50 text-slate-400'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-emerald-500'
      case 'trial': return 'bg-amber-500'
      case 'suspended': return 'bg-red-500'
      default: return 'bg-slate-500'
    }
  }

  // Calculate pie chart segments
  const getPieChartSegments = () => {
    let offset = 0
    return planDistribution.map(plan => {
      const segment = {
        ...plan,
        offset: offset,
        dashArray: `${plan.percent * 2.51} 251`
      }
      offset += plan.percent * 2.51
      return segment
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <header className="bg-slate-800/50 border-b border-slate-700 sticky top-0 z-40 backdrop-blur">
        <div className="px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">דאשבורד</h2>
            <p className="text-slate-400 text-sm">סקירה כללית של הפלטפורמה</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Date Range */}
            <div className="flex items-center gap-1 bg-slate-700 rounded-xl p-1">
              {['week', 'month', 'year'].map((range) => (
                <button
                  key={range}
                  onClick={() => setDateRange(range)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    dateRange === range
                      ? 'bg-violet-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {range === 'week' ? 'שבוע' : range === 'month' ? 'חודש' : 'שנה'}
                </button>
              ))}
            </div>

            {/* Refresh */}
            <button
              onClick={loadData}
              className="p-2 text-slate-400 hover:text-white bg-slate-700 rounded-xl"
            >
              <RefreshCw size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-6">
          {/* Companies */}
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-violet-500/20 rounded-xl flex items-center justify-center">
                <Building2 className="text-violet-400" size={24} />
              </div>
              {stats && stats.companies.new_this_month > 0 && (
                <span className="flex items-center gap-1 text-emerald-400 text-sm">
                  <TrendingUp size={16} />
                  +{stats.companies.new_this_month}
                </span>
              )}
            </div>
            <p className="text-3xl font-bold text-white">{stats?.companies.total || 0}</p>
            <p className="text-slate-400 text-sm mt-1">חברות</p>
            <div className="flex items-center gap-4 mt-4 text-xs">
              <span className="text-emerald-400">{stats?.companies.active} פעילות</span>
              <span className="text-amber-400">{stats?.companies.trial} בניסיון</span>
              <span className="text-red-400">{stats?.companies.suspended} מושעות</span>
            </div>
          </div>

          {/* Users */}
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                <Users className="text-blue-400" size={24} />
              </div>
            </div>
            <p className="text-3xl font-bold text-white">{stats?.users.total || 0}</p>
            <p className="text-slate-400 text-sm mt-1">משתמשים</p>
            <div className="flex items-center gap-4 mt-4 text-xs">
              <span className="text-emerald-400">{stats?.users.active} פעילים</span>
            </div>
          </div>

          {/* Tows */}
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center">
                <Truck className="text-amber-400" size={24} />
              </div>
              {stats && stats.tows.this_month > stats.tows.last_month && (
                <span className="flex items-center gap-1 text-emerald-400 text-sm">
                  <TrendingUp size={16} />
                  {stats.tows.last_month > 0 
                    ? Math.round(((stats.tows.this_month - stats.tows.last_month) / stats.tows.last_month) * 100)
                    : 100}%
                </span>
              )}
            </div>
            <p className="text-3xl font-bold text-white">{stats?.tows.this_month || 0}</p>
            <p className="text-slate-400 text-sm mt-1">גרירות החודש</p>
            <div className="flex items-center gap-4 mt-4 text-xs">
              <span className="text-slate-400">סה"כ: {stats?.tows.total?.toLocaleString()}</span>
            </div>
          </div>

          {/* Revenue */}
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                <span className="text-emerald-400 text-xl">₪</span>
              </div>
              {stats && stats.revenue.growth_percent !== 0 && (
                <span className={`flex items-center gap-1 text-sm ${
                  stats.revenue.growth_percent > 0 ? 'text-emerald-400' : 'text-red-400'
                }`}>
                  {stats.revenue.growth_percent > 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                  {stats.revenue.growth_percent}%
                </span>
              )}
            </div>
            <p className="text-3xl font-bold text-white">
              ₪{(stats?.revenue.this_month || 0).toLocaleString()}
            </p>
            <p className="text-slate-400 text-sm mt-1">הכנסות החודש</p>
            <div className="flex items-center gap-4 mt-4 text-xs">
              <span className="text-slate-400">חודש קודם: ₪{(stats?.revenue.last_month || 0).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Charts & Lists Row */}
        <div className="grid grid-cols-3 gap-6">
          {/* Plans Distribution */}
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
            <h3 className="font-bold text-white mb-4">התפלגות חבילות</h3>
            <div className="flex items-center justify-center mb-6">
              <div className="relative w-40 h-40">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#334155" strokeWidth="20" />
                  {getPieChartSegments().map((segment, idx) => (
                    <circle
                      key={segment.name}
                      cx="50"
                      cy="50"
                      r="40"
                      fill="none"
                      stroke={segment.name === 'enterprise' ? '#8b5cf6' : segment.name === 'pro' ? '#3b82f6' : '#10b981'}
                      strokeWidth="20"
                      strokeDasharray={segment.dashArray}
                      strokeDashoffset={-segment.offset}
                    />
                  ))}
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-white">{stats?.companies.total || 0}</p>
                    <p className="text-xs text-slate-400">חברות</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              {planDistribution.map((plan) => (
                <div key={plan.name} className="flex items-center gap-3">
                  <span className={`w-3 h-3 ${plan.color} rounded`}></span>
                  <span className="flex-1 text-slate-300">{plan.display_name}</span>
                  <span className="text-white font-medium">{plan.count}</span>
                  <span className="text-slate-500 text-sm">{plan.percent}%</span>
                </div>
              ))}
              {planDistribution.length === 0 && (
                <p className="text-slate-500 text-center">אין נתונים</p>
              )}
            </div>
          </div>

          {/* Recent Companies */}
          <div className="col-span-2 bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between">
              <h3 className="font-bold text-white">חברות אחרונות</h3>
              <Link href="/superadmin/companies" className="text-sm text-violet-400 hover:text-violet-300 flex items-center gap-1">
                צפה בכל
                <ArrowUpRight size={14} />
              </Link>
            </div>
            <div className="divide-y divide-slate-700">
              {recentCompanies.map((company) => (
                <Link
                  key={company.id}
                  href={`/superadmin/companies/${company.id}`}
                  className="px-5 py-3 flex items-center justify-between hover:bg-slate-700/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-700 rounded-xl flex items-center justify-center">
                      <span className="text-sm font-bold text-slate-300">
                        {company.name.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-white">{company.name}</p>
                      <p className="text-xs text-slate-500">
                        {new Date(company.created_at).toLocaleDateString('he-IL')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {company.subscription?.plan && (
                      <span className={`px-2 py-1 text-xs font-medium rounded-lg border ${getPlanBadge(company.subscription.plan.name)}`}>
                        {company.subscription.plan.display_name}
                      </span>
                    )}
                    <span className={`w-2 h-2 rounded-full ${getStatusColor(company.status)}`}></span>
                  </div>
                </Link>
              ))}
              {recentCompanies.length === 0 && (
                <div className="px-5 py-8 text-center text-slate-500">
                  אין חברות עדיין
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Row */}
        <div>
          {/* Top Companies */}
          <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between">
              <h3 className="font-bold text-white">חברות מובילות החודש</h3>
              <Link href="/superadmin/companies" className="text-sm text-violet-400 hover:text-violet-300">
                צפה בכל
              </Link>
            </div>
            <div className="divide-y divide-slate-700">
              {topCompanies.map((company, idx) => (
                <div key={company.id} className="px-5 py-3 flex items-center justify-between hover:bg-slate-700/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      idx === 0 ? 'bg-amber-500 text-amber-900' :
                      idx === 1 ? 'bg-slate-400 text-slate-800' :
                      idx === 2 ? 'bg-amber-700 text-amber-100' :
                      'bg-slate-700 text-slate-400'
                    }`}>
                      {idx + 1}
                    </span>
                    <p className="font-medium text-white">{company.name}</p>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-white">{company.tows_this_month}</p>
                    <p className="text-xs text-slate-500">גרירות</p>
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
        </div>
      </div>
    </div>
  )
}