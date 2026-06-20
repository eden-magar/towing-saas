'use client'

import { useState, useEffect, useRef } from 'react'
import {
  getDriverHoursReport,
  getDriverHourlyLocations,
  getShiftEditSummaries,
  backfillLocationAddresses,
  backfillShiftStartAddresses,
  isCoordShapedAddress,
  type DriverHourlyLocationRow,
  type ShiftEditSummary,
} from '../lib/queries/driver-shifts'
import { getDrivers } from '../lib/queries/drivers'
import EditShiftModal, { type EditShiftModalTarget } from './EditShiftModal'
import ShiftEditHistoryModal from './ShiftEditHistoryModal'
import { formatJerusalemDateShort } from '../lib/shift-datetime'
import { Clock, MapPin, Users, Activity, ChevronDown, Edit2, RefreshCw } from 'lucide-react'
import { DateInput } from './ui'

interface Props {
  companyId: string
}

function formatCoordLabel(lat: number | null, lng: number | null): string | null {
  if (lat == null || lng == null) return null
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
}

function renderHourlyLocationAddress(loc: DriverHourlyLocationRow) {
  const hasRealAddress = Boolean(loc.address && !isCoordShapedAddress(loc.address))
  if (hasRealAddress && loc.address) {
    return (
      <span className="flex items-center gap-1.5 text-gray-600">
        <MapPin size={13} className="text-gray-400 flex-shrink-0" />
        {loc.address}
      </span>
    )
  }

  const coordLabel =
    formatCoordLabel(loc.lat, loc.lng) ||
    (loc.address && isCoordShapedAddress(loc.address) ? loc.address.trim() : null)

  if (coordLabel) {
    return (
      <span className="flex items-center gap-1.5 text-gray-500 text-xs font-mono">
        <MapPin size={13} className="text-gray-400 flex-shrink-0" />
        {coordLabel}
      </span>
    )
  }

  return <span className="text-gray-400 text-xs">כתובת לא זמינה</span>
}

const AUTO_BACKFILL_MAX_BUCKETS = 50
const MANUAL_BACKFILL_BATCH_SIZE = 50

