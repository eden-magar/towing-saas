'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  ClipboardList, 
  User, 
  Truck,
  Bell,
  LogOut,
  Menu,
  X,
  CheckCircle2
} from 'lucide-react'

export default function DriverLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [showNotifications, setShowNotifications] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  // Mock driver data
  const driver = {
    name: 'דוד אברהם',
    status: 'available' as 'available' | 'busy' | 'unavailable',
    avatar: 'ד',
    truck: 'משאית 1 - 12-345-67'
  }

  // Mock notifications
  const notifications = [
    { id: 1, title: 'משימה חדשה', message: 'קיבלת משימה חדשה מחולון לבת ים', time: 'לפני 5 דקות', unread: true },
    { id: 2, title: 'עדכון מערכת', message: 'המערכת תהיה בתחזוקה הלילה', time: 'לפני שעה', unread: false },
  ]

  const unreadCount = notifications.filter(n => n.unread).length

  const navItems = [
    { href: '/driver', label: 'משימות', icon: ClipboardList },
    { href: '/driver/profile', label: 'פרופיל', icon: User },
  ]

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-emerald-500'
      case 'busy': return 'bg-amber-500'
      case 'unavailable': return 'bg-gray-400'
      default: return 'bg-gray-400'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'available': return 'זמין'
      case 'busy': return 'עסוק'
      case 'unavailable': return 'לא זמין'
      default: return 'לא ידוע'
    }
  }

  return (
    <div dir="rtl" className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top Header */}
      <header className="bg-[#33d4ff] text-white px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-bold text-lg">
              {driver.avatar}
            </div>
            <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#33d4ff] ${getStatusColor(driver.status)}`}></div>
          </div>
          <div>
            <p className="font-bold">{driver.name}</p>
            <p className="text-xs text-white/80">{getStatusText(driver.status)} • {driver.truck}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Notifications */}
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 hover:bg-white/20 rounded-lg"
          >
            <Bell size={22} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] flex items-center justify-center font-bold">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Menu */}
          <button 
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 hover:bg-white/20 rounded-lg"
          >
            <Menu size={22} />
          </button>
        </div>
      </header>

      {/* Notifications Dropdown */}
      {showNotifications && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)}></div>
          <div className="absolute top-16 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
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
                    className={`p-3 border-b border-gray-100 last:border-0 ${notif.unread ? 'bg-blue-50' : ''}`}
                  >
                    <div className="flex items-start gap-2">
                      {notif.unread && <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 flex-shrink-0"></div>}
                      <div className="flex-1">
                        <p className="font-medium text-gray-800 text-sm">{notif.title}</p>
                        <p className="text-gray-600 text-xs mt-0.5">{notif.message}</p>
                        <p className="text-gray-400 text-xs mt-1">{notif.time}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {/* Side Menu */}
      {showMenu && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setShowMenu(false)}></div>
            <div className="fixed top-0 left-0 bottom-0 w-72 bg-white z-50 shadow-xl">
            <div className="p-4 bg-[#33d4ff] text-white">
            <button onClick={() => setShowMenu(false)} className="absolute top-4 right-4 ...">
                <X size={20} />
              </button>
              <div className="flex items-center gap-3 mt-2">
                <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center font-bold text-2xl">
                  {driver.avatar}
                </div>
                <div>
                  <p className="font-bold text-lg">{driver.name}</p>
                  <p className="text-sm text-white/80">{driver.truck}</p>
                </div>
              </div>
            </div>
            
            <nav className="p-4">
              <Link 
                href="/driver"
                onClick={() => setShowMenu(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-100 text-gray-700"
              >
                <ClipboardList size={20} />
                <span>המשימות שלי</span>
              </Link>
              <Link 
                href="/driver/profile"
                onClick={() => setShowMenu(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-100 text-gray-700"
              >
                <User size={20} />
                <span>פרופיל</span>
              </Link>
              {/* <Link 
                href="/driver/profile#history"
                onClick={() => setShowMenu(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-100 text-gray-700"
              >
                <CheckCircle2 size={20} />
                <span>היסטוריית גרירות</span>
              </Link> */}
              <Link 
                href="/driver/profile#truck"
                onClick={() => setShowMenu(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-100 text-gray-700"
              >
                <Truck size={20} />
                <span>הגרר שלי</span>
              </Link>
            </nav>

            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
              <button className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-red-50 text-red-600 w-full">
                <LogOut size={20} />
                <span>התנתקות</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Main Content */}
      <main className="flex-1 pb-20">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-30">
        <div className="flex">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex-1 flex flex-col items-center py-3 transition-colors ${
                  isActive 
                    ? 'text-[#33d4ff]' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                <span className={`text-xs mt-1 ${isActive ? 'font-bold' : ''}`}>{item.label}</span>
                {isActive && (
                  <div className="absolute bottom-0 w-12 h-1 bg-[#33d4ff] rounded-t-full"></div>
                )}
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
