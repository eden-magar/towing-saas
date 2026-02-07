'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/app/lib/AuthContext'
import {
  getCustomerForUser,
  getCustomerUsers,
  updateCustomerUserRole,
  toggleCustomerUserActive,
} from '@/app/lib/queries/customer-portal'
import type { CustomerUserWithDetails } from '@/app/lib/types'
import {
  Users,
  User,
  Shield,
  Eye,
  UserCheck,
  UserX,
  Loader2,
  Lock
} from 'lucide-react'

const roleLabels: Record<string, { label: string; color: string; bg: string }> = {
  admin: { label: 'מנהל', color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
  manager: { label: 'מנהל תפעול', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  viewer: { label: 'צפייה', color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200' },
}

export default function CustomerUsersPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [customerInfo, setCustomerInfo] = useState<{
    customerId: string
    customerUserRole: string
  } | null>(null)
  const [customerUsers, setCustomerUsers] = useState<CustomerUserWithDetails[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading || !user) return

    const load = async () => {
      const info = await getCustomerForUser(user.id)
      if (!info) return

      // רק admin יכול לנהל משתמשים
      if (info.customerUserRole !== 'admin') {
        router.push('/customer')
        return
      }

      setCustomerInfo(info)
      const users = await getCustomerUsers(info.customerId)
      setCustomerUsers(users)
      setLoading(false)
    }

    load()
  }, [user, authLoading, router])

  const handleRoleChange = async (customerUserId: string, newRole: 'admin' | 'manager' | 'viewer') => {
    if (!customerInfo) return
    try {
      await updateCustomerUserRole(customerUserId, newRole)
      const users = await getCustomerUsers(customerInfo.customerId)
      setCustomerUsers(users)
    } catch (err) {
      console.error('Error updating role:', err)
    }
  }

  const handleToggleActive = async (customerUserId: string, currentActive: boolean) => {
    if (!customerInfo) return
    try {
      await toggleCustomerUserActive(customerUserId, !currentActive)
      const users = await getCustomerUsers(customerInfo.customerId)
      setCustomerUsers(users)
    } catch (err) {
      console.error('Error toggling active:', err)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">ניהול משתמשים</h1>
        <p className="text-sm text-gray-500 mt-1">ניהול הרשאות משתמשים בפורטל</p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <Lock size={18} className="text-blue-600 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-blue-800">
          להוספת משתמשים חדשים, יש לפנות לחברת הגרירה. כאן ניתן לנהל הרשאות ולהשבית משתמשים קיימים.
        </p>
      </div>

      {customerUsers.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Users size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">אין משתמשים</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
          {customerUsers.map((cu) => {
            const roleCfg = roleLabels[cu.role] || roleLabels.viewer
            const isCurrentUser = cu.user_id === user?.id

            return (
              <div key={cu.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      cu.is_active ? 'bg-blue-100' : 'bg-gray-100'
                    }`}>
                      <User size={20} className={cu.is_active ? 'text-blue-600' : 'text-gray-400'} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${cu.is_active ? 'text-gray-800' : 'text-gray-400'}`}>
                          {cu.user.full_name}
                        </span>
                        {isCurrentUser && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                            את/ה
                          </span>
                        )}
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${roleCfg.bg} ${roleCfg.color}`}>
                          {roleCfg.label}
                        </span>
                        {!cu.is_active && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200">
                            מושבת
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-gray-500 mt-0.5">
                        <span>{cu.user.email}</span>
                        {cu.user.phone && <span>{cu.user.phone}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Actions - don't allow editing yourself */}
                  {!isCurrentUser && (
                    <div className="flex items-center gap-2">
                      <select
                        value={cu.role}
                        onChange={(e) => handleRoleChange(cu.id, e.target.value as any)}
                        className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="admin">מנהל</option>
                        <option value="manager">מנהל תפעול</option>
                        <option value="viewer">צפייה</option>
                      </select>

                      <button
                        onClick={() => handleToggleActive(cu.id, cu.is_active)}
                        className={`p-2 rounded-lg transition-colors ${
                          cu.is_active
                            ? 'text-gray-400 hover:text-amber-600 hover:bg-amber-50'
                            : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
                        }`}
                        title={cu.is_active ? 'השבת משתמש' : 'הפעל משתמש'}
                      >
                        {cu.is_active ? <UserX size={16} /> : <UserCheck size={16} />}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}