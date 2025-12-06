'use client'

import { useState } from 'react'
import { Plus, Search, Filter, MapPin } from 'lucide-react'
import Link from 'next/link'

export default function TowsPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const tows: any[] = []

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">גרירות</h1>
          <p className="text-gray-500 mt-1">ניהול כל הגרירות במערכת</p>
        </div>
        <Link
          href="/dashboard/tows/new"
          className="flex items-center gap-2 bg-[#33d4ff] hover:bg-[#21b8e6] text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={20} />
          <span>גרירה חדשה</span>
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search size={20} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="חיפוש לפי מספר רכב, לקוח, נהג..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-10 pl-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#33d4ff]"
            />
          </div>
          
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <Filter size={20} className="text-gray-500" />
            <span className="text-gray-600">סינון</span>
          </button>
        </div>

        <div className="flex gap-2 mt-4">
          {['הכל', 'ממתינות', 'בביצוע', 'הושלמו', 'בוטלו'].map((status, index) => (
            <button
              key={status}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                index === 0
                  ? 'bg-[#33d4ff] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        {tows.length === 0 ? (
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
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-right px-6 py-4 text-sm font-medium text-gray-500">מספר</th>
                <th className="text-right px-6 py-4 text-sm font-medium text-gray-500">רכב</th>
                <th className="text-right px-6 py-4 text-sm font-medium text-gray-500">לקוח</th>
                <th className="text-right px-6 py-4 text-sm font-medium text-gray-500">נהג</th>
                <th className="text-right px-6 py-4 text-sm font-medium text-gray-500">סטטוס</th>
                <th className="text-right px-6 py-4 text-sm font-medium text-gray-500">תאריך</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody>
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}