'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '../lib/AuthContext'
import { checkIsSuperAdmin, getActiveImpersonation, endImpersonation } from '../lib/superadmin'
import {
  LayoutDashboard,
  Building2,
  Users,
  BarChart3,
  CreditCard,
  Settings,
  LogOut,
  Shield,
  X,
  Loader2
} from 'lucide-react'

const navItems = [
  { href: '/superadmin', label: 'דאשבורד', icon: LayoutDashboard },
  { href: '/superadmin/companies', label: 'חברות', icon: Building2 },
  { href: '/superadmin/users', label: 'משתמשים', icon: Users },
  { href: '/superadmin/reports', label: 'דוחות', icon: BarChart3 },
  { href: '/superadmin/billing', label: 'חיובים', icon: CreditCard },
  { href: '/superadmin/settings', label: 'הגדרות', icon: Settings },
]

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, loading: authLoading } = useAuth()
  
  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [impersonation, setImpersonation] = useState<any>(null)

  useEffect(() => {
    checkAccess()
  }, [user, authLoading])

  const checkAccess = async () => {
    if (authLoading) return

    if (!user) {
      router.push('/login')
      return
    }

    const isSuperAdmin = await checkIsSuperAdmin(user.id)
    if (!isSuperAdmin) {
      router.push('/dashboard')
      return
    }

    // Check for active impersonation
    const activeImpersonation = await getActiveImpersonation(user.id)
    setImpersonation(activeImpersonation)

    setAuthorized(true)
    setLoading(false)
  }

  const handleEndImpersonation = async () => {
    if (!impersonation || !user) return
    
    try {
      await endImpersonation(impersonation.id, user.id)
      setImpersonation(null)
    } catch (error) {
      console.error('Error ending impersonation:', error)
    }
  }

  const handleLogout = async () => {
    router.push('/login')
  }

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
      </div>
    )
  }

  if (!authorized) {
    return null
  }

  return (
    <div dir="rtl" className="dark-theme min-h-screen bg-slate-900 text-white">      {/* Impersonation Banner */}
      {impersonation && (
        <div className="fixed top-0 left-0 right-0 bg-amber-500 text-amber-900 py-2 px-4 z-[100] flex items-center justify-center gap-4">
          <Shield size={18} />
          <span className="font-medium">
            מחובר כחברת "{impersonation.company?.name}" - כל הפעולות נרשמות
          </span>
          <button
            onClick={handleEndImpersonation}
            className="flex items-center gap-1 bg-amber-600 hover:bg-amber-700 text-white px-3 py-1 rounded-lg text-sm font-medium"
          >
            <X size={14} />
            יציאה
          </button>
        </div>
      )}

      {/* Sidebar */}
      <aside className={`fixed right-0 bottom-0 w-64 bg-slate-800 border-l border-slate-700 z-50 ${impersonation ? 'top-10' : 'top-0'}`}>
        {/* Logo */}
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold">SA</span>
            </div>
            <div>
              <h1 className="font-bold text-white">Super Admin</h1>
              <p className="text-xs text-slate-400">ניהול פלטפורמה</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || 
              (item.href !== '/superadmin' && pathname.startsWith(item.href))
            const Icon = item.icon

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${
                  isActive
                    ? 'bg-violet-600/20 text-violet-400'
                    : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
                }`}
              >
                <Icon size={20} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* User Info */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-600 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-white">
                {user?.email?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-white truncate">מנהל מערכת</p>
              <p className="text-xs text-slate-400 truncate">{user?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-white transition-colors"
              title="התנתק"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`mr-64 min-h-screen ${impersonation ? 'pt-10' : ''}`}>
        {children}
      </main>
    </div>
  )
}