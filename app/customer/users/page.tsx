'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/app/lib/AuthContext'
import {
  getCustomerForUser,
  getCustomerUsers,
  createCustomerUser,
  updateCustomerUserRole,
  toggleCustomerUserActive,
  deleteCustomerUser,
} from '@/app/lib/queries/customer-portal'
import type { CustomerUserWithDetails } from '@/app/lib/types'
import {
  Users,
  User,
  Shield,
  Eye,
  UserCheck,
  UserX,
  Plus,
  Trash2,
  X,
  Loader2,
} from 'lucide-react'

const roleLabels: Record<string, { label: string; color: string; bg: string }> = {
  admin: { label: 'מנהל', color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
  manager: { label: 'מנהל תפעול', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  viewer: { label: 'צפייה', color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200' },
}

export default function CustomerUsersPage() {
  const { user, loading: authLoading } = useAuth()
  const [customerInfo, setCustomerInfo] = useState<{
    customerId: string
    customerUserRole: string
  } | null>(null)
  const [customerUsers, setCustomerUsers] = useState<CustomerUserWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddUser, setShowAddUser] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [newUserForm, setNewUserForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    role: 'viewer' as 'admin' | 'manager' | 'viewer',
  })

  useEffect(() => {
    if (authLoading || !user) return

    const load = async () => {
      const info = await getCustomerForUser(user.id)
      if (!info) return
      setCustomerInfo(info)
      const users = await getCustomerUsers(info.customerId)
      setCustomerUsers(users)
      setLoading(false)
    }

    load()
  }, [user, authLoading])

  const loadUsers = async () => {
    if (!customerInfo) return
    const users = await getCustomerUsers(customerInfo.customerId)
    setCustomerUsers(users)
  }

  const handleAddUser = async () => {
    if (!customerInfo || !newUserForm.fullName || !newUserForm.email) return

    setSaving(true)
    setError('')

    try {
      await createCustomerUser(
        newUserForm.email,
        newUserForm.fullName,
        newUserForm.phone || null,
        customerInfo.customerId,
        newUserForm.role
      )

      await loadUsers()
      setNewUserForm({ fullName: '', email: '', phone: '', role: 'viewer' })
      setShowAddUser(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'שגיאה ביצירת המשתמש')
    } finally {
      setSaving(false)
    }
  }

  const handleRoleChange = async (customerUserId: string, newRole: 'admin' | 'manager' | 'viewer') => {
    try {
      await updateCustomerUserRole(customerUserId, newRole)
      await loadUsers()
    } catch (err) {
      console.error('Error updating role:', err)
    }
  }

  const handleToggleActive = async (customerUserId: string, currentActive: boolean) => {
    try {
      await toggleCustomerUserActive(customerUserId, !currentActive)
      await loadUsers()
    } catch (err) {
      console.error('Error toggling active:', err)
    }
  }

  const handleDeleteUser = async (customerUserId: string) => {
    try {
      await deleteCustomerUser(customerUserId)
      setShowDeleteConfirm(null)
      await loadUsers()
    } catch (err) {
      console.error('Error deleting user:', err)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (!customerInfo) {
    return null
  }

  if (customerInfo.customerUserRole !== 'admin') {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
        <Shield size={40} className="mx-auto text-amber-600 mb-3" />
        <h2 className="text-lg font-bold text-amber-800 mb-2">אין הרשאה לניהול משתמשים</h2>
        <p className="text-sm text-amber-700">רק מנהל פורטל יכול לנהל משתמשים.</p>
      </div>
    )
  }

  return (
    <div dir="rtl" className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">ניהול משתמשים</h1>
        <p className="text-sm text-gray-500 mt-1">ניהול הרשאות משתמשים בפורטל</p>
      </div>

      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">
          משתמשים אלו יכולים להתחבר לפורטל הלקוח ולצפות בגרירות
        </p>
        <button
          onClick={() => {
            setShowAddUser(true)
            setError('')
          }}
          className="flex items-center gap-2 bg-[#33d4ff] text-white px-4 py-2.5 rounded-xl hover:bg-[#21b8e6] transition-colors font-medium text-sm"
        >
          <Plus size={18} />
          הוסף משתמש
        </button>
      </div>

      {customerUsers.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Users size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 mb-1">אין משתמשי פורטל</p>
          <p className="text-sm text-gray-400">הוסף משתמשים כדי לאפשר גישה לפורטל</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="divide-y divide-gray-100">
            {customerUsers.map((cu) => {
              const roleCfg = roleLabels[cu.role] || roleLabels.viewer
              const isCurrentUser = cu.user_id === user?.id

              return (
                <div key={cu.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                        cu.is_active ? 'bg-blue-100' : 'bg-gray-100'
                      }`}>
                        <User size={20} className={cu.is_active ? 'text-blue-600' : 'text-gray-400'} />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`font-medium ${cu.is_active ? 'text-gray-800' : 'text-gray-400'}`}>
                            {cu.user?.full_name || 'ללא שם'}
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
                        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 mt-0.5">
                          <span>{cu.user?.email}</span>
                          {cu.user?.phone && <span>{cu.user.phone}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <select
                        value={cu.role}
                        onChange={(e) => handleRoleChange(cu.id, e.target.value as 'admin' | 'manager' | 'viewer')}
                        className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                        disabled={isCurrentUser}
                      >
                        <option value="admin">מנהל</option>
                        <option value="manager">מנהל תפעול</option>
                        <option value="viewer">צפייה</option>
                      </select>

                      <button
                        onClick={() => handleToggleActive(cu.id, cu.is_active)}
                        disabled={isCurrentUser}
                        className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${
                          cu.is_active
                            ? 'text-gray-400 hover:text-amber-600 hover:bg-amber-50'
                            : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
                        }`}
                        title={cu.is_active ? 'השבת משתמש' : 'הפעל משתמש'}
                      >
                        {cu.is_active ? <UserX size={16} /> : <UserCheck size={16} />}
                      </button>

                      <button
                        onClick={() => setShowDeleteConfirm(cu.id)}
                        disabled={isCurrentUser}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        title="מחק משתמש"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showAddUser && (
        <div className="fixed inset-0 bg-black/50 flex items-end lg:items-center justify-center z-50">
          <div className="bg-white w-full lg:max-w-md lg:rounded-2xl lg:mx-4 overflow-hidden rounded-t-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-[#33d4ff] text-white">
              <h2 className="font-bold text-lg">הוספת משתמש פורטל</h2>
              <button
                onClick={() => setShowAddUser(false)}
                className="p-2 hover:bg-white/20 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-4">
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-sm">
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-sm text-gray-600 mb-1">שם מלא *</label>
                  <input
                    type="text"
                    value={newUserForm.fullName}
                    onChange={(e) => setNewUserForm({ ...newUserForm, fullName: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-1">אימייל *</label>
                  <input
                    type="email"
                    value={newUserForm.email}
                    onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-1">טלפון</label>
                  <input
                    type="tel"
                    value={newUserForm.phone}
                    onChange={(e) => setNewUserForm({ ...newUserForm, phone: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-1">הרשאה</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 'viewer', label: 'צפייה', icon: Eye },
                      { value: 'manager', label: 'מנהל תפעול', icon: Shield },
                      { value: 'admin', label: 'מנהל', icon: Shield },
                    ].map((opt) => {
                      const Icon = opt.icon
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setNewUserForm({ ...newUserForm, role: opt.value as 'admin' | 'manager' | 'viewer' })}
                          className={`p-3 rounded-xl border-2 text-center transition-all ${
                            newUserForm.role === opt.value
                              ? 'border-[#33d4ff] bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <Icon size={18} className={`mx-auto mb-1 ${
                            newUserForm.role === opt.value ? 'text-[#33d4ff]' : 'text-gray-400'
                          }`} />
                          <p className="text-xs font-medium">{opt.label}</p>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddUser(false)}
                    className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-100 transition-colors font-medium"
                  >
                    ביטול
                  </button>
                  <button
                    type="button"
                    onClick={handleAddUser}
                    disabled={!newUserForm.fullName || !newUserForm.email || saving}
                    className="flex-1 py-3 bg-[#33d4ff] text-white rounded-xl hover:bg-[#21b8e6] disabled:bg-gray-300 transition-colors font-medium"
                  >
                    {saving ? (
                      <Loader2 size={18} className="animate-spin mx-auto" />
                    ) : (
                      'צור משתמש'
                    )}
                  </button>
                </div>
              </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={32} className="text-red-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-800 mb-2">מחיקת משתמש</h2>
              <p className="text-gray-600">המשתמש יאבד גישה לפורטל הלקוח. להמשיך?</p>
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-100 transition-colors"
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={() => handleDeleteUser(showDeleteConfirm)}
                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors"
              >
                מחק
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