export default function DriverHoursTab({ companyId }: Props) {
  const [shifts, setShifts] = useState<any[]>([])
  const [editSummaries, setEditSummaries] = useState<Map<string, ShiftEditSummary>>(new Map())
  const [locations, setLocations] = useState<DriverHourlyLocationRow[]>([])
  const [drivers, setDrivers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeSubTab, setActiveSubTab] = useState<'shifts' | 'locations'>('shifts')
  const [selectedDriver, setSelectedDriver] = useState<string>('all')
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    d.setDate(1)
    return d.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])
  const [editTarget, setEditTarget] = useState<EditShiftModalTarget | null>(null)
  const [historyShiftId, setHistoryShiftId] = useState<string | null>(null)
  const [historyDriverName, setHistoryDriverName] = useState('')
  const [isBackfillingAddresses, setIsBackfillingAddresses] = useState(false)
  const [backfillStatusText, setBackfillStatusText] = useState<string | null>(null)
  const [isBackfillingShiftAddresses, setIsBackfillingShiftAddresses] = useState(false)
  const [shiftBackfillStatusText, setShiftBackfillStatusText] = useState<string | null>(null)
  const backfillCompleteForRangeRef = useRef<string | null>(null)
  const backfillInFlightRef = useRef(false)
  const shiftBackfillInFlightRef = useRef(false)

  const reportStartIso = startDate + 'T00:00:00'
  const reportEndIso = endDate + 'T23:59:59'
  const backfillRangeKey = `${companyId}|${startDate}|${endDate}`

  useEffect(() => {
    backfillCompleteForRangeRef.current = null
  }, [backfillRangeKey])

  useEffect(() => {
    if (!companyId) return
    loadData()
  }, [companyId, startDate, endDate, selectedDriver])

  useEffect(() => {
    if (!companyId) return
    const { supabase } = require('../lib/supabase')
    const channel = supabase
      .channel(`driver-shifts-${companyId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'driver_shifts',
        filter: `company_id=eq.${companyId}`
      }, () => loadData())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [companyId])

  useEffect(() => {
    if (!companyId || loading || activeSubTab !== 'locations') return
    if (backfillCompleteForRangeRef.current === backfillRangeKey) return

    const timer = window.setTimeout(() => {
      void runAutoBackgroundBackfill()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [companyId, backfillRangeKey, loading, activeSubTab])

  const loadData = async () => {
    setLoading(true)
    try {
      const [shiftsData, locationsData, driversData] = await Promise.all([
        getDriverHoursReport(
          companyId,
          reportStartIso,
          reportEndIso,
          selectedDriver !== 'all' ? selectedDriver : undefined
        ),
        getDriverHourlyLocations(
          companyId,
          reportStartIso,
          reportEndIso,
          selectedDriver !== 'all' ? selectedDriver : undefined
        ),
        getDrivers(companyId)
      ])
      const shiftIds = shiftsData.map((s: { id: string }) => s.id)
      const summaries = await getShiftEditSummaries(shiftIds)
      setShifts(shiftsData)
      setEditSummaries(summaries)
      setLocations(locationsData)
      setDrivers(driversData)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const reloadLocationsTable = async () => {
    if (!companyId) return

    try {
      const locationsData = await getDriverHourlyLocations(
        companyId,
        reportStartIso,
        reportEndIso,
        selectedDriver !== 'all' ? selectedDriver : undefined
      )
      setLocations(locationsData)
    } catch (err) {
      console.error('[DriverHoursTab] locations reload failed:', err)
    }
  }

  const runBackfillBatch = async (options: {
    maxCoordBuckets?: number
    skipRemainingCount?: boolean
    statusLabel: string
  }) => {
    if (!companyId || backfillInFlightRef.current) return null

    backfillInFlightRef.current = true
    setIsBackfillingAddresses(true)
    setBackfillStatusText(options.statusLabel)

    try {
      const locResult = await backfillLocationAddresses(
        companyId,
        reportStartIso,
        reportEndIso,
        {
          maxCoordBuckets: options.maxCoordBuckets,
          skipRemainingCount: options.skipRemainingCount,
        }
      )

      if (locResult.rowsUpdated > 0) {
        await reloadLocationsTable()
      }

      if (locResult.remainingRowsNeedingBackfill === 0) {
        backfillCompleteForRangeRef.current = backfillRangeKey
      } else {
        backfillCompleteForRangeRef.current = null
      }

      return locResult
    } catch (err) {
      backfillCompleteForRangeRef.current = null
      console.error('[DriverHoursTab] address backfill failed:', err)
      return null
    } finally {
      backfillInFlightRef.current = false
      setIsBackfillingAddresses(false)
    }
  }

  const runAutoBackgroundBackfill = async () => {
    if (backfillCompleteForRangeRef.current === backfillRangeKey) return

    const result = await runBackfillBatch({
      maxCoordBuckets: AUTO_BACKFILL_MAX_BUCKETS,
      skipRemainingCount: true,
      statusLabel: 'מאתר כתובות ברקע...',
    })

    if (result) {
      console.log('[DriverHoursTab] background address backfill finished', result)
    }

    setBackfillStatusText(null)
  }

  const handleRetryAddressBackfill = async () => {
    if (!companyId || backfillInFlightRef.current) return

    backfillCompleteForRangeRef.current = null
    backfillInFlightRef.current = true
    setIsBackfillingAddresses(true)

    try {
      let remaining = Infinity

      while (remaining > 0) {
        setBackfillStatusText('מאתר כתובות ברקע...')

        const locResult = await backfillLocationAddresses(
          companyId,
          reportStartIso,
          reportEndIso,
          {
            maxCoordBuckets: MANUAL_BACKFILL_BATCH_SIZE,
            skipRemainingCount: false,
          }
        )

        console.log('[DriverHoursTab] manual address backfill batch', locResult)

        if (locResult.rowsUpdated > 0) {
          await reloadLocationsTable()
        }

        remaining = locResult.remainingRowsNeedingBackfill

        if (locResult.coordBucketsProcessed === 0) break

        setBackfillStatusText(
          `מאתר כתובות ברקע... (${locResult.rowsUpdated} עודכנו, ${remaining} נותרו)`
        )

        if (remaining === 0) {
          backfillCompleteForRangeRef.current = backfillRangeKey
          break
        }

        backfillCompleteForRangeRef.current = null
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0))
      }

      console.log('[DriverHoursTab] manual address backfill finished', { remaining })
    } catch (err) {
      backfillCompleteForRangeRef.current = null
      console.error('[DriverHoursTab] manual address backfill failed:', err)
    } finally {
      backfillInFlightRef.current = false
      setIsBackfillingAddresses(false)
      setBackfillStatusText(null)
    }
  }

  const handleRetryShiftAddressBackfill = async () => {
    if (!companyId || shiftBackfillInFlightRef.current) return

    shiftBackfillInFlightRef.current = true
    setIsBackfillingShiftAddresses(true)
    setShiftBackfillStatusText('מאתר כתובות משמרות...')

    try {
      const result = await backfillShiftStartAddresses(
        companyId,
        reportStartIso,
        reportEndIso
      )

      console.log('[DriverHoursTab] shift address backfill finished', result)

      if (result.rowsUpdated > 0) {
        await loadData()
      }

      if (result.rowsNeedingBackfill > 0) {
        setShiftBackfillStatusText(
          `עודכנו ${result.rowsUpdated}, ${result.remainingRowsNeedingBackfill} נותרו`
        )
      }
    } catch (err) {
      console.error('[DriverHoursTab] shift address backfill failed:', err)
    } finally {
      shiftBackfillInFlightRef.current = false
      setIsBackfillingShiftAddresses(false)
      window.setTimeout(() => setShiftBackfillStatusText(null), 3000)
    }
  }

  const openEditModal = (shift: any) => {
    setEditTarget({
      shiftId: shift.id,
      driverName: shift.driver?.user?.full_name || 'נהג',
      driverId: shift.driver?.id || shift.driver_id,
      startedAt: shift.started_at,
      endedAt: shift.ended_at ?? null,
      workHoursEnd: shift.driver?.work_hours_end ?? null,
    })
  }

  const openHistoryModal = (shift: any) => {
    setHistoryShiftId(shift.id)
    setHistoryDriverName(shift.driver?.user?.full_name || 'נהג')
  }

  const calcHours = (start: string, end: string | null) => {
    if (!end) return null
    const diff = new Date(end).getTime() - new Date(start).getTime()
    const hours = Math.floor(diff / 3600000)
    const minutes = Math.floor((diff % 3600000) / 60000)
    return `${hours}:${minutes.toString().padStart(2, '0')}`
  }

  const totalHours = shifts.reduce((acc, s) => {
    if (!s.ended_at) return acc
    return acc + (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime())
  }, 0)
  const totalH = Math.floor(totalHours / 3600000)
  const totalM = Math.floor((totalHours % 3600000) / 60000)
  const activeShifts = shifts.filter(s => !s.ended_at).length

  return (
    <div className="mt-4 space-y-4">

      {/* Filters + SubTabs row */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-wrap gap-3 items-end justify-between">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">מתאריך</label>
              <DateInput
                value={startDate}
                onChange={setStartDate}
                className="min-w-[10rem]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">עד תאריך</label>
              <DateInput
                value={endDate}
                onChange={setEndDate}
                className="min-w-[10rem]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">נהג</label>
              <div className="relative">
                <select
                  value={selectedDriver}
                  onChange={e => setSelectedDriver(e.target.value)}
                  className="appearance-none border border-gray-200 rounded-xl px-3 py-2 text-sm pr-8 focus:outline-none focus:ring-2 focus:ring-[#33d4ff]/30"
                >
                  <option value="all">כל הנהגים</option>
                  {drivers.map((d: any) => (
                    <option key={d.id} value={d.id}>{d.user?.full_name || d.id}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Sub tabs */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveSubTab('shifts')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeSubTab === 'shifts'
                  ? 'bg-white text-gray-800 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Clock size={14} />
              דוח משמרות
            </button>
            <button
              onClick={() => setActiveSubTab('locations')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeSubTab === 'locations'
                  ? 'bg-white text-gray-800 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <MapPin size={14} />
              מיקומים שעתיים
            </button>
          </div>
        </div>
      </div>

      {activeSubTab === 'shifts' && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                <Users size={18} className="text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800">{shifts.length}</p>
                <p className="text-xs text-gray-500">משמרות</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#33d4ff]/10 flex items-center justify-center flex-shrink-0">
                <Clock size={18} className="text-[#33d4ff]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800">{totalH}:{totalM.toString().padStart(2, '0')}</p>
                <p className="text-xs text-gray-500">סה"כ שעות</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
                <Activity size={18} className="text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800">{activeShifts}</p>
                <p className="text-xs text-gray-500">משמרות פעילות</p>
              </div>
            </div>
          </div>

          {/* Shifts Table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-gray-100">
              <p className="text-xs text-gray-500">
                {shiftBackfillStatusText ??
                  (isBackfillingShiftAddresses
                    ? 'מאתר כתובות משמרות...'
                    : 'כתובות משמרות מוצגות לפי מיקום התחלה/סיום')}
              </p>
              <button
                type="button"
                onClick={handleRetryShiftAddressBackfill}
                disabled={isBackfillingShiftAddresses || loading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw size={13} className={isBackfillingShiftAddresses ? 'animate-spin' : ''} />
                נסה לאתר כתובות משמרות מחדש
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-right px-5 py-3.5 font-medium text-gray-500 text-xs">נהג</th>
                    <th className="text-right px-5 py-3.5 font-medium text-gray-500 text-xs">תאריך</th>
                    <th className="text-right px-5 py-3.5 font-medium text-gray-500 text-xs">כניסה</th>
                    <th className="text-right px-5 py-3.5 font-medium text-gray-500 text-xs">יציאה</th>
                    <th className="text-right px-5 py-3.5 font-medium text-gray-500 text-xs">סה"כ</th>
                    <th className="text-right px-5 py-3.5 font-medium text-gray-500 text-xs">מיקום התחלה</th>
                    <th className="text-right px-5 py-3.5 font-medium text-gray-500 text-xs">מיקום סיום</th>
                    <th className="text-right px-5 py-3.5 font-medium text-gray-500 text-xs">גרירה אחרונה</th>
                    <th className="text-right px-5 py-3.5 font-medium text-gray-500 text-xs">סטטוס</th>
                    <th className="text-right px-5 py-3.5 font-medium text-gray-500 text-xs">עריכה</th>
                    <th className="text-right px-5 py-3.5 font-medium text-gray-500 text-xs">פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={11} className="text-center py-12 text-gray-400">
                      <Clock size={24} className="mx-auto mb-2 opacity-30" />
                      טוען...
                    </td></tr>
                  ) : shifts.length === 0 ? (
                    <tr><td colSpan={11} className="text-center py-12 text-gray-400">
                      <Users size={24} className="mx-auto mb-2 opacity-30" />
                      אין נתונים לתקופה זו
                    </td></tr>
                  ) : shifts.map((shift: any) => {
                    const summary = editSummaries.get(shift.id)
                    return (
                      <tr key={shift.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                        <td className="px-5 py-3.5 font-medium text-gray-800">{shift.driver?.user?.full_name || '—'}</td>
                        <td className="px-5 py-3.5 text-gray-500">{new Date(shift.started_at).toLocaleDateString('he-IL')}</td>
                        <td className="px-5 py-3.5 text-gray-700 font-medium">{new Date(shift.started_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</td>
                        <td className="px-5 py-3.5 text-gray-700">
                          {shift.ended_at
                            ? new Date(shift.ended_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-5 py-3.5">
                          {calcHours(shift.started_at, shift.ended_at)
                            ? <span className="font-semibold text-[#33d4ff]">{calcHours(shift.started_at, shift.ended_at)}</span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-5 py-3.5 text-gray-500 text-xs max-w-[140px] truncate">
                          {shift.start_address || (shift.start_lat ? `${shift.start_lat.toFixed(4)}, ${shift.start_lng.toFixed(4)}` : <span className="text-gray-300">—</span>)}
                        </td>
                        <td className="px-5 py-3.5 text-gray-500 text-xs max-w-[140px] truncate">
                          {shift.end_address || (shift.end_lat ? `${shift.end_lat.toFixed(4)}, ${shift.end_lng.toFixed(4)}` : <span className="text-gray-300">—</span>)}
                        </td>
                        <td className="px-5 py-3.5 text-xs">
                          {shift.last_tow
                            ? <span className="font-medium text-gray-700">{new Date(shift.last_tow.updated_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
                            : <span className="text-gray-400">טרם בוצעה גרירה</span>}
                        </td>
                        <td className="px-5 py-3.5">
                          {shift.ended_at
                            ? <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-600">הסתיימה</span>
                            : <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-green-50 text-green-700">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                פעילה
                              </span>}
                        </td>
                        <td className="px-5 py-3.5">
                          {summary ? (
                            <button
                              type="button"
                              onClick={() => openHistoryModal(shift)}
                              className="text-xs text-blue-700 hover:underline text-right"
                            >
                              נערך {formatJerusalemDateShort(summary.last_edited_at)} ע&quot;י {summary.last_edited_by_name}
                              {summary.edit_count > 1 ? ` (${summary.edit_count}x)` : ''}
                            </button>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <button
                            type="button"
                            onClick={() => openEditModal(shift)}
                            aria-label="עריכת משמרת"
                            className="rounded-lg p-1.5 hover:bg-gray-100 text-gray-500"
                          >
                            <Edit2 size={16} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeSubTab === 'locations' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-gray-100">
            <p className="text-xs text-gray-500">
              {backfillStatusText ??
                (isBackfillingAddresses
                  ? 'מאתר כתובות ברקע...'
                  : 'כתובות נטענות מהמיקום השעתי האחרון בכל שעה')}
            </p>
            <button
              type="button"
              onClick={handleRetryAddressBackfill}
              disabled={isBackfillingAddresses || loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw size={13} className={isBackfillingAddresses ? 'animate-spin' : ''} />
              נסה לאתר כתובות מחדש
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-right px-5 py-3.5 font-medium text-gray-500 text-xs">נהג</th>
                  <th className="text-right px-5 py-3.5 font-medium text-gray-500 text-xs">תאריך</th>
                  <th className="text-right px-5 py-3.5 font-medium text-gray-500 text-xs">שעה</th>
                  <th className="text-right px-5 py-3.5 font-medium text-gray-500 text-xs">כתובת</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={4} className="text-center py-12 text-gray-400">
                    <MapPin size={24} className="mx-auto mb-2 opacity-30" />
                    טוען...
                  </td></tr>
                ) : locations.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-12 text-gray-400">
                    <MapPin size={24} className="mx-auto mb-2 opacity-30" />
                    אין נתוני מיקום לתקופה זו
                  </td></tr>
                ) : locations.map((loc) => {
                  const hourLabel = `${String(loc.hour).padStart(2, '0')}:00`
                  const dateLabel = new Date(`${loc.date}T12:00:00`).toLocaleDateString('he-IL')
                  return (
                    <tr
                      key={`${loc.driver_id}-${loc.date}-${loc.hour}`}
                      className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="px-5 py-3.5 font-medium text-gray-800">{loc.driver_name}</td>
                      <td className="px-5 py-3.5 text-gray-500">{dateLabel}</td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-1.5 font-medium text-gray-700">
                          <Clock size={13} className="text-[#33d4ff]" />
                          {hourLabel}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {renderHourlyLocationAddress(loc)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <EditShiftModal
        open={!!editTarget}
        target={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={async () => {
          setEditTarget(null)
          await loadData()
        }}
      />
      <ShiftEditHistoryModal
        open={!!historyShiftId}
        shiftId={historyShiftId}
        driverName={historyDriverName}
        onClose={() => {
          setHistoryShiftId(null)
          setHistoryDriverName('')
        }}
      />
    </div>
  )
}
