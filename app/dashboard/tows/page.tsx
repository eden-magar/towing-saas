'use client'

import { useState } from 'react'
import { Plus, Search, Filter, MapPin, Phone, User, Calendar, ChevronLeft } from 'lucide-react'
import Link from 'next/link'

export default function TowsPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [activeStatus, setActiveStatus] = useState('הכל')
  
  const tows = [
    { id: 1, number: 'T-001', vehicle: '12-345-67', vehicleDesc: 'טויוטה קורולה', customer: 'יוסי כהן', customerPhone: '050-1234567', driver: 'משה לוי', status: 'בביצוע', date: '06/12/2024', time: '10:30', from: 'תל אביב', to: 'חיפה', price: 450 },
    { id: 2, number: 'T-002', vehicle: '23-456-78', vehicleDesc: 'הונדה סיוויק', customer: 'שרה ישראלי', customerPhone: '052-9876543', driver: 'דוד אברהם', status: 'ממתינה', date: '06/12/2024', time: '11:00', from: 'ירושלים', to: 'תל אביב', price: 380 },
    { id: 3, number: 'T-003', vehicle: '34-567-89', vehicleDesc: 'מאזדה 3', customer: 'מוסך רמט', customerPhone: '03-5551234', driver: 'אבי ישראלי', status: 'הושלמה', date: '05/12/2024', time: '14:00', from: 'נתניה', to: 'הרצליה', price: 280 },
  ]

  const statuses = ['הכל', 'ממתינות', 'בביצוע', 'הושלמו', 'בוטלו']

  const statusConfig: Record<string, string> = {
    'ממתינה': 'bg-amber-100 text-amber-700',
    'בביצוע': 'bg-blue-100 text-blue-700',
    'הושלמה': 'bg-emerald-100 text-emerald-700',
    'בוטלה': 'bg-red-100 text-red-700',
  }

  const filteredTows = tows.filter(tow => {
    const matchesSearch = tow.vehicle.includes(searchTerm) || 
                          tow.customer.includes(searchTerm) || 
                          tow.driver.includes(searchTerm)
    const matchesStatus = activeStatus === 'הכל' || tow.status === activeStatus.slice(0, -1) + 'ה'
    return matchesSearch && matchesStatus
  })

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">גרירות</h1>
          <p className="text-gray-500 mt-1 text-sm">ניהול כל הגרירות במערכת</p>
        </div>
        <Link
          href="/dashboard/tows/new"
          className="hidden lg:flex items-center justify-center gap-2 bg-[#33d4ff] hover:bg-[#21b8e6] text-white px-4 py-2.5 rounded-xl transition-colors"
        >
          <Plus size={20} />
          <span>גרירה חדשה</span>
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="חיפוש..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-10 pl-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
            />
          </div>
          
          <button className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors sm:w-auto">
            <Filter size={18} className="text-gray-500" />
            <span className="text-gray-600 text-sm">סינון</span>
          </button>
        </div>

        <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
          {statuses.map((status) => (
            <button
              key={status}
              onClick={() => setActiveStatus(status)}
              className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm transition-colors whitespace-nowrap ${
                activeStatus === status
                  ? 'bg-[#33d4ff] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {filteredTows.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <MapPin size={32} className="text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-800 mb-2">אין גרירות להצגה</h3>
            <p className="text-gray-500 mb-6">צרו את הגרירה הראשונה שלכם</p>
            <Link
              href="/dashboard/tows/new"
              className="inline-flex items-center gap-2 bg-[#33d4ff] hover:bg-[#21b8e6] text-white px-4 py-2 rounded-lg transition-colors"
            >
              <Plus size={20} />
              <span>גרירה חדשה</span>
            </Link>
          </div>
        ) : (
          <>
            <div className="hidden lg:block">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">מספר</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">רכב</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">לקוח</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">נהג</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">מסלול</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">סטטוס</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">מחיר</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredTows.map((tow) => (
                    <tr key={tow.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-4">
                        <span className="font-medium text-gray-800">{tow.number}</span>
                        <p className="text-xs text-gray-500">{tow.date} {tow.time}</p>
                      </td>
                      <td className="px-4 py-4">
                        <span className="font-mono text-gray-800">{tow.vehicle}</span>
                        <p className="text-sm text-gray-500">{tow.vehicleDesc}</p>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-gray-800">{tow.customer}</span>
                        <p className="text-sm text-gray-500">{tow.customerPhone}</p>
                      </td>
                      <td className="px-4 py-4 text-gray-600">{tow.driver}</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <span>{tow.from}</span>
                          <ChevronLeft size={14} />
                          <span>{tow.to}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig[tow.status] || 'bg-gray-100 text-gray-600'}`}>
                          {tow.status}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className="font-medium text-gray-800">{tow.price} ש״ח</span>
                      </td>
                      <td className="px-4 py-4">
                        <Link
                          href={`/dashboard/tows/${tow.id}`}
                          className="text-[#33d4ff] hover:text-[#21b8e6] text-sm font-medium"
                        >
                          פרטים
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="lg:hidden divide-y divide-gray-100">
              {filteredTows.map((tow) => (
                <Link
                  key={tow.id}
                  href={`/dashboard/tows/${tow.id}`}
                  className="block p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-800">{tow.number}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig[tow.status] || 'bg-gray-100 text-gray-600'}`}>
                          {tow.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">{tow.date} | {tow.time}</p>
                    </div>
                    <span className="font-bold text-[#33d4ff]">{tow.price} ש״ח</span>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-3 mb-3">
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                      <span className="text-gray-700">{tow.from}</span>
                    </div>
                    <div className="w-0.5 h-3 bg-gray-300 mr-[3px] my-1"></div>
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                      <span className="text-gray-700">{tow.to}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <User size={14} />
                        <span>{tow.customer}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-500">
                      <span className="font-mono">{tow.vehicle}</span>
                    </div>
                  </div>

                  {tow.driver && (
                    <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-1.5 text-sm text-gray-500">
                      <span>נהג:</span>
                      <span className="text-gray-700">{tow.driver}</span>
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
