'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'
import {
  Search,
  Users,
  Loader2,
  RefreshCw,
  Building2,
  Eye,
  UserCheck,
  UserX,
  KeyRound,
  Mail,
  Lock,
  X,
  EyeOff,
  Check
} from 'lucide-react'

interface UserWithCompany {
  id: string
  email: string
  full_name: string | null
  phone: string | null
  role: string
  is_active: boolean
  last_sign_in_at: string | null
  created_at: string
  company_id: string | null
  company: {
    id: string
    name: string
  } | null
}

export default function SuperAdminUsersPage() {
  const [users, setUsers] = useState<UserWithCompany[]>([])
  const [loading, setLoading] = useState(true)
  
  // Filters
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Password Reset Modal
  const [showResetModal, setShowResetModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserWithCompany | null>(null)
  const [resetMethod, setResetMethod] = useState<'email' | 'manual'>('manual')
  const [newPassword, setNewPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [resetSuccess, setResetSuccess] = useState(false)

  useEffect(() => {
    loadUsers()
  }, [roleFilter, statusFilter])

  useEffect(() => {
    const timer = setTimeout(() => {
      loadUsers()
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const loadUsers = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('users')
        .select(`
          *,
          company:companies (id, name)
        `)
        .neq('role', 'super_admin')
        .order('created_at', { ascending: false })

      if (roleFilter !== 'all') {
        query = query.eq('role', roleFilter)
      }

      if (statusFilter === 'active') {
        query = query.eq('is_active', true)
      } else if (statusFilter === 'inactive') {
        query = query.eq('is_active', false)
      }

      if (searchQuery) {
        query = query.or(`full_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`)
      }

      const { data, error } = await query

      if (error) {
        console.error('Error loading users:', error)
      } else {
        setUsers(data || [])
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('users')
      .update({ is_active: !currentStatus })
      .eq('id', userId)

    if (error) {
      console.error('Error updating user:', error)
      alert('שגיאה בעדכון המשתמש')
    } else {
      loadUsers()
    }
  }

  const openResetModal = (user: UserWithCompany) => {
    setSelectedUser(user)
    setResetMethod('manual')
    setNewPassword('')
    setResetSuccess(false)
    setShowResetModal(true)
  }

  const handleResetPassword = async () => {
    if (!selectedUser) return
    
    setResetLoading(true)
    try {
      const response = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUser.id,
          method: resetMethod,
          newPassword: resetMethod === 'manual' ? newPassword : undefined,
          userEmail: selectedUser.email,
          userName: selectedUser.full_name
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'שגיאה באיפוס הסיסמה')
      }

      setResetSuccess(true)
    } catch (error: any) {
      console.error('Error resetting password:', error)
      alert(error.message || 'שגיאה באיפוס הסיסמה')
    } finally {
      setResetLoading(false)
    }
  }

  const closeResetModal = () => {
    setShowResetModal(false)
    setSelectedUser(null)
    setNewPassword('')
    setResetSuccess(false)
  }

  const stats = {
    total: users.length,
    active: users.filter(u => u.is_active).length,
    admins: users.filter(u => u.role === 'company_admin').length,
    dispatchers: users.filter(u => u.role === 'dispatcher').length,
    drivers: users.filter(u => u.role === 'driver').length
  }

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'company_admin': return 'bg-violet-500/20 text-violet-400'
      case 'dispatcher': return 'bg-blue-500/20 text-blue-400'
      case 'driver': return 'bg-amber-500/20 text-amber-400'
      default: return 'bg-slate-600/50 text-slate-400'
    }
  }

  const getRoleName = (role: string) => {
    switch (role) {
      case 'company_admin': return 'מנהל'
      case 'dispatcher': return 'מוקדן'
      case 'driver': return 'נהג'
      default: return role
    }
  }

  return (
    <div>
      {/* Header */}
      <header className="bg-slate-800/50 border-b border-slate-700 sticky top-0 z-40 backdrop-blur">
        <div className="px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">משתמשים</h2>
            <p className="text-slate-400 text-sm">ניהול כל המשתמשים בפלטפורמה</p>
          </div>
          <button
            onClick={loadUsers}
            className="p-2 text-slate-400 hover:text-white bg-slate-700 rounded-xl"
          >
            <RefreshCw size={20} />
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-5 gap-4">
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <p className="text-slate-400 text-sm">סה"כ</p>
            <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
          </div>
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <p className="text-slate-400 text-sm">פעילים</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">{stats.active}</p>
          </div>
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <p className="text-slate-400 text-sm">מנהלים</p>
            <p className="text-2xl font-bold text-violet-400 mt-1">{stats.admins}</p>
          </div>
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <p className="text-slate-400 text-sm">מוקדנים</p>
            <p className="text-2xl font-bold text-blue-400 mt-1">{stats.dispatchers}</p>
          </div>
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <p className="text-slate-400 text-sm">נהגים</p>
            <p className="text-2xl font-bold text-amber-400 mt-1">{stats.drivers}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Search */}
            <div className="relative flex-1 min-w-64">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="text"
                placeholder="חיפוש לפי שם, אימייל או טלפון..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-10 pl-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>

            {/* Role Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400">תפקיד:</span>
              <div className="flex gap-1 bg-slate-700 rounded-lg p-1">
                {[
                  { id: 'all', label: 'הכל' },
                  { id: 'company_admin', label: 'מנהלים' },
                  { id: 'dispatcher', label: 'מוקדנים' },
                  { id: 'driver', label: 'נהגים' },
                ].map((filter) => (
                  <button
                    key={filter.id}
                    onClick={() => setRoleFilter(filter.id)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      roleFilter === filter.id
                        ? 'bg-violet-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400">סטטוס:</span>
              <div className="flex gap-1 bg-slate-700 rounded-lg p-1">
                {[
                  { id: 'all', label: 'הכל' },
                  { id: 'active', label: 'פעילים' },
                  { id: 'inactive', label: 'לא פעילים' },
                ].map((filter) => (
                  <button
                    key={filter.id}
                    onClick={() => setStatusFilter(filter.id)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      statusFilter === filter.id
                        ? 'bg-violet-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 px-5 py-3 bg-slate-700/50 text-sm font-medium text-slate-400 border-b border-slate-700">
            <div className="col-span-3">משתמש</div>
            <div className="col-span-2">חברה</div>
            <div className="col-span-1">תפקיד</div>
            <div className="col-span-1">סטטוס</div>
            <div className="col-span-2">התחברות אחרונה</div>
            <div className="col-span-2">תאריך יצירה</div>
            <div className="col-span-1">פעולות</div>
          </div>

          {/* Loading */}
          {loading && (
            <div className="px-5 py-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-violet-500 mx-auto" />
            </div>
          )}

          {/* Table Body */}
          {!loading && (
            <div className="divide-y divide-slate-700">
              {users.map((user) => (
                <div
                  key={user.id}
                  className={`grid grid-cols-12 gap-4 px-5 py-4 items-center hover:bg-slate-700/30 transition-colors ${
                    !user.is_active ? 'opacity-60' : ''
                  }`}
                >
                  {/* User Info */}
                  <div className="col-span-3 flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-medium text-slate-300">
                        {user.full_name?.charAt(0) || user.email.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-white truncate">{user.full_name || '-'}</p>
                      <p className="text-xs text-slate-500 truncate">{user.email}</p>
                    </div>
                  </div>

                  {/* Company */}
                  <div className="col-span-2">
                    {user.company ? (
                      <Link 
                        href={`/superadmin/companies/${user.company.id}`}
                        className="flex items-center gap-2 text-slate-300 hover:text-violet-400"
                      >
                        <Building2 size={14} className="text-slate-500" />
                        <span className="truncate">{user.company.name}</span>
                      </Link>
                    ) : (
                      <span className="text-slate-500">-</span>
                    )}
                  </div>

                  {/* Role */}
                  <div className="col-span-1">
                    <span className={`px-2 py-1 text-xs font-medium rounded-lg ${getRoleBadge(user.role)}`}>
                      {getRoleName(user.role)}
                    </span>
                  </div>

                  {/* Status */}
                  <div className="col-span-1">
                    <span className={`px-2 py-1 text-xs font-medium rounded-lg ${
                      user.is_active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                      {user.is_active ? 'פעיל' : 'לא פעיל'}
                    </span>
                  </div>

                  {/* Last Login */}
                  <div className="col-span-2 text-sm text-slate-400">
                    {user.last_sign_in_at 
                      ? new Date(user.last_sign_in_at).toLocaleString('he-IL', {
                          day: '2-digit',
                          month: '2-digit',
                          year: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      : 'אף פעם'
                    }
                  </div>

                  {/* Created */}
                  <div className="col-span-2 text-sm text-slate-400">
                    {new Date(user.created_at).toLocaleDateString('he-IL')}
                  </div>

                  {/* Actions */}
                  <div className="col-span-1 flex items-center gap-1">
                    <button
                      onClick={() => openResetModal(user)}
                      className="p-2 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
                      title="איפוס סיסמה"
                    >
                      <KeyRound size={18} />
                    </button>
                    {user.company && (
                      <Link
                        href={`/superadmin/companies/${user.company.id}`}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                        title="צפה בחברה"
                      >
                        <Eye size={18} />
                      </Link>
                    )}
                    <button
                      onClick={() => toggleUserStatus(user.id, user.is_active)}
                      className={`p-2 rounded-lg transition-colors ${
                        user.is_active 
                          ? 'text-slate-400 hover:text-red-400 hover:bg-red-500/10' 
                          : 'text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10'
                      }`}
                      title={user.is_active ? 'השבת' : 'הפעל'}
                    >
                      {user.is_active ? <UserX size={18} /> : <UserCheck size={18} />}
                    </button>
                  </div>
                </div>
              ))}

              {users.length === 0 && !loading && (
                <div className="px-5 py-12 text-center">
                  <Users className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400">לא נמצאו משתמשים</p>
                </div>
              )}
            </div>
          )}

          {/* Pagination */}
          {users.length > 0 && (
            <div className="px-5 py-4 border-t border-slate-700 flex items-center justify-between">
              <p className="text-sm text-slate-400">
                מציג {users.length} משתמשים
              </p>
              <div className="flex items-center gap-2">
                <button className="px-3 py-1.5 text-sm text-slate-500 rounded-lg" disabled>
                  הקודם
                </button>
                <button className="px-3 py-1.5 text-sm bg-violet-600 text-white rounded-lg">1</button>
                <button className="px-3 py-1.5 text-sm text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg">
                  הבא
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Password Reset Modal */}
      {showResetModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 w-full max-w-md">
            {!resetSuccess ? (
              <>
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center">
                      <KeyRound className="text-amber-400" size={24} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">איפוס סיסמה</h3>
                      <p className="text-sm text-slate-400">{selectedUser.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={closeResetModal}
                    className="p-2 text-slate-400 hover:text-white rounded-lg"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Method Selection */}
                <div className="space-y-3 mb-6">
                  <label 
                    className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
                      resetMethod === 'email' 
                        ? 'border-violet-500 bg-violet-500/10' 
                        : 'border-slate-600 hover:border-slate-500'
                    }`}
                    onClick={() => setResetMethod('email')}
                  >
                    <input
                      type="radio"
                      name="reset_method"
                      checked={resetMethod === 'email'}
                      onChange={() => setResetMethod('email')}
                      className="w-5 h-5 text-violet-600"
                    />
                    <Mail size={20} className="text-slate-400" />
                    <div>
                      <p className="text-white font-medium">שלח מייל איפוס</p>
                      <p className="text-sm text-slate-400">המשתמש יקבל קישור לאיפוס סיסמה</p>
                    </div>
                  </label>

                  <label 
                    className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
                      resetMethod === 'manual' 
                        ? 'border-violet-500 bg-violet-500/10' 
                        : 'border-slate-600 hover:border-slate-500'
                    }`}
                    onClick={() => setResetMethod('manual')}
                  >
                    <input
                      type="radio"
                      name="reset_method"
                      checked={resetMethod === 'manual'}
                      onChange={() => setResetMethod('manual')}
                      className="w-5 h-5 text-violet-600"
                    />
                    <Lock size={20} className="text-slate-400" />
                    <div>
                      <p className="text-white font-medium">הגדר סיסמה ידנית</p>
                      <p className="text-sm text-slate-400">הגדר סיסמה חדשה ותעביר למשתמש</p>
                    </div>
                  </label>
                </div>

                {/* Manual Password Input */}
                {resetMethod === 'manual' && (
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      סיסמה חדשה
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 pl-12 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
                        placeholder="לפחות 6 תווים"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                      >
                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={closeResetModal}
                    className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium"
                  >
                    ביטול
                  </button>
                  <button
                    onClick={handleResetPassword}
                    disabled={resetLoading || (resetMethod === 'manual' && newPassword.length < 6)}
                    className="flex-1 px-4 py-3 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-700 text-white rounded-xl font-medium flex items-center justify-center gap-2"
                  >
                    {resetLoading ? (
                      <Loader2 className="animate-spin" size={18} />
                    ) : resetMethod === 'email' ? (
                      <>
                        <Mail size={18} />
                        שלח מייל
                      </>
                    ) : (
                      <>
                        <Lock size={18} />
                        עדכן סיסמה
                      </>
                    )}
                  </button>
                </div>
              </>
            ) : (
              /* Success State */
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="text-emerald-400" size={32} />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">
                  {resetMethod === 'email' ? 'המייל נשלח!' : 'הסיסמה עודכנה!'}
                </h3>
                <p className="text-slate-400 mb-6">
                  {resetMethod === 'email' 
                    ? `מייל איפוס סיסמה נשלח ל-${selectedUser.email}`
                    : 'הסיסמה החדשה עודכנה בהצלחה'
                  }
                </p>
                {resetMethod === 'manual' && newPassword && (
                  <div className="bg-slate-700 rounded-xl p-4 mb-6">
                    <p className="text-sm text-slate-400 mb-2">הסיסמה החדשה:</p>
                    <p className="text-lg font-mono text-white">{newPassword}</p>
                  </div>
                )}
                <button
                  onClick={closeResetModal}
                  className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium"
                >
                  סגור
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}