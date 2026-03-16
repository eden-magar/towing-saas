'use client'

import { useState, useEffect } from 'react'
import { getDriverHoursReport, getDriverHourlyLocations } from '../lib/queries/driver-shifts'
import { getDrivers } from '../lib/queries/drivers'
import { Clock, MapPin, Users, Activity, ChevronDown } from 'lucide-react'

interface Props {
  companyId: string
}

export default function DriverHoursTab({ companyId }: Props) {
  const [shifts, setShifts] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])
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

  const loadData = async () => {
    setLoading(true)
    try {
      const [shiftsData, locationsData, driversData] = await Promise.all([
        getDriverHoursReport(
          companyId,
          startDate + 'T00:00:00',
          endDate + 'T23:59:59',
          selectedDriver !== 'all' ? selectedDriver : undefined
        ),
        getDriverHourlyLocations(
          companyId,
          startDate + 'T00:00:00',
          endDate + 'T23:59:59',
          selectedDriver !== 'all' ? selectedDriver : undefined
        ),
        getDrivers(companyId)
      ])
      setShifts(shiftsData)
      setLocations(locationsData)
      setDrivers(driversData)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
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
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">עד תאריך</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]/30"
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
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={9} className="text-center py-12 text-gray-400">
                      <Clock size={24} className="mx-auto mb-2 opacity-30" />
                      טוען...
                    </td></tr>
                  ) : shifts.length === 0 ? (
                    <tr><td colSpan={9} className="text-center py-12 text-gray-400">
                      <Users size={24} className="mx-auto mb-2 opacity-30" />
                      אין נתונים לתקופה זו
                    </td></tr>
                  ) : shifts.map((shift: any) => (
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeSubTab === 'locations' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
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
                ) : locations.map((loc: any) => {
                  const d = new Date(loc.timestamp)
                  d.setMinutes(0, 0, 0)
                  return (
                    <tr key={loc.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3.5 font-medium text-gray-800">{loc.driver?.user?.full_name || '—'}</td>
                      <td className="px-5 py-3.5 text-gray-500">{d.toLocaleDateString('he-IL')}</td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-1.5 font-medium text-gray-700">
                          <Clock size={13} className="text-[#33d4ff]" />
                          {d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {loc.address
                          ? <span className="flex items-center gap-1.5 text-gray-600">
                              <MapPin size={13} className="text-gray-400 flex-shrink-0" />
                              {loc.address}
                            </span>
                          : loc.lat
                            ? <span className="text-gray-400 text-xs">{loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}</span>
                            : <span className="text-gray-300">—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}