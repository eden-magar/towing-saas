'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../lib/AuthContext'
import { supabase } from '../../lib/supabase'
import { getDriverByUserId, getDriverStats, DriverInfo } from '../../lib/queries/driver-tasks'
import { 
  User, 
  Truck, 
  Phone, 
  Mail, 
  ChevronLeft, 
  LogOut, 
  Check, 
  Award, 
  Calendar, 
  Target, 
  TrendingUp,
  Loader2
} from 'lucide-react'

const statuses = [
  { id: 'available', label: 'זמין', icon: '🟢' },
  { id: 'busy', label: 'בגרירה', icon: '🔵' },
  { id: 'break', label: 'בהפסקה', icon: '🟡' },
  { id: 'unavailable', label: 'לא זמין', icon: '🔴' },
]

export default function DriverProfilePage() {
  const { user, signOut, loading: authLoading } = useAuth()
  const router = useRouter()
  
  const [driverInfo, setDriverInfo] = useState<DriverInfo | null>(null)
  const [stats, setStats] = useState({ todayTasks: 0, weekCompleted: 0, monthCompleted: 0, totalCompleted: 0, completionRate: 0 })
  const [loading, setLoading] = useState(true)
  const [showStatusModal, setShowStatusModal] = useState(false)

  useEffect(() => {
    if (!authLoading && user) {
      loadData()
    }
  }, [authLoading, user])

  const loadData = async () => {
    if (!user) return
    setLoading(true)
    
    try {
      const driver = await getDriverByUserId(user.id)
      setDriverInfo(driver)
      
      if (driver) {
        // סטטיסטיקות בסיסיות
        const basicStats = await getDriverStats(driver.id)
        
        // סטטיסטיקות נוספות
        const now = new Date()
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
        
        // גרירות שהושלמו החודש
        const { count: monthCompleted } = await supabase
          .from('tows')
          .select('*', { count: 'exact', head: true })
          .eq('driver_id', driver.id)
          .eq('status', 'completed')
          .gte('completed_at', monthStart)
        
        // סה"כ גרירות שהושלמו
        const { count: totalCompleted } = await supabase
          .from('tows')
          .select('*', { count: 'exact', head: true })
          .eq('driver_id', driver.id)
          .eq('status', 'completed')
        
        // סה"כ גרירות (להחשבת אחוז השלמה)
        const { count: totalTows } = await supabase
          .from('tows')
          .select('*', { count: 'exact', head: true })
          .eq('driver_id', driver.id)
          .neq('status', 'pending')
        
        const completionRate = totalTows && totalTows > 0 
          ? Math.round((totalCompleted || 0) / totalTows * 100) 
          : 0
        
        setStats({
          todayTasks: basicStats.todayTasks,
          weekCompleted: basicStats.weekCompleted,
          monthCompleted: monthCompleted || 0,
          totalCompleted: totalCompleted || 0,
          completionRate
        })
      }
    } catch (err) {
      console.error('Error loading profile:', err)
    } finally {
      setLoading(false)
    }
  }

  const updateStatus = async (newStatus: string) => {
    if (!driverInfo?.id) return
    try {
      await supabase
        .from('drivers')
        .update({ status: newStatus })
        .eq('id', driverInfo.id)
      
      setDriverInfo(prev => prev ? { ...prev, status: newStatus as any } : null)
    } catch (err) {
      console.error('Error updating status:', err)
    }
    setShowStatusModal(false)
  }

  const handleLogout = async () => {
    try {
      await signOut()
      router.push('/login')
    } catch (err) {
      console.error('Error signing out:', err)
    }
  }

  const currentStatus = statuses.find(s => s.id === driverInfo?.status) || statuses[3]

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
      </div>
    )
  }

  const driverName = driverInfo?.user?.full_name || user?.full_name || 'נהג'
  const driverPhone = driverInfo?.user?.phone || ''
  const driverEmail = user?.email || ''
  const truckInfo = driverInfo?.truck

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Status Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6">
            <h3 className="text-xl font-bold mb-4 text-center">עדכן סטטוס</h3>
            <div className="space-y-3">
              {statuses.map(status => (
                <button
                  key={status.id}
                  onClick={() => updateStatus(status.id)}
                  className={`w-full p-4 rounded-xl flex items-center gap-3 transition-all ${
                    currentStatus.id === status.id 
                      ? 'bg-blue-100 border-2 border-blue-500' 
                      : 'bg-gray-50 border-2 border-transparent'
                  }`}
                >
                  <span className="text-2xl">{status.icon}</span>
                  <span className="font-medium text-lg text-gray-800">{status.label}</span>
                  {currentStatus.id === status.id && (
                    <Check className="mr-auto text-blue-500" size={24} />
                  )}
                </button>
              ))}
            </div>
            <button 
              onClick={() => setShowStatusModal(false)}
              className="w-full mt-4 p-4 bg-gray-100 border border-gray-300 rounded-xl font-medium text-gray-700"
            >
              ביטול
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 pb-8">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
            <User size={32} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{driverName}</h1>
            <p className="text-blue-200">נהג גרר</p>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-4 space-y-4">
        {/* Status Card */}
        <button 
          onClick={() => setShowStatusModal(true)}
          className="w-full bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">{currentStatus.icon}</span>
            <div className="text-right">
              <div className="text-sm text-gray-500">הסטטוס שלי</div>
              <div className="font-bold text-gray-800">{currentStatus.label}</div>
            </div>
          </div>
          <ChevronLeft size={24} className="text-gray-400" />
        </button>

        {/* Truck Card */}
        {truckInfo && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Truck size={24} className="text-blue-600" />
              </div>
              <div>
                <div className="text-sm text-gray-500">הגרר שלי</div>
                <div className="font-bold text-gray-800">
                  {truckInfo.manufacturer} {truckInfo.model}
                </div>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-1 bg-gray-50 rounded-xl p-3">
                <div className="text-xs text-gray-500 mb-1">לוחית רישוי</div>
                <span className="inline-block bg-yellow-400 text-gray-900 text-sm font-mono font-bold px-3 py-1 rounded border-2 border-yellow-500">
                  {truckInfo.plate_number}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <Calendar size={18} className="text-blue-500" />
              <span className="text-sm text-gray-500">השבוע</span>
            </div>
            <div className="text-2xl font-bold text-gray-800">{stats.weekCompleted}</div>
            <div className="text-xs text-gray-400">גרירות</div>
          </div>
          
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={18} className="text-green-500" />
              <span className="text-sm text-gray-500">החודש</span>
            </div>
            <div className="text-2xl font-bold text-gray-800">{stats.monthCompleted}</div>
            <div className="text-xs text-gray-400">גרירות</div>
          </div>
          
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <Target size={18} className="text-purple-500" />
              <span className="text-sm text-gray-500">סה"כ</span>
            </div>
            <div className="text-2xl font-bold text-gray-800">{stats.totalCompleted}</div>
            <div className="text-xs text-gray-400">גרירות</div>
          </div>
          
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <Award size={18} className="text-yellow-500" />
              <span className="text-sm text-gray-500">אחוז השלמה</span>
            </div>
            <div className={`text-2xl font-bold ${stats.completionRate >= 80 ? 'text-green-600' : stats.completionRate >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
              {stats.completionRate}%
            </div>
            <div className="text-xs text-gray-400">
              {stats.completionRate >= 80 ? 'מצוין!' : stats.completionRate >= 50 ? 'טוב' : 'לשפר'}
            </div>
          </div>
        </div>

        {/* Contact Info */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-800 mb-3">פרטי קשר</h3>
          <div className="space-y-3">
            {driverPhone && (
              <a href={`tel:${driverPhone}`} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <Phone size={20} className="text-green-600" />
                </div>
                <span className="font-medium text-gray-800">{driverPhone}</span>
                <ChevronLeft size={20} className="mr-auto text-gray-400" />
              </a>
            )}
            
            {driverEmail && (
              <a href={`mailto:${driverEmail}`} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Mail size={20} className="text-blue-600" />
                </div>
                <span className="font-medium text-gray-800 text-sm">{driverEmail}</span>
                <ChevronLeft size={20} className="mr-auto text-gray-400" />
              </a>
            )}
          </div>
        </div>

        {/* Logout Button */}
        <button 
          onClick={handleLogout}
          className="w-full p-4 bg-red-50 border border-red-200 rounded-2xl text-red-600 font-bold flex items-center justify-center gap-2"
        >
          <LogOut size={20} />
          התנתק
        </button>
      </div>
    </div>
  )
}