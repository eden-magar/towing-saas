'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../lib/AuthContext'
import { supabase } from '../../lib/supabase'
import { getTowRevenueContribution } from '../../lib/utils/cancellation-fee'
import { getDriverByUserId, getDriverStats, DriverInfo } from '../../lib/queries/driver-tasks'
import {
  User, Truck, Phone, Mail, ChevronLeft, LogOut, Check,
  Award, Calendar, Target, TrendingUp, TrendingDown,
  Clock, DollarSign, BarChart3, Loader2
} from 'lucide-react'

const statuses = [
  { id: 'available', label: 'זמין', icon: '🟢' },
  { id: 'busy', label: 'בגרירה', icon: '🔵' },
  { id: 'break', label: 'בהפסקה', icon: '🟡' },
  { id: 'unavailable', label: 'לא זמין', icon: '🔴' },
]

interface PeriodStats {
  tows: number; towsTrend: number; successRate: number; successTrend: number;
  avgTime: number; timeTrend: number; income: number; incomeTrend: number;
}
interface DailyData { day: string; tows: number; isToday: boolean }
interface WeeklyData { week: string; tows: number }
interface DriverStatsData {
  week: PeriodStats; month: PeriodStats;
  weeklyChart: DailyData[]; monthlyChart: WeeklyData[];
  personalBest: { count: number; date: string }
}

