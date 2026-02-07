'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/app/lib/AuthContext'
import { getCustomerForUser } from '@/app/lib/queries/customer-portal'
import {
  Truck,
  LayoutDashboard,
  Users,
  LogOut,
  Loader2,
  Menu,
  X
} from 'lucide-react'

interface CustomerInfo {
  customerId: string
  customerName: string
  customerType: string
  customerUserRole: string
}

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading, signOut } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      router.push('/login')
      return
    }

    if (user.role !== 'customer') {
      router.push('/dashboard')
      return
    }

    const loadCustomer = async () => {
      const info = await getCustomerForUser(user.id)
      if (!info) {
        router.push('/login')
        return
      }
      setCustomerInfo(info)
      setLoading(false)
    }

    loadCustomer()
  }, [user, authLoading, router])

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  if (authLoading || loading) {
    return (
      <div dir="rtl" className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-gray-500">טוען...</p>
        </div>
      </div>
    )
  }

  if (!customerInfo) return null

  const navItems = [
    { href: '/customer', label: 'גרירות', icon: LayoutDashboard },
    { href: '/customer/users', label: 'משתמשים', icon: Users, adminOnly: true },
  ]

  const visibleNavItems = navItems.filter(
    item => !item.adminOnly || customerInfo.customerUserRole === 'admin'
  )

  return (
    <div dir="rtl" className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="flex items-center justify-between px-4 h-16">
          {/* Logo + Name */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
              <Truck size={20} className="text-white" />
            </div>
            <div>
              <h1 className="font-bold text-gray-900 text-sm">{customerInfo.customerName}</h1>
              <p className="text-xs text-gray-500">פורטל לקוח</p>
            </div>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden sm:flex items-center gap-1">
            {visibleNavItems.map(item => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <button
                  key={item.href}
                  onClick={() => router.push(item.href)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Icon size={18} />
                  {item.label}
                </button>
              )
            })}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <span className="hidden sm:block text-sm text-gray-500">
              {user?.full_name}
            </span>
            <button
              onClick={handleSignOut}
              className="hidden sm:flex items-center gap-1 text-sm text-gray-500 hover:text-red-600 transition-colors"
            >
              <LogOut size={16} />
              יציאה
            </button>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="sm:hidden p-2 text-gray-600"
            >
              {menuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {menuOpen && (
          <div className="sm:hidden border-t border-gray-100 bg-white px-4 py-3 space-y-1">
            {visibleNavItems.map(item => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <button
                  key={item.href}
                  onClick={() => {
                    router.push(item.href)
                    setMenuOpen(false)
                  }}
                  className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium ${
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Icon size={18} />
                  {item.label}
                </button>
              )
            })}
            <div className="border-t border-gray-100 pt-2 mt-2">
              <p className="text-xs text-gray-400 px-3 mb-2">{user?.full_name}</p>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-red-600 hover:bg-red-50"
              >
                <LogOut size={18} />
                יציאה
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Content */}
      <main className="p-4 sm:p-6 max-w-6xl mx-auto">
        {children}
      </main>
    </div>
  )
}