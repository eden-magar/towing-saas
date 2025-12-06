'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Truck,
  Users,
  UserCircle,
  ClipboardList,
  FileText,
  Settings,
  LogOut,
  ChevronLeft,
  Car
} from 'lucide-react'
import { supabase } from '../lib/supabase'

const menuItems = [
  { href: '/dashboard', label: 'דשבורד', icon: LayoutDashboard },
  { href: '/dashboard/tows', label: 'גרירות', icon: Truck },
  { href: '/dashboard/drivers', label: 'נהגים', icon: UserCircle },
  { href: '/dashboard/trucks', label: 'גררים', icon: Car },
  { href: '/dashboard/customers', label: 'לקוחות', icon: Users },
  { href: '/dashboard/price-lists', label: 'מחירונים', icon: ClipboardList },
  { href: '/dashboard/reports', label: 'דוחות', icon: FileText },
  { href: '/dashboard/settings', label: 'הגדרות', icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <aside className="w-64 bg-white min-h-screen flex flex-col border-l border-gray-200 shadow-sm">
      
      {/* Logo */}
      <div className="p-6 border-b border-gray-200">
        <h1 className="text-xl font-bold text-[#33d4ff]">מערכת גרירות</h1>
      </div>

      {/* Menu */}
      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {menuItems.map((item) => {
            const isActive = pathname === item.href || 
              (item.href !== '/dashboard' && pathname?.startsWith(item.href))
            const Icon = item.icon
            
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-[#33d4ff] text-white'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <Icon size={20} />
                  <span>{item.label}</span>
                  {isActive && <ChevronLeft size={16} className="mr-auto" />}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-gray-200">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 w-full text-gray-600 hover:bg-gray-100 hover:text-gray-900 rounded-lg transition-colors"
        >
          <LogOut size={20} />
          <span>התנתקות</span>
        </button>
      </div>

    </aside>
  )
}