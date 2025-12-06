'use client'

import { useState } from 'react'
import { 
  Download, 
  Printer, 
  FileText, 
  TrendingUp, 
  TrendingDown,
  Truck,
  DollarSign,
  Users,
  UserCircle,
  Calendar,
  ChevronLeft,
  Star,
  Building2,
  User,
  Mail,
  X,
  Filter
} from 'lucide-react'

interface DriverReport {
  name: string
  tows: number
  completed: number
  cancelled: number
  km: number
  revenue: number
  rating: number
}

interface CustomerReport {
  id: number
  name: string
  type: 'business' | 'private'
  tows: number
  revenue: number
  avg: number
  balance: number
}

export default function ReportsPage() {
  const [activeReport, setActiveReport] = useState<'overview' | 'tows' | 'revenue' | 'drivers' | 'customers'>('overview')
  const [dateRange, setDateRange] = useState('month')
  const [customDateFrom, setCustomDateFrom] = useState('')
  const [customDateTo, setCustomDateTo] = useState('')
  const [showCustomerDetail, setShowCustomerDetail] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerReport | null>(null)
  const [customerReportPeriod, setCustomerReportPeriod] = useState('month')

  // Mock data for charts
  const towsOverTime = [
    { day: '01', value: 5 },
    { day: '02', value: 8 },
    { day: '03', value: 6 },
    { day: '04', value: 4 },
    { day: '05', value: 7 },
    { day: '06', value: 3 },
    { day: '07', value: 2 },
    { day: '08', value: 6 },
    { day: '09', value: 9 },
    { day: '10', value: 5 },
    { day: '11', value: 7 },
    { day: '12', value: 8 },
    { day: '13', value: 4 },
    { day: '14', value: 3 },
  ]

  const revenueOverTime = [
    { day: '01', value: 2100 },
    { day: '02', value: 3500 },
    { day: '03', value: 2800 },
    { day: '04', value: 1900 },
    { day: '05', value: 3200 },
    { day: '06', value: 1400 },
    { day: '07', value: 900 },
    { day: '08', value: 2600 },
    { day: '09', value: 4100 },
    { day: '10', value: 2300 },
    { day: '11', value: 3100 },
    { day: '12', value: 3600 },
    { day: '13', value: 1800 },
    { day: '14', value: 1300 },
  ]

  const vehicleTypes = [
    { label: 'רכב פרטי', value: 68, color: 'bg-blue-500' },
    { label: 'ג\'יפ / SUV', value: 18, color: 'bg-purple-500' },
    { label: 'מסחרי', value: 9, color: 'bg-amber-500' },
    { label: 'אופנוע', value: 5, color: 'bg-emerald-500' },
  ]

  const defectTypes = [
    { label: 'תקר', value: 35, color: 'bg-blue-500' },
    { label: 'מנוע', value: 25, color: 'bg-red-500' },
    { label: 'סוללה', value: 20, color: 'bg-amber-500' },
    { label: 'תאונה', value: 12, color: 'bg-purple-500' },
    { label: 'נעילה', value: 8, color: 'bg-emerald-500' },
  ]

  const paymentMethods = [
    { method: 'מזומן', amount: 12500, percent: 21, icon: '💵' },
    { method: 'אשראי', amount: 18200, percent: 31, icon: '💳' },
    { method: 'חשבונית', amount: 24820, percent: 43, icon: '📄' },
    { method: 'העברה', amount: 2900, percent: 5, icon: '🏦' },
  ]

  const drivers: DriverReport[] = [
    { name: 'דוד אברהם', tows: 42, completed: 41, cancelled: 1, km: 680, revenue: 15800, rating: 4.9 },
    { name: 'יעקב מזרחי', tows: 38, completed: 36, cancelled: 2, km: 590, revenue: 14200, rating: 4.8 },
    { name: 'אבי גולן', tows: 35, completed: 34, cancelled: 1, km: 520, revenue: 13100, rating: 4.7 },
    { name: 'משה לוי', tows: 28, completed: 26, cancelled: 2, km: 410, revenue: 10400, rating: 4.9 },
    { name: 'רון דוד', tows: 13, completed: 12, cancelled: 1, km: 195, revenue: 4920, rating: 4.6 },
  ]

  const customers: CustomerReport[] = [
    { id: 1, name: 'ליסינג ישיר', type: 'business', tows: 24, revenue: 12400, avg: 517, balance: 4200 },
    { id: 2, name: 'מוסך רמט', type: 'business', tows: 18, revenue: 8600, avg: 478, balance: 3200 },
    { id: 3, name: 'השכרת רכב אופק', type: 'business', tows: 15, revenue: 7200, avg: 480, balance: 7200 },
    { id: 4, name: 'מוסך אבי', type: 'business', tows: 12, revenue: 5800, avg: 483, balance: 0 },
    { id: 5, name: 'יוסי כהן', type: 'private', tows: 4, revenue: 1650, avg: 413, balance: 0 },
    { id: 6, name: 'שרה לוי', type: 'private', tows: 2, revenue: 760, avg: 380, balance: 0 },
  ]

  // Customer detail data
  const customerDetailData = {
    weekly: [
      { week: 'שבוע 1', tows: 6, revenue: 2800 },
      { week: 'שבוע 2', tows: 5, revenue: 2400 },
      { week: 'שבוע 3', tows: 7, revenue: 3600 },
      { week: 'שבוע 4', tows: 6, revenue: 3600 },
    ],
    monthly: [
      { month: 'ינואר', tows: 18, revenue: 8600 },
      { month: 'פברואר', tows: 22, revenue: 10200 },
      { month: 'מרץ', tows: 20, revenue: 9800 },
      { month: 'אפריל', tows: 25, revenue: 12100 },
      { month: 'מאי', tows: 19, revenue: 9200 },
      { month: 'יוני', tows: 24, revenue: 11800 },
    ],
    yearly: [
      { year: '2022', tows: 180, revenue: 82000 },
      { year: '2023', tows: 210, revenue: 98000 },
      { year: '2024', tows: 156, revenue: 74000 },
    ],
    tows: [
      { id: 'T-1001', date: '01/12/2024', vehicle: '12-345-67', route: 'ת"א → רמת גן', amount: 380 },
      { id: 'T-1005', date: '02/12/2024', vehicle: '23-456-78', route: 'חולון → יפו', amount: 420 },
      { id: 'T-1008', date: '03/12/2024', vehicle: '34-567-89', route: 'ב"ב → ת"א', amount: 350 },
      { id: 'T-1012', date: '04/12/2024', vehicle: '45-678-90', route: 'ראשל"צ → חולון', amount: 480 },
      { id: 'T-1015', date: '05/12/2024', vehicle: '56-789-01', route: 'גבעתיים → ת"א', amount: 520 },
    ]
  }

  const getDateRangeText = () => {
    switch (dateRange) {
      case 'week': return '01/12/2024 - 07/12/2024'
      case 'month': return '01/12/2024 - 31/12/2024'
      case 'quarter': return '01/10/2024 - 31/12/2024'
      case 'year': return '01/01/2024 - 31/12/2024'
      case 'custom': return customDateFrom && customDateTo ? `${customDateFrom} - ${customDateTo}` : 'בחר תאריכים'
      default: return ''
    }
  }

  const openCustomerDetail = (customer: CustomerReport) => {
    setSelectedCustomer(customer)
    setShowCustomerDetail(true)
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">דוחות</h1>
            <p className="text-gray-500 mt-1">ניתוח ביצועים ונתונים</p>
          </div>
          <div className="hidden lg:flex items-center gap-2">
            <button className="flex items-center gap-2 px-4 py-2.5 text-gray-600 hover:bg-gray-100 rounded-xl font-medium">
              <Download size={18} />
              ייצא לאקסל
            </button>
            <button className="flex items-center gap-2 px-4 py-2.5 bg-[#33d4ff] text-white rounded-xl font-medium hover:bg-[#21b8e6]">
              <Printer size={18} />
              הדפס
            </button>
          </div>
        </div>
        {/* Mobile Actions */}
        <div className="lg:hidden grid grid-cols-2 gap-2">
          <button className="flex items-center justify-center gap-2 px-4 py-3 border border-gray-200 text-gray-600 rounded-xl font-medium">
            <Download size={18} />
            ייצא
          </button>
          <button className="flex items-center justify-center gap-2 px-4 py-3 bg-[#33d4ff] text-white rounded-xl font-medium">
            <Printer size={18} />
            הדפס
          </button>
        </div>
      </div>

      {/* Date Range Selector */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0">
            <span className="text-sm text-gray-500 whitespace-nowrap">תקופה:</span>
            {[
              { id: 'week', label: 'שבוע' },
              { id: 'month', label: 'חודש' },
              { id: 'quarter', label: 'רבעון' },
              { id: 'year', label: 'שנה' },
              { id: 'custom', label: 'מותאם' },
            ].map((range) => (
              <button
                key={range.id}
                onClick={() => setDateRange(range.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  dateRange === range.id
                    ? 'bg-[#33d4ff] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
          
          {dateRange === 'custom' && (
            <div className="flex items-center gap-2">
              <input 
                type="date" 
                value={customDateFrom}
                onChange={(e) => setCustomDateFrom(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]" 
              />
              <span className="text-gray-400">-</span>
              <input 
                type="date" 
                value={customDateTo}
                onChange={(e) => setCustomDateTo(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]" 
              />
            </div>
          )}

          <p className="text-sm text-gray-500 whitespace-nowrap">
            {getDateRangeText()}
          </p>
        </div>
      </div>

      {/* Report Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1.5 rounded-xl overflow-x-auto">
        {[
          { id: 'overview', label: 'סקירה כללית', icon: '📊' },
          { id: 'tows', label: 'גרירות', icon: '🚗' },
          { id: 'revenue', label: 'הכנסות', icon: '💰' },
          { id: 'drivers', label: 'נהגים', icon: '👷' },
          { id: 'customers', label: 'לקוחות', icon: '👥' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveReport(tab.id as any)}
            className={`px-4 sm:px-5 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
              activeReport === tab.id ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Report */}
      {activeReport === 'overview' && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-500">סה"כ גרירות</span>
                <span className="px-2 py-1 bg-emerald-100 text-emerald-600 text-xs rounded-lg flex items-center gap-1">
                  <TrendingUp size={12} />
                  +12%
                </span>
              </div>
              <p className="text-3xl font-bold text-gray-800">156</p>
              <p className="text-sm text-gray-500 mt-1">לעומת 139 בחודש שעבר</p>
            </div>

            <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-500">הכנסות</span>
                <span className="px-2 py-1 bg-emerald-100 text-emerald-600 text-xs rounded-lg flex items-center gap-1">
                  <TrendingUp size={12} />
                  +18%
                </span>
              </div>
              <p className="text-3xl font-bold text-gray-800">₪58,420</p>
              <p className="text-sm text-gray-500 mt-1">לעומת ₪49,500 בחודש שעבר</p>
            </div>

            <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-500">ממוצע לגרירה</span>
                <span className="px-2 py-1 bg-emerald-100 text-emerald-600 text-xs rounded-lg flex items-center gap-1">
                  <TrendingUp size={12} />
                  +5%
                </span>
              </div>
              <p className="text-3xl font-bold text-gray-800">₪374</p>
              <p className="text-sm text-gray-500 mt-1">לעומת ₪356 בחודש שעבר</p>
            </div>

            <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-500">לקוחות חדשים</span>
                <span className="px-2 py-1 bg-amber-100 text-amber-600 text-xs rounded-lg flex items-center gap-1">
                  <TrendingDown size={12} />
                  -8%
                </span>
              </div>
              <p className="text-3xl font-bold text-gray-800">23</p>
              <p className="text-sm text-gray-500 mt-1">לעומת 25 בחודש שעבר</p>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Tows Over Time */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-200">
                <h3 className="font-bold text-gray-800">גרירות לאורך זמן</h3>
              </div>
              <div className="p-5">
                <div className="h-48 flex items-end justify-between gap-1 sm:gap-2">
                  {towsOverTime.map((item, idx) => (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                      <div 
                        className="w-full bg-[#33d4ff] rounded-t-lg transition-all hover:bg-[#21b8e6]"
                        style={{ height: `${item.value * 18}px` }}
                      ></div>
                      <span className="text-xs text-gray-500">{item.day}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Revenue Over Time */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-200">
                <h3 className="font-bold text-gray-800">הכנסות לאורך זמן</h3>
              </div>
              <div className="p-5">
                <div className="h-48 flex items-end justify-between gap-1 sm:gap-2">
                  {revenueOverTime.map((item, idx) => (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                      <div 
                        className="w-full bg-emerald-500 rounded-t-lg transition-all hover:bg-emerald-600"
                        style={{ height: `${item.value / 25}px` }}
                      ></div>
                      <span className="text-xs text-gray-500">{item.day}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Distribution Charts */}
          <div className="grid lg:grid-cols-3 gap-6">
            {/* By Vehicle Type */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-200">
                <h3 className="font-bold text-gray-800">לפי סוג רכב</h3>
              </div>
              <div className="p-5">
                <div className="space-y-3">
                  {vehicleTypes.map((item, idx) => (
                    <div key={idx}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-600">{item.label}</span>
                        <span className="font-medium text-gray-800">{item.value}%</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full ${item.color} rounded-full`} style={{ width: `${item.value}%` }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* By Defect Type */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-200">
                <h3 className="font-bold text-gray-800">לפי סוג תקלה</h3>
              </div>
              <div className="p-5">
                <div className="space-y-3">
                  {defectTypes.map((item, idx) => (
                    <div key={idx}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-600">{item.label}</span>
                        <span className="font-medium text-gray-800">{item.value}%</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full ${item.color} rounded-full`} style={{ width: `${item.value}%` }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* By Customer Type */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-200">
                <h3 className="font-bold text-gray-800">לפי סוג לקוח</h3>
              </div>
              <div className="p-5">
                <div className="flex items-center justify-center mb-4">
                  <div className="relative w-32 h-32">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="64" cy="64" r="56" fill="none" stroke="#e5e7eb" strokeWidth="16" />
                      <circle cx="64" cy="64" r="56" fill="none" stroke="#8b5cf6" strokeWidth="16" strokeDasharray="352" strokeDashoffset="123" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-2xl font-bold text-gray-800">156</span>
                    </div>
                  </div>
                </div>
                <div className="flex justify-center gap-6">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                    <span className="text-sm text-gray-600">עסקי 65%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <span className="text-sm text-gray-600">פרטי 35%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Top Lists */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Top Customers */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="font-bold text-gray-800">לקוחות מובילים</h3>
                <button 
                  onClick={() => setActiveReport('customers')}
                  className="text-sm text-[#33d4ff] hover:underline"
                >
                  צפה בכל
                </button>
              </div>
              <div className="divide-y divide-gray-100">
                {customers.slice(0, 4).map((customer, idx) => (
                  <div key={idx} className="px-5 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        customer.type === 'business' ? 'bg-purple-100' : 'bg-blue-100'
                      }`}>
                        {customer.type === 'business' ? (
                          <Building2 size={16} className="text-purple-600" />
                        ) : (
                          <User size={16} className="text-blue-600" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">{customer.name}</p>
                        <p className="text-sm text-gray-500">{customer.tows} גרירות</p>
                      </div>
                    </div>
                    <span className="font-bold text-gray-800">₪{customer.revenue.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Drivers */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="font-bold text-gray-800">נהגים מובילים</h3>
                <button 
                  onClick={() => setActiveReport('drivers')}
                  className="text-sm text-[#33d4ff] hover:underline"
                >
                  צפה בכל
                </button>
              </div>
              <div className="divide-y divide-gray-100">
                {drivers.slice(0, 4).map((driver, idx) => (
                  <div key={idx} className="px-5 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-xs font-medium text-blue-600">
                          {driver.name.split(' ').map(n => n[0]).join('')}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">{driver.name}</p>
                        <p className="text-sm text-gray-500">{driver.tows} גרירות</p>
                      </div>
                    </div>
                    <div className="text-left">
                      <span className="font-bold text-gray-800">₪{driver.revenue.toLocaleString()}</span>
                      <div className="flex items-center gap-1 justify-end">
                        <Star size={12} className="text-amber-400 fill-amber-400" />
                        <span className="text-sm text-gray-500">{driver.rating}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tows Report */}
      {activeReport === 'tows' && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
              <p className="text-sm text-gray-500">סה"כ גרירות</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">156</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
              <p className="text-sm text-gray-500">הושלמו</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">149</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
              <p className="text-sm text-gray-500">בוטלו</p>
              <p className="text-2xl font-bold text-red-600 mt-1">7</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
              <p className="text-sm text-gray-500">אחוז הצלחה</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">95.5%</p>
            </div>
          </div>

          {/* Chart */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200">
              <h3 className="font-bold text-gray-800">גרירות לאורך זמן</h3>
            </div>
            <div className="p-5">
              <div className="h-64 flex items-end justify-between gap-2">
                {towsOverTime.map((item, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                    <div 
                      className="w-full bg-[#33d4ff] rounded-t-lg transition-all hover:bg-[#21b8e6]"
                      style={{ height: `${item.value * 24}px` }}
                    ></div>
                    <span className="text-xs text-gray-500">{item.day}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Distributions */}
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-200">
                <h3 className="font-bold text-gray-800">לפי סוג רכב</h3>
              </div>
              <div className="p-5 space-y-3">
                {vehicleTypes.map((item, idx) => (
                  <div key={idx}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-600">{item.label}</span>
                      <span className="font-medium text-gray-800">{Math.round(156 * item.value / 100)} ({item.value}%)</span>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full ${item.color} rounded-full`} style={{ width: `${item.value}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-200">
                <h3 className="font-bold text-gray-800">לפי סוג תקלה</h3>
              </div>
              <div className="p-5 space-y-3">
                {defectTypes.map((item, idx) => (
                  <div key={idx}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-600">{item.label}</span>
                      <span className="font-medium text-gray-800">{Math.round(156 * item.value / 100)} ({item.value}%)</span>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full ${item.color} rounded-full`} style={{ width: `${item.value}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Revenue Report */}
      {activeReport === 'revenue' && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
              <p className="text-sm text-gray-500">סה"כ הכנסות</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">₪58,420</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
              <p className="text-sm text-gray-500">ממוצע ליום</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">₪1,884</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
              <p className="text-sm text-gray-500">ממוצע לגרירה</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">₪374</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
              <p className="text-sm text-gray-500">יתרות פתוחות</p>
              <p className="text-2xl font-bold text-red-600 mt-1">₪14,600</p>
            </div>
          </div>

          {/* Chart */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200">
              <h3 className="font-bold text-gray-800">הכנסות לאורך זמן</h3>
            </div>
            <div className="p-5">
              <div className="h-64 flex items-end justify-between gap-2">
                {revenueOverTime.map((item, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                    <div 
                      className="w-full bg-emerald-500 rounded-t-lg transition-all hover:bg-emerald-600"
                      style={{ height: `${item.value / 18}px` }}
                    ></div>
                    <span className="text-xs text-gray-500">{item.day}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Payment Methods */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200">
              <h3 className="font-bold text-gray-800">הכנסות לפי אמצעי תשלום</h3>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {paymentMethods.map((item, idx) => (
                  <div key={idx} className="p-4 bg-gray-50 rounded-xl text-center">
                    <span className="text-3xl">{item.icon}</span>
                    <p className="font-medium text-gray-800 mt-2">{item.method}</p>
                    <p className="text-xl font-bold text-gray-800 mt-1">₪{item.amount.toLocaleString()}</p>
                    <p className="text-sm text-gray-500">{item.percent}%</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Drivers Report */}
      {activeReport === 'drivers' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200">
            <h3 className="font-bold text-gray-800">ביצועי נהגים</h3>
          </div>
          
          {/* Desktop Table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-right px-5 py-3 text-sm font-medium text-gray-500">נהג</th>
                  <th className="text-right px-5 py-3 text-sm font-medium text-gray-500">גרירות</th>
                  <th className="text-right px-5 py-3 text-sm font-medium text-gray-500">הושלמו</th>
                  <th className="text-right px-5 py-3 text-sm font-medium text-gray-500">בוטלו</th>
                  <th className="text-right px-5 py-3 text-sm font-medium text-gray-500">סה"כ ק"מ</th>
                  <th className="text-right px-5 py-3 text-sm font-medium text-gray-500">הכנסות</th>
                  <th className="text-right px-5 py-3 text-sm font-medium text-gray-500">דירוג</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {drivers.map((driver, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-xs font-medium text-blue-600">
                            {driver.name.split(' ').map(n => n[0]).join('')}
                          </span>
                        </div>
                        <span className="font-medium text-gray-800">{driver.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 font-medium text-gray-800">{driver.tows}</td>
                    <td className="px-5 py-3 text-emerald-600">{driver.completed}</td>
                    <td className="px-5 py-3 text-red-600">{driver.cancelled}</td>
                    <td className="px-5 py-3 text-gray-600">{driver.km}</td>
                    <td className="px-5 py-3 font-medium text-gray-800">₪{driver.revenue.toLocaleString()}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1">
                        <Star size={16} className="text-amber-400 fill-amber-400" />
                        <span className="font-medium text-gray-800">{driver.rating}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile List */}
          <div className="lg:hidden divide-y divide-gray-100">
            {drivers.map((driver, idx) => (
              <div key={idx} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-blue-600">
                        {driver.name.split(' ').map(n => n[0]).join('')}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">{driver.name}</p>
                      <div className="flex items-center gap-1">
                        <Star size={12} className="text-amber-400 fill-amber-400" />
                        <span className="text-sm text-gray-500">{driver.rating}</span>
                      </div>
                    </div>
                  </div>
                  <span className="font-bold text-gray-800">₪{driver.revenue.toLocaleString()}</span>
                </div>
                <div className="flex gap-4 text-sm text-gray-500">
                  <span>{driver.tows} גרירות</span>
                  <span className="text-emerald-600">{driver.completed} הושלמו</span>
                  <span className="text-red-600">{driver.cancelled} בוטלו</span>
                  <span>{driver.km} ק"מ</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Customers Report */}
      {activeReport === 'customers' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200">
            <h3 className="font-bold text-gray-800">דוח לקוחות</h3>
            <p className="text-sm text-gray-500 mt-1">לחץ על לקוח לצפייה בדוח מפורט</p>
          </div>
          
          {/* Desktop Table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-right px-5 py-3 text-sm font-medium text-gray-500">לקוח</th>
                  <th className="text-right px-5 py-3 text-sm font-medium text-gray-500">סוג</th>
                  <th className="text-right px-5 py-3 text-sm font-medium text-gray-500">גרירות</th>
                  <th className="text-right px-5 py-3 text-sm font-medium text-gray-500">הכנסות</th>
                  <th className="text-right px-5 py-3 text-sm font-medium text-gray-500">ממוצע לגרירה</th>
                  <th className="text-right px-5 py-3 text-sm font-medium text-gray-500">יתרה פתוחה</th>
                  <th className="text-right px-5 py-3 text-sm font-medium text-gray-500">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {customers.map((customer, idx) => (
                  <tr 
                    key={idx} 
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => openCustomerDetail(customer)}
                  >
                    <td className="px-5 py-3 font-medium text-gray-800">{customer.name}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-1 text-xs rounded-lg ${
                        customer.type === 'business' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {customer.type === 'business' ? 'עסקי' : 'פרטי'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-600">{customer.tows}</td>
                    <td className="px-5 py-3 font-medium text-gray-800">₪{customer.revenue.toLocaleString()}</td>
                    <td className="px-5 py-3 text-gray-600">₪{customer.avg}</td>
                    <td className="px-5 py-3">
                      {customer.balance > 0 ? (
                        <span className="text-red-600 font-medium">₪{customer.balance.toLocaleString()}</span>
                      ) : (
                        <span className="text-emerald-600">מאופס</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <button 
                        onClick={(e) => { e.stopPropagation(); openCustomerDetail(customer); }}
                        className="text-[#33d4ff] hover:underline text-sm"
                      >
                        דוח מפורט
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile List */}
          <div className="lg:hidden divide-y divide-gray-100">
            {customers.map((customer, idx) => (
              <div 
                key={idx} 
                className="p-4 hover:bg-gray-50 cursor-pointer"
                onClick={() => openCustomerDetail(customer)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      customer.type === 'business' ? 'bg-purple-100' : 'bg-blue-100'
                    }`}>
                      {customer.type === 'business' ? (
                        <Building2 size={20} className="text-purple-600" />
                      ) : (
                        <User size={20} className="text-blue-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">{customer.name}</p>
                      <span className={`text-xs ${
                        customer.type === 'business' ? 'text-purple-600' : 'text-blue-600'
                      }`}>
                        {customer.type === 'business' ? 'עסקי' : 'פרטי'}
                      </span>
                    </div>
                  </div>
                  <ChevronLeft size={20} className="text-gray-400" />
                </div>
                <div className="flex justify-between text-sm mr-13">
                  <span className="text-gray-500">{customer.tows} גרירות</span>
                  <span className="font-bold text-gray-800">₪{customer.revenue.toLocaleString()}</span>
                </div>
                {customer.balance > 0 && (
                  <p className="text-sm text-red-600 mt-1 mr-13">יתרה: ₪{customer.balance.toLocaleString()}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Customer Detail Modal */}
      {showCustomerDetail && selectedCustomer && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white w-full sm:rounded-2xl sm:max-w-2xl sm:mx-4 overflow-hidden max-h-[95vh] flex flex-col rounded-t-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-[#33d4ff] text-white flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  selectedCustomer.type === 'business' ? 'bg-white/20' : 'bg-white/20'
                }`}>
                  {selectedCustomer.type === 'business' ? (
                    <Building2 size={20} />
                  ) : (
                    <User size={20} />
                  )}
                </div>
                <div>
                  <h2 className="font-bold text-lg">{selectedCustomer.name}</h2>
                  <p className="text-white/80 text-sm">דוח לקוח מפורט</p>
                </div>
              </div>
              <button
                onClick={() => setShowCustomerDetail(false)}
                className="p-2 hover:bg-white/20 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            {/* Period Selector */}
            <div className="px-5 py-3 border-b border-gray-200 bg-gray-50 flex-shrink-0">
              <div className="flex gap-2">
                {[
                  { id: 'week', label: 'שבועי' },
                  { id: 'month', label: 'חודשי' },
                  { id: 'year', label: 'שנתי' },
                ].map((period) => (
                  <button
                    key={period.id}
                    onClick={() => setCustomerReportPeriod(period.id)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      customerReportPeriod === period.id
                        ? 'bg-[#33d4ff] text-white'
                        : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {period.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-gray-50 rounded-xl text-center">
                  <p className="text-sm text-gray-500">גרירות</p>
                  <p className="text-xl font-bold text-gray-800">
                    {customerReportPeriod === 'week' ? customerDetailData.weekly.reduce((s, w) => s + w.tows, 0) :
                     customerReportPeriod === 'month' ? customerDetailData.monthly.reduce((s, m) => s + m.tows, 0) :
                     customerDetailData.yearly.reduce((s, y) => s + y.tows, 0)}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl text-center">
                  <p className="text-sm text-gray-500">הכנסות</p>
                  <p className="text-xl font-bold text-gray-800">
                    ₪{(customerReportPeriod === 'week' ? customerDetailData.weekly.reduce((s, w) => s + w.revenue, 0) :
                       customerReportPeriod === 'month' ? customerDetailData.monthly.reduce((s, m) => s + m.revenue, 0) :
                       customerDetailData.yearly.reduce((s, y) => s + y.revenue, 0)).toLocaleString()}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl text-center">
                  <p className="text-sm text-gray-500">יתרה</p>
                  <p className={`text-xl font-bold ${selectedCustomer.balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {selectedCustomer.balance > 0 ? `₪${selectedCustomer.balance.toLocaleString()}` : 'מאופס'}
                  </p>
                </div>
              </div>

              {/* Chart */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h4 className="font-medium text-gray-700 mb-3">
                  {customerReportPeriod === 'week' ? 'הכנסות שבועיות' :
                   customerReportPeriod === 'month' ? 'הכנסות חודשיות' : 'הכנסות שנתיות'}
                </h4>
                <div className="h-40 flex items-end justify-between gap-2">
                  {(customerReportPeriod === 'week' ? customerDetailData.weekly :
                    customerReportPeriod === 'month' ? customerDetailData.monthly :
                    customerDetailData.yearly).map((item: any, idx) => {
                    const maxRevenue = Math.max(...(customerReportPeriod === 'week' ? customerDetailData.weekly :
                      customerReportPeriod === 'month' ? customerDetailData.monthly :
                      customerDetailData.yearly).map((i: any) => i.revenue))
                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                        <div 
                          className="w-full bg-[#33d4ff] rounded-t-lg transition-all hover:bg-[#21b8e6]"
                          style={{ height: `${(item.revenue / maxRevenue) * 120}px` }}
                        ></div>
                        <span className="text-xs text-gray-500">
                          {item.week || item.month || item.year}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Tows List */}
              <div>
                <h4 className="font-medium text-gray-700 mb-3">גרירות אחרונות</h4>
                <div className="space-y-2">
                  {customerDetailData.tows.map((tow) => (
                    <div key={tow.id} className="p-3 bg-gray-50 rounded-xl flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[#33d4ff] text-sm">{tow.id}</span>
                          <span className="text-gray-400">•</span>
                          <span className="text-sm text-gray-600">{tow.date}</span>
                        </div>
                        <p className="text-sm text-gray-600">{tow.route}</p>
                      </div>
                      <span className="font-bold text-gray-800">₪{tow.amount}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 px-5 py-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
              <button className="flex-1 flex items-center justify-center gap-2 py-3 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-100">
                <Download size={18} />
                ייצא לאקסל
              </button>
              <button className="flex-1 flex items-center justify-center gap-2 py-3 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-100">
                <Mail size={18} />
                שלח במייל
              </button>
              <button className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#33d4ff] text-white rounded-xl font-medium hover:bg-[#21b8e6]">
                <Printer size={18} />
                הדפס
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
