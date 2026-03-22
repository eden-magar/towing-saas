'use client'

import { useState, useEffect, useCallback } from 'react'
import { DriverWithDetails } from '../lib/types'
import { getDayTows } from '../lib/queries/calendar'
import { TowWithDetails } from '../lib/queries/tows'

const DRIVER_COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4']

interface DriverCalendarPickerProps {
  companyId: string
  drivers: DriverWithDetails[]
  requiredTruckTypes?: string[]
  initialDate?: string   // YYYY-MM-DD
  initialTime?: string   // HH:MM
  onConfirm: (driverId: string, date: string, time: string) => void
  onClose: () => void
}

export function DriverCalendarPicker({
  companyId,
  drivers,
  requiredTruckTypes = [],
  initialDate,
  initialTime,
  onConfirm,
  onClose,
}: DriverCalendarPickerProps) {
  const [pickerDate, setPickerDate] = useState<Date>(() =>
    initialDate ? new Date(initialDate + 'T12:00:00') : new Date()
  )
  const [pickerTime, setPickerTime] = useState<string>(initialTime || '')
  const [pendingDriverId, setPendingDriverId] = useState<string | null>(null)
  const [calendarTows, setCalendarTows] = useState<TowWithDetails[]>([])
  const [calendarLoading, setCalendarLoading] = useState(false)

  const [selectedDriverIds, setSelectedDriverIds] = useState<string[]>([])
  const isAllSelected = selectedDriverIds.length === 0

  const toggleDriver = (driverId: string) => {
    if (driverId === 'all') {
      setSelectedDriverIds([])
    } else {
      setSelectedDriverIds(prev =>
        prev.includes(driverId) ? prev.filter(id => id !== driverId) : [...prev, driverId]
      )
    }
  }

  const visibleDrivers = isAllSelected
    ? drivers
    : drivers.filter(d => selectedDriverIds.includes(d.id))

  const loadCalendarTows = useCallback(async (date: Date) => {
    if (!companyId) return
    setCalendarLoading(true)
    try {
      const tows = await getDayTows(companyId, date)
      setCalendarTows(tows)
    } catch (e) {
      console.error(e)
    } finally {
      setCalendarLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    loadCalendarTows(pickerDate)
  }, [pickerDate, loadCalendarTows])

  const handleConfirm = () => {
    if (!pendingDriverId || !pickerTime) return
    const dateStr =
      pickerDate.getFullYear() + '-' +
      (pickerDate.getMonth() + 1).toString().padStart(2, '0') + '-' +
      pickerDate.getDate().toString().padStart(2, '0')
    onConfirm(pendingDriverId, dateStr, pickerTime)
  }

  const getCurrentTimePosition = () => {
    const now = new Date()
    return now.getHours() + now.getMinutes() / 60
  }

  const isPickerToday = pickerDate.toDateString() === new Date().toDateString()

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col">

        {/* כותרת + ניווט תאריך */}
        <div className="flex items-center justify-between p-4 border-b">
          <button
            type="button"
            onClick={() => {
              const d = new Date(pickerDate)
              d.setDate(d.getDate() - 1)
              setPickerDate(d)
            }}
            className="p-2 hover:bg-gray-100 rounded-lg text-lg"
          >→</button>
          <span className="font-medium text-sm">
            {pickerDate.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'numeric' })}
          </span>
          <button
            type="button"
            onClick={() => {
              const d = new Date(pickerDate)
              d.setDate(d.getDate() + 1)
              setPickerDate(d)
            }}
            className="p-2 hover:bg-gray-100 rounded-lg text-lg"
          >←</button>
        </div>

        {/* פילטר נהגים */}
        <div className="flex items-center gap-1.5 flex-wrap px-3 py-2 border-b">
          <button
            type="button"
            onClick={() => toggleDriver('all')}
            className={`px-2 py-0.5 rounded-lg text-xs border transition-colors ${
              isAllSelected ? 'border-blue-400 bg-blue-50 text-blue-600' : 'border-gray-200 bg-gray-50 text-gray-500'
            }`}
          >
            הכל
          </button>
          {drivers.map((d, i) => {
            const color = DRIVER_COLORS[i % DRIVER_COLORS.length]
            const selected = selectedDriverIds.includes(d.id)
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => toggleDriver(d.id)}
                className="px-2 py-0.5 rounded-lg text-xs border-2 transition-all"
                style={{
                  backgroundColor: selected ? color + '20' : '#f3f4f6',
                  color: selected ? color : '#9ca3af',
                  borderColor: selected ? color : 'transparent',
                }}
              >
                {d.user?.full_name?.split(' ')[0] || 'נהג'}
              </button>
            )
          })}
        </div>

        {/* גריד */}
        <div className="overflow-auto flex-1 p-2">
          {calendarLoading ? (
            <div className="text-center text-gray-400 py-8">טוען...</div>
          ) : (
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="sticky top-0 bg-gray-50 z-10">
                    <th className="text-right px-1.5 py-1.5 text-gray-400 font-medium border-b border-gray-100 w-8"></th>
                    {visibleDrivers.map((d, i) => {
                      const color = DRIVER_COLORS[drivers.indexOf(d) % DRIVER_COLORS.length]
                      return (
                        <th key={d.id} className="text-center px-1 py-1.5 font-medium border-b border-gray-100 border-l border-l-gray-100 text-xs" style={{ width: `${100 / visibleDrivers.length}%`, color }}>
                          {d.user?.full_name?.split(' ')[0] || 'נהג'}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody style={{ position: 'relative' }}>
                  {Array.from({ length: 24 }, (_, i) => i).map(hour => (
                    <tr key={hour} className="border-b border-gray-200" style={{ height: '40px' }}>
                      <td className="px-1 py-1 text-gray-500 border-l border-gray-200 text-xs font-medium">{hour}:00</td>
                      {visibleDrivers.map((driver) => {
                        const driverIdx = drivers.indexOf(driver)
                        const color = DRIVER_COLORS[driverIdx % DRIVER_COLORS.length]
                        const cellTows = calendarTows.filter(t =>
                          t.driver_id === driver.id &&
                          new Date(t.scheduled_at ?? '').getHours() === hour
                        )
                        const isRelevant = requiredTruckTypes.length === 0 ||
                          (driver as unknown as { trucks?: { truck_type: string }[] }).trucks?.some(
                            (t: { truck_type: string }) => requiredTruckTypes.includes(t.truck_type)
                          )
                        const isSelected = pendingDriverId === driver.id &&
                          pickerTime === `${hour.toString().padStart(2, '0')}:00`
                        return (
                          <td
                            key={driver.id}
                            className={`px-0.5 py-0.5 border-l border-gray-200 min-h-6 cursor-pointer transition-colors
                              ${!isRelevant ? 'bg-gray-50' : ''}
                              ${isSelected ? 'ring-2 ring-inset ring-blue-400 bg-blue-50' : ''}
                            `}
                            style={{ width: `${100 / visibleDrivers.length}%` }}
                            onClick={() => {
                              setPendingDriverId(driver.id)
                              setPickerTime(`${hour.toString().padStart(2, '0')}:00`)
                            }}
                          >
                            {cellTows.map(t => (
                              <div
                                key={t.id}
                                className="rounded px-1 py-0.5 mb-0.5 truncate text-xs font-medium"
                                style={{
                                  background: color + '25',
                                  color: color,
                                  border: `1px solid ${color}40`,
                                }}
                              >
                                {t.order_number?.slice(-4) || t.id.slice(0, 4)}
                              </div>
                            ))}
                            {cellTows.length === 0 && (
                              <button
                                type="button"
                                className="w-full h-5 border border-dashed border-gray-100 rounded text-gray-200 opacity-0 hover:opacity-100 hover:border-gray-300 hover:text-gray-300 flex items-center justify-center text-xs transition-opacity"
                              >
                                +
                              </button>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                  {isPickerToday && (
                    <tr
                      className="pointer-events-none"
                      style={{
                        position: 'absolute',
                        top: `${getCurrentTimePosition() * 40}px`,
                        left: 0,
                        right: 0,
                        height: '2px',
                        backgroundColor: '#ef4444',
                        opacity: 0.7,
                        zIndex: 10,
                      }}
                    >
                      <td colSpan={visibleDrivers.length + 1} style={{ padding: 0, height: '2px', backgroundColor: '#ef4444' }} />
                    </tr>
                  )}
                </tbody>
              </table>
          )}
        </div>

        {/* שעה + אישור */}
        <div className="p-4 border-t flex items-center gap-4 justify-between flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">שעת תחילת גרירה</label>
            <input
              type="time"
              value={pickerTime}
              onChange={e => setPickerTime(e.target.value)}
              className="border rounded-lg px-2 py-1 text-sm"
            />
          </div>
          {pendingDriverId && (
            <div className="text-sm text-blue-700 font-medium">
              {drivers.find(d => d.id === pendingDriverId)?.user?.full_name || 'נהג נבחר'}
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50"
            >
              ביטול
            </button>
            <button
              type="button"
              disabled={!pendingDriverId || !pickerTime}
              onClick={handleConfirm}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm disabled:opacity-40"
            >
              אשר שיבוץ
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
