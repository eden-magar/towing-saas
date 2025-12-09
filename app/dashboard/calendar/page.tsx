'use client'

import { useState, useEffect } from 'react'
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
  RefreshCw
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
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>(['all'])
  
  // תיקון: יצירת תאריך תחילת שבוע בצורה נכונה
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date()
    const day = today.getDay()
    const diff = today.getDate() - day
    const weekStart = new Date(today)
    weekStart.setDate(diff)
    weekStart.setHours(0, 0, 0, 0)
    return weekStart
  })
  
  const [drivers, setDrivers] = useState<DriverWithDetails[]>([])
  const [tows, setTows] = useState<TowWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  
  const [selectedTow, setSelectedTow] = useState<TowWithDetails | null>(null)
  const [draggedTow, setDraggedTow] = useState<TowWithDetails | null>(null)

  const hours = Array.from({ length: 24 }, (_, i) => i) // 00:00 - 23:00

  // טעינת נתונים
  const loadData = async () => {
    if (!companyId) return
    
    try {
      console.log('Loading calendar data for company:', companyId)
      console.log('Week start:', currentWeekStart.toISOString())
      
      const [driversData, towsData] = await Promise.all([
        getDrivers(companyId),
        getWeekTows(companyId, currentWeekStart)
      ])
      
      console.log('Loaded drivers:', driversData.length)
      console.log('Loaded tows:', towsData.length)
      towsData.forEach(t => {
        console.log(`Tow ${t.id}: scheduled_at=${t.scheduled_at}, created_at=${t.created_at}`)
      })
      
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
  const getWeekDays = () => {
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
  }

  const weekDays = getWeekDays()

  // פילטור נהגים
  const toggleDriver = (driverId: string) => {
    if (driverId === 'all') {
      setSelectedDrivers(['all'])
    } else {
      let newSelection: string[]
      if (selectedDrivers.includes('all')) {
        newSelection = [driverId]
      } else if (selectedDrivers.includes(driverId)) {
        newSelection = selectedDrivers.filter(d => d !== driverId)
        if (newSelection.length === 0) newSelection = ['all']
      } else {
        newSelection = [...selectedDrivers, driverId]
      }
      if (newSelection.length === drivers.length) newSelection = ['all']
      setSelectedDrivers(newSelection)
    }
  }

  const isDriverSelected = (driverId: string) => 
    selectedDrivers.includes('all') || selectedDrivers.includes(driverId)

  // פילטור גרירות
  const filteredTows = selectedDrivers.includes('all') 
    ? tows 
    : tows.filter(t => t.driver_id && selectedDrivers.includes(t.driver_id))

  // חישוב מיקום גרירה בלוח - תיקון!
  const getTowPosition = (tow: TowWithDetails) => {
    const towDate = new Date(tow.scheduled_at || tow.created_at)
    const dayIndex = weekDays.findIndex(d => 
      d.fullDate.toDateString() === towDate.toDateString()
    )
    const hour = towDate.getHours() + towDate.getMinutes() / 60
    
    console.log(`getTowPosition for tow ${tow.id}: dayIndex=${dayIndex}, hour=${hour}, towDate=${towDate.toISOString()}`)
    
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

  // ניווט בין שבועות - תיקון
  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentWeekStart)
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7))
    newDate.setHours(0, 0, 0, 0)
    setCurrentWeekStart(newDate)
  }

  // תיקון goToToday
  const goToToday = () => {
    const today = new Date()
    const day = today.getDay()
    const diff = today.getDate() - day
    const weekStart = new Date(today)
    weekStart.setDate(diff)
    weekStart.setHours(0, 0, 0, 0)
    setCurrentWeekStart(weekStart)
  }

  const getMonthYear = () => {
    const months = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']
    return `${months[currentWeekStart.getMonth()]} ${currentWeekStart.getFullYear()}`
  }

  const getCurrentTime = () => {
    const now = new Date()
    return now.getHours() + now.getMinutes() / 60
  }

  const formatHour = (hour: number) => {
    const h = Math.floor(hour)
    const m = Math.round((hour % 1) * 60)
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
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

    const newDate = new Date(weekDays[dayIndex].fullDate)
    newDate.setHours(Math.floor(hour), (hour % 1) * 60, 0, 0)

    try {
      await updateTowSchedule(draggedTow.id, newDate, driverId)
      
      // עדכון מקומי
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

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex items-center gap-2 text-gray-500">
          <RefreshCw className="animate-spin" size={20} />
          <span>טוען...</span>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">יומן גרירות</h1>
            <div className="flex items-center gap-1">
              <button 
                onClick={() => navigateWeek('prev')}
                className="p-2 hover:bg-gray-100 rounded-lg"
                title="שבוע קודם"
              >
                <ChevronRight size={20} className="text-gray-600" />
              </button>
              <span className="text-lg font-medium text-gray-700 min-w-[140px] text-center">{getMonthYear()}</span>
              <button 
                onClick={() => navigateWeek('next')}
                className="p-2 hover:bg-gray-100 rounded-lg"
                title="שבוע הבא"
              >
                <ChevronLeft size={20} className="text-gray-600" />
              </button>
            </div>
            <button 
              onClick={goToToday}
              className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-medium"
            >
              היום
            </button>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="רענן"
            >
              <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>

          <div className="flex items-center gap-3">
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

            <Link
              href="/dashboard/tows/new"
              className="hidden lg:flex items-center gap-2 px-4 py-2 bg-[#33d4ff] text-white rounded-xl text-sm font-medium hover:bg-[#21b8e6]"
            >
              <Plus size={18} />
              גרירה חדשה
            </Link>
          </div>
        </div>
        
        {/* Mobile Add Button */}
        <Link
          href="/dashboard/tows/new"
          className="lg:hidden flex items-center justify-center gap-2 px-4 py-3 bg-[#33d4ff] text-white rounded-xl font-medium w-full"
        >
          <Plus size={20} />
          גרירה חדשה
        </Link>
      </div>

      {/* Driver Filter */}
      {drivers.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 mb-4">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="text-sm text-gray-500">נהגים:</span>
            <button
              onClick={() => toggleDriver('all')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors border-2 ${
                selectedDrivers.includes('all')
                  ? 'border-[#33d4ff] bg-[#33d4ff]/10 text-[#33d4ff]'
                  : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300'
              }`}
            >
              <span className="font-medium">הכל</span>
              {selectedDrivers.includes('all') && <Check size={16} />}
            </button>
            <div className="w-px h-6 bg-gray-200 hidden sm:block"></div>
            {drivers.map((driver, index) => {
              const color = DRIVER_COLORS[index % DRIVER_COLORS.length]
              return (
                <button
                  key={driver.id}
                  onClick={() => toggleDriver(driver.id)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all border-2"
                  style={{
                    backgroundColor: isDriverSelected(driver.id) ? color + '20' : '#f3f4f6',
                    color: isDriverSelected(driver.id) ? color : '#6b7280',
                    borderColor: isDriverSelected(driver.id) && !selectedDrivers.includes('all') ? color : 'transparent'
                  }}
                >
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }}></div>
                  <span className="font-medium hidden sm:inline">{driver.user?.full_name}</span>
                  <span className="font-medium sm:hidden">{driver.user?.full_name?.split(' ')[0]}</span>
                  {isDriverSelected(driver.id) && !selectedDrivers.includes('all') && <Check size={14} />}
                </button>
              )
            })}
          </div>
          {!selectedDrivers.includes('all') && (
            <p className="text-xs text-gray-500 mt-2">{selectedDrivers.length} נהגים נבחרו</p>
          )}
        </div>
      )}

      {/* Calendar Grid */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Week View */}
        {view === 'week' && (
          <div className="overflow-x-auto">
            <div className="min-w-[800px]">
              {/* Days Header */}
              <div className="grid grid-cols-8 border-b border-gray-200 sticky top-0 bg-white z-20">
                <div className="p-3 text-center text-sm text-gray-500 border-l border-gray-200">
                  <Clock size={16} className="mx-auto" />
                </div>
                {weekDays.map((day, idx) => (
                  <div
                    key={idx}
                    className={`p-3 text-center border-l border-gray-200 ${day.isToday ? 'bg-[#33d4ff]/10' : ''}`}
                  >
                    <p className="text-sm text-gray-500">{day.day}</p>
                    <p className={`text-xl font-bold ${day.isToday ? 'text-[#33d4ff]' : 'text-gray-800'}`}>
                      {day.date}
                    </p>
                  </div>
                ))}
              </div>

              {/* Time Grid */}
              <div className="relative">
                {hours.map((hour) => (
                  <div key={hour} className="grid grid-cols-8 border-b border-gray-100" style={{ height: '60px' }}>
                    <div className="p-2 text-sm text-gray-400 text-center border-l border-gray-200 flex items-start justify-center">
                      {hour.toString().padStart(2, '0')}:00
                    </div>
                    {weekDays.map((day, dayIdx) => {
                      // יצירת URL עם פרמטרים של תאריך ושעה
                      const dateStr = day.fullDate.toISOString().split('T')[0] // YYYY-MM-DD
                      const timeStr = `${hour.toString().padStart(2, '0')}:00`
                      const newTowUrl = `/dashboard/tows/new?date=${dateStr}&time=${timeStr}`
                      
                      return (
                        <div
                          key={dayIdx}
                          className={`border-l border-gray-100 hover:bg-[#33d4ff]/5 cursor-pointer transition-colors relative group ${
                            day.isToday ? 'bg-[#33d4ff]/5' : ''
                          }`}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, dayIdx, hour)}
                        >
                          <Link
                            href={newTowUrl}
                            className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <div className="w-7 h-7 bg-[#33d4ff] rounded-full flex items-center justify-center shadow-lg">
                              <Plus size={16} className="text-white" />
                            </div>
                          </Link>
                        </div>
                      )
                    })}
                  </div>
                ))}

                {/* Tow Events - תיקון! הסרת הגבלת שעות */}
                <div className="absolute top-0 right-[12.5%] left-0 bottom-0 pointer-events-none">
                  {filteredTows.map((tow) => {
                    const { dayIndex, hour } = getTowPosition(tow)
                    
                    // תיקון: בדיקה רק אם היום קיים בשבוע
                    if (dayIndex === -1) {
                      console.log(`Tow ${tow.id} not displayed: dayIndex is -1`)
                      return null
                    }
                    
                    // תיקון: הסרת הגבלת השעות 6-20, מציגים את כל הגרירות
                    const top = hour * 60
                    const height = 60 // שעה אחת כברירת מחדל
                    const dayWidth = 100 / 7
                    const right = dayIndex * dayWidth
                    const driverColor = tow.driver_id ? getDriverColor(tow.driver_id) : '#6b7280'
                    const route = getRoute(tow)

                    console.log(`Rendering tow ${tow.id}: top=${top}px, right=${right}%, dayIndex=${dayIndex}, hour=${hour}`)

                    return (
                      <div
                        key={tow.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, tow)}
                        onClick={(e) => { e.stopPropagation(); setSelectedTow(tow) }}
                        className={`absolute pointer-events-auto cursor-grab active:cursor-grabbing rounded-lg p-1.5 sm:p-2 text-xs text-white overflow-hidden shadow-sm hover:shadow-lg hover:scale-[1.02] transition-all border-r-4 ${
                          draggedTow?.id === tow.id ? 'opacity-50' : ''
                        }`}
                        style={{
                          top: `${top}px`,
                          height: `${Math.max(height - 4, 24)}px`,
                          right: `${right + 0.3}%`,
                          width: `${dayWidth - 0.6}%`,
                          backgroundColor: driverColor,
                          borderRightColor: driverColor,
                        }}
                      >
                        <div className="font-bold truncate text-[11px] sm:text-xs">
                          {tow.customer?.name || 'ללא לקוח'}
                        </div>
                        <div className="truncate opacity-90 text-[10px] sm:text-xs">
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
                    style={{ top: `${getCurrentTime() * 60}px` }}
                  >
                    <div className="absolute right-0 w-3 h-3 bg-red-500 rounded-full -mt-1.5 -mr-1.5"></div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Day View */}
        {view === 'day' && (
          <div>
            {/* Day Header */}
            <div className="p-4 border-b border-gray-200 bg-[#33d4ff]/10">
              <p className="text-center">
                <span className="text-lg text-gray-600">{weekDays.find(d => d.isToday)?.day || weekDays[0].day}, </span>
                <span className="text-2xl font-bold text-[#33d4ff]">
                  {weekDays.find(d => d.isToday)?.date || weekDays[0].date} ב{getMonthYear()}
                </span>
              </p>
            </div>

            {/* Driver Columns */}
            <div className="overflow-x-auto">
              <div className="min-w-[700px]">
                {/* Driver Headers */}
                <div
                  className="grid border-b border-gray-200 sticky top-0 bg-white z-20"
                  style={{ gridTemplateColumns: `60px repeat(${selectedDrivers.includes('all') ? drivers.length : selectedDrivers.length}, 1fr)` }}
                >
                  <div className="p-3 text-center text-sm text-gray-500 border-l border-gray-200">
                    <Clock size={16} className="mx-auto" />
                  </div>
                  {(selectedDrivers.includes('all') ? drivers : drivers.filter(d => selectedDrivers.includes(d.id))).map((driver, index) => {
                    const color = DRIVER_COLORS[drivers.indexOf(driver) % DRIVER_COLORS.length]
                    return (
                      <div
                        key={driver.id}
                        className="p-3 text-center border-l border-gray-200"
                        style={{ backgroundColor: color + '15' }}
                      >
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }}></div>
                          <span className="font-medium text-gray-800 text-sm">{driver.user?.full_name}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Time Grid */}
                <div className="relative">
                  {hours.map((hour) => (
                    <div
                      key={hour}
                      className="grid border-b border-gray-100"
                      style={{
                        gridTemplateColumns: `60px repeat(${selectedDrivers.includes('all') ? drivers.length : selectedDrivers.length}, 1fr)`,
                        height: '60px'
                      }}
                    >
                      <div className="p-2 text-sm text-gray-400 text-center border-l border-gray-200">
                        {hour.toString().padStart(2, '0')}:00
                      </div>
                      {(selectedDrivers.includes('all') ? drivers : drivers.filter(d => selectedDrivers.includes(d.id))).map((driver) => {
                        const color = DRIVER_COLORS[drivers.indexOf(driver) % DRIVER_COLORS.length]
                        // יצירת URL עם פרמטרים של תאריך ושעה
                        const todayDate = weekDays.find(d => d.isToday)?.fullDate || weekDays[0].fullDate
                        const dateStr = todayDate.toISOString().split('T')[0]
                        const timeStr = `${hour.toString().padStart(2, '0')}:00`
                        const newTowUrl = `/dashboard/tows/new?date=${dateStr}&time=${timeStr}`
                        
                        return (
                          <div
                            key={driver.id}
                            className="border-l border-gray-100 hover:bg-[#33d4ff]/5 cursor-pointer transition-colors relative group"
                            style={{ backgroundColor: color + '05' }}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, weekDays.findIndex(d => d.isToday) || 0, hour, driver.id)}
                          >
                            <Link
                              href={newTowUrl}
                              className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <div className="w-6 h-6 bg-[#33d4ff] rounded-full flex items-center justify-center shadow">
                                <Plus size={14} className="text-white" />
                              </div>
                            </Link>
                          </div>
                        )
                      })}
                    </div>
                  ))}

                  {/* Current Time Line */}
                  {getCurrentTime() >= 0 && getCurrentTime() <= 23 && (
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

      {/* Instructions */}
      <div className="mt-4 grid sm:grid-cols-3 gap-3 text-sm">
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
            <Clock size={16} className="text-white" />
          </div>
          <p className="text-gray-700"><strong>פרטים:</strong> לחץ על גרירה</p>
        </div>
      </div>

      {/* Tow Detail Modal */}
      {selectedTow && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white w-full sm:rounded-2xl sm:max-w-md sm:mx-4 overflow-hidden rounded-t-2xl">
            <div
              className="px-5 py-4 text-white flex items-center justify-between"
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
    </div>
  )
}