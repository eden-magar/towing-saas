'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '../lib/AuthContext'
import { getDriverByUserId, DriverInfo } from '../lib/queries/driver-tasks'
import { supabase } from '../lib/supabase'
import { 
  Home,
  History,
  PieChart,
  UserCircle,
  Bell,
  X,
  Loader2,
  Truck,
  ChevronDown
} from 'lucide-react'

interface Notification {
  id: string
  title: string
  body: string
  created_at: string
  is_read: boolean
}

export default function DriverLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const { user, loading: authLoading } = useAuth()
  
  const [driverInfo, setDriverInfo] = useState<DriverInfo | null>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [showNotifications, setShowNotifications] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showStatusPicker, setShowStatusPicker] = useState(false)

  // בדיקה אם אנחנו בדף משימה
  const isTaskPage = pathname.includes('/driver/task/')

  // טעינת פרטי נהג והתראות
  useEffect(() => {
    if (!authLoading && user) {
      loadDriverInfo()
      loadNotifications()
    }
  }, [authLoading, user])

  const loadDriverInfo = async () => {
    if (!user) return
    try {
      const driver = await getDriverByUserId(user.id)
      setDriverInfo(driver)
    } catch (err) {
      console.error('Error loading driver info:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadNotifications = async () => {
    if (!user) return
    try {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10)
      
      setNotifications(data || [])
    } catch (err) {
      console.error('Error loading notifications:', err)
    }
  }

  const updateDriverStatus = async (newStatus: string) => {
    if (!driverInfo?.id) return
    try {
      await supabase
        .from('drivers')
        .update({ status: newStatus })
        .eq('id', driverInfo.id)
      
      setDriverInfo(prev => prev ? { ...prev, status: newStatus as 'available' | 'busy' | 'unavailable' } : null)
      setShowStatusPicker(false)
    } catch (err) {
      console.error('Error updating status:', err)
    }
  }

  const statusOptions = [
    { id: 'available', label: 'זמין', icon: '🟢' },
    { id: 'busy', label: 'בגרירה', icon: '🔵' },
    { id: 'break', label: 'בהפסקה', icon: '🟡' },
    { id: 'unavailable', label: 'לא זמין', icon: '🔴' },
  ]

  const navItems = [
    { href: '/driver', label: 'בית', icon: Home },
    { href: '/driver/history', label: 'היסטוריה', icon: History },
    { href: '/driver/stats', label: 'סטטיסטיקות', icon: PieChart },
    { href: '/driver/profile', label: 'פרופיל', icon: UserCircle },
  ]

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'available': return 'bg-emerald-500'
      case 'busy': return 'bg-amber-500'
      case 'unavailable': return 'bg-gray-400'
      default: return 'bg-gray-400'
    }
  }

  const markAsRead = async (notificationId: string) => {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
    
    setNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
    )
  }

  const getStatusText = (status: string | null) => {
    switch (status) {
      case 'available': return 'זמין'
      case 'busy': return 'עסוק'
      case 'unavailable': return 'לא זמין'
      default: return 'לא ידוע'
    }
  }

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'עכשיו'
    if (diffMins < 60) return `לפני ${diffMins} דקות`
    if (diffHours < 24) return `לפני ${diffHours} שעות`
    return `לפני ${diffDays} ימים`
  }

  const unreadCount = notifications.filter(n => !n.is_read).length

  // פרטי נהג - מהדאטאבייס או ברירת מחדל
  const driverName = driverInfo?.user?.full_name || user?.full_name || 'נהג'
  const driverAvatar = driverName.charAt(0)
  const driverStatus = driverInfo?.status || 'unavailable'
  const driverTruck = driverInfo?.truck 
    ? `${driverInfo.truck.manufacturer || ''} ${driverInfo.truck.model || ''} - ${driverInfo.truck.plate_number}`.trim()
    : 'אין גרר משויך'

  // בדף משימה - לא מציגים את הניווט התחתון
  if (isTaskPage) {
    return (
      <div dir="rtl" className="h-screen overflow-hidden">
        {children}
      </div>
    )
  }

  return (
    <div dir="rtl" className="min-h-screen bg-gray-50 flex flex-col">
      {/* Status Picker Dropdown */}
      {showStatusPicker && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowStatusPicker(false)}></div>
          <div className="absolute top-16 right-4 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden w-48">
            <div className="p-2">
              {statusOptions.map(option => (
                <button
                  key={option.id}
                  onClick={() => updateDriverStatus(option.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                    driverStatus === option.id 
                      ? 'bg-cyan-50 text-cyan-700' 
                      : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <span>{option.icon}</span>
                  <span className="font-medium">{option.label}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Notifications Dropdown */}
      {showNotifications && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)}></div>
          <div className="absolute top-16 left-4 right-4 sm:left-4 sm:right-auto sm:w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
            <div className="p-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-bold text-gray-800">התראות</h3>
              <button onClick={() => setShowNotifications(false)} className="p-1 hover:bg-gray-100 rounded">
                <X size={18} className="text-gray-500" />
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="p-4 text-center text-gray-500 text-sm">אין התראות</p>
              ) : (
                notifications.map(notif => (
                  <div 
                    key={notif.id} 
                    onClick={() => !notif.is_read && markAsRead(notif.id)}
                    className={`p-3 border-b border-gray-100 last:border-0 cursor-pointer ${!notif.is_read ? 'bg-cyan-50' : ''}`}
                  >
                    <div className="flex items-start gap-2">
                      {!notif.is_read && <div className="w-2 h-2 bg-cyan-500 rounded-full mt-1.5 flex-shrink-0"></div>}
                      <div className="flex-1">
                        <p className="font-medium text-gray-800 text-sm">{notif.title}</p>
                        <p className="text-gray-600 text-xs mt-0.5">{notif.body}</p>
                        <p className="text-gray-400 text-xs mt-1">{formatTimeAgo(notif.created_at)}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {/* Main Content */}
      <main className="flex-1 pb-20">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-30 safe-area-bottom">
        <div className="flex justify-around py-2 px-4">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center py-2 px-3 rounded-lg transition-colors ${
                  isActive 
                    ? 'text-blue-600' 
                    : 'text-gray-300 hover:text-gray-400'
                }`}
              >
                <Icon size={24} strokeWidth={isActive ? 2 : 1.5} />
                <span className={`text-xs mt-1 ${isActive ? 'font-medium' : ''}`}>{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}