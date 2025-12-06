'use client'

import { useState } from 'react'
import { 
  Search, 
  Plus, 
  MoreVertical,
  Mail,
  Phone,
  Shield,
  ShieldCheck,
  ShieldAlert,
  UserCircle,
  User,
  Truck,
  Headphones,
  Crown,
  X,
  Check,
  Clock,
  AlertTriangle,
  ChevronLeft,
  Edit,
  Trash2,
  Send,
  Key,
  Ban,
  CheckCircle,
  XCircle,
  RefreshCw,
  Eye,
  EyeOff,
  Copy,
  Calendar,
  Activity
} from 'lucide-react'

type UserRole = 'admin' | 'dispatcher' | 'driver'
type UserStatus = 'active' | 'pending' | 'disabled'

interface SystemUser {
  id: number
  name: string
  email: string
  phone: string
  role: UserRole
  status: UserStatus
  avatar?: string
  createdAt: string
  lastLogin?: string
  invitedBy?: string
  emailVerified: boolean
  twoFactorEnabled: boolean
  assignedTruck?: string
  permissions: string[]
}

interface ActivityLog {
  id: number
  userId: number
  action: string
  details: string
  timestamp: string
  ip?: string
}

export default function UsersPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | UserStatus>('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [selectedUser, setSelectedUser] = useState<SystemUser | null>(null)
  const [showActionsMenu, setShowActionsMenu] = useState<number | null>(null)
  
  // Add user form state
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'dispatcher' as UserRole,
    sendInvite: true,
    assignedTruck: '',
    permissions: [] as string[]
  })

  // Invite state
  const [inviteSent, setInviteSent] = useState(false)
  const [inviteLink, setInviteLink] = useState('')

  // Mock users data
  const [users, setUsers] = useState<SystemUser[]>([
    {
      id: 1,
      name: 'יוסי כהן',
      email: 'yossi@golan-towing.co.il',
      phone: '050-1234567',
      role: 'admin',
      status: 'active',
      createdAt: '01/01/2024',
      lastLogin: '06/12/2024 14:30',
      emailVerified: true,
      twoFactorEnabled: true,
      permissions: ['all']
    },
    {
      id: 2,
      name: 'שרה לוי',
      email: 'sara@golan-towing.co.il',
      phone: '050-2345678',
      role: 'dispatcher',
      status: 'active',
      createdAt: '15/02/2024',
      lastLogin: '06/12/2024 12:15',
      invitedBy: 'יוסי כהן',
      emailVerified: true,
      twoFactorEnabled: false,
      permissions: ['tows.view', 'tows.create', 'tows.edit', 'drivers.view', 'customers.view', 'customers.create']
    },
    {
      id: 3,
      name: 'דוד אברהם',
      email: 'david@golan-towing.co.il',
      phone: '050-3456789',
      role: 'driver',
      status: 'active',
      createdAt: '01/03/2024',
      lastLogin: '06/12/2024 08:45',
      invitedBy: 'יוסי כהן',
      emailVerified: true,
      twoFactorEnabled: false,
      assignedTruck: 'משאית 1 (12-345-67)',
      permissions: ['tows.view', 'tows.update_status']
    },
    {
      id: 4,
      name: 'יעקב מזרחי',
      email: 'yakov@golan-towing.co.il',
      phone: '050-4567890',
      role: 'driver',
      status: 'active',
      createdAt: '15/03/2024',
      lastLogin: '05/12/2024 18:20',
      invitedBy: 'שרה לוי',
      emailVerified: true,
      twoFactorEnabled: false,
      assignedTruck: 'משאית 2 (23-456-78)',
      permissions: ['tows.view', 'tows.update_status']
    },
    {
      id: 5,
      name: 'מיכל גולן',
      email: 'michal@golan-towing.co.il',
      phone: '050-5678901',
      role: 'dispatcher',
      status: 'pending',
      createdAt: '01/12/2024',
      invitedBy: 'יוסי כהן',
      emailVerified: false,
      twoFactorEnabled: false,
      permissions: ['tows.view', 'tows.create', 'drivers.view']
    },
    {
      id: 6,
      name: 'אבי גולן',
      email: 'avi@golan-towing.co.il',
      phone: '050-6789012',
      role: 'driver',
      status: 'disabled',
      createdAt: '01/06/2024',
      lastLogin: '15/10/2024 10:00',
      invitedBy: 'יוסי כהן',
      emailVerified: true,
      twoFactorEnabled: false,
      permissions: ['tows.view', 'tows.update_status']
    },
  ])

  // Mock activity log
  const activityLogs: ActivityLog[] = [
    { id: 1, userId: 1, action: 'login', details: 'התחברות למערכת', timestamp: '06/12/2024 14:30', ip: '192.168.1.1' },
    { id: 2, userId: 2, action: 'create_tow', details: 'יצירת גרירה T-1045', timestamp: '06/12/2024 12:15', ip: '192.168.1.2' },
    { id: 3, userId: 3, action: 'update_tow', details: 'עדכון סטטוס גרירה T-1044', timestamp: '06/12/2024 08:45', ip: '10.0.0.5' },
    { id: 4, userId: 1, action: 'invite_user', details: 'הזמנת משתמש מיכל גולן', timestamp: '01/12/2024 09:00', ip: '192.168.1.1' },
    { id: 5, userId: 1, action: 'disable_user', details: 'השבתת משתמש אבי גולן', timestamp: '15/10/2024 11:00', ip: '192.168.1.1' },
  ]

  // Available permissions
  const allPermissions = [
    { id: 'tows.view', label: 'צפייה בגרירות', category: 'גרירות' },
    { id: 'tows.create', label: 'יצירת גרירות', category: 'גרירות' },
    { id: 'tows.edit', label: 'עריכת גרירות', category: 'גרירות' },
    { id: 'tows.delete', label: 'מחיקת גרירות', category: 'גרירות' },
    { id: 'tows.update_status', label: 'עדכון סטטוס', category: 'גרירות' },
    { id: 'drivers.view', label: 'צפייה בנהגים', category: 'נהגים' },
    { id: 'drivers.manage', label: 'ניהול נהגים', category: 'נהגים' },
    { id: 'customers.view', label: 'צפייה בלקוחות', category: 'לקוחות' },
    { id: 'customers.create', label: 'יצירת לקוחות', category: 'לקוחות' },
    { id: 'customers.edit', label: 'עריכת לקוחות', category: 'לקוחות' },
    { id: 'invoices.view', label: 'צפייה בחשבוניות', category: 'חשבוניות' },
    { id: 'invoices.create', label: 'הפקת חשבוניות', category: 'חשבוניות' },
    { id: 'reports.view', label: 'צפייה בדוחות', category: 'דוחות' },
    { id: 'settings.manage', label: 'ניהול הגדרות', category: 'מערכת' },
    { id: 'users.manage', label: 'ניהול משתמשים', category: 'מערכת' },
  ]

  // Role presets
  const rolePermissions: Record<UserRole, string[]> = {
    admin: ['all'],
    dispatcher: ['tows.view', 'tows.create', 'tows.edit', 'drivers.view', 'customers.view', 'customers.create', 'invoices.view'],
    driver: ['tows.view', 'tows.update_status']
  }

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'admin': return <Crown size={16} className="text-amber-500" />
      case 'dispatcher': return <Headphones size={16} className="text-blue-500" />
      case 'driver': return <Truck size={16} className="text-emerald-500" />
    }
  }

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case 'admin': return 'מנהל'
      case 'dispatcher': return 'מוקדן'
      case 'driver': return 'נהג'
    }
  }

  const getRoleBadgeStyle = (role: UserRole) => {
    switch (role) {
      case 'admin': return 'bg-amber-100 text-amber-700'
      case 'dispatcher': return 'bg-blue-100 text-blue-700'
      case 'driver': return 'bg-emerald-100 text-emerald-700'
    }
  }

  const getStatusIcon = (status: UserStatus) => {
    switch (status) {
      case 'active': return <CheckCircle size={16} className="text-emerald-500" />
      case 'pending': return <Clock size={16} className="text-amber-500" />
      case 'disabled': return <XCircle size={16} className="text-gray-400" />
    }
  }

  const getStatusLabel = (status: UserStatus) => {
    switch (status) {
      case 'active': return 'פעיל'
      case 'pending': return 'ממתין לאימות'
      case 'disabled': return 'מושבת'
    }
  }

  const getStatusBadgeStyle = (status: UserStatus) => {
    switch (status) {
      case 'active': return 'bg-emerald-100 text-emerald-700'
      case 'pending': return 'bg-amber-100 text-amber-700'
      case 'disabled': return 'bg-gray-100 text-gray-500'
    }
  }

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.includes(searchQuery) || 
                         user.email.includes(searchQuery) ||
                         user.phone.includes(searchQuery)
    const matchesRole = roleFilter === 'all' || user.role === roleFilter
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter
    return matchesSearch && matchesRole && matchesStatus
  })

  const handleAddUser = () => {
    const newId = Math.max(...users.map(u => u.id)) + 1
    const user: SystemUser = {
      id: newId,
      name: newUser.name,
      email: newUser.email,
      phone: newUser.phone,
      role: newUser.role,
      status: newUser.sendInvite ? 'pending' : 'active',
      createdAt: new Date().toLocaleDateString('he-IL'),
      invitedBy: 'יוסי כהן', // Current user
      emailVerified: !newUser.sendInvite,
      twoFactorEnabled: false,
      assignedTruck: newUser.assignedTruck,
      permissions: newUser.permissions.length > 0 ? newUser.permissions : rolePermissions[newUser.role]
    }
    setUsers([...users, user])
    
    if (newUser.sendInvite) {
      // Generate invite link
      setInviteLink(`https://app.golan-towing.co.il/invite/${btoa(newUser.email)}`)
      setInviteSent(true)
      setShowInviteModal(true)
    }
    
    setShowAddModal(false)
    setNewUser({
      name: '',
      email: '',
      phone: '',
      role: 'dispatcher',
      sendInvite: true,
      assignedTruck: '',
      permissions: []
    })
  }

  const handleResendInvite = (user: SystemUser) => {
    setSelectedUser(user)
    setInviteLink(`https://app.golan-towing.co.il/invite/${btoa(user.email)}`)
    setInviteSent(true)
    setShowInviteModal(true)
  }

  const handleToggleStatus = (user: SystemUser) => {
    setUsers(users.map(u => 
      u.id === user.id 
        ? { ...u, status: u.status === 'disabled' ? 'active' : 'disabled' }
        : u
    ))
  }

  const handleDeleteUser = () => {
    if (selectedUser) {
      setUsers(users.filter(u => u.id !== selectedUser.id))
      setShowDeleteConfirm(false)
      setSelectedUser(null)
    }
  }

  const openUserDetail = (user: SystemUser) => {
    setSelectedUser(user)
    setShowDetailModal(true)
    setShowActionsMenu(null)
  }

  const openEditUser = (user: SystemUser) => {
    setSelectedUser(user)
    setShowEditModal(true)
    setShowActionsMenu(null)
  }

  const stats = {
    total: users.length,
    active: users.filter(u => u.status === 'active').length,
    pending: users.filter(u => u.status === 'pending').length,
    disabled: users.filter(u => u.status === 'disabled').length,
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">ניהול משתמשים</h1>
            <p className="text-gray-500 mt-1">הזמנה, עריכה והשבתת משתמשים</p>
          </div>
          <button 
            onClick={() => setShowAddModal(true)}
            className="hidden lg:flex items-center gap-2 px-5 py-2.5 bg-[#33d4ff] text-white rounded-xl font-medium hover:bg-[#21b8e6]"
          >
            <Plus size={20} />
            הוסף משתמש
          </button>
        </div>
        {/* Mobile Add Button */}
        <button 
          onClick={() => setShowAddModal(true)}
          className="lg:hidden flex items-center justify-center gap-2 px-5 py-3 bg-[#33d4ff] text-white rounded-xl font-medium w-full"
        >
          <Plus size={20} />
          הוסף משתמש
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
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
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
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
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
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
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
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
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="חיפוש לפי שם, אימייל או טלפון..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-10 pl-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#33d4ff] text-sm"
            />
          </div>
          
          {/* Role Filter */}
          <div className="flex gap-2 overflow-x-auto pb-2 lg:pb-0">
            {[
              { id: 'all', label: 'הכל' },
              { id: 'admin', label: 'מנהלים' },
              { id: 'dispatcher', label: 'מוקדנים' },
              { id: 'driver', label: 'נהגים' },
            ].map((role) => (
              <button
                key={role.id}
                onClick={() => setRoleFilter(role.id as any)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  roleFilter === role.id
                    ? 'bg-[#33d4ff] text-white'
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
              { id: 'pending', label: 'ממתין' },
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
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Desktop Table */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-right px-5 py-3 text-sm font-medium text-gray-500">משתמש</th>
                <th className="text-right px-5 py-3 text-sm font-medium text-gray-500">תפקיד</th>
                <th className="text-right px-5 py-3 text-sm font-medium text-gray-500">סטטוס</th>
                <th className="text-right px-5 py-3 text-sm font-medium text-gray-500">אימות</th>
                <th className="text-right px-5 py-3 text-sm font-medium text-gray-500">התחברות אחרונה</th>
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
                          {user.name.split(' ').map(n => n[0]).join('')}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">{user.name}</p>
                        <p className="text-sm text-gray-500">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg ${getRoleBadgeStyle(user.role)}`}>
                      {getRoleIcon(user.role)}
                      {getRoleLabel(user.role)}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg ${getStatusBadgeStyle(user.status)}`}>
                      {getStatusIcon(user.status)}
                      {getStatusLabel(user.status)}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      {user.emailVerified ? (
                        <span className="flex items-center gap-1 text-emerald-600 text-sm">
                          <ShieldCheck size={16} />
                          מאומת
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-amber-600 text-sm">
                          <ShieldAlert size={16} />
                          לא מאומת
                        </span>
                      )}
                      {user.twoFactorEnabled && (
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">2FA</span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-500">
                    {user.lastLogin || '—'}
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
                          {user.status === 'pending' && (
                            <button 
                              onClick={() => handleResendInvite(user)}
                              className="w-full px-4 py-2 text-right text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                            >
                              <RefreshCw size={16} />
                              שלח הזמנה מחדש
                            </button>
                          )}
                          <button 
                            onClick={() => {
                              handleToggleStatus(user)
                              setShowActionsMenu(null)
                            }}
                            className="w-full px-4 py-2 text-right text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                          >
                            {user.status === 'disabled' ? (
                              <>
                                <CheckCircle size={16} />
                                הפעל
                              </>
                            ) : (
                              <>
                                <Ban size={16} />
                                השבת
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
                      {user.name.split(' ').map(n => n[0]).join('')}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">{user.name}</p>
                    <p className="text-sm text-gray-500">{user.email}</p>
                  </div>
                </div>
                <ChevronLeft size={20} className="text-gray-400" />
              </div>
              <div className="flex items-center gap-2 mr-15">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-lg ${getRoleBadgeStyle(user.role)}`}>
                  {getRoleIcon(user.role)}
                  {getRoleLabel(user.role)}
                </span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-lg ${getStatusBadgeStyle(user.status)}`}>
                  {getStatusLabel(user.status)}
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
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-[#33d4ff] text-white flex-shrink-0">
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
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                  placeholder="לדוגמה: ישראל ישראלי"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">אימייל *</label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                  placeholder="email@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">טלפון</label>
                <input
                  type="tel"
                  value={newUser.phone}
                  onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                  placeholder="050-0000000"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">תפקיד *</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'admin', label: 'מנהל', icon: Crown, color: 'amber' },
                    { id: 'dispatcher', label: 'מוקדן', icon: Headphones, color: 'blue' },
                    { id: 'driver', label: 'נהג', icon: Truck, color: 'emerald' },
                  ].map((role) => (
                    <button
                      key={role.id}
                      onClick={() => setNewUser({ ...newUser, role: role.id as UserRole })}
                      className={`p-3 rounded-xl border-2 text-center transition-colors ${
                        newUser.role === role.id
                          ? 'border-[#33d4ff] bg-[#33d4ff]/10'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <role.icon size={24} className={`mx-auto mb-1 text-${role.color}-500`} />
                      <span className="text-sm font-medium text-gray-800">{role.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {newUser.role === 'driver' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">שיוך למשאית</label>
                  <select
                    value={newUser.assignedTruck}
                    onChange={(e) => setNewUser({ ...newUser, assignedTruck: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                  >
                    <option value="">בחר משאית...</option>
                    <option value="truck1">משאית 1 (12-345-67)</option>
                    <option value="truck2">משאית 2 (23-456-78)</option>
                    <option value="truck3">משאית 3 (34-567-89)</option>
                  </select>
                </div>
              )}

              <div className="p-4 bg-gray-50 rounded-xl">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newUser.sendInvite}
                    onChange={(e) => setNewUser({ ...newUser, sendInvite: e.target.checked })}
                    className="w-5 h-5 text-[#33d4ff] rounded"
                  />
                  <div>
                    <span className="font-medium text-gray-800">שלח הזמנה במייל</span>
                    <p className="text-sm text-gray-500">המשתמש יקבל קישור להגדרת סיסמה</p>
                  </div>
                </label>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <div className="flex items-start gap-3">
                  <Shield size={20} className="text-blue-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-blue-800">הרשאות ברירת מחדל</p>
                    <p className="text-sm text-blue-700 mt-1">
                      {newUser.role === 'admin' && 'גישה מלאה לכל המערכת'}
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
                onClick={handleAddUser}
                disabled={!newUser.name || !newUser.email}
                className={`flex-1 py-3 rounded-xl font-medium flex items-center justify-center gap-2 ${
                  newUser.name && newUser.email
                    ? 'bg-[#33d4ff] text-white hover:bg-[#21b8e6]'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                {newUser.sendInvite ? (
                  <>
                    <Send size={18} />
                    שלח הזמנה
                  </>
                ) : (
                  <>
                    <Plus size={18} />
                    הוסף משתמש
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Sent Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl max-w-md mx-4 overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail size={32} className="text-emerald-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">ההזמנה נשלחה!</h3>
              <p className="text-gray-500 mb-4">
                הזמנה נשלחה ל-{selectedUser?.email || newUser.email}
              </p>
              
              <div className="p-3 bg-gray-50 rounded-xl mb-4">
                <p className="text-xs text-gray-500 mb-1">קישור להזמנה:</p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={inviteLink}
                    readOnly
                    className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600"
                  />
                  <button 
                    onClick={() => navigator.clipboard.writeText(inviteLink)}
                    className="p-2 hover:bg-gray-200 rounded-lg"
                  >
                    <Copy size={18} className="text-gray-500" />
                  </button>
                </div>
              </div>

              <button
                onClick={() => {
                  setShowInviteModal(false)
                  setInviteSent(false)
                  setSelectedUser(null)
                }}
                className="w-full py-3 bg-[#33d4ff] text-white rounded-xl font-medium hover:bg-[#21b8e6]"
              >
                סגור
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Detail Modal */}
      {showDetailModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white w-full sm:rounded-2xl sm:max-w-lg sm:mx-4 overflow-hidden max-h-[95vh] flex flex-col rounded-t-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-[#33d4ff] text-white flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <span className="font-medium">
                    {selectedUser.name.split(' ').map(n => n[0]).join('')}
                  </span>
                </div>
                <div>
                  <h2 className="font-bold text-lg">{selectedUser.name}</h2>
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
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg ${getStatusBadgeStyle(selectedUser.status)}`}>
                  {getStatusIcon(selectedUser.status)}
                  {getStatusLabel(selectedUser.status)}
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
                  {selectedUser.emailVerified && (
                    <ShieldCheck size={18} className="text-emerald-500 mr-auto" />
                  )}
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <Phone size={18} className="text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">טלפון</p>
                    <p className="text-gray-800">{selectedUser.phone}</p>
                  </div>
                </div>
              </div>

              {/* Assigned Truck */}
              {selectedUser.role === 'driver' && selectedUser.assignedTruck && (
                <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-xl">
                  <Truck size={18} className="text-emerald-600" />
                  <div>
                    <p className="text-sm text-emerald-600">משאית משויכת</p>
                    <p className="text-emerald-800 font-medium">{selectedUser.assignedTruck}</p>
                  </div>
                </div>
              )}

              {/* Security */}
              <div className="p-4 bg-gray-50 rounded-xl space-y-3">
                <h4 className="font-medium text-gray-700">אבטחה</h4>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">אימות דו-שלבי (2FA)</span>
                  <span className={`px-2 py-1 text-xs rounded-lg ${
                    selectedUser.twoFactorEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-500'
                  }`}>
                    {selectedUser.twoFactorEnabled ? 'מופעל' : 'כבוי'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">אימות אימייל</span>
                  <span className={`px-2 py-1 text-xs rounded-lg ${
                    selectedUser.emailVerified ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {selectedUser.emailVerified ? 'מאומת' : 'לא מאומת'}
                  </span>
                </div>
              </div>

              {/* Permissions */}
              <div className="p-4 bg-gray-50 rounded-xl">
                <h4 className="font-medium text-gray-700 mb-2">הרשאות</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedUser.permissions.includes('all') ? (
                    <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs rounded-lg">גישה מלאה</span>
                  ) : (
                    selectedUser.permissions.map((perm) => {
                      const permission = allPermissions.find(p => p.id === perm)
                      return (
                        <span key={perm} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-lg">
                          {permission?.label || perm}
                        </span>
                      )
                    })
                  )}
                </div>
              </div>

              {/* Metadata */}
              <div className="p-4 bg-gray-50 rounded-xl space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">נוצר בתאריך</span>
                  <span className="text-gray-800">{selectedUser.createdAt}</span>
                </div>
                {selectedUser.invitedBy && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">הוזמן על ידי</span>
                    <span className="text-gray-800">{selectedUser.invitedBy}</span>
                  </div>
                )}
                {selectedUser.lastLogin && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">התחברות אחרונה</span>
                    <span className="text-gray-800">{selectedUser.lastLogin}</span>
                  </div>
                )}
              </div>

              {/* Activity Log */}
              <div className="p-4 bg-gray-50 rounded-xl">
                <h4 className="font-medium text-gray-700 mb-3">פעילות אחרונה</h4>
                <div className="space-y-2">
                  {activityLogs
                    .filter(log => log.userId === selectedUser.id)
                    .slice(0, 3)
                    .map((log) => (
                      <div key={log.id} className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">{log.details}</span>
                        <span className="text-gray-400">{log.timestamp}</span>
                      </div>
                    ))}
                  {activityLogs.filter(log => log.userId === selectedUser.id).length === 0 && (
                    <p className="text-gray-400 text-sm">אין פעילות</p>
                  )}
                </div>
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
                  selectedUser.status === 'disabled'
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'bg-red-600 text-white hover:bg-red-700'
                }`}
              >
                {selectedUser.status === 'disabled' ? (
                  <>
                    <CheckCircle size={18} />
                    הפעל
                  </>
                ) : (
                  <>
                    <Ban size={18} />
                    השבת
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
                האם אתה בטוח שברצונך למחוק את המשתמש <strong>{selectedUser.name}</strong>?
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
                  className="flex-1 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 flex items-center justify-center gap-2"
                >
                  <Trash2 size={18} />
                  מחק
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
