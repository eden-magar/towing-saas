'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../../lib/AuthContext'
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown,
  Users, 
  Truck, 
  DollarSign,
  FileText,
  Calendar,
  Download,
  RefreshCw,
  ChevronLeft,
  Building2,
  User,
  Star
} from 'lucide-react'
import Link from 'next/link'
import {
  getReportsSummary,
  getTowsOverTime,
  getVehicleTypeBreakdown,
  getTowReasonBreakdown,
  getCustomerTypeBreakdown,
  getTopDrivers,
  getTopCustomers,
  getDateRange,
  ReportsSummary,
  PeriodData,
  VehicleTypeBreakdown,
  TowReasonBreakdown,
  CustomerTypeData,
  TopDriver,
  TopCustomer,
  ReportFilters
} from '../../lib/queries/reports'

type PeriodType = 'week' | 'month' | 'quarter' | 'year'

export default function ReportsPage() {
  const { companyId } = useAuth()

  // State
  const [period, setPeriod] = useState<PeriodType>('month')
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<ReportsSummary | null>(null)
  const [towsOverTime, setTowsOverTime] = useState<PeriodData[]>([])
  const [vehicleTypes, setVehicleTypes] = useState<VehicleTypeBreakdown[]>([])
  const [towReasons, setTowReasons] = useState<TowReasonBreakdown[]>([])
  const [customerTypes, setCustomerTypes] = useState<CustomerTypeData | null>(null)
  const [topDrivers, setTopDrivers] = useState<TopDriver[]>([])
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([])
  const [filters, setFilters] = useState<ReportFilters>(getDateRange('month'))

  // Load data
  useEffect(() => {
    if (companyId) {
      loadData()
    }
  }, [companyId, filters])

  // Update filters when period changes
  useEffect(() => {
    setFilters(getDateRange(period))
  }, [period])

  async function loadData() {
    if (!companyId) return
    setLoading(true)

    try {
      const [
        summaryData,
        towsData,
        vehicleData,
        reasonData,
        customerTypeData,
        driversData,
        customersData
      ] = await Promise.all([
        getReportsSummary(companyId, filters),
        getTowsOverTime(companyId, filters, period === 'year' ? 'month' : 'day'),
        getVehicleTypeBreakdown(companyId, filters),
        getTowReasonBreakdown(companyId, filters),
        getCustomerTypeBreakdown(companyId, filters),
        getTopDrivers(companyId, filters, 5),
        getTopCustomers(companyId, filters, 5)
      ])

      setSummary(summaryData)
      setTowsOverTime(towsData)
      setVehicleTypes(vehicleData)
      setTowReasons(reasonData)
      setCustomerTypes(customerTypeData)
      setTopDrivers(driversData)
      setTopCustomers(customersData)
    } catch (error) {
      console.error('Error loading reports:', error)
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

  // Format date range
  const formatDateRange = () => {
    const start = new Date(filters.startDate)
    const end = new Date(filters.endDate)
    return `${start.toLocaleDateString('he-IL')} - ${end.toLocaleDateString('he-IL')}`
  }

  // Get max value for chart scaling
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

  // Vehicle type colors
  const vehicleColors: Record<string, string> = {
    'רכב פרטי': 'bg-cyan-500',
    'ג\'יפ / SUV': 'bg-amber-500',
    'מסחרי': 'bg-purple-500',
    'אופנוע': 'bg-emerald-500',
    'משאית': 'bg-rose-500',
    'לא ידוע': 'bg-gray-400'
  }

  // Tow reason colors
  const reasonColors: Record<string, string> = {
    'תקר': 'bg-cyan-500',
    'מנוע': 'bg-rose-500',
    'סוללה': 'bg-amber-500',
    'תאונה': 'bg-purple-500',
    'נעילה': 'bg-emerald-500'
  }

  if (loading && !summary) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-48"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="h-64 bg-gray-200 rounded-xl"></div>
            <div className="h-64 bg-gray-200 rounded-xl"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">דוחות</h1>
          <p className="text-gray-500">ניתוח ביצועים ונתונים</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Period Selector */}
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

          {/* Date Range Display */}
          <div className="hidden md:flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg text-sm text-gray-600">
            <Calendar className="w-4 h-4" />
            {formatDateRange()}
          </div>

          {/* Export Button */}
          <button className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <Download className="w-4 h-4" />
            <span className="hidden md:inline">ייצא לאקסל</span>
          </button>

          {/* Refresh Button */}
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden md:inline">רענן</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Tows */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">סה"כ גרירות</p>
              <p className="text-3xl font-bold text-gray-800 mt-1">{summary?.totalTows || 0}</p>
              <p className="text-xs text-gray-400 mt-1">
                {summary?.completedTows || 0} הושלמו • {summary?.cancelledTows || 0} בוטלו
              </p>
            </div>
            <div className="w-12 h-12 bg-cyan-100 rounded-xl flex items-center justify-center">
              <Truck className="w-6 h-6 text-cyan-600" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-3 text-sm">
            {(summary?.towsChange ?? 0) >= 0 ? (
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            ) : (
              <TrendingDown className="w-4 h-4 text-rose-500" />
            )}
            <span className={`font-medium ${(summary?.towsChange ?? 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {(summary?.towsChange ?? 0) >= 0 ? '+' : ''}{summary?.towsChange ?? 0}%
            </span>
            <span className="text-gray-400">מהתקופה הקודמת</span>
          </div>
        </div>

        {/* Revenue */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">הכנסות</p>
              <p className="text-3xl font-bold text-gray-800 mt-1">{formatCurrency(summary?.totalRevenue || 0)}</p>
              <p className="text-xs text-gray-400 mt-1">
                נגבה: {formatCurrency(summary?.collectedRevenue || 0)}
              </p>
            </div>
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-3 text-sm">
            {(summary?.revenueChange ?? 0) >= 0 ? (
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            ) : (
              <TrendingDown className="w-4 h-4 text-rose-500" />
            )}
            <span className={`font-medium ${(summary?.revenueChange ?? 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {(summary?.revenueChange ?? 0) >= 0 ? '+' : ''}{summary?.revenueChange ?? 0}%
            </span>
            <span className="text-gray-400">מהתקופה הקודמת</span>
          </div>
        </div>

        {/* Average per Tow */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">ממוצע לגרירה</p>
              <p className="text-3xl font-bold text-gray-800 mt-1">{formatCurrency(summary?.avgRevenuePerTow || 0)}</p>
              <p className="text-xs text-gray-400 mt-1">
                אחוז השלמה: {summary?.completionRate || 0}%
              </p>
            </div>
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-amber-600" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-3 text-sm">
            {(summary?.avgChange ?? 0) >= 0 ? (
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            ) : (
              <TrendingDown className="w-4 h-4 text-rose-500" />
            )}
            <span className={`font-medium ${(summary?.avgChange ?? 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {(summary?.avgChange ?? 0) >= 0 ? '+' : ''}{summary?.avgChange ?? 0}%
            </span>
            <span className="text-gray-400">מהתקופה הקודמת</span>
          </div>
        </div>

        {/* New Customers */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">לקוחות חדשים</p>
              <p className="text-3xl font-bold text-gray-800 mt-1">{summary?.newCustomers || 0}</p>
              <p className="text-xs text-gray-400 mt-1">
                בתקופה הנבחרת
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-3 text-sm">
            {(summary?.customersChange ?? 0) >= 0 ? (
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            ) : (
              <TrendingDown className="w-4 h-4 text-rose-500" />
            )}
            <span className={`font-medium ${(summary?.customersChange ?? 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {(summary?.customersChange ?? 0) >= 0 ? '+' : ''}{summary?.customersChange ?? 0}%
            </span>
            <span className="text-gray-400">מהתקופה הקודמת</span>
          </div>
        </div>
      </div>


      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tows Over Time Chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-800 mb-4">גרירות לאורך זמן</h3>
          <div className="h-48 flex items-end gap-1">
            {towsOverTime.length > 0 ? (
              towsOverTime.slice(-14).map((item, index) => (
                <div key={index} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-cyan-500 rounded-t transition-all hover:bg-cyan-600"
                    style={{
                      height: `${(item.tows / getMaxValue(towsOverTime, 'tows')) * 150}px`,
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

        {/* Revenue Over Time Chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-800 mb-4">הכנסות לאורך זמן</h3>
          <div className="h-48 flex items-end gap-1">
            {towsOverTime.length > 0 ? (
              towsOverTime.slice(-14).map((item, index) => (
                <div key={index} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-emerald-500 rounded-t transition-all hover:bg-emerald-600"
                    style={{
                      height: `${(item.revenue / getMaxValue(towsOverTime, 'revenue')) * 150}px`,
                      minHeight: item.revenue > 0 ? '8px' : '0'
                    }}
                    title={formatCurrency(item.revenue)}
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
      </div>

      {/* Breakdowns Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Vehicle Type */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-800 mb-4">לפי סוג רכב</h3>
          <div className="space-y-3">
            {vehicleTypes.length > 0 ? (
              vehicleTypes.map((item, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">{item.vehicle_type}</span>
                      <span className="text-gray-400">{item.percentage}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${vehicleColors[item.vehicle_type] || 'bg-gray-400'} rounded-full`}
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-400 text-center py-4">אין נתונים</p>
            )}
          </div>
        </div>

        {/* Tow Reason */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-800 mb-4">לפי סוג תקלה</h3>
          <div className="space-y-3">
            {towReasons.length > 0 ? (
              towReasons.slice(0, 5).map((item, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">{item.tow_reason}</span>
                      <span className="text-gray-400">{item.percentage}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${reasonColors[item.tow_reason] || 'bg-cyan-500'} rounded-full`}
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-400 text-center py-4">אין נתונים</p>
            )}
          </div>
        </div>

        {/* Customer Type */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-800 mb-4">לפי סוג לקוח</h3>
          {customerTypes && customerTypes.total > 0 ? (
            <div className="flex items-center justify-center">
              <div className="relative w-40 h-40">
                {/* Donut Chart */}
                <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#e5e7eb"
                    strokeWidth="3"
                  />
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#8b5cf6"
                    strokeWidth="3"
                    strokeDasharray={`${customerTypes.businessPercent}, 100`}
                  />
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#06b6d4"
                    strokeWidth="3"
                    strokeDasharray={`${customerTypes.privatePercent}, 100`}
                    strokeDashoffset={`-${customerTypes.businessPercent}`}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold text-gray-800">{customerTypes.total}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center text-gray-400">
              אין נתונים
            </div>
          )}
          <div className="flex justify-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-purple-500" />
              <span className="text-sm text-gray-600">עסקי {customerTypes?.businessPercent || 0}%</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-cyan-500" />
              <span className="text-sm text-gray-600">פרטי {customerTypes?.privatePercent || 0}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Top Lists Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Drivers */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">נהגים מובילים</h3>
            <Link href="/dashboard/reports/drivers" className="text-sm text-cyan-600 hover:text-cyan-700">
              צפה בכל
            </Link>
          </div>
          <div className="space-y-3">
            {topDrivers.length > 0 ? (
              topDrivers.map((driver, index) => (
                <Link
                  key={driver.driver_id}
                  href={`/dashboard/reports/driver/${driver.driver_id}`}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="w-10 h-10 bg-cyan-100 rounded-full flex items-center justify-center text-cyan-600 font-medium">
                    {driver.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 truncate">{driver.driver_name}</p>
                    <p className="text-sm text-gray-500">{driver.total_tows} גרירות</p>
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-gray-800">{formatCurrency(driver.total_revenue)}</p>
                    <div className="flex items-center gap-1 text-amber-500">
                      <Star className="w-3 h-3 fill-current" />
                      <span className="text-xs">4.9</span>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <p className="text-gray-400 text-center py-8">אין נתונים</p>
            )}
          </div>
        </div>

        {/* Top Customers */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">לקוחות מובילים</h3>
            <Link href="/dashboard/reports/customers" className="text-sm text-cyan-600 hover:text-cyan-700">
              צפה בכל
            </Link>
          </div>
          <div className="space-y-3">
            {topCustomers.length > 0 ? (
              topCustomers.map((customer, index) => (
                <Link
                  key={customer.customer_id}
                  href={`/dashboard/reports/customer/${customer.customer_id}`}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    customer.customer_type === 'business' 
                      ? 'bg-purple-100 text-purple-600' 
                      : 'bg-cyan-100 text-cyan-600'
                  }`}>
                    {customer.customer_type === 'business' ? (
                      <Building2 className="w-5 h-5" />
                    ) : (
                      <User className="w-5 h-5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 truncate">{customer.customer_name}</p>
                    <p className="text-sm text-gray-500">{customer.total_tows} גרירות</p>
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-gray-800">{formatCurrency(customer.total_revenue)}</p>
                  </div>
                </Link>
              ))
            ) : (
              <p className="text-gray-400 text-center py-8">אין נתונים</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}