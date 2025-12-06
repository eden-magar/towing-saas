'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Truck, Users, Clock, CheckCircle, Plus, ChevronLeft } from 'lucide-react'
import Link from 'next/link'

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      setLoading(false)
      
      if (!user) {
        window.location.href = '/login'
      }
    }
    getUser()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">טוען...</p>
      </div>
    )
  }

  const stats = [
    { label: 'גרירות היום', value: '0', icon: Truck, color: 'bg-[#33d4ff]' },
    { label: 'ממתינות לשיבוץ', value: '0', icon: Clock, color: 'bg-amber-400' },
    { label: 'הושלמו היום', value: '0', icon: CheckCircle, color: 'bg-emerald-400' },
    { label: 'נהגים זמינים', value: '0', icon: Users, color: 'bg-violet-400' },
  ]

  const recentTows = [
    { id: 1, number: 'T-001', vehicle: '12-345-67', customer: 'יוסי כהן', status: 'בביצוע', statusColor: 'bg-blue-100 text-blue-700', from: 'תל אביב', to: 'חיפה' },
    { id: 2, number: 'T-002', vehicle: '23-456-78', customer: 'שרה ישראלי', status: 'ממתינה', statusColor: 'bg-amber-100 text-amber-700', from: 'ירושלים', to: 'תל אביב' },
    { id: 3, number: 'T-003', vehicle: '34-567-89', customer: 'מוסך רמט', status: 'הושלמה', statusColor: 'bg-emerald-100 text-emerald-700', from: 'נתניה', to: 'הרצליה' },
  ]

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">דשבורד</h1>
          <p className="text-gray-500 text-sm mt-1 truncate hidden lg:block">ברוך הבא, {user?.email}</p>
        </div>
        <Link
          href="/dashboard/tows/new"
          className="hidden lg:flex items-center justify-center gap-2 bg-[#33d4ff] hover:bg-[#21b8e6] text-white px-4 py-2.5 rounded-xl transition-colors flex-shrink-0"
        >
          <Plus size={20} />
          <span>גרירה חדשה</span>
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon
          return (
            <div key={index} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center gap-3">
                <div className={`${stat.color} p-2.5 sm:p-3 rounded-lg flex-shrink-0`}>
                  <Icon size={20} className="text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-gray-500 text-xs sm:text-sm truncate">{stat.label}</p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-800">{stat.value}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-semibold text-gray-800">גרירות אחרונות</h2>
          <Link href="/dashboard/tows" className="text-[#33d4ff] text-sm hover:underline">
            הצג הכל
          </Link>
        </div>
        
        {recentTows.length === 0 ? (
          <div className="p-6">
            <p className="text-gray-400 text-center py-8">אין גרירות להצגה</p>
          </div>
        ) : (
          <>
            <div className="hidden sm:block">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">מספר</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">רכב</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">לקוח</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">מסלול</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">סטטוס</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentTows.map((tow) => (
                    <tr key={tow.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-800">{tow.number}</td>
                      <td className="px-4 py-3 font-mono text-gray-600">{tow.vehicle}</td>
                      <td className="px-4 py-3 text-gray-600">{tow.customer}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-sm text-gray-600">
                          <span>{tow.from}</span>
                          <ChevronLeft size={14} />
                          <span>{tow.to}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${tow.statusColor}`}>
                          {tow.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="sm:hidden divide-y divide-gray-100">
              {recentTows.map((tow) => (
                <Link
                  key={tow.id}
                  href={`/dashboard/tows/${tow.id}`}
                  className="flex items-center justify-between p-4 hover:bg-gray-50"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-gray-800">{tow.number}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tow.statusColor}`}>
                        {tow.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{tow.customer}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{tow.from} ← {tow.to}</p>
                  </div>
                  <ChevronLeft size={20} className="text-gray-400 flex-shrink-0" />
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
