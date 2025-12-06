'use client'

import { useState, useRef, useEffect } from 'react'
import { 
  ChevronRight,
  ChevronLeft,
  Plus,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Truck,
  User,
  X,
  GripVertical,
  Check,
  Search
} from 'lucide-react'

interface TowEvent {
  id: number
  driver: string
  day: number // 0 = today, 1 = tomorrow, etc.
  startHour: number
  duration: number
  customer: string
  from: string
  to: string
  vehicle: string
  status: 'pending' | 'assigned' | 'in_progress' | 'completed'
}

interface Driver {
  id: string
  name: string
  color: string
}

interface NewTowSlot {
  day: number
  hour: number
  driver?: string
}

export default function CalendarPage() {
  const [view, setView] = useState<'week' | 'day'>('week')
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>(['all'])
  const [showAddModal, setShowAddModal] = useState(false)
  const [newTowSlot, setNewTowSlot] = useState<NewTowSlot | null>(null)
  const [draggedTow, setDraggedTow] = useState<TowEvent | null>(null)
  const [selectedTow, setSelectedTow] = useState<TowEvent | null>(null)
  const [currentWeekStart, setCurrentWeekStart] = useState(new Date())
  
  // Form state for new tow
  const [newTowForm, setNewTowForm] = useState({
    customer: '',
    vehicle: '',
    from: '',
    to: '',
    driver: '',
    duration: 1
  })

  const [tows, setTows] = useState<TowEvent[]>([
    { id: 1, driver: 'd1', day: 0, startHour: 8, duration: 1.5, customer: 'יוסי כהן', from: 'תל אביב', to: 'רמת גן', vehicle: '12-345-67', status: 'assigned' },
    { id: 2, driver: 'd1', day: 0, startHour: 10, duration: 2, customer: 'מוסך רמט', from: 'חולון', to: 'בת ים', vehicle: '23-456-78', status: 'in_progress' },
    { id: 3, driver: 'd2', day: 0, startHour: 7, duration: 1, customer: 'שרה לוי', from: 'ראשל"צ', to: 'חולון', vehicle: '34-567-89', status: 'pending' },
    { id: 4, driver: 'd2', day: 0, startHour: 9, duration: 2.5, customer: 'ליסינג ישיר', from: 'פ"ת', to: 'ת"א', vehicle: '45-678-90', status: 'assigned' },
    { id: 5, driver: 'd3', day: 0, startHour: 8.5, duration: 1.5, customer: 'דני רוזן', from: 'גבעתיים', to: 'ב"ב', vehicle: '56-789-01', status: 'completed' },
    { id: 6, driver: 'd1', day: 1, startHour: 9, duration: 1, customer: 'מיכל גולן', from: 'הרצליה', to: 'ר"ג', vehicle: '67-890-12', status: 'pending' },
    { id: 7, driver: 'd3', day: 1, startHour: 11, duration: 2, customer: 'אופק רנט', from: 'נתניה', to: 'ת"א', vehicle: '78-901-23', status: 'assigned' },
    { id: 8, driver: 'd4', day: 0, startHour: 7.5, duration: 1.5, customer: 'יובל כץ', from: 'אשדוד', to: 'ראשל"צ', vehicle: '89-012-34', status: 'in_progress' },
    { id: 9, driver: 'd4', day: 0, startHour: 10, duration: 1, customer: 'נועה שלום', from: 'יפו', to: 'חולון', vehicle: '90-123-45', status: 'pending' },
    { id: 10, driver: 'd5', day: 2, startHour: 8, duration: 2, customer: 'מוסך אבי', from: 'לוד', to: 'רמלה', vehicle: '01-234-56', status: 'assigned' },
    { id: 11, driver: 'd2', day: 3, startHour: 14, duration: 1.5, customer: 'חברת השכרה', from: 'מודיעין', to: 'ת"א', vehicle: '12-345-67', status: 'pending' },
    { id: 12, driver: 'd1', day: 4, startHour: 16, duration: 1, customer: 'גיא לוי', from: 'כ"ס', to: 'ירושלים', vehicle: '23-456-78', status: 'pending' },
  ])

  const hours = Array.from({ length: 15 }, (_, i) => i + 6) // 06:00 - 20:00

  const drivers: Driver[] = [
    { id: 'd1', name: 'דוד אברהם', color: '#22c55e' },
    { id: 'd2', name: 'יעקב מזרחי', color: '#3b82f6' },
    { id: 'd3', name: 'אבי גולן', color: '#f59e0b' },
    { id: 'd4', name: 'משה לוי', color: '#8b5cf6' },
    { id: 'd5', name: 'רון דוד', color: '#ef4444' },
  ]

  // Generate week days based on currentWeekStart
  const getWeekDays = () => {
    const days = []
    const today = new Date()
    const startOfWeek = new Date(currentWeekStart)
    
    // Start from Saturday (day 6) going back to Sunday (day 0)
    for (let i = 6; i >= 0; i--) {
      const date = new Date(startOfWeek)
      date.setDate(startOfWeek.getDate() + i)
      const isToday = date.toDateString() === today.toDateString()
      days.push({
        day: ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'][date.getDay()],
        date: date.getDate().toString(),
        fullDate: date,
        isToday,
        dayIndex: 6 - i
      })
    }
    return days
  }

  const weekDays = getWeekDays()

  const getDriverColor = (driverId: string) => drivers.find(d => d.id === driverId)?.color || '#6b7280'
  const getDriverName = (driverId: string) => drivers.find(d => d.id === driverId)?.name || ''

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

  const isDriverSelected = (driverId: string) => selectedDrivers.includes('all') || selectedDrivers.includes(driverId)

  const filteredTows = selectedDrivers.includes('all') ? tows : tows.filter(t => selectedDrivers.includes(t.driver))

  const handleCellClick = (day: number, hour: number, driver?: string) => {
    setNewTowSlot({ day, hour, driver })
    setNewTowForm({
      customer: '',
      vehicle: '',
      from: '',
      to: '',
      driver: driver || '',
      duration: 1
    })
    setShowAddModal(true)
  }

  const handleDragStart = (e: React.DragEvent, tow: TowEvent) => {
    setDraggedTow(tow)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', tow.id.toString())
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent, day: number, hour: number, driver?: string) => {
    e.preventDefault()
    if (draggedTow) {
      setTows(tows.map(t => 
        t.id === draggedTow.id 
          ? { ...t, day, startHour: hour, driver: driver || t.driver }
          : t
      ))
      setDraggedTow(null)
    }
  }

  const handleAddTow = () => {
    if (!newTowSlot || !newTowForm.customer || !newTowForm.vehicle) return
    
    const newTow: TowEvent = {
      id: Math.max(...tows.map(t => t.id)) + 1,
      driver: newTowForm.driver || 'd1',
      day: newTowSlot.day,
      startHour: newTowSlot.hour,
      duration: newTowForm.duration,
      customer: newTowForm.customer,
      from: newTowForm.from,
      to: newTowForm.to,
      vehicle: newTowForm.vehicle,
      status: 'pending'
    }
    
    setTows([...tows, newTow])
    setShowAddModal(false)
    setNewTowSlot(null)
  }

  const formatHour = (hour: number) => {
    const h = Math.floor(hour)
    const m = Math.round((hour % 1) * 60)
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
  }

  const getMonthYear = () => {
    const months = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']
    return `${months[currentWeekStart.getMonth()]} ${currentWeekStart.getFullYear()}`
  }

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentWeekStart)
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7))
    setCurrentWeekStart(newDate)
  }

  const goToToday = () => {
    setCurrentWeekStart(new Date())
  }

  const getCurrentTime = () => {
    const now = new Date()
    return now.getHours() + now.getMinutes() / 60
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

            <button
              onClick={() => { setNewTowSlot({ day: 0, hour: 9 }); setShowAddModal(true) }}
              className="hidden lg:flex items-center gap-2 px-4 py-2 bg-[#33d4ff] text-white rounded-xl text-sm font-medium hover:bg-[#21b8e6]"
            >
              <Plus size={18} />
              גרירה חדשה
            </button>
          </div>
        </div>
        
        {/* Mobile Add Button */}
        <button
          onClick={() => { setNewTowSlot({ day: 0, hour: 9 }); setShowAddModal(true) }}
          className="lg:hidden flex items-center justify-center gap-2 px-4 py-3 bg-[#33d4ff] text-white rounded-xl font-medium w-full"
        >
          <Plus size={20} />
          גרירה חדשה
        </button>
      </div>

      {/* Driver Filter */}
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
          {drivers.map(driver => (
            <button
              key={driver.id}
              onClick={() => toggleDriver(driver.id)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all border-2"
              style={{
                backgroundColor: isDriverSelected(driver.id) ? driver.color + '20' : '#f3f4f6',
                color: isDriverSelected(driver.id) ? driver.color : '#6b7280',
                borderColor: isDriverSelected(driver.id) && !selectedDrivers.includes('all') ? driver.color : 'transparent'
              }}
            >
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: driver.color }}></div>
              <span className="font-medium hidden sm:inline">{driver.name}</span>
              <span className="font-medium sm:hidden">{driver.name.split(' ')[0]}</span>
              {isDriverSelected(driver.id) && !selectedDrivers.includes('all') && <Check size={14} />}
            </button>
          ))}
        </div>
        {!selectedDrivers.includes('all') && (
          <p className="text-xs text-gray-500 mt-2">{selectedDrivers.length} נהגים נבחרו</p>
        )}
      </div>

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
                    {weekDays.map((day, dayIdx) => (
                      <div
                        key={dayIdx}
                        className={`border-l border-gray-100 hover:bg-[#33d4ff]/5 cursor-pointer transition-colors relative group ${
                          day.isToday ? 'bg-[#33d4ff]/5' : ''
                        }`}
                        onClick={() => handleCellClick(day.dayIndex, hour)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, day.dayIndex, hour)}
                      >
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          <div className="w-7 h-7 bg-[#33d4ff] rounded-full flex items-center justify-center shadow-lg">
                            <Plus size={16} className="text-white" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}

                {/* Tow Events */}
                <div className="absolute top-0 right-[12.5%] left-0 bottom-0 pointer-events-none">
                  {filteredTows.map((tow) => {
                    const top = (tow.startHour - 6) * 60
                    const height = tow.duration * 60
                    const dayWidth = 100 / 7
                    const right = (6 - tow.day) * dayWidth

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
                          backgroundColor: getDriverColor(tow.driver),
                          borderRightColor: getDriverColor(tow.driver),
                        }}
                      >
                        <div className="font-bold truncate text-[11px] sm:text-xs">{tow.customer}</div>
                        {height > 40 && <div className="truncate opacity-90 text-[10px] sm:text-xs">{tow.from} ← {tow.to}</div>}
                        {height > 60 && <div className="truncate opacity-75 font-mono text-[10px]">{tow.vehicle}</div>}
                        {/* Resize Handle */}
                        <div className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize bg-white/20 hover:bg-white/40 transition-colors rounded-b">
                          <div className="w-6 h-0.5 bg-white/60 rounded mx-auto mt-0.5"></div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Current Time Line */}
                {weekDays.some(d => d.isToday) && (
                  <div
                    className="absolute right-0 left-0 border-t-2 border-red-500 z-10 pointer-events-none"
                    style={{ top: `${(getCurrentTime() - 6) * 60}px` }}
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
                <span className="text-lg text-gray-600">{weekDays.find(d => d.isToday)?.day || weekDays[6].day}, </span>
                <span className="text-2xl font-bold text-[#33d4ff]">
                  {weekDays.find(d => d.isToday)?.date || weekDays[6].date} ב{getMonthYear()}
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
                  {(selectedDrivers.includes('all') ? drivers : drivers.filter(d => selectedDrivers.includes(d.id))).map(driver => (
                    <div
                      key={driver.id}
                      className="p-3 text-center border-l border-gray-200"
                      style={{ backgroundColor: driver.color + '15' }}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: driver.color }}></div>
                        <span className="font-medium text-gray-800 text-sm">{driver.name}</span>
                      </div>
                    </div>
                  ))}
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
                      {(selectedDrivers.includes('all') ? drivers : drivers.filter(d => selectedDrivers.includes(d.id))).map(driver => (
                        <div
                          key={driver.id}
                          className="border-l border-gray-100 hover:bg-[#33d4ff]/5 cursor-pointer transition-colors relative group"
                          style={{ backgroundColor: driver.color + '05' }}
                          onClick={() => handleCellClick(0, hour, driver.id)}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, 0, hour, driver.id)}
                        >
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                            <div className="w-6 h-6 bg-[#33d4ff] rounded-full flex items-center justify-center shadow">
                              <Plus size={14} className="text-white" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}

                  {/* Tow Events for today */}
                  {filteredTows.filter(t => t.day === 0).map((tow) => {
                    const displayDrivers = selectedDrivers.includes('all') ? drivers : drivers.filter(d => selectedDrivers.includes(d.id))
                    const driverIndex = displayDrivers.findIndex(d => d.id === tow.driver)
                    if (driverIndex === -1) return null

                    const top = (tow.startHour - 6) * 60
                    const height = tow.duration * 60
                    const columnWidth = 100 / displayDrivers.length
                    const right = driverIndex * columnWidth

                    return (
                      <div
                        key={tow.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, tow)}
                        onClick={(e) => { e.stopPropagation(); setSelectedTow(tow) }}
                        className={`absolute cursor-grab active:cursor-grabbing rounded-lg p-2 text-xs text-white overflow-hidden shadow-sm hover:shadow-lg hover:scale-[1.02] transition-all border-r-4 ${
                          draggedTow?.id === tow.id ? 'opacity-50' : ''
                        }`}
                        style={{
                          top: `${top}px`,
                          height: `${Math.max(height - 4, 24)}px`,
                          right: `calc(60px + ${right + 0.5}%)`,
                          width: `calc(${columnWidth - 1}% - 10px)`,
                          backgroundColor: getDriverColor(tow.driver),
                          borderRightColor: getDriverColor(tow.driver),
                        }}
                      >
                        <div className="font-bold truncate">{tow.customer}</div>
                        {height > 40 && <div className="truncate opacity-90">{tow.from} ← {tow.to}</div>}
                        {height > 60 && <div className="truncate opacity-75 font-mono">{tow.vehicle}</div>}
                        <div className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize bg-white/20 hover:bg-white/40 transition-colors rounded-b">
                          <div className="w-6 h-0.5 bg-white/60 rounded mx-auto mt-0.5"></div>
                        </div>
                      </div>
                    )
                  })}

                  {/* Current Time Line */}
                  <div
                    className="absolute right-0 left-0 border-t-2 border-red-500 z-10 pointer-events-none"
                    style={{ top: `${(getCurrentTime() - 6) * 60}px` }}
                  >
                    <div className="absolute right-0 w-3 h-3 bg-red-500 rounded-full -mt-1.5 -mr-1.5"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

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
          <p className="text-gray-700"><strong>משך:</strong> משוך קצה תחתון</p>
        </div>
      </div>

      {/* Add Tow Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white w-full sm:rounded-2xl sm:max-w-md sm:mx-4 overflow-hidden max-h-[90vh] flex flex-col rounded-t-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-[#33d4ff] text-white flex-shrink-0">
              <div>
                <h2 className="font-bold text-lg">גרירה חדשה</h2>
                {newTowSlot && (
                  <p className="text-white/80 text-sm">
                    {weekDays[6 - newTowSlot.day]?.day} {weekDays[6 - newTowSlot.day]?.date}/{currentWeekStart.getMonth() + 1} • {formatHour(newTowSlot.hour)}
                  </p>
                )}
              </div>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-white/20 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">לקוח *</label>
                <input
                  type="text"
                  value={newTowForm.customer}
                  onChange={(e) => setNewTowForm({ ...newTowForm, customer: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                  placeholder="שם לקוח או חברה"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">לוחית רישוי *</label>
                <input
                  type="text"
                  value={newTowForm.vehicle}
                  onChange={(e) => setNewTowForm({ ...newTowForm, vehicle: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                  placeholder="00-000-00"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">מוצא</label>
                  <input
                    type="text"
                    value={newTowForm.from}
                    onChange={(e) => setNewTowForm({ ...newTowForm, from: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                    placeholder="כתובת איסוף"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">יעד</label>
                  <input
                    type="text"
                    value={newTowForm.to}
                    onChange={(e) => setNewTowForm({ ...newTowForm, to: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                    placeholder="כתובת יעד"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">נהג</label>
                <select
                  value={newTowForm.driver}
                  onChange={(e) => setNewTowForm({ ...newTowForm, driver: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                >
                  <option value="">בחר נהג...</option>
                  {drivers.map(driver => (
                    <option key={driver.id} value={driver.id}>{driver.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">משך משוער (שעות)</label>
                <div className="flex items-center gap-2">
                  {[0.5, 1, 1.5, 2, 2.5, 3].map(dur => (
                    <button
                      key={dur}
                      onClick={() => setNewTowForm({ ...newTowForm, duration: dur })}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                        newTowForm.duration === dur
                          ? 'bg-[#33d4ff] text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {dur}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 px-5 py-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-100"
              >
                ביטול
              </button>
              <button
                onClick={handleAddTow}
                disabled={!newTowForm.customer || !newTowForm.vehicle}
                className={`flex-1 py-3 rounded-xl font-medium ${
                  newTowForm.customer && newTowForm.vehicle
                    ? 'bg-[#33d4ff] text-white hover:bg-[#21b8e6]'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                הוסף גרירה
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tow Detail Modal */}
      {selectedTow && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white w-full sm:rounded-2xl sm:max-w-md sm:mx-4 overflow-hidden rounded-t-2xl">
            <div
              className="px-5 py-4 text-white flex items-center justify-between"
              style={{ backgroundColor: getDriverColor(selectedTow.driver) }}
            >
              <div>
                <h2 className="font-bold text-lg">{selectedTow.customer}</h2>
                <p className="text-white/80 text-sm">{getDriverName(selectedTow.driver)}</p>
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
                  <p className="font-mono font-medium text-gray-800">{selectedTow.vehicle}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <MapPin size={20} className="text-gray-400" />
                <div className="flex-1">
                  <p className="text-sm text-gray-500">מסלול</p>
                  <p className="font-medium text-gray-800">{selectedTow.from} ← {selectedTow.to}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <Clock size={20} className="text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">זמן</p>
                  <p className="font-medium text-gray-800">
                    {formatHour(selectedTow.startHour)} - {formatHour(selectedTow.startHour + selectedTow.duration)}
                    <span className="text-gray-500 mr-2">({selectedTow.duration} שעות)</span>
                  </p>
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
              <button
                onClick={() => { /* Navigate to tow details */ }}
                className="flex-1 py-3 bg-[#33d4ff] text-white rounded-xl font-medium hover:bg-[#21b8e6]"
              >
                פרטים מלאים
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
