'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/app/lib/AuthContext'
import { getCustomerForUser } from '@/app/lib/queries/customer-portal'
import {
  Truck,
  LayoutDashboard,
  Users,
  BookUser,
  LogOut,
  Loader2,
  Menu,
  X,
  PlusCircle,
} from 'lucide-react'
import { canSubmitOrdersViaPortal } from '@/app/lib/utils/portal-settings'

interface CustomerInfo {
  customerId: string
  customerName: string
  customerType: string
  customerUserRole: string
  portalSettings: Record<string, boolean>
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
      setCustomerInfo({
        customerId: info.customerId,
        customerName: info.customerName,
        customerType: info.customerType,
        customerUserRole: info.customerUserRole,
        portalSettings: info.portalSettings,
      })
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
      <div dir="rtl" className="flex flex-1 flex-col min-h-0 items-center justify-center bg-gray-50">
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
    {
      href: '/customer/request/new',
      label: 'הזמן גרירה',
      icon: PlusCircle,
      requiresSubmitOrders: true,
    },
    { href: '/customer/contacts', label: 'אנשי קשר', icon: BookUser },
    { href: '/customer/users', label: 'משתמשים', icon: Users, adminOnly: true },
  ]

  const canSubmitOrders = canSubmitOrdersViaPortal(customerInfo.portalSettings)

  const visibleNavItems = navItems.filter((item) => {
    if (item.adminOnly && customerInfo.customerUserRole !== 'admin') return false
    if (item.requiresSubmitOrders && !canSubmitOrders) return false
    return true
  })

  const isHome = pathname === '/customer'
  const isRequestFlow = pathname.startsWith('/customer/request')

  return (
    <div dir="rtl" className="flex flex-1 flex-col min-h-0 h-full max-h-full overflow-hidden bg-gt-portal-canvas">
      {/* Header */}
      <header className="shrink-0 bg-gt-surface border-b border-gt-border-subtle/80 z-30">
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
              const isActive =
                pathname === item.href ||
                (item.href !== '/customer' && pathname.startsWith(item.href))
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
              const isActive =
                pathname === item.href ||
                (item.href !== '/customer' && pathname.startsWith(item.href))
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

      {/*
        Home (/customer): fill remaining height and let the list column scroll
        (md+). Other routes: main scrolls as usual. Mobile home still page-scrolls.
      */}
      <main
        className={`mx-auto w-full flex-1 min-h-0 ${
          isRequestFlow
            ? 'max-w-6xl px-3 py-2 sm:px-4 sm:py-2.5 overflow-y-auto'
            : isHome
              ? 'max-w-6xl p-4 sm:p-6 flex flex-col overflow-hidden max-md:overflow-y-auto'
              : 'max-w-6xl p-4 sm:p-6 overflow-y-auto'
        }`}
      >
        {children}
      </main>
    </div>
  )
}