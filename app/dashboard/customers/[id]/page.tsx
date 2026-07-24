'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/app/lib/AuthContext'
import {
  ArrowRight,
  User,
  Building2,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  FileText,
  Users,
  Plus,
  Edit2,
  Trash2,
  X,
  Loader2,
  Shield,
  Eye,
  UserCheck,
  UserX,
  Copy,
  Check,
  Settings,
  Contact2,
  Briefcase,
  ClipboardList,
  UserPen,
  Calculator,
} from 'lucide-react'
import { supabase } from '@/app/lib/supabase'
import {
  getCustomerUsers,
  createCustomerUser,
  updateCustomerUserRole,
  toggleCustomerUserActive,
  deleteCustomerUser,
} from '@/app/lib/queries/customer-portal'
import {
  getCustomerContacts,
  insertCustomerContact,
  updateCustomerContact,
  deleteCustomerContact,
} from '@/app/lib/queries/customer-contacts'
import {
  getCustomerAddresses,
  insertCustomerAddress,
  updateCustomerAddress,
  deleteCustomerAddress,
} from '@/app/lib/queries/customer-addresses'
import {
  getCustomerOrderers,
  insertCustomerOrderer,
  updateCustomerOrderer,
  deleteCustomerOrderer,
} from '@/app/lib/queries/customer-orderers'
import type {
  CustomerAddress,
  CustomerContact,
  CustomerOrderer,
  CustomerUserRole,
  CustomerUserWithDetails,
} from '@/app/lib/types'
import {
  PORTAL_ROLE_DISPLAY,
  STAFF_ASSIGNABLE_ROLES,
  isCustomerUserRole,
} from '@/app/lib/utils/portal-roles'
import { PhoneInput } from '@/app/components/ui/PhoneInput'
import { AddressInput, type AddressData } from '@/app/components/tow-forms/routes/AddressInput'
import { PinDropModal } from '@/app/components/tow-forms/shared/PinDropModal'
import {
  getStaffCustomerPortalOrders,
  type StaffCustomerPortalOrder,
} from '@/app/lib/queries/customer-tow-requests'
import { PortalOrdersSection } from './PortalOrdersSection'

interface CustomerDetail {
  id: string
  name: string
  customer_type: 'private' | 'business'
  id_number: string | null
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  created_at: string
  company_relation: {
    id: string
    payment_terms: 'immediate' | 'monthly'
    credit_limit: number | null
    discount_percent: number | null
    notes: string | null
    is_active: boolean
  } | null
}

const ROLE_ICONS: Record<CustomerUserRole, typeof Eye> = {
  viewer: Eye,
  manager: Shield,
  admin: Shield,
  accountant: Calculator,
}

