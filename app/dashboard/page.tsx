'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Truck, Users, Clock, CheckCircle } from 'lucide-react'

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

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">דשבורד</h1>
        <p className="text-gray-500 mt-1">ברוך הבא, {user?.email}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, index) => {
          const Icon = stat.icon
          return (
            <div key={index} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm">{stat.label}</p>
                  <p className="text-3xl font-bold text-gray-800 mt-1">{stat.value}</p>
                </div>
                <div className={`${stat.color} p-3 rounded-lg`}>
                  <Icon size={24} className="text-white" />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">גרירות אחרונות</h2>
        </div>
        <div className="p-6">
          <p className="text-gray-400 text-center py-8">אין גרירות להצגה</p>
        </div>
      </div>
    </div>
  )
}