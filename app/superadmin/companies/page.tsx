'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { 
  getCompanies,
  getSubscriptionPlans,
  type CompanyWithSubscription,
  type SubscriptionPlan
} from '../../lib/superadmin'
import {
  Search,
  Plus,
  Eye,
  Pencil,
  MoreVertical,
  Building2,
  Users,
  Truck as TruckIcon,
  Loader2,
  RefreshCw
} from 'lucide-react'

export default function SuperAdminCompaniesPage() {
  const [companies, setCompanies] = useState<CompanyWithSubscription[]>([])
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [loading, setLoading] = useState(true)
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('all')
  const [planFilter, setPlanFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadData()
  }, [statusFilter, planFilter])

  useEffect(() => {
    // Debounce search
    const timer = setTimeout(() => {
      loadData()
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const loadData = async () => {
    setLoading(true)
    try {
      const [companiesData, plansData] = await Promise.all([
        getCompanies({
          status: statusFilter,
          plan: planFilter,
          search: searchQuery
        }),
        getSubscriptionPlans()
      ])
      setCompanies(companiesData)
      setPlans(plansData)
    } catch (error) {
      console.error('Error loading companies:', error)
    } finally {
      setLoading(false)
    }
  }

  const stats = {
    total: companies.length,
    active: companies.filter(c => c.status === 'active').length,
    trial: companies.filter(c => c.status === 'trial').length,
    suspended: companies.filter(c => c.status === 'suspended').length
  }

  const getPlanBadge = (planName?: string) => {
    switch (planName) {
      case 'enterprise': return 'bg-violet-500/20 text-violet-400 border-violet-500/30'
      case 'pro': return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      case 'basic': return 'bg-slate-600/50 text-slate-400 border-slate-500/30'
      default: return 'bg-slate-600/50 text-slate-400'
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return 'bg-emerald-500/20 text-emerald-400'
      case 'trial': return 'bg-amber-500/20 text-amber-400'
      case 'suspended': return 'bg-red-500/20 text-red-400'
      case 'cancelled': return 'bg-slate-600/50 text-slate-400'
      default: return 'bg-slate-600/50 text-slate-400'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'פעיל'
      case 'trial': return 'ניסיון'
      case 'suspended': return 'מושעה'
      case 'cancelled': return 'מבוטל'
      default: return status
    }
  }

  return (
    <div>
      {/* Header */}
      <header className="bg-slate-800/50 border-b border-slate-700 sticky top-0 z-40 backdrop-blur">
        <div className="px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">חברות</h2>
            <p className="text-slate-400 text-sm">ניהול כל החברות בפלטפורמה</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadData}
              className="p-2 text-slate-400 hover:text-white bg-slate-700 rounded-xl"
            >
              <RefreshCw size={20} />
            </button>
            <Link
              href="/superadmin/companies/new"
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl font-medium hover:bg-violet-700 transition-colors"
            >
              <Plus size={20} />
              הוסף חברה
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <p className="text-slate-400 text-sm">סה"כ</p>
            <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
          </div>
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <p className="text-slate-400 text-sm">פעילות</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">{stats.active}</p>
          </div>
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <p className="text-slate-400 text-sm">בניסיון</p>
            <p className="text-2xl font-bold text-amber-400 mt-1">{stats.trial}</p>
          </div>
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <p className="text-slate-400 text-sm">מושעות</p>
            <p className="text-2xl font-bold text-red-400 mt-1">{stats.suspended}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Search */}
            <div className="relative flex-1 min-w-64">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="text"
                placeholder="חיפוש לפי שם, אימייל או טלפון..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-10 pl-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400">סטטוס:</span>
              <div className="flex gap-1 bg-slate-700 rounded-lg p-1">
                {[
                  { id: 'all', label: 'הכל' },
                  { id: 'active', label: 'פעיל' },
                  { id: 'trial', label: 'ניסיון' },
                  { id: 'suspended', label: 'מושעה' },
                ].map((filter) => (
                  <button
                    key={filter.id}
                    onClick={() => setStatusFilter(filter.id)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      statusFilter === filter.id
                        ? 'bg-violet-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Plan Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400">חבילה:</span>
              <select
                value={planFilter}
                onChange={(e) => setPlanFilter(e.target.value)}
                className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="all">הכל</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.name}>
                    {plan.display_name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Companies Table */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 px-5 py-3 bg-slate-700/50 text-sm font-medium text-slate-400 border-b border-slate-700">
            <div className="col-span-3">חברה</div>
            <div className="col-span-1">חבילה</div>
            <div className="col-span-1">סטטוס</div>
            <div className="col-span-2">משתמשים / נהגים</div>
            <div className="col-span-1">גרירות</div>
            <div className="col-span-2">פעילות אחרונה</div>
            <div className="col-span-2">פעולות</div>
          </div>

          {/* Loading */}
          {loading && (
            <div className="px-5 py-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-violet-500 mx-auto" />
            </div>
          )}

          {/* Table Body */}
          {!loading && (
            <div className="divide-y divide-slate-700">
              {companies.map((company) => (
                <div
                  key={company.id}
                  className={`grid grid-cols-12 gap-4 px-5 py-4 items-center hover:bg-slate-700/30 transition-colors ${
                    company.status === 'suspended' ? 'opacity-60' : ''
                  }`}
                >
                  {/* Company Info */}
                  <div className="col-span-3 flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-700 rounded-xl flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-slate-300">
                        {company.name.charAt(0)}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-white truncate">{company.name}</p>
                      <p className="text-xs text-slate-500 truncate">{company.email}</p>
                    </div>
                  </div>

                  {/* Plan */}
                  <div className="col-span-1">
                    {company.subscription?.plan ? (
                      <span className={`px-2 py-1 text-xs font-medium rounded-lg border ${getPlanBadge(company.subscription.plan.name)}`}>
                        {company.subscription.plan.display_name}
                      </span>
                    ) : (
                      <span className="text-slate-500 text-sm">-</span>
                    )}
                  </div>

                  {/* Status */}
                  <div className="col-span-1">
                    <span className={`px-2 py-1 text-xs font-medium rounded-lg ${getStatusBadge(company.status)}`}>
                      {getStatusText(company.status)}
                    </span>
                  </div>

                  {/* Users / Drivers */}
                  <div className="col-span-2">
                    <div className="flex items-center gap-4 text-sm">
                      <span className="flex items-center gap-1 text-slate-300">
                        <Users size={14} className="text-slate-500" />
                        <span className="text-white font-medium">{company.stats.users_count}</span>
                      </span>
                      <span className="flex items-center gap-1 text-slate-300">
                        <TruckIcon size={14} className="text-slate-500" />
                        <span className="text-white font-medium">{company.stats.drivers_count}</span>
                      </span>
                    </div>
                  </div>

                  {/* Tows */}
                  <div className="col-span-1">
                    <span className="text-white font-medium">{company.stats.tows_this_month}</span>
                    <span className="text-slate-500 text-xs mr-1">/חודש</span>
                  </div>

                  {/* Last Active / Trial Info */}
                  <div className="col-span-2">
                    <p className="text-sm text-slate-300">
                      {new Date(company.created_at).toLocaleDateString('he-IL')}
                    </p>
                    {company.status === 'trial' && company.subscription?.trial_ends_at && (
                      <p className="text-xs text-amber-400">
                        ניסיון עד: {new Date(company.subscription.trial_ends_at).toLocaleDateString('he-IL')}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="col-span-2 flex items-center gap-1">
                    <Link
                      href={`/superadmin/companies/${company.id}`}
                      className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                      title="צפה"
                    >
                      <Eye size={18} />
                    </Link>
                    <Link
                      href={`/superadmin/companies/${company.id}/edit`}
                      className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                      title="ערוך"
                    >
                      <Pencil size={18} />
                    </Link>
                    <button
                      className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                      title="עוד"
                    >
                      <MoreVertical size={18} />
                    </button>
                  </div>
                </div>
              ))}

              {companies.length === 0 && !loading && (
                <div className="px-5 py-12 text-center">
                  <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400">לא נמצאו חברות</p>
                  <Link
                    href="/superadmin/companies/new"
                    className="inline-flex items-center gap-2 mt-4 text-violet-400 hover:text-violet-300"
                  >
                    <Plus size={18} />
                    הוסף חברה חדשה
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Pagination */}
          {companies.length > 0 && (
            <div className="px-5 py-4 border-t border-slate-700 flex items-center justify-between">
              <p className="text-sm text-slate-400">
                מציג {companies.length} חברות
              </p>
              <div className="flex items-center gap-2">
                <button className="px-3 py-1.5 text-sm text-slate-500 rounded-lg" disabled>
                  הקודם
                </button>
                <button className="px-3 py-1.5 text-sm bg-violet-600 text-white rounded-lg">1</button>
                <button className="px-3 py-1.5 text-sm text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg">
                  הבא
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}