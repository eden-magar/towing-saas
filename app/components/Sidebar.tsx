'use client'

import { useState, useEffect } from 'react'
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
  Car,
  Menu,
  X,
  Plus
} from 'lucide-react'
import { supabase } from '../lib/supabase'

import { Calendar} from 'lucide-react'

const menuItems = [
  { href: '/dashboard', label: 'דשבורד', icon: LayoutDashboard },
  { href: '/dashboard/tows', label: 'גרירות', icon: Truck },
  { href: '/dashboard/calendar', label: 'יומן', icon: Calendar},
  { href: '/dashboard/drivers', label: 'נהגים', icon: UserCircle },
  { href: '/dashboard/trucks', label: 'גררים', icon: Car },
  { href: '/dashboard/customers', label: 'לקוחות', icon: Users },
  { href: '/dashboard/price-lists', label: 'מחירונים', icon: ClipboardList },
  { href: '/dashboard/invoices', label: 'חשבוניות', icon: FileText },
  { href: '/dashboard/reports', label: 'דוחות', icon: FileText },
  { href: '/dashboard/users', label: 'משתמשים', icon: Users },
  { href: '/dashboard/settings', label: 'הגדרות', icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const currentPage = menuItems.find(item => 
    pathname === item.href || (item.href !== '/dashboard' && pathname?.startsWith(item.href))
  )

  return (
    <>
      <div className="lg:hidden fixed top-0 right-0 left-0 h-16 bg-white border-b border-gray-200 z-40 flex items-center justify-between px-4">
        <button
          onClick={() => setIsOpen(true)}
          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
        >
          <Menu size={24} />
        </button>
        
        <h1 className="text-lg font-bold text-[#33d4ff]">מערכת גרירות</h1>
        
        <Link
          href="/dashboard/tows/new"
          className="p-2 bg-[#33d4ff] text-white rounded-lg hover:bg-[#21b8e6]"
        >
          <Plus size={20} />
        </Link>
      </div>

      <div className="lg:hidden h-16"></div>

      {isOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-50"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside className={`
        fixed lg:static inset-y-0 right-0 z-50
        w-72 lg:w-64 bg-white min-h-screen flex flex-col border-l border-gray-200 shadow-lg lg:shadow-sm
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
      `}>
        
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h1 className="text-xl font-bold text-[#33d4ff]">מערכת גרירות</h1>
          <button
            onClick={() => setIsOpen(false)}
            className="lg:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 p-4 overflow-y-auto">
          <ul className="space-y-1">
            {menuItems.map((item) => {
              const isActive = pathname === item.href || 
                (item.href !== '/dashboard' && pathname?.startsWith(item.href))
              const Icon = item.icon
              
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setIsOpen(false)}
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
    </>
  )
}
