'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../../../lib/AuthContext'
import { getDriverHoursReport } from '../../../lib/queries/driver-shifts'
import { getDrivers } from '../../../lib/queries/drivers'
import { Clock, Download, ChevronLeft } from 'lucide-react'
import Link from 'next/link'

export default function DriverHoursPage() {
  const { companyId } = useAuth()
  const [shifts, setShifts] = useState<any[]>([])
  const [drivers, setDrivers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
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

  const loadData = async () => {
    if (!companyId) return
    setLoading(true)
    try {
      const [shiftsData, driversData] = await Promise.all([
        getDriverHoursReport(
          companyId,
          startDate + 'T00:00:00',
          endDate + 'T23:59:59',
          selectedDriver !== 'all' ? selectedDriver : undefined
        ),
        getDrivers(companyId)
      ])
      setShifts(shiftsData)
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

  return (
    <div dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/reports" className="text-gray-400 hover:text-gray-600">
          <ChevronLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">דוח שעות נהגים</h1>
          <p className="text-gray-500 text-sm">משמרות ושעות עבודה</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-sm text-gray-600 mb-1">מתאריך</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">עד תאריך</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">נהג</label>
          <select value={selectedDriver} onChange={e => setSelectedDriver(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
            <option value="all">כל הנהגים</option>
            {drivers.map((d: any) => (
              <option key={d.id} value={d.id}>{d.user?.full_name || d.id}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-gray-800">{shifts.length}</p>
          <p className="text-sm text-gray-500">משמרות</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-gray-800">{totalH}:{totalM.toString().padStart(2, '0')}</p>
          <p className="text-sm text-gray-500">סה"כ שעות</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-gray-800">
            {shifts.filter(s => !s.ended_at).length}
          </p>
          <p className="text-sm text-gray-500">משמרות פעילות</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-right p-4 font-medium text-gray-600">נהג</th>
              <th className="text-right p-4 font-medium text-gray-600">תאריך</th>
              <th className="text-right p-4 font-medium text-gray-600">כניסה</th>
              <th className="text-right p-4 font-medium text-gray-600">יציאה</th>
              <th className="text-right p-4 font-medium text-gray-600">סה"כ</th>
              <th className="text-right p-4 font-medium text-gray-600">סטטוס</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center p-8 text-gray-400">טוען...</td></tr>
            ) : shifts.length === 0 ? (
              <tr><td colSpan={6} className="text-center p-8 text-gray-400">אין נתונים</td></tr>
            ) : shifts.map((shift: any) => (
              <tr key={shift.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="p-4 font-medium text-gray-800">
                  {shift.driver?.user?.full_name || '—'}
                </td>
                <td className="p-4 text-gray-600">
                  {new Date(shift.started_at).toLocaleDateString('he-IL')}
                </td>
                <td className="p-4 text-gray-600">
                  {new Date(shift.started_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                </td>
                <td className="p-4 text-gray-600">
                  {shift.ended_at
                    ? new Date(shift.ended_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
                    : '—'}
                </td>
                <td className="p-4 font-medium text-gray-800">
                  {calcHours(shift.started_at, shift.ended_at) || '—'}
                </td>
                <td className="p-4">
                  {shift.ended_at ? (
                    <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-lg text-xs">הסתיימה</span>
                  ) : (
                    <span className="bg-green-100 text-green-700 px-2 py-1 rounded-lg text-xs">פעילה</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}