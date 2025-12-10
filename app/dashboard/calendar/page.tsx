'use client'

import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../lib/AuthContext'
import { getWeekTows, updateTowSchedule } from '../../lib/queries/calendar'
import { getDrivers } from '../../lib/queries/drivers'
import { TowWithDetails } from '../../lib/queries/tows'
import { DriverWithDetails } from '../../lib/types'
import { 
  ChevronRight,
  ChevronLeft,
  Plus,
  Clock,
  MapPin,
  Truck,
  X,
  GripVertical,
  Check,
  RefreshCw,
  Calendar
} from 'lucide-react'
import Link from 'next/link'

// צבעים לנהגים
const DRIVER_COLORS = [
  '#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444',
  '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#6366f1'
]

// מיפוי סטטוסים
const statusLabels: Record<string, string> = {
  pending: 'ממתינה',
  assigned: 'שובצה',
  in_progress: 'בביצוע',
  completed: 'הושלמה',
  cancelled: 'בוטלה'
}

export default function CalendarPage() {
  const { companyId, loading: authLoading } = useAuth()
  const [view, setView] = useState<'week' | 'day'>('week')
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>([])
  
  // תאריך תחילת שבוע
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date()
    const day = today.getDay()
    const diff = today.getDate() - day
    const weekStart = new Date(today)
    weekStart.setDate(diff)
    weekStart.setHours(0, 0, 0, 0)
    return weekStart
  })

  // תאריך נבחר לתצוגה יומית
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return today
  })
  
  const [drivers, setDrivers] = useState<DriverWithDetails[]>([])
  const [tows, setTows] = useState<TowWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  
  const [selectedTow, setSelectedTow] = useState<TowWithDetails | null>(null)
  const [draggedTow, setDraggedTow] = useState<TowWithDetails | null>(null)
  
  // מודל בחירת נהג
  const [showDriverModal, setShowDriverModal] = useState(false)
  const [pendingSlot, setPendingSlot] = useState<{ date: Date; hour: number } | null>(null)
  const [towToAssign, setTowToAssign] = useState<TowWithDetails | null>(null)

  const hours = Array.from({ length: 24 }, (_, i) => i)

  // זיהוי מובייל
  const [isMobile, setIsMobile] = useState(false)
  
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // טעינת נתונים
  const loadData = async () => {
    if (!companyId) return
    
    try {
      const [driversData, towsData] = await Promise.all([
        getDrivers(companyId),
        getWeekTows(companyId, currentWeekStart)
      ])
      
      setDrivers(driversData)
      setTows(towsData)
    } catch (error) {
      console.error('Error loading calendar data:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (!authLoading) {
      if (companyId) {
        loadData()
      } else {
        setLoading(false)
      }
    }
  }, [companyId, authLoading, currentWeekStart])

  const handleRefresh = () => {
    setRefreshing(true)
    loadData()
  }

  // מיפוי צבעים לנהגים
  const getDriverColor = (driverId: string) => {
    const index = drivers.findIndex(d => d.id === driverId)
    return DRIVER_COLORS[index % DRIVER_COLORS.length] || '#6b7280'
  }

  const getDriverName = (driverId: string) => {
    return drivers.find(d => d.id === driverId)?.user?.full_name || ''
  }

  // יצירת ימי השבוע
  const weekDays = useMemo(() => {
    const days = []
    const today = new Date()
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStart)
      date.setDate(currentWeekStart.getDate() + i)
      const isToday = date.toDateString() === today.toDateString()
      days.push({
        day: ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'][date.getDay()],
        date: date.getDate().toString(),
        fullDate: date,
        isToday,
        dayIndex: i
      })
    }
    return days
  }, [currentWeekStart])

  // ימים להצגה - 3 במובייל, 7 בדסקטופ
  const [mobileStartIndex, setMobileStartIndex] = useState(0)
  
  useEffect(() => {
    // מתחילים מהיום הנוכחי במובייל
    const todayIndex = weekDays.findIndex(d => d.isToday)
    if (todayIndex !== -1) {
      setMobileStartIndex(Math.max(0, Math.min(todayIndex, 4))) // מקסימום 4 כדי להציג 3 ימים
    }
  }, [weekDays])

  const displayedDays = useMemo(() => {
    if (!isMobile) return weekDays
    return weekDays.slice(mobileStartIndex, mobileStartIndex + 3)
  }, [weekDays, isMobile, mobileStartIndex])

  // בדיקה אם "הכל" נבחר - אם הרשימה ריקה = הכל נבחר
  const isAllSelected = selectedDrivers.length === 0

  // פילטור נהגים - תוקן!
  const toggleDriver = (driverId: string) => {
    if (driverId === 'all') {
      setSelectedDrivers([])
    } else {
      setSelectedDrivers(prev => {
        if (prev.includes(driverId)) {
          return prev.filter(d => d !== driverId)
        } else {
          return [...prev, driverId]
        }
      })
    }
  }

  const isDriverSelected = (driverId: string) => 
    isAllSelected || selectedDrivers.includes(driverId)

  // פילטור גרירות - תוקן!
  const filteredTows = useMemo(() => {
    if (isAllSelected) {
      return tows
    }
    return tows.filter(t => t.driver_id && selectedDrivers.includes(t.driver_id))
  }, [tows, selectedDrivers, isAllSelected])

  // גרירות לתצוגה יומית
  const dayFilteredTows = useMemo(() => {
    return filteredTows.filter(tow => {
      const towDate = new Date(tow.scheduled_at || tow.created_at)
      return towDate.toDateString() === selectedDate.toDateString()
    })
  }, [filteredTows, selectedDate])

  // חישוב מיקום גרירה בלוח
  const getTowPosition = (tow: TowWithDetails) => {
    const towDate = new Date(tow.scheduled_at || tow.created_at)
    const dayIndex = weekDays.findIndex(d => 
      d.fullDate.toDateString() === towDate.toDateString()
    )
    const hour = towDate.getHours() + towDate.getMinutes() / 60
    
    return { dayIndex, hour }
  }

  // קבלת מידע מהגרירה
  const getRoute = (tow: TowWithDetails) => {
    if (tow.legs && tow.legs.length > 0) {
      const firstLeg = tow.legs.find(l => l.from_address)
      const lastLeg = [...tow.legs].reverse().find(l => l.to_address)
      return {
        from: firstLeg?.from_address?.split(',')[0] || '-',
        to: lastLeg?.to_address?.split(',')[0] || '-'
      }
    }
    return { from: '-', to: '-' }
  }

  const getFirstVehicle = (tow: TowWithDetails) => {
    return tow.vehicles?.[0]?.plate_number || '-'
  }

  // ניווט בין שבועות
  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentWeekStart)
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7))
    newDate.setHours(0, 0, 0, 0)
    setCurrentWeekStart(newDate)
  }

  const goToToday = () => {
    const today = new Date()
    const day = today.getDay()
    const diff = today.getDate() - day
    const weekStart = new Date(today)
    weekStart.setDate(diff)
    weekStart.setHours(0, 0, 0, 0)
    setCurrentWeekStart(weekStart)
    
    const todayClean = new Date()
    todayClean.setHours(0, 0, 0, 0)
    setSelectedDate(todayClean)
  }

  const getMonthYear = () => {
    const months = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']
    return `${months[currentWeekStart.getMonth()]} ${currentWeekStart.getFullYear()}`
  }

  const getCurrentTime = () => {
    const now = new Date()
    return now.getHours() + now.getMinutes() / 60
  }

  // Drag & Drop
  const handleDragStart = (e: React.DragEvent, tow: TowWithDetails) => {
    setDraggedTow(tow)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', tow.id)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = async (e: React.DragEvent, dayIndex: number, hour: number, driverId?: string) => {
    e.preventDefault()
    if (!draggedTow) return

    const targetDate = view === 'week' ? weekDays[dayIndex].fullDate : selectedDate
    const newDate = new Date(targetDate)
    newDate.setHours(Math.floor(hour), (hour % 1) * 60, 0, 0)

    try {
      await updateTowSchedule(draggedTow.id, newDate, driverId)
      
      setTows(tows.map(t => 
        t.id === draggedTow.id 
          ? { 
              ...t, 
              scheduled_at: newDate.toISOString(),
              driver_id: driverId || t.driver_id
            }
          : t
      ))
    } catch (error) {
      console.error('Error updating tow schedule:', error)
    }
    
    setDraggedTow(null)
  }

  // פתיחת מודל בחירת נהג למשבצת ריקה
  const handleSlotClick = (date: Date, hour: number) => {
    const slotDate = new Date(date)
    slotDate.setHours(hour, 0, 0, 0)
    setPendingSlot({ date: slotDate, hour })
    setTowToAssign(null)
    setShowDriverModal(true)
  }

  // פתיחת מודל לשיבוץ נהג לגרירה קיימת
  const handleAssignDriver = (tow: TowWithDetails) => {
    setTowToAssign(tow)
    setPendingSlot(null)
    setShowDriverModal(true)
  }

  // בחירת נהג - מעביר לטופס או משבץ לגרירה קיימת
  const handleDriverSelect = async (driverId: string) => {
    if (pendingSlot) {
      // יצירת גרירה חדשה - מעביר לטופס עם הפרמטרים
      const dateStr = pendingSlot.date.toISOString().split('T')[0]
      const timeStr = `${pendingSlot.hour.toString().padStart(2, '0')}:00`
      window.location.href = `/dashboard/tows/new?date=${dateStr}&time=${timeStr}&driver=${driverId}`
    } else if (towToAssign) {
      // שיבוץ נהג לגרירה קיימת
      try {
        await updateTowSchedule(towToAssign.id, new Date(towToAssign.scheduled_at || towToAssign.created_at), driverId)
        setTows(tows.map(t => 
          t.id === towToAssign.id ? { ...t, driver_id: driverId } : t
        ))
        setShowDriverModal(false)
        setTowToAssign(null)
      } catch (error) {
        console.error('Error assigning driver:', error)
      }
    }
  }

  // סגירת מודל בחירת נהג
  const closeDriverModal = () => {
    setShowDriverModal(false)
    setPendingSlot(null)
    setTowToAssign(null)
  }

  // בחירת יום לתצוגה יומית
  const selectDay = (date: Date) => {
    setSelectedDate(date)
    setView('day')
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="flex items-center gap-2 text-gray-500">
          <RefreshCw className="animate-spin" size={20} />
          <span>טוען...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="pb-6">
      {/* Header */}
      <div className="flex flex-col gap-4 mb-4">
        {/* Top Row - Title and Navigation */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-800">יומן גרירות</h1>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="רענן"
            >
              <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
            </button>
            
            <Link
              href="/dashboard/tows/new"
              className="hidden sm:flex items-center gap-2 px-4 py-2 bg-[#33d4ff] text-white rounded-xl text-sm font-medium hover:bg-[#21b8e6]"
            >
              <Plus size={18} />
              גרירה חדשה
            </Link>
          </div>
        </div>

        {/* Navigation Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => navigateWeek('prev')}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ChevronRight size={20} className="text-gray-600" />
            </button>
            <span className="text-base sm:text-lg font-medium text-gray-700 min-w-[120px] text-center">
              {getMonthYear()}
            </span>
            <button 
              onClick={() => navigateWeek('next')}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ChevronLeft size={20} className="text-gray-600" />
            </button>
            <button 
              onClick={goToToday}
              className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-medium"
            >
              היום
            </button>
          </div>

          {/* View Toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setView('day')}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                view === 'day' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-600'
              }`}
            >
              יום
            </button>
            <button
              onClick={() => setView('week')}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                view === 'week' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-600'
              }`}
            >
              שבוע
            </button>
          </div>
        </div>
        
        {/* Mobile Add Button */}
        <Link
          href="/dashboard/tows/new"
          className="sm:hidden flex items-center justify-center gap-2 px-4 py-3 bg-[#33d4ff] text-white rounded-xl font-medium w-full"
        >
          <Plus size={20} />
          גרירה חדשה
        </Link>
      </div>

      {/* Driver Filter */}
      {drivers.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 mb-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-500">נהגים:</span>
            <button
              onClick={() => toggleDriver('all')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors border-2 ${
                isAllSelected
                  ? 'border-[#33d4ff] bg-[#33d4ff]/10 text-[#33d4ff]'
                  : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300'
              }`}
            >
              <span className="font-medium">הכל</span>
              {isAllSelected && <Check size={16} />}
            </button>
            {drivers.map((driver, index) => {
              const color = DRIVER_COLORS[index % DRIVER_COLORS.length]
              const selected = selectedDrivers.includes(driver.id)
              return (
                <button
                  key={driver.id}
                  onClick={() => toggleDriver(driver.id)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all border-2"
                  style={{
                    backgroundColor: selected ? color + '20' : '#f3f4f6',
                    color: selected ? color : '#6b7280',
                    borderColor: selected ? color : 'transparent'
                  }}
                >
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }}></div>
                  <span className="font-medium hidden sm:inline">{driver.user?.full_name}</span>
                  <span className="font-medium sm:hidden">{driver.user?.full_name?.split(' ')[0]}</span>
                  {selected && <Check size={14} />}
                </button>
              )
            })}
          </div>
          {!isAllSelected && (
            <p className="text-xs text-gray-500 mt-2">{selectedDrivers.length} נהגים נבחרו</p>
          )}
        </div>
      )}

      {/* Calendar Grid */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Week View */}
        {view === 'week' && (
          <div>
            {/* Mobile Day Navigation */}
            {isMobile && (
              <div className="flex items-center justify-between p-2 border-b border-gray-200 bg-gray-50">
                <button
                  onClick={() => setMobileStartIndex(Math.max(0, mobileStartIndex - 1))}
                  disabled={mobileStartIndex === 0}
                  className="p-2 rounded-lg hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={20} />
                </button>
                <span className="text-sm text-gray-600">
                  {displayedDays[0]?.day} - {displayedDays[displayedDays.length - 1]?.day}
                </span>
                <button
                  onClick={() => setMobileStartIndex(Math.min(4, mobileStartIndex + 1))}
                  disabled={mobileStartIndex >= 4}
                  className="p-2 rounded-lg hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={20} />
                </button>
              </div>
            )}
            
            {/* Days Header */}
            <div className={`grid border-b border-gray-200 sticky top-0 bg-white z-20 ${isMobile ? 'grid-cols-4' : 'grid-cols-8'}`}>
              <div className="p-2 sm:p-3 text-center text-sm text-gray-500 border-l border-gray-200">
                <Clock size={16} className="mx-auto" />
              </div>
              {displayedDays.map((day, idx) => (
                <button
                  key={idx}
                  onClick={() => selectDay(day.fullDate)}
                  className={`p-2 sm:p-3 text-center border-l border-gray-200 hover:bg-gray-50 transition-colors ${
                    day.isToday ? 'bg-[#33d4ff]/10' : ''
                  }`}
                >
                  <p className="text-xs sm:text-sm text-gray-500">{isMobile ? day.day.slice(0, 3) : day.day}</p>
                  <p className={`text-lg sm:text-xl font-bold ${day.isToday ? 'text-[#33d4ff]' : 'text-gray-800'}`}>
                    {day.date}
                  </p>
                </button>
              ))}
            </div>

            {/* Time Grid */}
            <div className="relative">
              {hours.map((hour) => (
                <div key={hour} className={`grid border-b border-gray-100 ${isMobile ? 'grid-cols-4' : 'grid-cols-8'}`} style={{ height: '50px' }}>
                  <div className="p-1 sm:p-2 text-xs sm:text-sm text-gray-400 text-center border-l border-gray-200 flex items-start justify-center">
                    {hour.toString().padStart(2, '0')}:00
                  </div>
                  {displayedDays.map((day, dayIdx) => {
                    return (
                      <div
                        key={dayIdx}
                        onClick={() => handleSlotClick(day.fullDate, hour)}
                        className={`border-l border-gray-100 hover:bg-[#33d4ff]/5 cursor-pointer transition-colors relative group ${
                          day.isToday ? 'bg-[#33d4ff]/5' : ''
                        }`}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, day.dayIndex, hour)}
                      >
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="w-6 h-6 bg-[#33d4ff] rounded-full flex items-center justify-center shadow-lg">
                            <Plus size={14} className="text-white" />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}

              {/* Tow Events */}
                <div className={`absolute top-0 left-0 bottom-0 pointer-events-none ${isMobile ? 'right-[25%]' : 'right-[12.5%]'}`}>
                  {filteredTows.map((tow) => {
                    const { dayIndex, hour } = getTowPosition(tow)
                    
                    // בדיקה אם היום מוצג במובייל
                    const displayIndex = displayedDays.findIndex(d => d.dayIndex === dayIndex)
                    if (displayIndex === -1) return null
                    
                    const top = hour * 50
                    const height = 50
                    const numDays = isMobile ? 3 : 7
                    const dayWidth = 100 / numDays
                    const right = displayIndex * dayWidth
                    const driverColor = tow.driver_id ? getDriverColor(tow.driver_id) : '#6b7280'
                    const route = getRoute(tow)

                    return (
                      <div
                        key={tow.id}
                        draggable={!isMobile}
                        onDragStart={(e) => handleDragStart(e, tow)}
                        onClick={(e) => { 
                          e.stopPropagation()
                          if (!tow.driver_id) {
                            handleAssignDriver(tow)
                          } else {
                            setSelectedTow(tow)
                          }
                        }}
                        className={`absolute pointer-events-auto cursor-grab active:cursor-grabbing rounded-lg p-1 sm:p-2 text-xs text-white overflow-hidden shadow-sm hover:shadow-lg hover:scale-[1.02] transition-all border-r-4 ${
                          draggedTow?.id === tow.id ? 'opacity-50' : ''
                        } ${!tow.driver_id ? 'animate-pulse ring-2 ring-white ring-offset-1' : ''}`}
                        style={{
                          top: `${top}px`,
                          height: `${Math.max(height - 4, 20)}px`,
                          right: `${right + 0.3}%`,
                          width: `${dayWidth - 0.6}%`,
                          backgroundColor: driverColor,
                          borderRightColor: driverColor,
                        }}
                      >
                        {!tow.driver_id && (
                          <div className="absolute top-0 left-0 bg-white text-gray-600 text-[8px] px-1 rounded-br font-bold">
                            לשיבוץ
                          </div>
                        )}
                        <div className="font-bold truncate text-[10px] sm:text-xs">
                          {tow.customer?.name || 'ללא לקוח'}
                        </div>
                        <div className="truncate opacity-90 text-[9px] sm:text-[11px] hidden sm:block">
                          {route.from} ← {route.to}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Current Time Line */}
                {weekDays.some(d => d.isToday) && (
                  <div
                    className="absolute right-0 left-0 border-t-2 border-red-500 z-10 pointer-events-none"
                    style={{ top: `${getCurrentTime() * 50}px` }}
                  >
                    <div className="absolute right-0 w-3 h-3 bg-red-500 rounded-full -mt-1.5 -mr-1.5"></div>
                  </div>
                )}
              </div>
          </div>
        )}

        {/* Day View */}
        {view === 'day' && (
          <div>
            {/* Day Header */}
            <div className="p-4 border-b border-gray-200 bg-[#33d4ff]/10">
              <p className="text-center">
                <span className="text-base sm:text-lg text-gray-600">
                  {['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'][selectedDate.getDay()]},{' '}
                </span>
                <span className="text-xl sm:text-2xl font-bold text-[#33d4ff]">
                  {selectedDate.getDate()} ב{getMonthYear()}
                </span>
              </p>
            </div>

            {/* Time Grid for Day View */}
            <div className="overflow-x-auto">
              <div className="min-w-[300px]">
                <div className="relative">
                  {hours.map((hour) => {
                    return (
                      <div
                        key={hour}
                        className="flex border-b border-gray-100 group"
                        style={{ height: '60px' }}
                      >
                        <div className="w-16 sm:w-20 p-2 text-sm text-gray-400 text-center border-l border-gray-200 flex-shrink-0">
                          {hour.toString().padStart(2, '0')}:00
                        </div>
                        <div 
                          onClick={() => handleSlotClick(selectedDate, hour)}
                          className="flex-1 hover:bg-[#33d4ff]/5 cursor-pointer transition-colors relative"
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, 0, hour)}
                        >
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="w-7 h-7 bg-[#33d4ff] rounded-full flex items-center justify-center shadow-lg">
                              <Plus size={16} className="text-white" />
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}

                  {/* Day View Tow Events - תוקן! */}
                  <div className="absolute top-0 right-16 sm:right-20 left-0 bottom-0 pointer-events-none">
                    {dayFilteredTows.map((tow) => {
                      const towDate = new Date(tow.scheduled_at || tow.created_at)
                      const hour = towDate.getHours() + towDate.getMinutes() / 60
                      const top = hour * 60
                      const driverColor = tow.driver_id ? getDriverColor(tow.driver_id) : '#6b7280'
                      const route = getRoute(tow)

                      return (
                        <div
                          key={tow.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, tow)}
                          onClick={(e) => { 
                            e.stopPropagation()
                            if (!tow.driver_id) {
                              handleAssignDriver(tow)
                            } else {
                              setSelectedTow(tow)
                            }
                          }}
                          className={`absolute pointer-events-auto cursor-grab active:cursor-grabbing rounded-lg p-2 sm:p-3 text-white overflow-hidden shadow-md hover:shadow-lg transition-all border-r-4 ${
                            draggedTow?.id === tow.id ? 'opacity-50' : ''
                          } ${!tow.driver_id ? 'animate-pulse ring-2 ring-white ring-offset-1' : ''}`}
                          style={{
                            top: `${top}px`,
                            height: '56px',
                            right: '4px',
                            left: '4px',
                            backgroundColor: driverColor,
                            borderRightColor: driverColor,
                          }}
                        >
                          {!tow.driver_id && (
                            <div className="absolute top-0 left-0 bg-white text-gray-600 text-[10px] px-1.5 py-0.5 rounded-br font-bold">
                              לשיבוץ
                            </div>
                          )}
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="font-bold truncate text-sm">
                                {tow.customer?.name || 'ללא לקוח'}
                              </div>
                              <div className="truncate opacity-90 text-xs">
                                {route.from} ← {route.to}
                              </div>
                            </div>
                            <div className="text-xs opacity-80 mr-2">
                              {towDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Current Time Line */}
                  {selectedDate.toDateString() === new Date().toDateString() && (
                    <div
                      className="absolute right-0 left-0 border-t-2 border-red-500 z-10 pointer-events-none"
                      style={{ top: `${getCurrentTime() * 60}px` }}
                    >
                      <div className="absolute right-0 w-3 h-3 bg-red-500 rounded-full -mt-1.5 -mr-1.5"></div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Empty State */}
      {tows.length === 0 && !loading && (
        <div className="mt-6 text-center py-12 bg-white rounded-xl border border-gray-200">
          <Truck size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 mb-4">אין גרירות מתוזמנות לשבוע זה</p>
          <Link
            href="/dashboard/tows/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#33d4ff] text-white rounded-xl text-sm font-medium hover:bg-[#21b8e6]"
          >
            <Plus size={18} />
            צור גרירה חדשה
          </Link>
        </div>
      )}

      {/* Instructions - Hidden on mobile */}
      <div className="mt-4 hidden sm:grid sm:grid-cols-3 gap-3 text-sm">
        <div className="p-3 bg-[#33d4ff]/10 border border-[#33d4ff]/30 rounded-xl flex items-center gap-3">
          <div className="w-8 h-8 bg-[#33d4ff] rounded-full flex items-center justify-center flex-shrink-0">
            <Plus size={16} className="text-white" />
          </div>
          <p className="text-gray-700"><strong>הוספה:</strong> לחץ על משבצת</p>
        </div>
        <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl flex items-center gap-3">
          <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
            <GripVertical size={16} className="text-white" />
          </div>
          <p className="text-gray-700"><strong>הזזה:</strong> גרור לשעה אחרת</p>
        </div>
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3">
          <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0">
            <Calendar size={16} className="text-white" />
          </div>
          <p className="text-gray-700"><strong>יום:</strong> לחץ על תאריך</p>
        </div>
      </div>

      {/* Tow Detail Modal */}
      {selectedTow && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white w-full sm:rounded-2xl sm:max-w-md sm:mx-4 overflow-hidden rounded-t-2xl max-h-[90vh] overflow-y-auto">
            <div
              className="px-5 py-4 text-white flex items-center justify-between sticky top-0"
              style={{ backgroundColor: selectedTow.driver_id ? getDriverColor(selectedTow.driver_id) : '#6b7280' }}
            >
              <div>
                <h2 className="font-bold text-lg">{selectedTow.customer?.name || 'ללא לקוח'}</h2>
                <p className="text-white/80 text-sm">
                  {selectedTow.driver_id ? getDriverName(selectedTow.driver_id) : 'לא שובץ נהג'}
                </p>
              </div>
              <button onClick={() => setSelectedTow(null)} className="p-2 hover:bg-white/20 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <Truck size={20} className="text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">רכב</p>
                  <p className="font-mono font-medium text-gray-800">{getFirstVehicle(selectedTow)}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <MapPin size={20} className="text-gray-400" />
                <div className="flex-1">
                  <p className="text-sm text-gray-500">מסלול</p>
                  <p className="font-medium text-gray-800">
                    {getRoute(selectedTow).from} ← {getRoute(selectedTow).to}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <Clock size={20} className="text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">זמן מתוזמן</p>
                  <p className="font-medium text-gray-800">
                    {new Date(selectedTow.scheduled_at || selectedTow.created_at).toLocaleString('he-IL')}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <div className="w-5 h-5 rounded-full" style={{ 
                  backgroundColor: selectedTow.status === 'completed' ? '#22c55e' : 
                    selectedTow.status === 'in_progress' ? '#3b82f6' : 
                    selectedTow.status === 'pending' ? '#f59e0b' : '#6b7280'
                }}></div>
                <div>
                  <p className="text-sm text-gray-500">סטטוס</p>
                  <p className="font-medium text-gray-800">{statusLabels[selectedTow.status]}</p>
                </div>
              </div>
            </div>

            <div className="flex gap-3 px-5 py-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setSelectedTow(null)}
                className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-100"
              >
                סגור
              </button>
              <Link
                href={`/dashboard/tows/${selectedTow.id}`}
                className="flex-1 py-3 bg-[#33d4ff] text-white rounded-xl font-medium hover:bg-[#21b8e6] text-center"
              >
                פרטים מלאים
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Driver Selection Modal */}
      {showDriverModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white w-full sm:rounded-2xl sm:max-w-md sm:mx-4 overflow-hidden rounded-t-2xl max-h-[80vh] overflow-y-auto">
            <div className="px-5 py-4 bg-[#33d4ff] text-white flex items-center justify-between sticky top-0">
              <div>
                <h2 className="font-bold text-lg">
                  {towToAssign ? 'שיבוץ נהג לגרירה' : 'בחר נהג'}
                </h2>
                <p className="text-white/80 text-sm">
                  {pendingSlot && (
                    <>
                      {['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'][pendingSlot.date.getDay()]},{' '}
                      {pendingSlot.date.toLocaleDateString('he-IL')} בשעה {pendingSlot.hour.toString().padStart(2, '0')}:00
                    </>
                  )}
                  {towToAssign && (
                    <>
                      {towToAssign.customer?.name || 'ללא לקוח'}
                    </>
                  )}
                </p>
              </div>
              <button onClick={closeDriverModal} className="p-2 hover:bg-white/20 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <div className="p-4 space-y-2">
              {drivers.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Truck size={40} className="mx-auto mb-3 text-gray-300" />
                  <p>אין נהגים במערכת</p>
                  <Link 
                    href="/dashboard/drivers" 
                    className="text-[#33d4ff] hover:underline text-sm mt-2 inline-block"
                  >
                    הוסף נהגים
                  </Link>
                </div>
              ) : (
                <>
                  {/* רשימת נהגים עם מספר גרירות היום */}
                  {drivers.map((driver, index) => {
                    const color = DRIVER_COLORS[index % DRIVER_COLORS.length]
                    const targetDate = pendingSlot?.date || (towToAssign ? new Date(towToAssign.scheduled_at || towToAssign.created_at) : new Date())
                    const driverTowsToday = tows.filter(t => {
                      if (t.driver_id !== driver.id) return false
                      const towDate = new Date(t.scheduled_at || t.created_at)
                      return towDate.toDateString() === targetDate.toDateString()
                    })
                    const towCount = driverTowsToday.length
                    
                    return (
                      <button
                        key={driver.id}
                        onClick={() => handleDriverSelect(driver.id)}
                        className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-gray-100 hover:border-[#33d4ff] hover:bg-[#33d4ff]/5 transition-all text-right"
                      >
                        <div 
                          className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
                          style={{ backgroundColor: color }}
                        >
                          {driver.user?.full_name?.charAt(0) || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-800">{driver.user?.full_name}</p>
                          <p className="text-sm text-gray-500">{driver.user?.phone || 'אין טלפון'}</p>
                        </div>
                        <div className="text-left flex-shrink-0">
                          {towCount === 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                              פנוי
                            </span>
                          ) : towCount <= 3 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                              <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                              {towCount} גרירות
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                              <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                              {towCount} גרירות
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                  
                  {/* אפשרות ללא נהג */}
                  {pendingSlot && (
                    <div className="pt-2 border-t border-gray-200 mt-3">
                      <Link
                        href={`/dashboard/tows/new?date=${pendingSlot.date.toISOString().split('T')[0]}&time=${pendingSlot.hour.toString().padStart(2, '0')}:00`}
                        className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-gray-300 hover:border-gray-400 hover:bg-gray-50 transition-all text-gray-500"
                      >
                        <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                          <Plus size={20} className="text-gray-400" />
                        </div>
                        <div>
                          <p className="font-medium">ללא נהג</p>
                          <p className="text-sm">שיבוץ מאוחר יותר</p>
                        </div>
                      </Link>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="px-5 py-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={closeDriverModal}
                className="w-full py-3 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-100"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}