export default function CustomerDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { companyId } = useAuth()
  const customerId = params.id as string

  const [customer, setCustomer] = useState<CustomerDetail | null>(null)
  const [customerUsers, setCustomerUsers] = useState<CustomerUserWithDetails[]>([])
  const [customerContacts, setCustomerContacts] = useState<CustomerContact[]>([])
  const [customerAddresses, setCustomerAddresses] = useState<CustomerAddress[]>([])
  const [customerOrderers, setCustomerOrderers] = useState<CustomerOrderer[]>([])
  const [portalOrders, setPortalOrders] = useState<StaffCustomerPortalOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<
    'info' | 'contacts' | 'addresses' | 'orderers' | 'users' | 'settings' | 'portalOrders'
  >('info')
  const [portalSettings, setPortalSettings] = useState<Record<string, boolean>>({})

  // Modal states
  const [showAddUser, setShowAddUser] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [showContactModal, setShowContactModal] = useState(false)
  const [editingContactId, setEditingContactId] = useState<string | null>(null)
  const [showDeleteContactConfirm, setShowDeleteContactConfirm] = useState<string | null>(null)
  const [showAddressModal, setShowAddressModal] = useState(false)
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null)
  const [showDeleteAddressConfirm, setShowDeleteAddressConfirm] = useState<string | null>(null)
  const [showOrdererModal, setShowOrdererModal] = useState(false)
  const [editingOrdererId, setEditingOrdererId] = useState<string | null>(null)
  const [showDeleteOrdererConfirm, setShowDeleteOrdererConfirm] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [tempPassword, setTempPassword] = useState<string | null>(null)
  const [copiedPassword, setCopiedPassword] = useState(false)

  const [newUserForm, setNewUserForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    role: 'viewer' as CustomerUserRole,
  })

  const emptyContactForm = { name: '', phone: '', role_or_title: '', notes: '' }
  const [contactForm, setContactForm] = useState(emptyContactForm)

  const emptyAddressForm = {
    label: '',
    address: '',
    place_id: null as string | null,
    lat: null as number | null,
    lng: null as number | null,
    notes: '',
  }
  const [addressForm, setAddressForm] = useState(emptyAddressForm)
  const [addressPinOpen, setAddressPinOpen] = useState(false)

  const emptyOrdererForm = { department: '', name: '' }
  const [ordererForm, setOrdererForm] = useState(emptyOrdererForm)

  useEffect(() => {
    if (companyId && customerId) {
      loadData()
    }
  }, [companyId, customerId])

  const loadData = async () => {
    setLoading(true)
    try {
      // Load customer details
      const { data: custData, error: custError } = await supabase
        .from('customers')
        .select(`
          id, name, customer_type, id_number, phone, email, address, notes, created_at, portal_settings,
          customer_company (
            id, payment_terms, credit_limit, discount_percent, notes, is_active
          )
        `)
        .eq('id', customerId)
        .single()

      if (custError || !custData) {
        router.push('/dashboard/customers')
        return
      }

      const companyRelations = custData.customer_company as any[]
      const relation = companyRelations?.find((r: any) => r.is_active) || companyRelations?.[0] || null

      setCustomer({
        ...custData,
        customer_type: custData.customer_type as 'private' | 'business',
        company_relation: relation,
      })
      setPortalSettings((custData as { portal_settings?: Record<string, boolean> }).portal_settings || {})

      // Load customer users
      const users = await getCustomerUsers(customerId)
      setCustomerUsers(users)

      if (companyId) {
        const [contacts, addresses, orderers, orders] = await Promise.all([
          getCustomerContacts(companyId, customerId),
          getCustomerAddresses(companyId, customerId),
          getCustomerOrderers(companyId, customerId),
          getStaffCustomerPortalOrders(companyId, customerId),
        ])
        setCustomerContacts(contacts)
        setCustomerAddresses(addresses)
        setCustomerOrderers(orderers)
        setPortalOrders(orders)
      }
    } catch (err) {
      console.error('Error loading customer:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleAddUser = async () => {
    if (!newUserForm.fullName || !newUserForm.email) return

    setSaving(true)
    setError('')

    try {
      await createCustomerUser(
        newUserForm.email,
        newUserForm.fullName,
        newUserForm.phone || null,
        customerId,
        newUserForm.role
      )

      await loadData()
      setNewUserForm({ fullName: '', email: '', phone: '', role: 'viewer' })
      setShowAddUser(false)
      // TODO: אפשר להוסיף toast notification
    } catch (err: any) {
      setError(err.message || 'שגיאה ביצירת המשתמש')
    } finally {
      setSaving(false)
    }
  }

  const handleRoleChange = async (customerUserId: string, newRole: CustomerUserRole) => {
    try {
      await updateCustomerUserRole(customerUserId, newRole)
      await loadData()
    } catch (err) {
      console.error('Error updating role:', err)
    }
  }

  const handleToggleActive = async (customerUserId: string, currentActive: boolean) => {
    try {
      await toggleCustomerUserActive(customerUserId, !currentActive)
      await loadData()
    } catch (err) {
      console.error('Error toggling active:', err)
    }
  }

  const handleDeleteUser = async (customerUserId: string) => {
    try {
      await deleteCustomerUser(customerUserId)
      setShowDeleteConfirm(null)
      await loadData()
    } catch (err) {
      console.error('Error deleting user:', err)
    }
  }

  const openAddContactModal = () => {
    setEditingContactId(null)
    setContactForm(emptyContactForm)
    setError('')
    setShowContactModal(true)
  }

  const openEditContactModal = (contact: CustomerContact) => {
    setEditingContactId(contact.id)
    setContactForm({
      name: contact.name,
      phone: contact.phone || '',
      role_or_title: contact.role_or_title || '',
      notes: contact.notes || '',
    })
    setError('')
    setShowContactModal(true)
  }

  const handleSaveContact = async () => {
    if (!companyId || !contactForm.name.trim()) return

    setSaving(true)
    setError('')

    try {
      const payload = {
        name: contactForm.name,
        phone: contactForm.phone || null,
        role_or_title: contactForm.role_or_title || null,
        notes: contactForm.notes || null,
      }

      if (editingContactId) {
        await updateCustomerContact(companyId, editingContactId, payload)
      } else {
        await insertCustomerContact(companyId, customerId, payload)
      }

      setShowContactModal(false)
      setEditingContactId(null)
      setContactForm(emptyContactForm)
      await loadData()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'שגיאה בשמירת איש הקשר'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteContact = async (contactId: string) => {
    if (!companyId) return

    try {
      await deleteCustomerContact(companyId, contactId)
      setShowDeleteContactConfirm(null)
      await loadData()
    } catch (err) {
      console.error('Error deleting contact:', err)
    }
  }

  const openAddAddressModal = () => {
    setEditingAddressId(null)
    setAddressForm(emptyAddressForm)
    setAddressPinOpen(false)
    setError('')
    setShowAddressModal(true)
  }

  const openEditAddressModal = (row: CustomerAddress) => {
    setEditingAddressId(row.id)
    setAddressForm({
      label: row.label,
      address: row.address,
      place_id: row.place_id,
      lat: row.lat,
      lng: row.lng,
      notes: row.notes || '',
    })
    setAddressPinOpen(false)
    setError('')
    setShowAddressModal(true)
  }

  const handleAddressDataChange = (data: AddressData) => {
    setAddressForm((prev) => ({
      ...prev,
      address: data.address,
      place_id: data.placeId ?? null,
      lat: data.lat ?? null,
      lng: data.lng ?? null,
    }))
  }

  const handleSaveAddress = async () => {
    if (!companyId || !addressForm.label.trim() || !addressForm.address.trim()) return

    setSaving(true)
    setError('')

    try {
      const payload = {
        label: addressForm.label,
        address: addressForm.address,
        place_id: addressForm.place_id,
        lat: addressForm.lat,
        lng: addressForm.lng,
        notes: addressForm.notes || null,
      }

      if (editingAddressId) {
        await updateCustomerAddress(companyId, editingAddressId, payload)
      } else {
        await insertCustomerAddress(companyId, customerId, payload)
      }

      setShowAddressModal(false)
      setEditingAddressId(null)
      setAddressForm(emptyAddressForm)
      setAddressPinOpen(false)
      await loadData()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'שגיאה בשמירת הכתובת'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteAddress = async (addressId: string) => {
    if (!companyId) return

    try {
      await deleteCustomerAddress(companyId, addressId)
      setShowDeleteAddressConfirm(null)
      await loadData()
    } catch (err) {
      console.error('Error deleting address:', err)
    }
  }

  const openAddOrdererModal = () => {
    setEditingOrdererId(null)
    setOrdererForm(emptyOrdererForm)
    setError('')
    setShowOrdererModal(true)
  }

  const openEditOrdererModal = (orderer: CustomerOrderer) => {
    setEditingOrdererId(orderer.id)
    setOrdererForm({
      department: orderer.department || '',
      name: orderer.name,
    })
    setError('')
    setShowOrdererModal(true)
  }

  const handleSaveOrderer = async () => {
    if (!companyId || !ordererForm.name.trim()) return

    setSaving(true)
    setError('')

    try {
      const payload = {
        department: ordererForm.department || null,
        name: ordererForm.name,
      }

      if (editingOrdererId) {
        await updateCustomerOrderer(companyId, editingOrdererId, payload)
      } else {
        await insertCustomerOrderer(companyId, customerId, payload)
      }

      setShowOrdererModal(false)
      setEditingOrdererId(null)
      setOrdererForm(emptyOrdererForm)
      await loadData()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'שגיאה בשמירת המזמין'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteOrderer = async (ordererId: string) => {
    if (!companyId) return

    try {
      await deleteCustomerOrderer(companyId, ordererId)
      setShowDeleteOrdererConfirm(null)
      await loadData()
    } catch (err) {
      console.error('Error deleting orderer:', err)
    }
  }

  const copyPassword = () => {
    if (tempPassword) {
      navigator.clipboard.writeText(tempPassword)
      setCopiedPassword(true)
      setTimeout(() => setCopiedPassword(false), 2000)
    }
  }

  const handlePortalSettingChange = async (key: string, value: boolean) => {
    const newSettings = { ...portalSettings, [key]: value }
    setPortalSettings(newSettings)
    try {
      await supabase
        .from('customers')
        .update({ portal_settings: newSettings })
        .eq('id', customerId)
    } catch (err) {
      console.error('Error updating portal settings:', err)
      setPortalSettings(portalSettings)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-[#33d4ff]" />
      </div>
    )
  }

  if (!customer) return null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/dashboard/customers')}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowRight size={16} />
          חזרה לרשימת לקוחות
        </button>

        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
            customer.customer_type === 'business' ? 'bg-purple-100' : 'bg-blue-100'
          }`}>
            {customer.customer_type === 'business' ? (
              <Building2 size={28} className="text-purple-600" />
            ) : (
              <User size={28} className="text-blue-600" />
            )}
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800">{customer.name}</h1>
            <p className="text-sm text-gray-500">
              {customer.customer_type === 'business' ? 'לקוח עסקי' : 'לקוח פרטי'}
              {customer.id_number && ` · ${customer.customer_type === 'business' ? 'ח.פ' : 'ת.ז'}: ${customer.id_number}`}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-white rounded-xl border border-gray-200 p-1 w-fit">
        <button
          onClick={() => setActiveTab('info')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'info'
              ? 'bg-[#33d4ff] text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <FileText size={16} />
          פרטים
        </button>
        <button
          onClick={() => setActiveTab('contacts')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'contacts'
              ? 'bg-[#33d4ff] text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Contact2 size={16} />
          אנשי קשר
          {customerContacts.length > 0 && (
            <span className={`px-1.5 py-0.5 rounded-full text-xs ${
              activeTab === 'contacts' ? 'bg-white/20' : 'bg-gray-200'
            }`}>
              {customerContacts.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('addresses')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'addresses'
              ? 'bg-[#33d4ff] text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <MapPin size={16} />
          כתובות קבועות
          {customerAddresses.length > 0 && (
            <span className={`px-1.5 py-0.5 rounded-full text-xs ${
              activeTab === 'addresses' ? 'bg-white/20' : 'bg-gray-200'
            }`}>
              {customerAddresses.length}
            </span>
          )}
        </button>
        {customer.customer_type === 'business' && (
          <button
            onClick={() => setActiveTab('orderers')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'orderers'
                ? 'bg-[#33d4ff] text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <UserPen size={16} />
            מזמינים
            {customerOrderers.length > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                activeTab === 'orderers' ? 'bg-white/20' : 'bg-gray-200'
              }`}>
                {customerOrderers.length}
              </span>
            )}
          </button>
        )}
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'users'
              ? 'bg-[#33d4ff] text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Users size={16} />
          משתמשי פורטל
          {customerUsers.length > 0 && (
            <span className={`px-1.5 py-0.5 rounded-full text-xs ${
              activeTab === 'users' ? 'bg-white/20' : 'bg-gray-200'
            }`}>
              {customerUsers.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('portalOrders')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'portalOrders'
              ? 'bg-[#33d4ff] text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <ClipboardList size={16} />
          הזמנות פורטל
          {portalOrders.length > 0 && (
            <span className={`px-1.5 py-0.5 rounded-full text-xs ${
              activeTab === 'portalOrders' ? 'bg-white/20' : 'bg-gray-200'
            }`}>
              {portalOrders.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'settings'
              ? 'bg-[#33d4ff] text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Settings size={16} />
          הגדרות פורטל
        </button>
      </div>

      {/* Info Tab */}
      {activeTab === 'info' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Contact Info */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-bold text-gray-800 mb-4">פרטי התקשרות</h2>
            <div className="space-y-3">
              {customer.phone && (
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
                    <Phone size={16} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">טלפון</p>
                    <a href={`tel:${customer.phone}`} className="text-[#33d4ff] font-medium">
                      {customer.phone}
                    </a>
                  </div>
                </div>
              )}
              {customer.email && (
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-purple-50 rounded-lg flex items-center justify-center">
                    <Mail size={16} className="text-purple-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">אימייל</p>
                    <a href={`mailto:${customer.email}`} className="text-[#33d4ff] font-medium">
                      {customer.email}
                    </a>
                  </div>
                </div>
              )}
              {customer.address && (
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-green-50 rounded-lg flex items-center justify-center">
                    <MapPin size={16} className="text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">כתובת</p>
                    <p className="text-gray-800">{customer.address}</p>
                  </div>
                </div>
              )}
              {!customer.phone && !customer.email && !customer.address && (
                <p className="text-gray-400 text-sm">לא הוזנו פרטי התקשרות</p>
              )}
            </div>
          </div>

          {/* Payment Info */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-bold text-gray-800 mb-4">תנאי תשלום</h2>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-amber-50 rounded-lg flex items-center justify-center">
                  <CreditCard size={16} className="text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">תנאי תשלום</p>
                  <p className="text-gray-800 font-medium">
                    {customer.company_relation?.payment_terms === 'monthly' ? 'שוטף + 30' : 'מיידי'}
                  </p>
                </div>
              </div>
              {customer.company_relation?.credit_limit && (
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-red-50 rounded-lg flex items-center justify-center">
                    <CreditCard size={16} className="text-red-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">תקרת אשראי</p>
                    <p className="text-gray-800 font-medium">
                      {customer.company_relation.credit_limit.toLocaleString()} ש״ח
                    </p>
                  </div>
                </div>
              )}
              {customer.company_relation?.discount_percent && (
                <div>
                  <p className="text-xs text-gray-500">הנחה</p>
                  <p className="text-gray-800 font-medium">{customer.company_relation.discount_percent}%</p>
                </div>
              )}
            </div>
            {customer.company_relation?.id && (
              <Link
                href={`/dashboard/price-lists?tab=customers&customer_company_id=${customer.company_relation.id}`}
                className="mt-5 flex w-full items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-800 hover:bg-gray-100 transition-colors text-sm font-medium"
              >
                <ClipboardList size={16} className="text-[#33d4ff]" />
                מחירון הלקוח
              </Link>
            )}
          </div>

          {/* Notes */}
          {customer.notes && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 lg:col-span-2">
              <h2 className="font-bold text-gray-800 mb-2">הערות</h2>
              <p className="text-gray-600 text-sm">{customer.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Contacts Tab */}
      {activeTab === 'contacts' && (
        <div className="space-y-4 max-w-2xl w-full">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-500">
              אנשי קשר תפעוליים ללקוח — יוצעו בטופס גרירה בעת בחירת הלקוח
            </p>
            <button
              onClick={openAddContactModal}
              className="flex items-center gap-2 bg-[#33d4ff] text-white px-4 py-2.5 rounded-xl hover:bg-[#21b8e6] transition-colors font-medium text-sm"
            >
              <Plus size={18} />
              הוסף איש קשר
            </button>
          </div>

          {customerContacts.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <Contact2 size={48} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 mb-1">אין אנשי קשר שמורים</p>
              <p className="text-sm text-gray-400">הוסף אנשי קשר שחוזרים על עצמם בגרירות מול לקוח זה</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="divide-y divide-gray-100">
                {customerContacts.map((contact) => (
                  <div key={contact.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex w-full items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                          <Contact2 size={20} className="text-teal-600" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-gray-800">{contact.name}</span>
                            {contact.role_or_title && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                                <Briefcase size={12} />
                                {contact.role_or_title}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-sm text-gray-500 mt-0.5">
                            {contact.phone ? (
                              <a href={`tel:${contact.phone}`} className="text-[#33d4ff] hover:underline">
                                {contact.phone}
                              </a>
                            ) : (
                              <span className="text-gray-400">ללא טלפון</span>
                            )}
                            {contact.notes && (
                              <span className="truncate" title={contact.notes}>
                                {contact.notes}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => openEditContactModal(contact)}
                          className="p-2 text-gray-400 hover:text-[#33d4ff] hover:bg-blue-50 rounded-lg transition-colors"
                          title="עריכה"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => setShowDeleteContactConfirm(contact.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="מחיקה"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Addresses Tab */}
      {activeTab === 'addresses' && (
        <div className="space-y-4 max-w-2xl w-full">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-500">
              כתובות קבועות ללקוח — יוצעו בטופס גרירה בעת בחירת הלקוח
            </p>
            <button
              onClick={openAddAddressModal}
              className="flex items-center gap-2 bg-[#33d4ff] text-white px-4 py-2.5 rounded-xl hover:bg-[#21b8e6] transition-colors font-medium text-sm"
            >
              <Plus size={18} />
              הוסף כתובת
            </button>
          </div>

          {customerAddresses.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <MapPin size={48} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 mb-1">אין כתובות שמורות</p>
              <p className="text-sm text-gray-400">הוסף כתובות שחוזרות על עצמן בגרירות מול לקוח זה</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="divide-y divide-gray-100">
                {customerAddresses.map((row) => (
                  <div key={row.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex w-full items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                          <MapPin size={20} className="text-emerald-600" />
                        </div>
                        <div className="min-w-0">
                          <span className="font-medium text-gray-800">{row.label}</span>
                          <p className="text-sm text-gray-500 mt-0.5 truncate" title={row.address}>
                            {row.address}
                          </p>
                          {row.notes && (
                            <p className="text-sm text-gray-400 mt-0.5 truncate" title={row.notes}>
                              {row.notes}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => openEditAddressModal(row)}
                          className="p-2 text-gray-400 hover:text-[#33d4ff] hover:bg-blue-50 rounded-lg transition-colors"
                          title="עריכה"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => setShowDeleteAddressConfirm(row.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="מחיקה"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Orderers Tab */}
      {activeTab === 'orderers' && customer.customer_type === 'business' && (
        <div className="space-y-4 max-w-2xl w-full">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-500">
              מזמינים שמורים ללקוח — יוצעו בטופס גרירה בעת בחירת הלקוח העסקי
            </p>
            <button
              onClick={openAddOrdererModal}
              className="flex items-center gap-2 bg-[#33d4ff] text-white px-4 py-2.5 rounded-xl hover:bg-[#21b8e6] transition-colors font-medium text-sm"
            >
              <Plus size={18} />
              הוסף מזמין
            </button>
          </div>

          {customerOrderers.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <UserPen size={48} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 mb-1">אין מזמינים שמורים</p>
              <p className="text-sm text-gray-400">הוסף מזמינים שחוזרים על עצמם בגרירות מול לקוח עסקי זה</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="divide-y divide-gray-100">
                {customerOrderers.map((orderer) => (
                  <div key={orderer.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex w-full items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                          <UserPen size={20} className="text-purple-600" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-gray-800">{orderer.name}</span>
                            {orderer.department && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                                <Briefcase size={12} />
                                {orderer.department}
                              </span>
                            )}
                          </div>
                          {!orderer.department && (
                            <p className="text-sm text-gray-400 mt-0.5">ללא מחלקה</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => openEditOrdererModal(orderer)}
                          className="p-2 text-gray-400 hover:text-[#33d4ff] hover:bg-blue-50 rounded-lg transition-colors"
                          title="עריכה"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => setShowDeleteOrdererConfirm(orderer.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="מחיקה"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="space-y-4 max-w-2xl w-full">
          {/* Add User Button */}
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-500">
              משתמשים אלו יכולים להתחבר לפורטל הלקוח ולצפות בגרירות
            </p>
            <button
              onClick={() => {
                setShowAddUser(true)
                setError('')
                setTempPassword(null)
              }}
              className="flex items-center gap-2 bg-[#33d4ff] text-white px-4 py-2.5 rounded-xl hover:bg-[#21b8e6] transition-colors font-medium text-sm"
            >
              <Plus size={18} />
              הוסף משתמש
            </button>
          </div>

          {/* Users List */}
          {customerUsers.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <Users size={48} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 mb-1">אין משתמשי פורטל</p>
              <p className="text-sm text-gray-400">הוסף משתמשים כדי לאפשר ללקוח גישה לפורטל</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="divide-y divide-gray-100">
                {customerUsers.map((cu) => {
                  const roleKey = isCustomerUserRole(cu.role) ? cu.role : 'viewer'
                  const roleCfg = PORTAL_ROLE_DISPLAY[roleKey]

                  return (
                    <div key={cu.id} className="p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex w-full items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            cu.is_active ? 'bg-blue-100' : 'bg-gray-100'
                          }`}>
                            <User size={20} className={cu.is_active ? 'text-blue-600' : 'text-gray-400'} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`font-medium ${cu.is_active ? 'text-gray-800' : 'text-gray-400'}`}>
                                {cu.user?.full_name || 'ללא שם'}
                              </span>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${roleCfg.bg} ${roleCfg.color}`}>
                                {roleCfg.label}
                              </span>
                              {!cu.is_active && (
                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200">
                                  מושבת
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">{roleCfg.description}</p>
                            <div className="flex items-center gap-3 text-sm text-gray-500 mt-0.5">
                              <span>{cu.user?.email}</span>
                              {cu.user?.phone && <span>{cu.user.phone}</span>}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 flex-shrink-0">
                          {/* Role Select */}
                          <select
                            value={roleKey}
                            onChange={(e) => handleRoleChange(cu.id, e.target.value as CustomerUserRole)}
                            className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                          >
                            {STAFF_ASSIGNABLE_ROLES.map((r) => (
                              <option key={r} value={r}>
                                {PORTAL_ROLE_DISPLAY[r].label}
                              </option>
                            ))}
                          </select>

                          {/* Toggle Active */}
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

                          {/* Delete */}
                          <button
                            onClick={() => setShowDeleteConfirm(cu.id)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
        </div>
      )}

      {/* Portal orders tab — every request this customer submitted, any outcome */}
      {activeTab === 'portalOrders' && (
        <PortalOrdersSection orders={portalOrders} />
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 max-w-2xl w-full">
          <h2 className="font-bold text-gray-800 mb-4">הגדרות פורטל</h2>
          <p className="text-sm text-gray-500 mb-6">מה הלקוח רואה כשנכנס לפורטל — גרירות, תמונות, מחירים ועוד.</p>

          <div className="mb-8 pb-6 border-b border-gray-200">
            <h3 className="font-semibold text-gray-800 mb-1">הרשאות</h3>
            <p className="text-sm text-gray-500 mb-4">פעולות שהלקוח יכול לבצע בפורטל (כבוי כברירת מחדל).</p>
            <div className="flex w-full items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="font-medium text-gray-800">הזמנת גרירות דרך הפורטל</p>
                <p className="text-sm text-gray-500 mt-0.5">מאפשר ללקוח לשלוח בקשות גרירה לטיפול במוקד</p>
              </div>
              <button
                type="button"
                onClick={() => handlePortalSettingChange('can_submit_orders', !portalSettings.can_submit_orders)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full p-0.5 transition-colors cursor-pointer ${portalSettings.can_submit_orders ? 'bg-green-500 justify-end' : 'bg-gray-300 justify-start'}`}
              >
                <span className="inline-block h-4 w-4 rounded-full bg-white shadow" />
              </button>
            </div>
          </div>

          <h3 className="font-semibold text-gray-800 mb-4">תצוגה</h3>
          <div className="space-y-4">
            {[
              { key: 'show_photos', label: 'הצגת תמונות', desc: 'תמונות שצולמו במהלך הגרירה' },
              { key: 'show_price', label: 'הצגת מחיר', desc: 'מחיר הגרירה ופירוט עלויות' },
              { key: 'show_driver_info', label: 'הצגת שם נהג', desc: 'שם הנהג שמבצע את הגרירה' },
              { key: 'show_driver_phone', label: 'הצגת טלפון נהג', desc: 'מספר הטלפון של הנהג' },
              { key: 'show_status_history', label: 'הצגת היסטוריית סטטוסים', desc: 'ציר זמן של שלבי הגרירה' },
              { key: 'show_vehicles', label: 'הצגת פרטי רכבים', desc: 'פרטי הרכבים שנגררו' },
              { key: 'show_notes', label: 'הצגת הערות', desc: 'הערות פנימיות על הגרירה' },
            ].map(({ key, label, desc }) => (
              <div key={key} className="flex w-full items-center justify-between gap-4 py-3 border-b border-gray-100 last:border-0">
                <div className="min-w-0">
                  <p className="font-medium text-gray-800">{label}</p>
                  <p className="text-sm text-gray-500 mt-0.5">{desc}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handlePortalSettingChange(key, !portalSettings[key])}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full p-0.5 transition-colors cursor-pointer ${portalSettings[key] ? 'bg-green-500 justify-end' : 'bg-gray-300 justify-start'}`}
                >
                  <span className="inline-block h-4 w-4 rounded-full bg-white shadow" />
                </button>
              </div>
            ))}
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
                onClick={() => {
                  setShowAddUser(false)
                  setTempPassword(null)
                }}
                className="p-2 hover:bg-white/20 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

              {/* Form */}
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
                  <PhoneInput
                    value={newUserForm.phone}
                    onChange={(phone) => setNewUserForm({ ...newUserForm, phone })}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-1">הרשאה</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {STAFF_ASSIGNABLE_ROLES.map((value) => {
                      const cfg = PORTAL_ROLE_DISPLAY[value]
                      const Icon = ROLE_ICONS[value]
                      const selected = newUserForm.role === value
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setNewUserForm({ ...newUserForm, role: value })}
                          className={`p-3 rounded-xl border-2 text-right transition-all ${
                            selected
                              ? 'border-[#33d4ff] bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <Icon
                              size={18}
                              className={`mt-0.5 shrink-0 ${selected ? 'text-[#33d4ff]' : 'text-gray-400'}`}
                            />
                            <div>
                              <p className="text-xs font-medium text-gray-900">{cfg.label}</p>
                              <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">{cfg.description}</p>
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowAddUser(false)}
                    className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-100 transition-colors font-medium"
                  >
                    ביטול
                  </button>
                  <button
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

      {/* Add / Edit Contact Modal */}
      {showContactModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end lg:items-center justify-center z-50">
          <div className="bg-white w-full lg:max-w-md lg:rounded-2xl lg:mx-4 overflow-hidden rounded-t-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-[#33d4ff] text-white">
              <h2 className="font-bold text-lg">
                {editingContactId ? 'עריכת איש קשר' : 'הוספת איש קשר'}
              </h2>
              <button
                onClick={() => {
                  setShowContactModal(false)
                  setEditingContactId(null)
                }}
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
                <label className="block text-sm text-gray-600 mb-1">שם *</label>
                <input
                  type="text"
                  value={contactForm.name}
                  onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">טלפון</label>
                <PhoneInput
                  value={contactForm.phone}
                  onChange={(phone) => setContactForm({ ...contactForm, phone })}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">תפקיד / תיאור</label>
                <input
                  type="text"
                  value={contactForm.role_or_title}
                  onChange={(e) => setContactForm({ ...contactForm, role_or_title: e.target.value })}
                  placeholder="לדוגמה: מחסן, חשבונות"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">הערות</label>
                <textarea
                  value={contactForm.notes}
                  onChange={(e) => setContactForm({ ...contactForm, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#33d4ff] resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowContactModal(false)
                    setEditingContactId(null)
                  }}
                  className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-100 transition-colors font-medium"
                >
                  ביטול
                </button>
                <button
                  onClick={handleSaveContact}
                  disabled={!contactForm.name.trim() || saving}
                  className="flex-1 py-3 bg-[#33d4ff] text-white rounded-xl hover:bg-[#21b8e6] disabled:bg-gray-300 transition-colors font-medium"
                >
                  {saving ? (
                    <Loader2 size={18} className="animate-spin mx-auto" />
                  ) : (
                    'שמור'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Address Modal */}
      {showAddressModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end lg:items-center justify-center z-50">
          <div className="bg-white w-full lg:max-w-md lg:rounded-2xl lg:mx-4 overflow-hidden rounded-t-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-[#33d4ff] text-white">
              <h2 className="font-bold text-lg">
                {editingAddressId ? 'עריכת כתובת' : 'הוספת כתובת'}
              </h2>
              <button
                onClick={() => {
                  setShowAddressModal(false)
                  setEditingAddressId(null)
                  setAddressPinOpen(false)
                }}
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
                <label className="block text-sm text-gray-600 mb-1">תווית *</label>
                <input
                  type="text"
                  value={addressForm.label}
                  onChange={(e) => setAddressForm({ ...addressForm, label: e.target.value })}
                  placeholder='לדוגמה: מגרש רמלה'
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">כתובת מלאה *</label>
                <AddressInput
                  hideLabel
                  value={{
                    address: addressForm.address,
                    placeId: addressForm.place_id ?? undefined,
                    lat: addressForm.lat ?? undefined,
                    lng: addressForm.lng ?? undefined,
                  }}
                  onChange={handleAddressDataChange}
                  placeholder="התחל להקליד כתובת..."
                  onPinDropClick={() => setAddressPinOpen(true)}
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">הערות</label>
                <textarea
                  value={addressForm.notes}
                  onChange={(e) => setAddressForm({ ...addressForm, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#33d4ff] resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowAddressModal(false)
                    setEditingAddressId(null)
                    setAddressPinOpen(false)
                  }}
                  className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-100 transition-colors font-medium"
                >
                  ביטול
                </button>
                <button
                  onClick={handleSaveAddress}
                  disabled={!addressForm.label.trim() || !addressForm.address.trim() || saving}
                  className="flex-1 py-3 bg-[#33d4ff] text-white rounded-xl hover:bg-[#21b8e6] disabled:bg-gray-300 transition-colors font-medium"
                >
                  {saving ? (
                    <Loader2 size={18} className="animate-spin mx-auto" />
                  ) : (
                    'שמור'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <PinDropModal
        isOpen={addressPinOpen}
        onClose={() => setAddressPinOpen(false)}
        onConfirm={(data) => {
          handleAddressDataChange(data)
          setAddressPinOpen(false)
        }}
        initialAddress={{
          address: addressForm.address,
          placeId: addressForm.place_id ?? undefined,
          lat: addressForm.lat ?? undefined,
          lng: addressForm.lng ?? undefined,
        }}
        title="בחר מיקום לכתובת"
      />

      {/* Add / Edit Orderer Modal */}
      {showOrdererModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end lg:items-center justify-center z-50">
          <div className="bg-white w-full lg:max-w-md lg:rounded-2xl lg:mx-4 overflow-hidden rounded-t-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-[#33d4ff] text-white">
              <h2 className="font-bold text-lg">
                {editingOrdererId ? 'עריכת מזמין' : 'הוספת מזמין'}
              </h2>
              <button
                onClick={() => {
                  setShowOrdererModal(false)
                  setEditingOrdererId(null)
                }}
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
                <label className="block text-sm text-gray-600 mb-1">מחלקה</label>
                <input
                  type="text"
                  value={ordererForm.department}
                  onChange={(e) => setOrdererForm({ ...ordererForm, department: e.target.value })}
                  placeholder="לדוגמה: לוגיסטיקה, חשבונות"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">שם מזמין *</label>
                <input
                  type="text"
                  value={ordererForm.name}
                  onChange={(e) => setOrdererForm({ ...ordererForm, name: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowOrdererModal(false)
                    setEditingOrdererId(null)
                  }}
                  className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-100 transition-colors font-medium"
                >
                  ביטול
                </button>
                <button
                  onClick={handleSaveOrderer}
                  disabled={!ordererForm.name.trim() || saving}
                  className="flex-1 py-3 bg-[#33d4ff] text-white rounded-xl hover:bg-[#21b8e6] disabled:bg-gray-300 transition-colors font-medium"
                >
                  {saving ? (
                    <Loader2 size={18} className="animate-spin mx-auto" />
                  ) : (
                    'שמור'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Orderer Confirm Modal */}
      {showDeleteOrdererConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={32} className="text-red-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-800 mb-2">מחיקת מזמין</h2>
              <p className="text-gray-600">המזמין יוסר מרשימת המזמינים של הלקוח. להמשיך?</p>
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <button
                onClick={() => setShowDeleteOrdererConfirm(null)}
                className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-100 transition-colors"
              >
                ביטול
              </button>
              <button
                onClick={() => handleDeleteOrderer(showDeleteOrdererConfirm)}
                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors"
              >
                מחק
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Contact Confirm Modal */}
      {showDeleteContactConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={32} className="text-red-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-800 mb-2">מחיקת איש קשר</h2>
              <p className="text-gray-600">איש הקשר יוסר מרשימת אנשי הקשר של הלקוח. להמשיך?</p>
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <button
                onClick={() => setShowDeleteContactConfirm(null)}
                className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-100 transition-colors"
              >
                ביטול
              </button>
              <button
                onClick={() => handleDeleteContact(showDeleteContactConfirm)}
                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors"
              >
                מחק
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Address Confirm Modal */}
      {showDeleteAddressConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={32} className="text-red-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-800 mb-2">מחיקת כתובת</h2>
              <p className="text-gray-600">הכתובת תוסר מרשימת הכתובות הקבועות של הלקוח. להמשיך?</p>
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <button
                onClick={() => setShowDeleteAddressConfirm(null)}
                className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-100 transition-colors"
              >
                ביטול
              </button>
              <button
                onClick={() => handleDeleteAddress(showDeleteAddressConfirm)}
                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors"
              >
                מחק
              </button>
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
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-100 transition-colors"
              >
                ביטול
              </button>
              <button
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