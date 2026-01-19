'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../../lib/AuthContext'
import { getDriverByUserId, DriverInfo } from '../../lib/queries/driver-tasks'
import { supabase } from '../../lib/supabase'
import { 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Truck, 
  Award, 
  DollarSign,
  ChevronRight,
  ChevronLeft,
  Loader2,
  BarChart3
} from 'lucide-react'

// ==================== Types ====================

interface PeriodStats {
  tows: number
  towsTrend: number
  successRate: number
  successTrend: number
  avgTime: number
  timeTrend: number
  income: number
  incomeTrend: number
}

interface DailyData {
  day: string
  dayName: string
  tows: number
  isToday: boolean
}

interface WeeklyData {
  week: string
  tows: number
}

interface DriverStatsData {
  week: PeriodStats
  month: PeriodStats
  weeklyChart: DailyData[]
  monthlyChart: WeeklyData[]
  personalBest: {
    count: number
    date: string
  }
}

// ==================== Component ====================

export default function DriverStatsPage() {
  const { user, loading: authLoading } = useAuth()
  const [driverInfo, setDriverInfo] = useState<DriverInfo | null>(null)
  const [stats, setStats] = useState<DriverStatsData | null>(null)
  const [period, setPeriod] = useState<'week' | 'month'>('month')
  const [loading, setLoading] = useState(true)
  const [chartOffset, setChartOffset] = useState(0) // For navigating weeks/months

  useEffect(() => {
    if (!authLoading && user) {
      loadData()
    }
  }, [authLoading, user])

  const loadData = async () => {
    if (!user) return
    setLoading(true)

    try {
      const driver = await getDriverByUserId(user.id)
      if (!driver) {
        setLoading(false)
        return
      }
      setDriverInfo(driver)

      const statsData = await fetchDriverStats(driver.id)
      setStats(statsData)
    } catch (err) {
      console.error('Error loading stats:', err)
    } finally {
      setLoading(false)
    }
  }

  // ==================== Fetch Stats ====================

  const fetchDriverStats = async (driverId: string): Promise<DriverStatsData> => {
    const now = new Date()
    const today = now.toISOString().split('T')[0]
    
    // Calculate date ranges
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - now.getDay()) // Start of week (Sunday)
    const weekStartStr = weekStart.toISOString().split('T')[0]
    
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthStartStr = monthStart.toISOString().split('T')[0]
    
    const prevWeekStart = new Date(weekStart)
    prevWeekStart.setDate(prevWeekStart.getDate() - 7)
    const prevWeekStartStr = prevWeekStart.toISOString().split('T')[0]
    
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
    const prevMonthStartStr = prevMonthStart.toISOString().split('T')[0]
    const prevMonthEndStr = prevMonthEnd.toISOString().split('T')[0]

    // Fetch current week stats
    const { data: weekTows } = await supabase
      .from('tows')
      .select('id, status, created_at, completed_at, final_price, tow_type')
      .eq('driver_id', driverId)
      .gte('created_at', `${weekStartStr}T00:00:00`)
      .neq('status', 'cancelled')

    // Fetch previous week for trend
    const { data: prevWeekTows } = await supabase
      .from('tows')
      .select('id, status')
      .eq('driver_id', driverId)
      .gte('created_at', `${prevWeekStartStr}T00:00:00`)
      .lt('created_at', `${weekStartStr}T00:00:00`)
      .neq('status', 'cancelled')

    // Fetch current month stats
    const { data: monthTows } = await supabase
      .from('tows')
      .select('id, status, created_at, completed_at, final_price, tow_type')
      .eq('driver_id', driverId)
      .gte('created_at', `${monthStartStr}T00:00:00`)
      .neq('status', 'cancelled')

    // Fetch previous month for trend
    const { data: prevMonthTows } = await supabase
      .from('tows')
      .select('id, status')
      .eq('driver_id', driverId)
      .gte('created_at', `${prevMonthStartStr}T00:00:00`)
      .lte('created_at', `${prevMonthEndStr}T23:59:59`)
      .neq('status', 'cancelled')

    // Fetch all-time best day
    const { data: allTows } = await supabase
      .from('tows')
      .select('created_at')
      .eq('driver_id', driverId)
      .eq('status', 'completed')

    // Calculate stats
    const weekStats = calculatePeriodStats(weekTows || [], prevWeekTows || [])
    const monthStats = calculatePeriodStats(monthTows || [], prevMonthTows || [])

    // Build weekly chart data (last 7 days)
    const weeklyChart = buildWeeklyChart(weekTows || [], now)

    // Build monthly chart data (weeks of month)
    const monthlyChart = buildMonthlyChart(monthTows || [], now)

    // Find personal best
    const personalBest = findPersonalBest(allTows || [])

    return {
      week: weekStats,
      month: monthStats,
      weeklyChart,
      monthlyChart,
      personalBest
    }
  }

  const calculatePeriodStats = (current: any[], previous: any[]): PeriodStats => {
    const totalTows = current.length
    const prevTows = previous.length
    const towsTrend = prevTows > 0 ? Math.round(((totalTows - prevTows) / prevTows) * 100) : 0

    const completed = current.filter(t => t.status === 'completed').length
    const successRate = totalTows > 0 ? Math.round((completed / totalTows) * 100) : 0
    const prevCompleted = previous.filter(t => t.status === 'completed').length
    const prevSuccessRate = prevTows > 0 ? Math.round((prevCompleted / prevTows) * 100) : 0
    const successTrend = prevSuccessRate > 0 ? successRate - prevSuccessRate : 0

    // Calculate average time (mock for now - would need started_at field)
    const avgTime = 42 // minutes - placeholder
    const timeTrend = -5 // placeholder

    const income = current.reduce((sum, t) => sum + (t.final_price || 0), 0)
    const prevIncome = previous.reduce((sum: number, t: any) => sum + (t.final_price || 0), 0)
    const incomeTrend = prevIncome > 0 ? Math.round(((income - prevIncome) / prevIncome) * 100) : 0

    return {
      tows: totalTows,
      towsTrend,
      successRate,
      successTrend,
      avgTime,
      timeTrend,
      income,
      incomeTrend
    }
  }

  const buildWeeklyChart = (tows: any[], now: Date): DailyData[] => {
    const days = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳']
    const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
    const todayIndex = now.getDay()
    
    return days.map((day, idx) => {
      const date = new Date(now)
      date.setDate(now.getDate() - now.getDay() + idx)
      const dateStr = date.toISOString().split('T')[0]
      
      const dayTows = tows.filter(t => 
        t.created_at.startsWith(dateStr)
      ).length

      return {
        day,
        dayName: dayNames[idx],
        tows: dayTows,
        isToday: idx === todayIndex
      }
    })
  }

  const buildMonthlyChart = (tows: any[], now: Date): WeeklyData[] => {
    const weeks: WeeklyData[] = []
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    
    for (let week = 0; week < 4; week++) {
      const weekStart = new Date(monthStart)
      weekStart.setDate(monthStart.getDate() + (week * 7))
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekStart.getDate() + 6)

      const weekTows = tows.filter(t => {
        const towDate = new Date(t.created_at)
        return towDate >= weekStart && towDate <= weekEnd
      }).length

      weeks.push({
        week: `שבוע ${week + 1}`,
        tows: weekTows
      })
    }

    return weeks
  }

  const findPersonalBest = (tows: any[]): { count: number; date: string } => {
    const dayCount: Record<string, number> = {}
    
    tows.forEach(t => {
      const date = t.created_at.split('T')[0]
      dayCount[date] = (dayCount[date] || 0) + 1
    })

    let maxCount = 0
    let maxDate = ''
    
    Object.entries(dayCount).forEach(([date, count]) => {
      if (count > maxCount) {
        maxCount = count
        maxDate = date
      }
    })

    return {
      count: maxCount,
      date: maxDate ? new Date(maxDate).toLocaleDateString('he-IL', { 
        day: 'numeric', 
        month: 'long',
        year: 'numeric'
      }) : ''
    }
  }

  // ==================== Render Helpers ====================

  const StatCard = ({ 
    icon: Icon, 
    value, 
    label, 
    trend, 
    suffix = '', 
    prefix = '', 
    color = 'blue' 
  }: {
    icon: any
    value: number
    label: string
    trend?: number
    suffix?: string
    prefix?: string
    color?: 'blue' | 'green' | 'orange' | 'purple'
  }) => {
    const colorClasses = {
      blue: 'from-blue-500 to-blue-600',
      green: 'from-emerald-500 to-emerald-600',
      orange: 'from-orange-500 to-orange-600',
      purple: 'from-purple-500 to-purple-600',
    }

    return (
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <div className="flex items-start justify-between mb-2">
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colorClasses[color]} flex items-center justify-center`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          {trend !== undefined && (
            <div className={`flex items-center gap-1 text-xs font-medium ${trend >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              <span>{Math.abs(trend)}%</span>
            </div>
          )}
        </div>
        <div className="text-2xl font-bold text-gray-800 mb-0.5">
          {prefix}{value.toLocaleString()}{suffix}
        </div>
        <div className="text-sm text-gray-500">{label}</div>
      </div>
    )
  }

  // ==================== Loading State ====================

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto mb-3" />
          <p className="text-gray-500">טוען סטטיסטיקות...</p>
        </div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center" dir="rtl">
        <p className="text-gray-500">לא נמצאו נתונים</p>
      </div>
    )
  }

  const currentStats = period === 'month' ? stats.month : stats.week
  const chartData = period === 'month' ? stats.monthlyChart : stats.weeklyChart
  const maxChartValue = Math.max(...chartData.map(d => d.tows), 1)

  // ==================== Main Render ====================

  return (
    <div className="min-h-screen bg-gray-50 pb-6" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-700 text-white px-5 pt-12 pb-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">סטטיסטיקות</h1>
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
            <BarChart3 className="w-5 h-5" />
          </div>
        </div>
        
        {/* Period Selector */}
        <div className="flex gap-2 bg-white/10 rounded-xl p-1">
          <button
            onClick={() => setPeriod('week')}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
              period === 'week' 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-white/80 hover:text-white'
            }`}
          >
            שבוע
          </button>
          <button
            onClick={() => setPeriod('month')}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
              period === 'month' 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-white/80 hover:text-white'
            }`}
          >
            חודש
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="px-5 -mt-4">
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            icon={Truck}
            value={currentStats.tows}
            label={period === 'month' ? 'גרירות החודש' : 'גרירות השבוע'}
            trend={currentStats.towsTrend}
            color="blue"
          />
          <StatCard
            icon={Award}
            value={currentStats.successRate}
            suffix="%"
            label="הושלמו בהצלחה"
            trend={currentStats.successTrend}
            color="green"
          />
          <StatCard
            icon={Clock}
            value={currentStats.avgTime}
            suffix=" דק׳"
            label="ממוצע לגרירה"
            trend={currentStats.timeTrend}
            color="orange"
          />
          <StatCard
            icon={DollarSign}
            value={currentStats.income}
            prefix="₪"
            label={period === 'month' ? 'הכנסות החודש' : 'הכנסות השבוע'}
            trend={currentStats.incomeTrend}
            color="purple"
          />
        </div>
      </div>

      {/* Chart Section */}
      <div className="px-5 mt-6">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">
              {period === 'month' ? 'גרירות לפי שבועות' : 'גרירות לפי ימים'}
            </h3>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setChartOffset(chartOffset + 1)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </button>
              <button 
                onClick={() => setChartOffset(Math.max(0, chartOffset - 1))}
                disabled={chartOffset === 0}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          </div>
          
          {/* Simple Bar Chart */}
          <div className="h-48 flex items-end justify-between gap-2">
            {chartData.map((item, index) => {
              const height = maxChartValue > 0 ? (item.tows / maxChartValue) * 100 : 0
              const isToday = 'isToday' in item && item.isToday
              
              return (
                <div key={index} className="flex-1 flex flex-col items-center gap-2">
                  <span className="text-xs text-gray-500 font-medium">{item.tows}</span>
                  <div 
                    className={`w-full rounded-t-lg transition-all duration-300 ${
                      isToday ? 'bg-blue-500' : 'bg-gray-200'
                    }`}
                    style={{ height: `${Math.max(height, 4)}%` }}
                  />
                  <span className="text-xs text-gray-500">
                    {'day' in item ? item.day : item.week.replace('שבוע ', '')}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Personal Best */}
      {stats.personalBest.count > 0 && (
        <div className="px-5 mt-6">
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-5 border border-amber-100">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center">
                <Award className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="font-bold text-gray-800">שיא אישי! 🏆</div>
                <div className="text-sm text-gray-600">{stats.personalBest.count} גרירות ביום אחד</div>
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-2 mr-15">הושג ב-{stats.personalBest.date}</div>
          </div>
        </div>
      )}

    </div>
  )
}