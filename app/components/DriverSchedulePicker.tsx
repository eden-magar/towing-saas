'use client'

import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, User, Clock, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface DriverSchedulePickerProps {
  companyId: string
  requiredTruckTypes: string[]
  selectedDate: Date
  onDateChange: (date: Date) => void
  onDriverSelect: (driverId: string) => void
  onClose: () => void
}

interface Driver {
  id: string
  user: { full_name: string; phone: string | null }
  trucks: { id: string; truck_type: string; plate_number: string }[]
}

interface TowEvent {
  id: string
  scheduled_at: string
  customer_name: string
  driver_id: string
}

// מיפוי סוגי גרר לעברית
const truckTypeLabels: Record<string, string> = {
  'carrier': 'מוביל',
  'carrier_large': 'מוביל גדול',
  'crane_tow': 'מנוף',
  'dolly': 'דולי',
  'flatbed': 'רמסע',
  'heavy_equipment': 'ציוד כבד',
  'heavy_rescue': 'חילוץ כבד',
  'wheel_lift_cradle': 'משקפיים'
}

export function DriverSchedulePicker({
  companyId,
  requiredTruckTypes,
  selectedDate,
  onDateChange,
  onDriverSelect,
  onClose
}: DriverSchedulePickerProps) {
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [tows, setTows] = useState<TowEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [showAllDrivers, setShowAllDrivers] = useState(false)

  const hours = Array.from({ length: 15 }, (_, i) => i + 6) // 06:00 - 20:00

  // טעינת נהגים וגרירות
  useEffect(() => {
    loadData()
  }, [companyId, selectedDate])

  const loadData = async () => {
    setLoading(true)
    try {
      // טעינת נהגים עם הגררים שלהם
      const { data: driversData } = await supabase
        .from('drivers')
        .select(`
          id,
          user:users(full_name, phone)
        `)
        .eq('company_id', companyId)

      // טעינת שיוכי גררים
      const { data: trucksData } = await supabase
        .from('tow_trucks')
        .select(`
          id,
          truck_type,
          plate_number,
          assigned_driver:driver_truck_assignments!inner(driver_id)
        `)
        .eq('company_id', companyId)
        .eq('driver_truck_assignments.is_current', true)

      // מיפוי גררים לנהגים - עם סינון נהגים ללא user
      const driversWithTrucks = (driversData || [])
        .filter(d => {
          const user = Array.isArray(d.user) ? d.user[0] : d.user
          return user && user.full_name // מוודא שגם ה-user וגם ה-full_name קיימים
        })        
        .map(d => ({
          id: d.id,
          user: Array.isArray(d.user) ? d.user[0] : d.user as { full_name: string; phone: string | null },
          trucks: (trucksData || [])
            .filter(t => t.assigned_driver?.some((a: any) => a.driver_id === d.id))
            .map(t => ({ id: t.id, truck_type: t.truck_type, plate_number: t.plate_number }))
        }))
      setDrivers(driversWithTrucks)

      // טעינת גרירות ליום הנבחר
      const startOfDay = new Date(selectedDate)
      startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date(selectedDate)
      endOfDay.setHours(23, 59, 59, 999)

      const { data: towsData } = await supabase
        .from('tows')
        .select(`
          id,
          scheduled_at,
          driver_id,
          customer:customers(name)
        `)
        .eq('company_id', companyId)
        .gte('scheduled_at', startOfDay.toISOString())
        .lte('scheduled_at', endOfDay.toISOString())
        .not('status', 'eq', 'cancelled')

      setTows((towsData || []).map(t => ({
        id: t.id,
        scheduled_at: t.scheduled_at,
        customer_name: (t.customer as any)?.name || 'ללא לקוח',
        driver_id: t.driver_id
      })))

    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  // סינון נהגים לפי סוג גרר
  const filteredDrivers = drivers.filter(driver => {
    if (showAllDrivers) return driver.trucks.length > 0
    if (!requiredTruckTypes || requiredTruckTypes.length === 0) return driver.trucks.length > 0
    return driver.trucks.some(truck => requiredTruckTypes.includes(truck.truck_type))
  })

  // ניווט בין ימים
  const navigateDay = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate)
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1))
    onDateChange(newDate)
  }

  // חישוב שעה נוכחית
  const getCurrentHourPosition = () => {
    const now = new Date()
    if (now.toDateString() !== selectedDate.toDateString()) return null
    const hour = now.getHours() + now.getMinutes() / 60
    if (hour < 6 || hour > 20) return null
    return ((hour - 6) / 14) * 100
  }

  // קבלת גרירות של נהג
  const getDriverTows = (driverId: string) => {
    return tows.filter(t => t.driver_id === driverId)
  }

  // חישוב מיקום גרירה על ציר הזמן
  const getTowPosition = (scheduledAt: string) => {
    const date = new Date(scheduledAt)
    const hour = date.getHours() + date.getMinutes() / 60
    if (hour < 6) return 0
    if (hour > 20) return 100
    return ((hour - 6) / 14) * 100
  }

  const formatDate = (date: Date) => {
    const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
    return `${days[date.getDay()]}, ${date.getDate()}/${date.getMonth() + 1}`
  }

  const currentHourPos = getCurrentHourPosition()

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-[#33d4ff] border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header עם ניווט */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
        <button onClick={() => navigateDay('prev')} className="p-2 hover:bg-gray-200 rounded-lg">
          <ChevronRight size={20} />
        </button>
        <div className="text-center">
          <p className="font-bold text-gray-800">{formatDate(selectedDate)}</p>
          {selectedDate.toDateString() === new Date().toDateString() && (
            <span className="text-xs text-[#33d4ff]">היום</span>
          )}
        </div>
        <button onClick={() => navigateDay('next')} className="p-2 hover:bg-gray-200 rounded-lg">
          <ChevronLeft size={20} />
        </button>
      </div>

      {/* הודעה על סוג גרר נדרש */}
      {requiredTruckTypes && requiredTruckTypes.length > 0 && (
        <div className="mx-4 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
          <p className="text-sm text-amber-700 font-medium">
            ⚠️ נדרש גרר מסוג: {requiredTruckTypes.map(t => truckTypeLabels[t] || t).join(', ')}
          </p>
        </div>
      )}

      {/* סרגל שעות */}
      <div className="px-4 pt-4">
        <div className="flex mr-24">
          {hours.map(hour => (
            <div key={hour} className="flex-1 text-center text-xs text-gray-400">
              {hour.toString().padStart(2, '0')}:00
            </div>
          ))}
        </div>
      </div>

      {/* רשימת נהגים עם יומן */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredDrivers.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={32} className="text-gray-400" />
            </div>
            <p className="text-gray-600 font-medium">אין נהגים עם גרר מתאים</p>
            <button
              onClick={() => setShowAllDrivers(true)}
              className="mt-4 px-4 py-2 text-sm text-[#33d4ff] hover:bg-[#33d4ff]/10 rounded-lg"
            >
              הצג את כל הנהגים בכל זאת
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredDrivers.map(driver => {
              const driverTows = getDriverTows(driver.id)
              const driverTruckTypes = driver.trucks.map(t => truckTypeLabels[t.truck_type] || t.truck_type)
              
              return (
                <div
                  key={driver.id}
                  onClick={() => onDriverSelect(driver.id)}
                  className="bg-white border border-gray-200 rounded-xl p-3 hover:border-[#33d4ff] hover:shadow-md cursor-pointer transition-all"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <User size={20} className="text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 truncate">{driver.user.full_name}</p>
                      <p className="text-xs text-gray-500">{driverTruckTypes.join(', ')}</p>
                    </div>
                    <div className="text-left">
                      {driverTows.length === 0 ? (
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">פנוי</span>
                      ) : (
                        <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs">
                          {driverTows.length} גרירות
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* ציר זמן */}
                  <div className="relative h-8 bg-gray-100 rounded-lg overflow-hidden mr-12">
                    {/* קו שעה נוכחית */}
                    {currentHourPos !== null && (
                      <div 
                        className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
                        style={{ left: `${currentHourPos}%` }}
                      />
                    )}
                    
                    {/* גרירות */}
                    {driverTows.map(tow => {
                      const pos = getTowPosition(tow.scheduled_at)
                      return (
                        <div
                          key={tow.id}
                          className="absolute top-1 bottom-1 bg-[#33d4ff] rounded text-white text-[10px] px-1 truncate"
                          style={{ left: `${pos}%`, width: '60px' }}
                          title={`${new Date(tow.scheduled_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })} - ${tow.customer_name}`}
                        >
                          {tow.customer_name}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* כפתורי פעולה */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <button
          onClick={onClose}
          className="w-full py-3 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-100 font-medium"
        >
          ביטול
        </button>
      </div>
    </div>
  )
}