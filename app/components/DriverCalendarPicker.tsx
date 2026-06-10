'use client'

import { useState, useEffect, useCallback } from 'react'
import { Sparkles } from 'lucide-react'
import { DriverWithDetails } from '../lib/types'
import { getDayTows } from '../lib/queries/calendar'
import { getDayEvents, CalendarWeekEvent } from '../lib/queries/events'
import { TowWithDetails } from '../lib/queries/tows'
import { getEventTimeBounds } from '../lib/utils/event-time-bounds'
import { TimeInput } from './ui/TimeInput'

const DRIVER_COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4']
const PIXELS_PER_HOUR = 40
const HOURS_PER_DAY = 24
const DRIVER_COL_WIDTH_PX = 120

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
  const [calendarEvents, setCalendarEvents] = useState<CalendarWeekEvent[]>([])
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
      const [tows, events] = await Promise.all([
        getDayTows(companyId, date),
        getDayEvents(companyId, date),
      ])
      setCalendarTows(tows)
      setCalendarEvents(events)
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

  const singleDriverView = visibleDrivers.length === 1
  const gridMinWidthPx = singleDriverView
    ? undefined
    : 64 + visibleDrivers.length * DRIVER_COL_WIDTH_PX

  const driverColumnClass = singleDriverView
    ? 'flex-1 min-w-0 border-l border-gray-200'
    : 'w-[120px] shrink-0 border-l border-gray-200'

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col">

        {/* כותרת + ניווט תאריך */}
        <div className="flex items-center justify-center gap-3 p-4 border-b">
          <button
            type="button"
            onClick={() => {
              const d = new Date(pickerDate)
              d.setDate(d.getDate() - 1)
              setPickerDate(d)
            }}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-xl font-bold text-gray-700 transition-colors"
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
            className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-xl font-bold text-gray-700 transition-colors"
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
                className="px-2 py-0.5 rounded-lg text-xs border-2 transition-all font-bold"
                style={{
                  backgroundColor: selected ? color + '20' : '#f3f4f6',
                  color: '#000',
                  borderColor: selected ? color : 'transparent',
                }}
              >
                {d.user?.full_name?.split(' ')[0] || 'נהג'}
              </button>
            )
          })}
        </div>

        {/* גריד */}
        <div className="overflow-y-auto overflow-x-auto flex-1 min-h-0 p-2 relative">
          {calendarLoading && (
            <span className="absolute top-2 right-2 z-20 text-xs text-gray-500">טוען...</span>
          )}
          <div
            className={`flex flex-col w-full text-xs ${calendarLoading ? 'opacity-50' : ''}`}
            style={gridMinWidthPx !== undefined ? { minWidth: `${gridMinWidthPx}px` } : undefined}
          >
            {/* Driver headers — sticky; hour gutter spacer aligns with body gutter (RTL: gutter on right) */}
            <div className="flex sticky top-0 z-10 bg-white shrink-0">
              <div className="w-16 shrink-0 border-b border-l border-gray-200 bg-gray-50" />
              <div className="flex flex-1 min-w-0">
                {visibleDrivers.map(d => {
                  const color = DRIVER_COLORS[drivers.indexOf(d) % DRIVER_COLORS.length]
                  return (
                    <div
                      key={d.id}
                      className={`${driverColumnClass} border-b px-1 py-1.5 text-center overflow-hidden`}
                    >
                      <span
                        className="inline-block max-w-full truncate rounded-lg px-2 py-1 font-bold"
                        style={{ backgroundColor: `${color}26`, color: '#000' }}
                      >
                        {d.user?.full_name?.split(' ')[0] || 'נהג'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Hour rows + driver columns */}
            <div className="relative flex min-w-0">
              <div className="w-16 shrink-0 border-l border-gray-200 bg-gray-50">
                {Array.from({ length: HOURS_PER_DAY }, (_, i) => i).map(hour => (
                  <div
                    key={hour}
                    className="px-1 py-1 text-gray-500 text-xs font-medium border-b border-gray-200"
                    style={{ height: `${PIXELS_PER_HOUR}px` }}
                  >
                    {hour}:00
                  </div>
                ))}
              </div>

              <div className="flex flex-1 min-w-0">
                {visibleDrivers.map(driver => {
                  const driverIdx = drivers.indexOf(driver)
                  const color = DRIVER_COLORS[driverIdx % DRIVER_COLORS.length]
                  return (
                    <div key={driver.id} className={driverColumnClass}>
                      {Array.from({ length: HOURS_PER_DAY }, (_, i) => i).map(hour => {
                        const cellTows = calendarTows.filter(t =>
                          t.driver_id === driver.id &&
                          new Date(t.scheduled_at ?? '').getHours() === hour
                        )
                        const cellEvents = calendarEvents.filter(e => {
                          if (e.driver_id !== driver.id) return false
                          const bounds = getEventTimeBounds(e)
                          if (!bounds) return false
                          return new Date(bounds.startMs).getHours() === hour
                        })
                        const isRelevant = requiredTruckTypes.length === 0 ||
                          (driver as unknown as { trucks?: { truck_type: string }[] }).trucks?.some(
                            (t: { truck_type: string }) => requiredTruckTypes.includes(t.truck_type)
                          )
                        const isSelected = pendingDriverId === driver.id &&
                          pickerTime === `${hour.toString().padStart(2, '0')}:00`
                        return (
                          <div
                            key={hour}
                            className={`px-0.5 py-0.5 border-b border-gray-200 cursor-pointer transition-colors hover:bg-blue-50/30 overflow-hidden
                              ${isSelected ? 'ring-2 ring-inset ring-blue-400 bg-blue-50' : ''}
                              ${!isSelected && !isRelevant ? 'bg-gray-50' : ''}
                              ${!isSelected && isRelevant ? 'bg-white' : ''}
                            `}
                            style={{ height: `${PIXELS_PER_HOUR}px` }}
                            onClick={() => {
                              setPendingDriverId(driver.id)
                              setPickerTime(`${hour.toString().padStart(2, '0')}:00`)
                            }}
                          >
                            {cellTows.map(t => (
                              <div
                                key={t.id}
                                title={`${t.customer?.name || ''} ${t.order_number || ''}`.trim()}
                                className="rounded px-1 py-0.5 mb-0.5 truncate text-xs font-medium whitespace-nowrap"
                                style={{
                                  background: color + '25',
                                  color: color,
                                  border: `1px solid ${color}40`,
                                }}
                              >
                                {t.customer?.name || t.order_number?.slice(-4) || t.id.slice(0, 4)}
                              </div>
                            ))}
                            {cellEvents.map(e => (
                              <div
                                key={e.id}
                                title={e.customer?.name || 'אירוע'}
                                className="relative rounded px-1 py-0.5 mb-0.5 text-xs font-medium overflow-hidden min-w-0"
                                style={{
                                  background: color + '25',
                                  color: color,
                                  border: '1px solid #22d3ee',
                                }}
                              >
                                <div className="absolute top-0 left-0 flex items-center gap-0.5 bg-cyan-400 text-white text-[8px] px-1 rounded-br font-bold pointer-events-none">
                                  <Sparkles size={8} />
                                  אירוע
                                </div>
                                <div className="truncate pt-3 min-w-0 font-medium">
                                  {e.customer?.name || 'אירוע'}
                                </div>
                              </div>
                            ))}
                            {cellTows.length + cellEvents.length === 0 && (
                              <button
                                type="button"
                                className="w-full h-5 border border-dashed border-gray-200 rounded text-gray-200 opacity-0 hover:opacity-100 hover:border-gray-300 hover:text-gray-300 flex items-center justify-center text-xs transition-opacity"
                              >
                                +
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>

              {isPickerToday && (
                <div
                  className="pointer-events-none absolute left-0 right-0 h-0.5 bg-red-500 z-10"
                  style={{
                    top: `${getCurrentTimePosition() * PIXELS_PER_HOUR}px`,
                    opacity: 0.7,
                  }}
                />
              )}
            </div>
          </div>
        </div>

        {/* שעה + אישור */}
        <div className="p-4 border-t flex items-center gap-4 justify-between flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">שעת תחילת גרירה</label>
            <TimeInput
              value={pickerTime}
              onChange={setPickerTime}
              showNow
              className="w-28 px-2 py-1 text-sm"
            />
          </div>
          {pendingDriverId && (
            <div className="text-sm text-black font-bold">
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
