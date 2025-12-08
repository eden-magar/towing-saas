'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../../lib/AuthContext'
import { 
  Search, 
  Plus, 
  MoreVertical,
  Mail,
  Phone,
  ShieldCheck,
  ShieldAlert,
  User,
  Truck,
  Headphones,
  Crown,
  X,
  Clock,
  AlertTriangle,
  ChevronLeft,
  Edit,
  Trash2,
  Key,
  Ban,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  RefreshCw
} from 'lucide-react'
import {
  getUsers,
  getUserStats,
  createUser,
  updateUser,
  toggleUserStatus,
  deleteUser,
  getRoleLabel,
  getRoleColor,
  UserWithDetails,
  UserStats,
  UserRole
} from '../../lib/queries/users'

export default function UsersPage() {
  const { companyId } = useAuth()
  
  // Data state
  const [users, setUsers] = useState<UserWithDetails[]>([])
  const [stats, setStats] = useState<UserStats>({ total: 0, active: 0, pending: 0, disabled: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'disabled'>('all')

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserWithDetails | null>(null)
  const [showActionsMenu, setShowActionsMenu] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state
  const [newUser, setNewUser] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    role: 'dispatcher' as UserRole
  })
  const [showPassword, setShowPassword] = useState(false)

  // Load data
  useEffect(() => {
    if (companyId) {
      loadData()
    }
  }, [companyId])

  async function loadData() {
    if (!companyId) return
    setLoading(true)
    setError('')

    try {
      const [usersData, statsData] = await Promise.all([
        getUsers(companyId),
        getUserStats(companyId)
      ])
      setUsers(usersData)
      setStats(statsData)
    } catch (err) {
      console.error('Error loading users:', err)
      setError('שגיאה בטעינת המשתמשים')
    } finally {
      setLoading(false)
    }
  }

  // Filter users
  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.phone && user.phone.includes(searchQuery))
    
    const matchesRole = roleFilter === 'all' || user.role === roleFilter
    
    const matchesStatus = 
      statusFilter === 'all' ||
      (statusFilter === 'active' && user.is_active) ||
      (statusFilter === 'disabled' && !user.is_active)
    
    return matchesSearch && matchesRole && matchesStatus
  })

  // Create user
  async function handleCreateUser() {
    if (!companyId || !newUser.full_name || !newUser.email || !newUser.password) return

    setSaving(true)
    setError('')

    try {
      await createUser({
        email: newUser.email,
        password: newUser.password,
        full_name: newUser.full_name,
        phone: newUser.phone || undefined,
        role: newUser.role,
        company_id: companyId
      })

      setShowAddModal(false)
      setNewUser({
        full_name: '',
        email: '',
        phone: '',
        password: '',
        role: 'dispatcher'
      })
      await loadData()
    } catch (err: any) {
      console.error('Error creating user:', err)
      if (err.message?.includes('already registered')) {
        setError('כתובת האימייל כבר קיימת במערכת')
      } else {
        setError('שגיאה ביצירת המשתמש')
      }
    } finally {
      setSaving(false)
    }
  }

  // Toggle status
  async function handleToggleStatus(user: UserWithDetails) {
    try {
      await toggleUserStatus(user.id)
      await loadData()
      setShowActionsMenu(null)
    } catch (err) {
      console.error('Error toggling status:', err)
      setError('שגיאה בעדכון הסטטוס')
    }
  }

  // Delete user
  async function handleDeleteUser() {
    if (!selectedUser) return

    setSaving(true)
    try {
      await deleteUser(selectedUser.id)
      setShowDeleteConfirm(false)
      setSelectedUser(null)
      await loadData()
    } catch (err) {
      console.error('Error deleting user:', err)
      setError('שגיאה במחיקת המשתמש')
    } finally {
      setSaving(false)
    }
  }

  // Open modals
  function openUserDetail(user: UserWithDetails) {
    setSelectedUser(user)
    setShowDetailModal(true)
    setShowActionsMenu(null)
  }

  function openEditUser(user: UserWithDetails) {
    setSelectedUser(user)
    setShowEditModal(true)
    setShowActionsMenu(null)
  }

  // Get role icon
  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'super_admin':
      case 'company_admin':
        return <Crown size={16} className="text-amber-500" />
      case 'dispatcher':
        return <Headphones size={16} className="text-blue-500" />
      case 'driver':
        return <Truck size={16} className="text-emerald-500" />
      default:
        return <User size={16} className="text-gray-500" />
    }
  }

  // Format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('he-IL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  // Generate password
  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
    let password = ''
    for (let i = 0; i < 10; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setNewUser({ ...newUser, password })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-gray-500">טוען משתמשים...</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center justify-between">
          {error}
          <button onClick={() => setError('')} className="text-red-500 hover:text-red-700">
            <X size={18} />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">ניהול משתמשים</h1>
            <p className="text-gray-500 mt-1">הוספה, עריכה והשבתת משתמשים</p>
          </div>
          <button 
            onClick={() => setShowAddModal(true)}
            className="hidden lg:flex items-center gap-2 px-5 py-2.5 bg-cyan-500 text-white rounded-xl font-medium hover:bg-cyan-600 transition-colors"
          >
            <Plus size={20} />
            הוסף משתמש
          </button>
        </div>
        
        {/* Mobile Add Button */}
        <button 
          onClick={() => setShowAddModal(true)}
          className="lg:hidden flex items-center justify-center gap-2 px-5 py-3 bg-cyan-500 text-white rounded-xl font-medium w-full"
        >
          <Plus size={20} />
          הוסף משתמש
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <User size={20} className="text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
              <p className="text-sm text-gray-500">סה"כ משתמשים</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <CheckCircle size={20} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-600">{stats.active}</p>
              <p className="text-sm text-gray-500">פעילים</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <Clock size={20} className="text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
              <p className="text-sm text-gray-500">ממתינים</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <XCircle size={20} className="text-gray-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-400">{stats.disabled}</p>
              <p className="text-sm text-gray-500">מושבתים</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="חיפוש לפי שם, אימייל או טלפון..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-10 pl-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
            />
          </div>
          
          {/* Role Filter */}
          <div className="flex gap-2 overflow-x-auto pb-2 lg:pb-0">
            {[
              { id: 'all', label: 'הכל' },
              { id: 'company_admin', label: 'מנהלים' },
              { id: 'dispatcher', label: 'מוקדנים' },
              { id: 'driver', label: 'נהגים' },
            ].map((role) => (
              <button
                key={role.id}
                onClick={() => setRoleFilter(role.id as any)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  roleFilter === role.id
                    ? 'bg-cyan-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {role.label}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <div className="flex gap-2">
            {[
              { id: 'all', label: 'כל הסטטוסים' },
              { id: 'active', label: 'פעיל' },
              { id: 'disabled', label: 'מושבת' },
            ].map((status) => (
              <button
                key={status.id}
                onClick={() => setStatusFilter(status.id as any)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  statusFilter === status.id
                    ? 'bg-gray-800 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {status.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Users List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Desktop Table */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-right px-5 py-3 text-sm font-medium text-gray-500">משתמש</th>
                <th className="text-right px-5 py-3 text-sm font-medium text-gray-500">תפקיד</th>
                <th className="text-right px-5 py-3 text-sm font-medium text-gray-500">סטטוס</th>
                <th className="text-right px-5 py-3 text-sm font-medium text-gray-500">טלפון</th>
                <th className="text-right px-5 py-3 text-sm font-medium text-gray-500">נוצר</th>
                <th className="text-right px-5 py-3 text-sm font-medium text-gray-500">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-gray-600">
                          {user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">{user.full_name}</p>
                        <p className="text-sm text-gray-500">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg ${getRoleColor(user.role)}`}>
                      {getRoleIcon(user.role)}
                      {getRoleLabel(user.role)}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg ${
                      user.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {user.is_active ? (
                        <>
                          <CheckCircle size={14} />
                          פעיל
                        </>
                      ) : (
                        <>
                          <XCircle size={14} />
                          מושבת
                        </>
                      )}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-600">
                    {user.phone || '—'}
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-500">
                    {formatDate(user.created_at)}
                  </td>
                  <td className="px-5 py-3">
                    <div className="relative">
                      <button 
                        onClick={() => setShowActionsMenu(showActionsMenu === user.id ? null : user.id)}
                        className="p-2 hover:bg-gray-100 rounded-lg"
                      >
                        <MoreVertical size={18} className="text-gray-400" />
                      </button>
                      
                      {showActionsMenu === user.id && (
                        <div className="absolute left-0 top-full mt-1 w-48 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-10">
                          <button 
                            onClick={() => openUserDetail(user)}
                            className="w-full px-4 py-2 text-right text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                          >
                            <Eye size={16} />
                            צפה בפרטים
                          </button>
                          <button 
                            onClick={() => openEditUser(user)}
                            className="w-full px-4 py-2 text-right text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                          >
                            <Edit size={16} />
                            ערוך
                          </button>
                          <button 
                            onClick={() => handleToggleStatus(user)}
                            className="w-full px-4 py-2 text-right text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                          >
                            {user.is_active ? (
                              <>
                                <Ban size={16} />
                                השבת
                              </>
                            ) : (
                              <>
                                <CheckCircle size={16} />
                                הפעל
                              </>
                            )}
                          </button>
                          <hr className="my-1" />
                          <button 
                            onClick={() => {
                              setSelectedUser(user)
                              setShowDeleteConfirm(true)
                              setShowActionsMenu(null)
                            }}
                            className="w-full px-4 py-2 text-right text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                          >
                            <Trash2 size={16} />
                            מחק
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile List */}
        <div className="lg:hidden divide-y divide-gray-100">
          {filteredUsers.map((user) => (
            <div 
              key={user.id} 
              className="p-4 hover:bg-gray-50"
              onClick={() => openUserDetail(user)}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-gray-600">
                      {user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">{user.full_name}</p>
                    <p className="text-sm text-gray-500">{user.email}</p>
                  </div>
                </div>
                <ChevronLeft size={20} className="text-gray-400" />
              </div>
              <div className="flex items-center gap-2 mr-15">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-lg ${getRoleColor(user.role)}`}>
                  {getRoleIcon(user.role)}
                  {getRoleLabel(user.role)}
                </span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-lg ${
                  user.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {user.is_active ? 'פעיל' : 'מושבת'}
                </span>
              </div>
            </div>
          ))}
        </div>

        {filteredUsers.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            <User size={48} className="mx-auto text-gray-300 mb-3" />
            <p>לא נמצאו משתמשים</p>
          </div>
        )}
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white w-full sm:rounded-2xl sm:max-w-lg sm:mx-4 overflow-hidden max-h-[95vh] flex flex-col rounded-t-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-cyan-500 text-white flex-shrink-0">
              <h2 className="font-bold text-lg">הוספת משתמש חדש</h2>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-white/20 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">שם מלא *</label>
                <input
                  type="text"
                  value={newUser.full_name}
                  onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="לדוגמה: ישראל ישראלי"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">אימייל *</label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="email@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">טלפון</label>
                <input
                  type="tel"
                  value={newUser.phone}
                  onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="050-0000000"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">סיסמה זמנית *</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      placeholder="סיסמה זמנית"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={generatePassword}
                    className="px-4 py-3 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-colors"
                  >
                    <Key size={18} />
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">המשתמש יתבקש להחליף את הסיסמה בהתחברות הראשונה</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">תפקיד *</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'company_admin', label: 'מנהל', icon: Crown, color: 'text-amber-500' },
                    { id: 'dispatcher', label: 'מוקדן', icon: Headphones, color: 'text-blue-500' },
                    { id: 'driver', label: 'נהג', icon: Truck, color: 'text-emerald-500' },
                  ].map((role) => (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => setNewUser({ ...newUser, role: role.id as UserRole })}
                      className={`p-3 rounded-xl border-2 text-center transition-colors ${
                        newUser.role === role.id
                          ? 'border-cyan-500 bg-cyan-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <role.icon size={24} className={`mx-auto mb-1 ${role.color}`} />
                      <span className="text-sm font-medium text-gray-800">{role.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <div className="flex items-start gap-3">
                  <ShieldCheck size={20} className="text-blue-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-blue-800">הרשאות ברירת מחדל</p>
                    <p className="text-sm text-blue-700 mt-1">
                      {newUser.role === 'company_admin' && 'גישה מלאה לכל המערכת'}
                      {newUser.role === 'dispatcher' && 'גרירות, נהגים, לקוחות, חשבוניות'}
                      {newUser.role === 'driver' && 'צפייה ועדכון גרירות בלבד'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 px-5 py-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-100"
              >
                ביטול
              </button>
              <button
                onClick={handleCreateUser}
                disabled={!newUser.full_name || !newUser.email || !newUser.password || saving}
                className={`flex-1 py-3 rounded-xl font-medium flex items-center justify-center gap-2 ${
                  newUser.full_name && newUser.email && newUser.password && !saving
                    ? 'bg-cyan-500 text-white hover:bg-cyan-600'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                {saving ? (
                  <RefreshCw size={18} className="animate-spin" />
                ) : (
                  <Plus size={18} />
                )}
                {saving ? 'שומר...' : 'הוסף משתמש'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Detail Modal */}
      {showDetailModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white w-full sm:rounded-2xl sm:max-w-lg sm:mx-4 overflow-hidden max-h-[95vh] flex flex-col rounded-t-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-cyan-500 text-white flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <span className="font-medium">
                    {selectedUser.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </span>
                </div>
                <div>
                  <h2 className="font-bold text-lg">{selectedUser.full_name}</h2>
                  <p className="text-white/80 text-sm">{getRoleLabel(selectedUser.role)}</p>
                </div>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="p-2 hover:bg-white/20 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              {/* Status */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <span className="text-gray-600">סטטוס</span>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg ${
                  selectedUser.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'
                }`}>
                  {selectedUser.is_active ? (
                    <>
                      <CheckCircle size={16} />
                      פעיל
                    </>
                  ) : (
                    <>
                      <XCircle size={16} />
                      מושבת
                    </>
                  )}
                </span>
              </div>

              {/* Contact Info */}
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <Mail size={18} className="text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">אימייל</p>
                    <p className="text-gray-800">{selectedUser.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <Phone size={18} className="text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">טלפון</p>
                    <p className="text-gray-800">{selectedUser.phone || '—'}</p>
                  </div>
                </div>
              </div>

              {/* Driver info */}
              {selectedUser.role === 'driver' && selectedUser.driver && (
                <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-xl">
                  <Truck size={18} className="text-emerald-600" />
                  <div>
                    <p className="text-sm text-emerald-600">סטטוס נהג</p>
                    <p className="text-emerald-800 font-medium">{selectedUser.driver.status}</p>
                  </div>
                </div>
              )}

              {/* Metadata */}
              <div className="p-4 bg-gray-50 rounded-xl space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">נוצר בתאריך</span>
                  <span className="text-gray-800">{formatDate(selectedUser.created_at)}</span>
                </div>
                {selectedUser.id_number && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">ת.ז.</span>
                    <span className="text-gray-800">{selectedUser.id_number}</span>
                  </div>
                )}
                {selectedUser.address && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">כתובת</span>
                    <span className="text-gray-800">{selectedUser.address}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 px-5 py-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
              <button
                onClick={() => {
                  setShowDetailModal(false)
                  openEditUser(selectedUser)
                }}
                className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-100 flex items-center justify-center gap-2"
              >
                <Edit size={18} />
                ערוך
              </button>
              <button
                onClick={() => {
                  handleToggleStatus(selectedUser)
                  setShowDetailModal(false)
                }}
                className={`flex-1 py-3 rounded-xl font-medium flex items-center justify-center gap-2 ${
                  selectedUser.is_active
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
                }`}
              >
                {selectedUser.is_active ? (
                  <>
                    <Ban size={18} />
                    השבת
                  </>
                ) : (
                  <>
                    <CheckCircle size={18} />
                    הפעל
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl max-w-md mx-4 overflow-hidden">
            <div className="p-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={32} className="text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 text-center mb-2">מחיקת משתמש</h3>
              <p className="text-gray-500 text-center mb-6">
                האם אתה בטוח שברצונך למחוק את המשתמש <strong>{selectedUser.full_name}</strong>?
                <br />
                פעולה זו אינה ניתנת לביטול.
              </p>
              
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false)
                    setSelectedUser(null)
                  }}
                  className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-100"
                >
                  ביטול
                </button>
                <button
                  onClick={handleDeleteUser}
                  disabled={saving}
                  className="flex-1 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <RefreshCw size={18} className="animate-spin" />
                  ) : (
                    <Trash2 size={18} />
                  )}
                  {saving ? 'מוחק...' : 'מחק'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Click outside to close menus */}
      {showActionsMenu && (
        <div 
          className="fixed inset-0 z-5" 
          onClick={() => setShowActionsMenu(null)}
        />
      )}
    </div>
  )
}