export default function DriverProfilePage() {
  const { user, signOut, loading: authLoading } = useAuth()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'profile' | 'stats'>('profile')
  const [driverInfo, setDriverInfo] = useState<DriverInfo | null>(null)
  const [profileStats, setProfileStats] = useState({
    todayTasks: 0, weekCompleted: 0, monthCompleted: 0,
    totalCompleted: 0, completionRate: 0
  })
  const [statsData, setStatsData] = useState<DriverStatsData | null>(null)
  const [period, setPeriod] = useState<'week' | 'month'>('month')
  const [loading, setLoading] = useState(true)
  const [showStatusModal, setShowStatusModal] = useState(false)

  useEffect(() => {
    if (!authLoading && user) loadData()
  }, [authLoading, user])

  const loadData = async () => {
    if (!user) return
    setLoading(true)
    try {
      const driver = await getDriverByUserId(user.id)
      setDriverInfo(driver)
      if (driver) {
        const basicStats = await getDriverStats(driver.id)
        const now = new Date()
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
        const { count: monthCompleted } = await supabase.from('tows')
          .select('*', { count: 'exact', head: true })
          .eq('driver_id', driver.id).eq('status', 'completed').gte('completed_at', monthStart)
        const { count: totalCompleted } = await supabase.from('tows')
          .select('*', { count: 'exact', head: true })
          .eq('driver_id', driver.id).eq('status', 'completed')
        const { count: totalTows } = await supabase.from('tows')
          .select('*', { count: 'exact', head: true })
          .eq('driver_id', driver.id).neq('status', 'pending')
        const completionRate = totalTows && totalTows > 0
          ? Math.round((totalCompleted || 0) / totalTows * 100) : 0
        setProfileStats({
          todayTasks: basicStats.todayTasks,
          weekCompleted: basicStats.weekCompleted,
          monthCompleted: monthCompleted || 0,
          totalCompleted: totalCompleted || 0,
          completionRate
        })
        const sd = await fetchDriverStats(driver.id)
        setStatsData(sd)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const fetchDriverStats = async (driverId: string): Promise<DriverStatsData> => {
    const now = new Date()
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - now.getDay())
    const weekStartStr = weekStart.toISOString().split('T')[0]
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthStartStr = monthStart.toISOString().split('T')[0]
    const prevWeekStart = new Date(weekStart)
    prevWeekStart.setDate(prevWeekStart.getDate() - 7)
    const prevWeekStartStr = prevWeekStart.toISOString().split('T')[0]
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)

    const { data: weekTows } = await supabase.from('tows')
      .select('id, status, created_at, completed_at, final_price, cancellation_fee')
      .eq('driver_id', driverId).gte('created_at', `${weekStartStr}T00:00:00`).neq('status', 'cancelled')
    const { data: prevWeekTows } = await supabase.from('tows')
      .select('id, status')
      .eq('driver_id', driverId).gte('created_at', `${prevWeekStartStr}T00:00:00`).lt('created_at', `${weekStartStr}T00:00:00`).neq('status', 'cancelled')
    const { data: monthTows } = await supabase.from('tows')
      .select('id, status, created_at, completed_at, final_price, cancellation_fee')
      .eq('driver_id', driverId).gte('created_at', `${monthStartStr}T00:00:00`).neq('status', 'cancelled')
    const { data: prevMonthTows } = await supabase.from('tows')
      .select('id, status')
      .eq('driver_id', driverId)
      .gte('created_at', prevMonthStart.toISOString().split('T')[0] + 'T00:00:00')
      .lte('created_at', prevMonthEnd.toISOString().split('T')[0] + 'T23:59:59')
      .neq('status', 'cancelled')
    const { data: allTows } = await supabase.from('tows')
      .select('created_at').eq('driver_id', driverId).eq('status', 'completed')

    const calc = (cur: any[], prev: any[]): PeriodStats => {
      const total = cur.length, prevTotal = prev.length
      const towsTrend = prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : 0
      const completed = cur.filter(t => t.status === 'completed').length
      const successRate = total > 0 ? Math.round(completed / total * 100) : 0
      const prevCompleted = prev.filter(t => t.status === 'completed').length
      const prevSuccessRate = prevTotal > 0 ? Math.round(prevCompleted / prevTotal * 100) : 0
      const income = cur.reduce((s, t) => s + getTowRevenueContribution(t), 0)
      const prevIncome = prev.reduce((s: number, t: any) => s + getTowRevenueContribution(t), 0)
      return {
        tows: total, towsTrend, successRate,
        successTrend: prevSuccessRate > 0 ? successRate - prevSuccessRate : 0,
        avgTime: 42, timeTrend: -5, income,
        incomeTrend: prevIncome > 0 ? Math.round(((income - prevIncome) / prevIncome) * 100) : 0
      }
    }

    const days = ['א׳','ב׳','ג׳','ד׳','ה׳','ו׳','ש׳']
    const weeklyChart: DailyData[] = days.map((day, idx) => {
      const d = new Date(now)
      d.setDate(now.getDate() - now.getDay() + idx)
      const dateStr = d.toISOString().split('T')[0]
      return {
        day, tows: (weekTows || []).filter(t => t.created_at.startsWith(dateStr)).length,
        isToday: idx === now.getDay()
      }
    })

    const monthlyChart: WeeklyData[] = Array.from({ length: 4 }, (_, week) => {
      const ws = new Date(monthStart)
      ws.setDate(monthStart.getDate() + week * 7)
      const we = new Date(ws)
      we.setDate(ws.getDate() + 6)
      return {
        week: `שבוע ${week + 1}`,
        tows: (monthTows || []).filter(t => {
          const d = new Date(t.created_at); return d >= ws && d <= we
        }).length
      }
    })

    const dayCount: Record<string, number> = {}
    ;(allTows || []).forEach(t => {
      const d = t.created_at.split('T')[0]
      dayCount[d] = (dayCount[d] || 0) + 1
    })
    let maxCount = 0, maxDate = ''
    Object.entries(dayCount).forEach(([date, count]) => {
      if (count > maxCount) { maxCount = count; maxDate = date }
    })

    return {
      week: calc(weekTows || [], prevWeekTows || []),
      month: calc(monthTows || [], prevMonthTows || []),
      weeklyChart, monthlyChart,
      personalBest: {
        count: maxCount,
        date: maxDate ? new Date(maxDate).toLocaleDateString('he-IL', {
          day: 'numeric', month: 'long', year: 'numeric'
        }) : ''
      }
    }
  }

  const updateStatus = async (newStatus: string) => {
    if (!driverInfo?.id) return
    await supabase.from('drivers').update({ status: newStatus }).eq('id', driverInfo.id)
    setDriverInfo(prev => prev ? { ...prev, status: newStatus as any } : null)
    setShowStatusModal(false)
  }

  const handleLogout = async () => {
    await signOut()
    router.push('/login')
  }

  const StatCard = ({
    icon: Icon, value, label, trend, suffix = '', prefix = '', color = 'blue'
  }: {
    icon: any; value: number; label: string; trend?: number;
    suffix?: string; prefix?: string; color?: 'blue' | 'green' | 'orange' | 'purple'
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
        <div className="text-2xl font-bold text-gray-800 mb-0.5">{prefix}{value.toLocaleString()}{suffix}</div>
        <div className="text-sm text-gray-500">{label}</div>
      </div>
    )
  }

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
      </div>
    )
  }

  const currentStatus = statuses.find(s => s.id === driverInfo?.status) || statuses[3]
  const driverName = driverInfo?.user?.full_name || user?.full_name || 'נהג'
  const driverPhone = driverInfo?.user?.phone || ''
  const driverEmail = user?.email || ''
  const currentStats = statsData ? (period === 'month' ? statsData.month : statsData.week) : null
  const chartData = statsData ? (period === 'month' ? statsData.monthlyChart : statsData.weeklyChart) : []
  const maxChartValue = Math.max(...chartData.map(d => d.tows), 1)

  return (
    <div className="min-h-screen bg-gray-50 pb-24" dir="rtl">
      {/* Status Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6">
            <h3 className="text-xl font-bold mb-4 text-center">עדכן סטטוס</h3>
            <div className="space-y-3">
              {statuses.map(status => (
                <button
                  key={status.id}
                  onClick={() => updateStatus(status.id)}
                  className={`w-full p-4 rounded-xl flex items-center gap-3 transition-all ${
                    currentStatus.id === status.id
                      ? 'bg-blue-100 border-2 border-blue-500'
                      : 'bg-gray-50 border-2 border-transparent'
                  }`}
                >
                  <span className="text-2xl">{status.icon}</span>
                  <span className="font-medium text-lg text-gray-800">{status.label}</span>
                  {currentStatus.id === status.id && (
                    <Check className="mr-auto text-blue-500" size={24} />
                  )}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowStatusModal(false)}
              className="w-full mt-4 p-4 bg-gray-100 border border-gray-300 rounded-xl font-medium text-gray-700"
            >
              ביטול
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-5 pt-6 pb-4">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center">
            <User size={28} />
          </div>
          <div>
            <h1 className="text-xl font-bold">{driverName}</h1>
            <p className="text-blue-200 text-sm">נהג גרר</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 bg-white/10 rounded-xl p-1">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'profile' ? 'bg-white text-blue-600' : 'text-white/80'
            }`}
          >
            פרופיל
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'stats' ? 'bg-white text-blue-600' : 'text-white/80'
            }`}
          >
            סטטיסטיקות
          </button>
        </div>
      </div>

      <div className="px-4 py-4 flex flex-col gap-4">

        {/* ===== טאב פרופיל ===== */}
        {activeTab === 'profile' && (
          <>
            <button
              onClick={() => setShowStatusModal(true)}
              className="w-full bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{currentStatus.icon}</span>
                <div className="text-right">
                  <div className="text-sm text-gray-500">הסטטוס שלי</div>
                  <div className="font-bold text-gray-800">{currentStatus.label}</div>
                </div>
              </div>
              <ChevronLeft size={24} className="text-gray-400" />
            </button>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar size={18} className="text-blue-500" />
                  <span className="text-sm text-gray-500">השבוע</span>
                </div>
                <div className="text-2xl font-bold text-gray-800">{profileStats.weekCompleted}</div>
                <div className="text-xs text-gray-400">גרירות</div>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp size={18} className="text-green-500" />
                  <span className="text-sm text-gray-500">החודש</span>
                </div>
                <div className="text-2xl font-bold text-gray-800">{profileStats.monthCompleted}</div>
                <div className="text-xs text-gray-400">גרירות</div>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <Target size={18} className="text-purple-500" />
                  <span className="text-sm text-gray-500">סה"כ</span>
                </div>
                <div className="text-2xl font-bold text-gray-800">{profileStats.totalCompleted}</div>
                <div className="text-xs text-gray-400">גרירות</div>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <Award size={18} className="text-yellow-500" />
                  <span className="text-sm text-gray-500">אחוז השלמה</span>
                </div>
                <div className={`text-2xl font-bold ${profileStats.completionRate >= 80 ? 'text-green-600' : profileStats.completionRate >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {profileStats.completionRate}%
                </div>
                <div className="text-xs text-gray-400">
                  {profileStats.completionRate >= 80 ? 'מצוין!' : profileStats.completionRate >= 50 ? 'טוב' : 'לשפר'}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-800 mb-3">פרטי קשר</h3>
              <div className="space-y-3">
                {driverPhone && (
                  <a href={`tel:${driverPhone}`} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <Phone size={20} className="text-green-600" />
                    </div>
                    <span className="font-medium text-gray-800">{driverPhone}</span>
                    <ChevronLeft size={20} className="mr-auto text-gray-400" />
                  </a>
                )}
                {driverEmail && (
                  <a href={`mailto:${driverEmail}`} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Mail size={20} className="text-blue-600" />
                    </div>
                    <span className="font-medium text-gray-800 text-sm">{driverEmail}</span>
                    <ChevronLeft size={20} className="mr-auto text-gray-400" />
                  </a>
                )}
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="w-full p-4 bg-red-50 border border-red-200 rounded-2xl text-red-600 font-bold flex items-center justify-center gap-2"
            >
              <LogOut size={20} />
              התנתק
            </button>
          </>
        )}

        {/* ===== טאב סטטיסטיקות ===== */}
        {activeTab === 'stats' && (
          <>
            <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100">
              <div className="flex gap-2 bg-gray-100 rounded-xl p-1">
                <button
                  onClick={() => setPeriod('week')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${period === 'week' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}
                >
                  שבוע
                </button>
                <button
                  onClick={() => setPeriod('month')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${period === 'month' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}
                >
                  חודש
                </button>
              </div>
            </div>

            {currentStats && (
              <div className="grid grid-cols-2 gap-3">
                <StatCard icon={Truck} value={currentStats.tows} label={period === 'month' ? 'גרירות החודש' : 'גרירות השבוע'} trend={currentStats.towsTrend} color="blue" />
                <StatCard icon={Award} value={currentStats.successRate} suffix="%" label="הושלמו בהצלחה" trend={currentStats.successTrend} color="green" />
                <StatCard icon={Clock} value={currentStats.avgTime} suffix=" דק׳" label="ממוצע לגרירה" trend={currentStats.timeTrend} color="orange" />
                <StatCard icon={DollarSign} value={currentStats.income} prefix="₪" label={period === 'month' ? 'הכנסות החודש' : 'הכנסות השבוע'} trend={currentStats.incomeTrend} color="purple" />
              </div>
            )}

            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-800 mb-4">
                {period === 'month' ? 'גרירות לפי שבועות' : 'גרירות לפי ימים'}
              </h3>
              <div className="h-48 flex items-end justify-between gap-2">
                {chartData.map((item, index) => {
                  const height = (item.tows / maxChartValue) * 100
                  const isToday = 'isToday' in item && item.isToday
                  return (
                    <div key={index} className="flex-1 flex flex-col items-center gap-2">
                      <span className="text-xs text-gray-500">{item.tows}</span>
                      <div
                        className={`w-full rounded-t-lg ${isToday ? 'bg-blue-500' : 'bg-gray-200'}`}
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

            {statsData && statsData.personalBest.count > 0 && (
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-5 border border-amber-100">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center">
                    <Award className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="font-bold text-gray-800">שיא אישי! 🏆</div>
                    <div className="text-sm text-gray-600">{statsData.personalBest.count} גרירות ביום אחד</div>
                    <div className="text-xs text-gray-500 mt-1">הושג ב-{statsData.personalBest.date}</div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}