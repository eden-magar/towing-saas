'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Truck, Users, UserCircle, ClipboardList,
  FileText, Settings, LogOut, ChevronLeft, Car, Menu, X,
  Plus, Calendar, Package, Wallet, ChevronRight,
} from 'lucide-react'
import { supabase } from '../lib/supabase'

const menuItems = [
  { href: '/dashboard', label: 'דשבורד', icon: LayoutDashboard },
  { href: '/dashboard/tows', label: 'גרירות', icon: Truck },
  { href: '/dashboard/tasks', label: 'משימות', icon: ClipboardList },
  { href: '/dashboard/calendar', label: 'יומן', icon: Calendar },
  { href: '/dashboard/drivers', label: 'נהגים', icon: UserCircle },
  { href: '/dashboard/trucks', label: 'גררים', icon: Car },
  { href: '/dashboard/storage', label: 'אחסנה', icon: Package },
  { href: '/dashboard/cash', label: 'קופות נהגים', icon: Wallet },
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
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => { document.body.style.overflow = 'unset' }
  }, [isOpen])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <>
      {/* מובייל: header */}
      <div className="lg:hidden fixed top-0 right-0 left-0 h-16 bg-white border-b border-gray-200 z-40 flex items-center justify-between px-4">
        <button onClick={() => setIsOpen(true)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
          <Menu size={24} />
        </button>
        <h1 className="text-lg font-bold text-[#33d4ff]">מערכת גרירות</h1>
        <Link href="/dashboard/tows/new" className="p-2 bg-[#33d4ff] text-white rounded-lg hover:bg-[#21b8e6]">
          <Plus size={20} />
        </Link>
      </div>
      <div className="lg:hidden h-16"></div>

      {/* מובייל: overlay */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/50 z-50" onClick={() => setIsOpen(false)} />
      )}

      {/* סיידבר */}
      <aside className={`
        fixed lg:static inset-y-0 right-0 z-50
        bg-white flex flex-col border-l border-gray-200 shadow-lg lg:shadow-sm
        transform transition-all duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0 invisible lg:visible'}
        ${collapsed ? 'lg:w-16' : 'lg:w-64'}
        w-72
      `}>

        {/* כותרת */}
        <div className={`p-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0 ${collapsed ? 'lg:justify-center' : ''}`}>
          {!collapsed && <h1 className="text-lg font-bold text-[#33d4ff] truncate">מערכת גרירות</h1>}
          <div className="flex items-center gap-1">
            {/* כפתור קיפול — דסקטופ בלבד */}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="hidden lg:flex p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title={collapsed ? 'הרחב תפריט' : 'כווץ תפריט'}
            >
              {collapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
            </button>
            {/* כפתור סגירה — מובייל בלבד */}
            <button onClick={() => setIsOpen(false)} className="lg:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* ניווט */}
        <nav className="flex-1 p-2 overflow-y-auto">
          <ul className="space-y-0.5">
            {menuItems.map((item) => {
              const isActive = pathname === item.href ||
                (item.href !== '/dashboard' && pathname?.startsWith(item.href))
              const Icon = item.icon

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    title={collapsed ? item.label : undefined}
                    className={`flex items-center gap-3 rounded-lg transition-colors
                      ${collapsed ? 'lg:justify-center px-2 py-2.5' : 'px-3 py-2.5'}
                      ${isActive ? 'bg-[#33d4ff] text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}
                    `}
                  >
                    <Icon size={18} className="flex-shrink-0" />
                    {!collapsed && (
                      <>
                        <span className="text-sm">{item.label}</span>
                        {isActive && <ChevronLeft size={14} className="mr-auto" />}
                      </>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* התנתקות */}
        <div className="p-2 border-t border-gray-200 flex-shrink-0">
          <button
            onClick={handleLogout}
            title={collapsed ? 'התנתקות' : undefined}
            className={`flex items-center gap-3 w-full text-gray-600 hover:bg-gray-100 hover:text-gray-900 rounded-lg transition-colors
              ${collapsed ? 'lg:justify-center px-2 py-2.5' : 'px-3 py-2.5'}
            `}
          >
            <LogOut size={18} className="flex-shrink-0" />
            {!collapsed && <span className="text-sm">התנתקות</span>}
          </button>
        </div>
      </aside>
    </>
  )
}