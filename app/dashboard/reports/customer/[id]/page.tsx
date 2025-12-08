'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useAuth } from '../../../../lib/AuthContext'
import Link from 'next/link'
import { 
  ArrowRight, 
  Truck, 
  DollarSign, 
  Receipt,
  AlertCircle,
  Phone,
  Mail,
  Calendar,
  Building2,
  User,
  MapPin,
  RefreshCw,
  CheckCircle2,
  Clock
} from 'lucide-react'
import {
  getCustomerReport,
  getCustomerTowsOverTime,
  getCustomerTows,
  getDateRange,
  CustomerReport,
  PeriodData,
  TowListItem,
  ReportFilters
} from '../../../../lib/queries/reports'

type PeriodType = 'week' | 'month' | 'quarter' | 'year'

const statusLabels: Record<string, string> = {
  pending: 'ממתין',
  assigned: 'שובץ',
  in_progress: 'בביצוע',
  completed: 'הושלם',
  cancelled: 'בוטל'
}

const statusColors: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  assigned: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-cyan-100 text-cyan-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700'
}

export default function CustomerReportPage() {
  const params = useParams()
  const customerId = params.id as string
  const { companyId } = useAuth()


  // State
  const [period, setPeriod] = useState<PeriodType>('month')
  const [loading, setLoading] = useState(true)
  const [report, setReport] = useState<CustomerReport | null>(null)
  const [chartData, setChartData] = useState<PeriodData[]>([])
  const [tows, setTows] = useState<TowListItem[]>([])
  const [filters, setFilters] = useState<ReportFilters>(getDateRange('month'))

  // Update filters when period changes
  useEffect(() => {
    setFilters(getDateRange(period))
  }, [period])

  // Load data
  useEffect(() => {
    if (companyId && customerId) {
      loadData()
    }
  }, [companyId, customerId, filters])

  async function loadData() {
    if (!companyId || !customerId) return
    setLoading(true)

    try {
      const [reportData, chartData, towsData] = await Promise.all([
        getCustomerReport(companyId, customerId, filters),
        getCustomerTowsOverTime(companyId, customerId, filters),
        getCustomerTows(companyId, customerId, filters)
      ])

      setReport(reportData)
      setChartData(chartData)
      setTows(towsData)
    } catch (error) {
      console.error('Error loading customer report:', error)
    } finally {
      setLoading(false)
    }
  }

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  // Format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('he-IL', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    })
  }

  // Get max value for chart
  const getMaxValue = (data: PeriodData[], key: 'tows' | 'revenue') => {
    if (data.length === 0) return 1
    return Math.max(...data.map(d => d[key])) || 1
  }

  // Period labels
  const periodLabels: Record<PeriodType, string> = {
    week: 'שבוע',
    month: 'חודש',
    quarter: 'רבעון',
    year: 'שנה'
  }

  if (loading && !report) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-48"></div>
          <div className="h-32 bg-gray-200 rounded-xl"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-gray-500">לקוח לא נמצא</p>
          <Link href="/dashboard/reports" className="text-cyan-600 hover:underline mt-2 inline-block">
            חזור לדוחות
          </Link>
        </div>
      </div>
    )
  }

  const isBusiness = report.customer_type === 'business'

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link 
          href="/dashboard/reports" 
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowRight className="w-5 h-5 text-gray-600" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-800">דוח לקוח</h1>
          <p className="text-gray-500">{report.customer_name}</p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          רענן
        </button>
      </div>

      {/* Customer Info Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          {/* Avatar */}
          <div className={`w-20 h-20 rounded-full flex items-center justify-center ${
            isBusiness ? 'bg-purple-100' : 'bg-cyan-100'
          }`}>
            {isBusiness ? (
              <Building2 className="w-10 h-10 text-purple-600" />
            ) : (
              <User className="w-10 h-10 text-cyan-600" />
            )}
          </div>

          {/* Info */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500">שם</p>
              <p className="font-semibold text-gray-800">{report.customer_name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">סוג</p>
              <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                isBusiness ? 'bg-purple-100 text-purple-700' : 'bg-cyan-100 text-cyan-700'
              }`}>
                {isBusiness ? 'עסקי' : 'פרטי'}
              </span>
            </div>
            <div>
              <p className="text-sm text-gray-500">טלפון</p>
              <p className="font-semibold text-gray-800 flex items-center gap-1">
                <Phone className="w-4 h-4 text-gray-400" />
                {report.phone || '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">אימייל</p>
              <p className="font-semibold text-gray-800 flex items-center gap-1 truncate">
                <Mail className="w-4 h-4 text-gray-400" />
                {report.email || '-'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Period Selector */}
      <div className="flex justify-center">
        <div className="flex bg-gray-100 rounded-lg p-1">
          {(['week', 'month', 'quarter', 'year'] as PeriodType[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                period === p
                  ? 'bg-cyan-500 text-white'
                  : 'text-gray-600 hover:bg-gray-200'
              }`}
            >
              {periodLabels[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-cyan-100 rounded-lg flex items-center justify-center">
              <Truck className="w-5 h-5 text-cyan-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">סה"כ גרירות</p>
              <p className="text-2xl font-bold text-gray-800">{report.total_tows}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">סה"כ חיובים</p>
              <p className="text-2xl font-bold text-gray-800">{formatCurrency(report.total_revenue)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">שולם</p>
              <p className="text-2xl font-bold text-emerald-600">{formatCurrency(report.paid_amount)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              report.debt > 0 ? 'bg-rose-100' : 'bg-gray-100'
            }`}>
              {report.debt > 0 ? (
                <AlertCircle className="w-5 h-5 text-rose-600" />
              ) : (
                <Clock className="w-5 h-5 text-gray-500" />
              )}
            </div>
            <div>
              <p className="text-sm text-gray-500">חוב פתוח</p>
              <p className={`text-2xl font-bold ${report.debt > 0 ? 'text-rose-600' : 'text-gray-800'}`}>
                {formatCurrency(report.debt)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Debt Alert */}
      {report.debt > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-rose-600 flex-shrink-0" />
          <div>
            <p className="font-medium text-rose-800">יש חוב פתוח</p>
            <p className="text-sm text-rose-600">
              ללקוח זה יש {formatCurrency(report.debt)} חוב פתוח. יש לטפל בגביית החוב.
            </p>
          </div>
          <Link
            href={`/dashboard/invoices?customer=${customerId}&status=sent`}
            className="mr-auto px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors text-sm"
          >
            צפה בחשבוניות
          </Link>
        </div>
      )}

      {/* Chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-800 mb-4">פעילות לאורך זמן</h3>
        <div className="h-48 flex items-end gap-1">
          {chartData.length > 0 ? (
            chartData.slice(-14).map((item, index) => (
              <div key={index} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className={`w-full rounded-t transition-all hover:opacity-80 ${
                    isBusiness ? 'bg-purple-500' : 'bg-cyan-500'
                  }`}
                  style={{
                    height: `${(item.tows / getMaxValue(chartData, 'tows')) * 150}px`,
                    minHeight: item.tows > 0 ? '8px' : '0'
                  }}
                  title={`${item.tows} גרירות`}
                />
                <span className="text-[10px] text-gray-400">{item.label}</span>
              </div>
            ))
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              אין נתונים להצגה
            </div>
          )}
        </div>
      </div>

      {/* Financial Summary */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-800 mb-4">סיכום כספי</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-gray-600">סה"כ גרירות בתקופה</span>
            <span className="font-semibold">{formatCurrency(report.total_revenue)}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-gray-600">סה"כ חשבוניות</span>
            <span className="font-semibold">{formatCurrency(report.total_invoiced)}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-gray-600 flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              שולם
            </span>
            <span className="font-semibold text-emerald-600">{formatCurrency(report.paid_amount)}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-gray-600 flex items-center gap-1">
              <Clock className="w-4 h-4 text-amber-500" />
              ממתין לתשלום
            </span>
            <span className={`font-semibold ${report.pending_amount > 0 ? 'text-amber-600' : ''}`}>
              {formatCurrency(report.pending_amount)}
            </span>
          </div>
        </div>
      </div>

      {/* Tows List */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-5 border-b border-gray-200">
          <h3 className="font-semibold text-gray-800">רשימת גרירות ({tows.length})</h3>
        </div>

        {tows.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {tows.map((tow) => (
              <Link
                key={tow.id}
                href={`/dashboard/tows/${tow.id}`}
                className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-800">{tow.vehicle_plate || 'לא צוין'}</p>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[tow.status]}`}>
                      {statusLabels[tow.status]}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 truncate flex items-center gap-1 mt-1">
                    <MapPin className="w-3 h-3" />
                    {tow.from_address || 'לא צוין'} → {tow.to_address || 'לא צוין'}
                  </p>
                  {tow.driver_name && (
                    <p className="text-xs text-gray-400 mt-1">נהג: {tow.driver_name}</p>
                  )}
                </div>
                <div className="text-left">
                  <p className="font-semibold text-gray-800">
                    {tow.final_price ? formatCurrency(tow.final_price) : '-'}
                  </p>
                  <p className="text-xs text-gray-400">{formatDate(tow.created_at)}</p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-gray-400">
            אין גרירות בתקופה הנבחרת
          </div>
        )}
      </div>
    </div>
  )
}