'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'
import {
  CreditCard,
  Search,
  Download,
  Loader2,
  RefreshCw,
  Building2,
  Calendar,
  CheckCircle,
  Clock,
  XCircle,
  Filter,
  FileText
} from 'lucide-react'

interface BillingRecord {
  id: string
  company_id: string
  invoice_number: string
  amount: number
  vat_amount: number
  total_amount: number
  status: 'pending' | 'paid' | 'failed' | 'refunded'
  billing_period_start: string | null
  billing_period_end: string | null
  paid_at: string | null
  created_at: string
  company: {
    id: string
    name: string
  } | null
}

export default function SuperAdminBillingPage() {
  const [records, setRecords] = useState<BillingRecord[]>([])
  const [loading, setLoading] = useState(true)
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'quarter' | 'all'>('month')

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    paid: 0,
    pending: 0,
    failed: 0,
    totalRevenue: 0,
    pendingRevenue: 0
  })

  useEffect(() => {
    loadBilling()
  }, [statusFilter, dateRange])

  useEffect(() => {
    const timer = setTimeout(() => {
      loadBilling()
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const loadBilling = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('billing_history')
        .select(`
          *,
          company:companies (id, name)
        `)
        .order('created_at', { ascending: false })

      // Status filter
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      // Date range filter
      if (dateRange !== 'all') {
        const now = new Date()
        let startDate: Date
        
        switch (dateRange) {
          case 'week':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
            break
          case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1)
            break
          case 'quarter':
            startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1)
            break
          default:
            startDate = new Date(0)
        }
        
        query = query.gte('created_at', startDate.toISOString())
      }

      const { data, error } = await query

      if (error) {
        console.error('Error loading billing:', error)
        setRecords([])
      } else {
        // Filter by search query
        let filtered = data || []
        if (searchQuery) {
          filtered = filtered.filter(r => 
            r.invoice_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            r.company?.name?.toLowerCase().includes(searchQuery.toLowerCase())
          )
        }
        setRecords(filtered)

        // Calculate stats
        const allRecords = data || []
        setStats({
          total: allRecords.length,
          paid: allRecords.filter(r => r.status === 'paid').length,
          pending: allRecords.filter(r => r.status === 'pending').length,
          failed: allRecords.filter(r => r.status === 'failed').length,
          totalRevenue: allRecords
            .filter(r => r.status === 'paid')
            .reduce((sum, r) => sum + (r.total_amount || 0), 0),
          pendingRevenue: allRecords
            .filter(r => r.status === 'pending')
            .reduce((sum, r) => sum + (r.total_amount || 0), 0)
        })
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid': return { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'שולם', icon: CheckCircle }
      case 'pending': return { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'ממתין', icon: Clock }
      case 'failed': return { bg: 'bg-red-500/20', text: 'text-red-400', label: 'נכשל', icon: XCircle }
      case 'refunded': return { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'הוחזר', icon: CreditCard }
      default: return { bg: 'bg-slate-600/50', text: 'text-slate-400', label: status, icon: CreditCard }
    }
  }

  return (
    <div>
      {/* Header */}
      <header className="bg-slate-800/50 border-b border-slate-700 sticky top-0 z-40 backdrop-blur">
        <div className="px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">חיובים</h2>
            <p className="text-slate-400 text-sm">היסטוריית חיובים מכל החברות</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadBilling}
              disabled={loading}
              className="p-2 text-slate-400 hover:text-white bg-slate-700 rounded-xl"
            >
              <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl">
              <Download size={18} />
              ייצא CSV
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-6 gap-4">
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <p className="text-slate-400 text-sm">סה"כ חשבוניות</p>
            <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
          </div>
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <p className="text-slate-400 text-sm">שולמו</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">{stats.paid}</p>
          </div>
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <p className="text-slate-400 text-sm">ממתינות</p>
            <p className="text-2xl font-bold text-amber-400 mt-1">{stats.pending}</p>
          </div>
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <p className="text-slate-400 text-sm">נכשלו</p>
            <p className="text-2xl font-bold text-red-400 mt-1">{stats.failed}</p>
          </div>
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <p className="text-slate-400 text-sm">הכנסות</p>
            <p className="text-2xl font-bold text-white mt-1">₪{stats.totalRevenue.toLocaleString()}</p>
          </div>
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <p className="text-slate-400 text-sm">ממתין לגבייה</p>
            <p className="text-2xl font-bold text-amber-400 mt-1">₪{stats.pendingRevenue.toLocaleString()}</p>
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
                placeholder="חיפוש לפי מספר חשבונית או שם חברה..."
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
                  { id: 'paid', label: 'שולם' },
                  { id: 'pending', label: 'ממתין' },
                  { id: 'failed', label: 'נכשל' },
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

            {/* Date Range */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400">תקופה:</span>
              <div className="flex gap-1 bg-slate-700 rounded-lg p-1">
                {[
                  { id: 'week', label: 'שבוע' },
                  { id: 'month', label: 'חודש' },
                  { id: 'quarter', label: 'רבעון' },
                  { id: 'all', label: 'הכל' },
                ].map((filter) => (
                  <button
                    key={filter.id}
                    onClick={() => setDateRange(filter.id as any)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      dateRange === filter.id
                        ? 'bg-violet-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Billing Table */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 px-5 py-3 bg-slate-700/50 text-sm font-medium text-slate-400 border-b border-slate-700">
            <div className="col-span-2">מספר חשבונית</div>
            <div className="col-span-3">חברה</div>
            <div className="col-span-2">תקופה</div>
            <div className="col-span-1">סכום</div>
            <div className="col-span-1">סטטוס</div>
            <div className="col-span-2">תאריך</div>
            <div className="col-span-1">פעולות</div>
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
              {records.map((record) => {
                const status = getStatusBadge(record.status)
                const StatusIcon = status.icon
                
                return (
                  <div
                    key={record.id}
                    className="grid grid-cols-12 gap-4 px-5 py-4 items-center hover:bg-slate-700/30 transition-colors"
                  >
                    {/* Invoice Number */}
                    <div className="col-span-2">
                      <span className="font-mono text-white">{record.invoice_number}</span>
                    </div>

                    {/* Company */}
                    <div className="col-span-3">
                      {record.company ? (
                        <Link 
                          href={`/superadmin/companies/${record.company.id}`}
                          className="flex items-center gap-2 text-slate-300 hover:text-violet-400"
                        >
                          <Building2 size={14} className="text-slate-500" />
                          <span className="truncate">{record.company.name}</span>
                        </Link>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </div>

                    {/* Billing Period */}
                    <div className="col-span-2 text-sm text-slate-400">
                      {record.billing_period_start && record.billing_period_end ? (
                        <>
                          {new Date(record.billing_period_start).toLocaleDateString('he-IL')}
                          {' - '}
                          {new Date(record.billing_period_end).toLocaleDateString('he-IL')}
                        </>
                      ) : (
                        '-'
                      )}
                    </div>

                    {/* Amount */}
                    <div className="col-span-1">
                      <span className="text-white font-medium">₪{record.total_amount?.toLocaleString()}</span>
                    </div>

                    {/* Status */}
                    <div className="col-span-1">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg ${status.bg} ${status.text}`}>
                        <StatusIcon size={12} />
                        {status.label}
                      </span>
                    </div>

                    {/* Date */}
                    <div className="col-span-2 text-sm text-slate-400">
                      <div>{new Date(record.created_at).toLocaleDateString('he-IL')}</div>
                      {record.paid_at && (
                        <div className="text-xs text-emerald-400">
                          שולם: {new Date(record.paid_at).toLocaleDateString('he-IL')}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="col-span-1">
                      <button
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                        title="הורד חשבונית"
                      >
                        <FileText size={18} />
                      </button>
                    </div>
                  </div>
                )
              })}

              {records.length === 0 && !loading && (
                <div className="px-5 py-12 text-center">
                  <CreditCard className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400">אין חיובים</p>
                </div>
              )}
            </div>
          )}

          {/* Pagination */}
          {records.length > 0 && (
            <div className="px-5 py-4 border-t border-slate-700 flex items-center justify-between">
              <p className="text-sm text-slate-400">
                מציג {records.length} חיובים
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