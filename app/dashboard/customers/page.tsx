'use client'

import { useState } from 'react'
import { 
  Search, 
  Plus, 
  User, 
  Building2, 
  Phone, 
  Mail, 
  MapPin, 
  Edit2, 
  Trash2, 
  X,
  CheckCircle,
  AlertTriangle,
  CreditCard,
  FileText,
  Eye,
  ChevronLeft
} from 'lucide-react'

interface Customer {
  id: number
  name: string
  type: 'private' | 'business'
  contactName?: string
  phone: string
  email?: string
  idNumber?: string
  businessId?: string
  address: string
  totalTows: number
  openBalance: number
  paymentTerms?: string
  paymentMethod: 'cash' | 'credit' | 'invoice'
  creditLimit?: number
  lastTow?: string
  hasPriceList: boolean
  isActive: boolean
  notes?: string
}

export default function CustomersPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'private' | 'business'>('all')
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false)
  const [duplicateCustomer, setDuplicateCustomer] = useState<Customer | null>(null)

  const [formData, setFormData] = useState({
    type: 'private' as 'private' | 'business',
    firstName: '',
    lastName: '',
    businessName: '',
    idNumber: '',
    businessId: '',
    phone: '',
    email: '',
    address: '',
    contactName: '',
    contactPhone: '',
    paymentMethod: 'cash' as 'cash' | 'credit' | 'invoice',
    paymentTerms: 'immediate' as 'immediate' | 'net30' | 'net45' | 'net60',
    creditLimit: 0,
    hasPriceList: false,
    notes: '',
  })

  const [customers, setCustomers] = useState<Customer[]>([
    {
      id: 1,
      name: 'מוסך רמט',
      type: 'business',
      contactName: 'רמי טל',
      phone: '03-5551234',
      email: 'info@ramat-garage.co.il',
      businessId: '512345678',
      address: 'רמת גן, רח׳ ביאליק 67',
      totalTows: 47,
      openBalance: 3200,
      paymentTerms: 'שוטף + 30',
      paymentMethod: 'invoice',
      creditLimit: 10000,
      lastTow: '05/12/2024',
      hasPriceList: true,
      isActive: true
    },
    {
      id: 2,
      name: 'ליסינג ישיר',
      type: 'business',
      contactName: 'דנה כהן',
      phone: '03-9876543',
      email: 'orders@leasing-yashir.co.il',
      businessId: '523456789',
      address: 'תל אביב, רח׳ הארבעה 19',
      totalTows: 124,
      openBalance: 8750,
      paymentTerms: 'שוטף + 45',
      paymentMethod: 'invoice',
      creditLimit: 20000,
      lastTow: '05/12/2024',
      hasPriceList: true,
      isActive: true
    },
    {
      id: 3,
      name: 'יוסי כהן',
      type: 'private',
      phone: '050-1112233',
      email: 'yossi.cohen@gmail.com',
      idNumber: '123456789',
      address: 'תל אביב, רח׳ דיזנגוף 120',
      totalTows: 3,
      openBalance: 0,
      paymentMethod: 'cash',
      lastTow: '05/12/2024',
      hasPriceList: false,
      isActive: true
    },
    {
      id: 4,
      name: 'שרה לוי',
      type: 'private',
      phone: '052-9876543',
      email: 'sara.levi@gmail.com',
      address: 'גבעתיים, רח׳ כצנלסון 23',
      totalTows: 1,
      openBalance: 330,
      paymentMethod: 'credit',
      lastTow: '05/12/2024',
      hasPriceList: false,
      isActive: true
    },
    {
      id: 5,
      name: 'השכרת רכב אופק',
      type: 'business',
      contactName: 'מיכאל אופק',
      phone: '03-6667788',
      email: 'info@ofek-rental.co.il',
      businessId: '545678901',
      address: 'חיפה, דרך העצמאות 100',
      totalTows: 56,
      openBalance: 4200,
      paymentTerms: 'שוטף + 60',
      paymentMethod: 'invoice',
      creditLimit: 15000,
      lastTow: '02/12/2024',
      hasPriceList: true,
      isActive: false
    },
  ])

  const stats = {
    total: customers.length,
    business: customers.filter(c => c.type === 'business').length,
    private: customers.filter(c => c.type === 'private').length,
    withBalance: customers.filter(c => c.openBalance > 0).length,
    totalBalance: customers.reduce((sum, c) => sum + c.openBalance, 0)
  }

  const filteredCustomers = customers.filter(c => {
    if (typeFilter !== 'all' && c.type !== typeFilter) return false
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      if (!c.name.toLowerCase().includes(query) && 
          !c.phone.includes(query) && 
          !(c.businessId && c.businessId.includes(query)) &&
          !(c.idNumber && c.idNumber.includes(query))) {
        return false
      }
    }
    return true
  })

  const resetForm = () => {
    setFormData({
      type: 'private',
      firstName: '',
      lastName: '',
      businessName: '',
      idNumber: '',
      businessId: '',
      phone: '',
      email: '',
      address: '',
      contactName: '',
      contactPhone: '',
      paymentMethod: 'cash',
      paymentTerms: 'immediate',
      creditLimit: 0,
      hasPriceList: false,
      notes: '',
    })
  }

  const handleAddCustomer = () => {
    setSelectedCustomer(null)
    resetForm()
    setShowCustomerModal(true)
  }

  const handleEditCustomer = (customer: Customer) => {
    setSelectedCustomer(customer)
    const nameParts = customer.type === 'private' ? customer.name.split(' ') : ['', '']
    setFormData({
      type: customer.type,
      firstName: nameParts[0] || '',
      lastName: nameParts.slice(1).join(' ') || '',
      businessName: customer.type === 'business' ? customer.name : '',
      idNumber: customer.idNumber || '',
      businessId: customer.businessId || '',
      phone: customer.phone,
      email: customer.email || '',
      address: customer.address,
      contactName: customer.contactName || '',
      contactPhone: '',
      paymentMethod: customer.paymentMethod,
      paymentTerms: customer.paymentTerms === 'שוטף + 30' ? 'net30' : 
                    customer.paymentTerms === 'שוטף + 45' ? 'net45' :
                    customer.paymentTerms === 'שוטף + 60' ? 'net60' : 'immediate',
      creditLimit: customer.creditLimit || 0,
      hasPriceList: customer.hasPriceList,
      notes: customer.notes || '',
    })
    setShowCustomerModal(true)
  }

  const handleDeleteCustomer = (customer: Customer) => {
    setSelectedCustomer(customer)
    setShowDeleteConfirm(true)
  }

  const confirmDelete = () => {
    if (selectedCustomer) {
      setCustomers(customers.filter(c => c.id !== selectedCustomer.id))
      setShowDeleteConfirm(false)
      setSelectedCustomer(null)
    }
  }

  const checkDuplicates = () => {
    const identifier = formData.type === 'business' ? formData.businessId : formData.idNumber
    const phone = formData.phone

    const duplicate = customers.find(c => {
      if (selectedCustomer && c.id === selectedCustomer.id) return false
      if (c.phone === phone) return true
      if (formData.type === 'business' && c.businessId === identifier) return true
      if (formData.type === 'private' && c.idNumber === identifier) return true
      return false
    })

    if (duplicate) {
      setDuplicateCustomer(duplicate)
      setShowDuplicateWarning(true)
      return true
    }
    return false
  }

  const handleSaveCustomer = () => {
    if (checkDuplicates()) return

    const paymentTermsMap: Record<string, string> = {
      immediate: 'מזומן',
      net30: 'שוטף + 30',
      net45: 'שוטף + 45',
      net60: 'שוטף + 60',
    }

    if (selectedCustomer) {
      setCustomers(customers.map(c => {
        if (c.id === selectedCustomer.id) {
          return {
            ...c,
            name: formData.type === 'business' ? formData.businessName : `${formData.firstName} ${formData.lastName}`,
            type: formData.type,
            phone: formData.phone,
            email: formData.email || undefined,
            address: formData.address,
            idNumber: formData.idNumber || undefined,
            businessId: formData.businessId || undefined,
            contactName: formData.contactName || undefined,
            paymentMethod: formData.paymentMethod,
            paymentTerms: formData.type === 'business' ? paymentTermsMap[formData.paymentTerms] : undefined,
            creditLimit: formData.creditLimit || undefined,
            hasPriceList: formData.hasPriceList,
            notes: formData.notes || undefined,
          }
        }
        return c
      }))
    } else {
      const newCustomer: Customer = {
        id: Math.max(...customers.map(c => c.id), 0) + 1,
        name: formData.type === 'business' ? formData.businessName : `${formData.firstName} ${formData.lastName}`,
        type: formData.type,
        phone: formData.phone,
        email: formData.email || undefined,
        address: formData.address,
        idNumber: formData.idNumber || undefined,
        businessId: formData.businessId || undefined,
        contactName: formData.contactName || undefined,
        paymentMethod: formData.paymentMethod,
        paymentTerms: formData.type === 'business' ? paymentTermsMap[formData.paymentTerms] : undefined,
        creditLimit: formData.creditLimit || undefined,
        hasPriceList: formData.hasPriceList,
        totalTows: 0,
        openBalance: 0,
        isActive: true,
      }
      setCustomers([...customers, newCustomer])
    }

    setShowCustomerModal(false)
    resetForm()
  }

  const useDuplicateCustomer = () => {
    setShowDuplicateWarning(false)
    setShowCustomerModal(false)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800">ניהול לקוחות</h1>
            <p className="text-sm text-gray-500 mt-1">ניהול לקוחות פרטיים ועסקיים</p>
          </div>
          <button
            onClick={handleAddCustomer}
            className="hidden lg:flex items-center justify-center gap-2 bg-[#33d4ff] text-white px-4 py-2.5 rounded-xl hover:bg-[#21b8e6] transition-colors font-medium whitespace-nowrap"
          >
            <Plus size={20} />
            <span>הוסף לקוח</span>
          </button>
        </div>
        <button
          onClick={handleAddCustomer}
          className="lg:hidden flex items-center justify-center gap-2 bg-[#33d4ff] text-white px-4 py-3 rounded-xl hover:bg-[#21b8e6] transition-colors font-medium w-full mt-4"
        >
          <Plus size={20} />
          <span>הוסף לקוח</span>
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-gray-500 text-sm">סה״כ לקוחות</p>
          <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-gray-500 text-sm">עסקיים</p>
          <p className="text-2xl font-bold text-purple-600">{stats.business}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-gray-500 text-sm">פרטיים</p>
          <p className="text-2xl font-bold text-blue-600">{stats.private}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-gray-500 text-sm">עם יתרה</p>
          <p className="text-2xl font-bold text-amber-600">{stats.withBalance}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 col-span-2 lg:col-span-1">
          <p className="text-gray-500 text-sm">סה״כ חוב</p>
          <p className="text-2xl font-bold text-red-600">{stats.totalBalance.toLocaleString()} ש״ח</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="חיפוש לפי שם, טלפון או ח.פ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-10 pl-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setTypeFilter('all')}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  typeFilter === 'all' ? 'bg-[#33d4ff] text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                הכל
              </button>
              <button
                onClick={() => setTypeFilter('business')}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  typeFilter === 'business' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                עסקיים
              </button>
              <button
                onClick={() => setTypeFilter('private')}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  typeFilter === 'private' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                פרטיים
              </button>
            </div>
          </div>
        </div>

        <div className="hidden lg:grid lg:grid-cols-12 gap-4 px-5 py-3 bg-gray-50 text-sm font-medium text-gray-500 border-b border-gray-200">
          <div className="col-span-3">לקוח</div>
          <div className="col-span-2">טלפון / אימייל</div>
          <div className="col-span-2">כתובת</div>
          <div className="col-span-1">גרירות</div>
          <div className="col-span-2">יתרה</div>
          <div className="col-span-1">גרירה אחרונה</div>
          <div className="col-span-1">פעולות</div>
        </div>

        <div className="divide-y divide-gray-100">
          {filteredCustomers.map((customer) => (
            <div
              key={customer.id}
              className={`px-5 py-4 hover:bg-gray-50 transition-colors ${
                !customer.isActive ? 'bg-gray-50 opacity-60' : ''
              }`}
            >
              <div className="hidden lg:grid lg:grid-cols-12 gap-4 items-center">
                <div className="col-span-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      customer.type === 'business' ? 'bg-purple-100' : 'bg-blue-100'
                    }`}>
                      {customer.type === 'business' ? (
                        <Building2 size={20} className="text-purple-600" />
                      ) : (
                        <User size={20} className="text-blue-600" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-800">{customer.name}</span>
                        {customer.type === 'business' && (
                          <span className="px-1.5 py-0.5 bg-purple-100 text-purple-600 text-xs rounded">עסקי</span>
                        )}
                        {customer.hasPriceList && (
                          <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-600 text-xs rounded">מחירון</span>
                        )}
                      </div>
                      {customer.contactName && (
                        <p className="text-sm text-gray-500">{customer.contactName}</p>
                      )}
                      {customer.businessId && (
                        <p className="text-xs text-gray-400">ח.פ: {customer.businessId}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="col-span-2">
                  <a href={`tel:${customer.phone}`} className="text-[#33d4ff] hover:text-[#21b8e6] text-sm">
                    {customer.phone}
                  </a>
                  {customer.email && (
                    <p className="text-xs text-gray-500 truncate">{customer.email}</p>
                  )}
                </div>

                <div className="col-span-2">
                  <p className="text-sm text-gray-600 truncate">{customer.address}</p>
                </div>

                <div className="col-span-1">
                  <span className="text-sm font-medium text-gray-800">{customer.totalTows}</span>
                </div>

                <div className="col-span-2">
                  {customer.openBalance > 0 ? (
                    <div>
                      <span className="font-medium text-red-600">{customer.openBalance.toLocaleString()} ש״ח</span>
                      {customer.paymentTerms && (
                        <p className="text-xs text-gray-500">{customer.paymentTerms}</p>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm text-emerald-600">מאופס</span>
                  )}
                </div>

                <div className="col-span-1">
                  <span className="text-sm text-gray-600">{customer.lastTow || '-'}</span>
                </div>

                <div className="col-span-1">
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => handleEditCustomer(customer)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => handleDeleteCustomer(customer)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="lg:hidden">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      customer.type === 'business' ? 'bg-purple-100' : 'bg-blue-100'
                    }`}>
                      {customer.type === 'business' ? (
                        <Building2 size={20} className="text-purple-600" />
                      ) : (
                        <User size={20} className="text-blue-600" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-800">{customer.name}</span>
                        {customer.type === 'business' && (
                          <span className="px-1.5 py-0.5 bg-purple-100 text-purple-600 text-xs rounded">עסקי</span>
                        )}
                      </div>
                      {customer.contactName && (
                        <p className="text-sm text-gray-500">{customer.contactName}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {customer.openBalance > 0 && (
                      <span className="font-medium text-red-600">{customer.openBalance.toLocaleString()} ש״ח</span>
                    )}
                    <button 
                      onClick={() => handleEditCustomer(customer)}
                      className="p-2 text-gray-400"
                    >
                      <ChevronLeft size={20} />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <a href={`tel:${customer.phone}`} className="text-[#33d4ff]">{customer.phone}</a>
                  <span>•</span>
                  <span>{customer.totalTows} גרירות</span>
                  {customer.lastTow && (
                    <>
                      <span>•</span>
                      <span>אחרונה: {customer.lastTow}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}

          {filteredCustomers.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <User size={48} className="mx-auto mb-4 opacity-50" />
              <p>לא נמצאו לקוחות</p>
            </div>
          )}
        </div>
      </div>

      {showCustomerModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end lg:items-center justify-center z-50">
          <div className="bg-white w-full lg:max-w-2xl lg:rounded-2xl lg:mx-4 overflow-hidden max-h-[95vh] flex flex-col rounded-t-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-[#33d4ff] text-white flex-shrink-0">
              <h2 className="font-bold text-lg">{selectedCustomer ? 'עריכת לקוח' : 'הוספת לקוח חדש'}</h2>
              <button onClick={() => setShowCustomerModal(false)} className="p-2 hover:bg-white/20 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 bg-[#33d4ff] text-white rounded-full flex items-center justify-center text-sm">1</span>
                  סוג לקוח
                </h3>
                <div className="flex gap-3">
                  <button
                    onClick={() => setFormData({ ...formData, type: 'private' })}
                    className={`flex-1 p-4 rounded-xl border-2 text-center transition-all ${
                      formData.type === 'private'
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className={`w-10 h-10 mx-auto mb-2 rounded-xl flex items-center justify-center ${
                      formData.type === 'private' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'
                    }`}>
                      <User size={20} />
                    </div>
                    <p className={`font-medium text-sm ${formData.type === 'private' ? 'text-blue-600' : 'text-gray-700'}`}>לקוח פרטי</p>
                  </button>

                  <button
                    onClick={() => setFormData({ ...formData, type: 'business' })}
                    className={`flex-1 p-4 rounded-xl border-2 text-center transition-all ${
                      formData.type === 'business'
                        ? 'border-purple-600 bg-purple-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className={`w-10 h-10 mx-auto mb-2 rounded-xl flex items-center justify-center ${
                      formData.type === 'business' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-500'
                    }`}>
                      <Building2 size={20} />
                    </div>
                    <p className={`font-medium text-sm ${formData.type === 'business' ? 'text-purple-600' : 'text-gray-700'}`}>לקוח עסקי</p>
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 bg-[#33d4ff] text-white rounded-full flex items-center justify-center text-sm">2</span>
                  פרטים בסיסיים
                </h3>
                <div className="space-y-4">
                  {formData.type === 'private' ? (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">שם פרטי *</label>
                          <input
                            type="text"
                            value={formData.firstName}
                            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">שם משפחה *</label>
                          <input
                            type="text"
                            value={formData.lastName}
                            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">תעודת זהות</label>
                        <input
                          type="text"
                          value={formData.idNumber}
                          onChange={(e) => setFormData({ ...formData, idNumber: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">שם החברה / העסק *</label>
                        <input
                          type="text"
                          value={formData.businessName}
                          onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">ח.פ / עוסק מורשה *</label>
                        <input
                          type="text"
                          value={formData.businessId}
                          onChange={(e) => setFormData({ ...formData, businessId: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">איש קשר</label>
                          <input
                            type="text"
                            value={formData.contactName}
                            onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">טלפון איש קשר</label>
                          <input
                            type="tel"
                            value={formData.contactPhone}
                            onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 bg-[#33d4ff] text-white rounded-full flex items-center justify-center text-sm">3</span>
                  פרטי התקשרות
                </h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">טלפון *</label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">אימייל</label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">כתובת</label>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 bg-[#33d4ff] text-white rounded-full flex items-center justify-center text-sm">4</span>
                  תנאי תשלום
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-2">אמצעי תשלום</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setFormData({ ...formData, paymentMethod: 'cash' })}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                          formData.paymentMethod === 'cash' ? 'bg-[#33d4ff] text-white' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        מזומן
                      </button>
                      <button
                        onClick={() => setFormData({ ...formData, paymentMethod: 'credit' })}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                          formData.paymentMethod === 'credit' ? 'bg-[#33d4ff] text-white' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        אשראי
                      </button>
                      <button
                        onClick={() => setFormData({ ...formData, paymentMethod: 'invoice' })}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                          formData.paymentMethod === 'invoice' ? 'bg-[#33d4ff] text-white' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        חשבונית
                      </button>
                    </div>
                  </div>

                  {formData.type === 'business' && formData.paymentMethod === 'invoice' && (
                    <>
                      <div>
                        <label className="block text-sm text-gray-600 mb-2">תנאי תשלום</label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {[
                            { value: 'immediate', label: 'מיידי' },
                            { value: 'net30', label: 'שוטף + 30' },
                            { value: 'net45', label: 'שוטף + 45' },
                            { value: 'net60', label: 'שוטף + 60' },
                          ].map((option) => (
                            <button
                              key={option.value}
                              onClick={() => setFormData({ ...formData, paymentTerms: option.value as any })}
                              className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                                formData.paymentTerms === option.value ? 'bg-[#33d4ff] text-white' : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm text-gray-600 mb-1">תקרת אשראי</label>
                        <div className="relative">
                          <input
                            type="number"
                            value={formData.creditLimit || ''}
                            onChange={(e) => setFormData({ ...formData, creditLimit: Number(e.target.value) })}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                            placeholder="0"
                          />
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">ש״ח</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {formData.type === 'business' && (
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <h3 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                    <span className="w-6 h-6 bg-[#33d4ff] text-white rounded-full flex items-center justify-center text-sm">5</span>
                    מחירון מותאם
                  </h3>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-700">מחירון מיוחד ללקוח</p>
                      <p className="text-xs text-gray-500">הגדר מחירים שונים מהמחירון הרגיל</p>
                    </div>
                    <button
                      onClick={() => setFormData({ ...formData, hasPriceList: !formData.hasPriceList })}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        formData.hasPriceList ? 'bg-[#33d4ff]' : 'bg-gray-300'
                      }`}
                    >
                      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                        formData.hasPriceList ? 'right-1' : 'left-1'
                      }`}></span>
                    </button>
                  </div>
                  {formData.hasPriceList && (
                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                      <p className="text-sm text-blue-800">מחירון מותאם יוגדר בדף "מחירונים" לאחר שמירת הלקוח</p>
                    </div>
                  )}
                </div>
              )}

              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 bg-[#33d4ff] text-white rounded-full flex items-center justify-center text-sm">
                    {formData.type === 'business' ? '6' : '5'}
                  </span>
                  הערות
                </h3>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="הערות על הלקוח..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                />
              </div>
            </div>

            <div className="flex gap-3 px-5 py-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
              <button
                onClick={() => setShowCustomerModal(false)}
                className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-100 transition-colors font-medium"
              >
                ביטול
              </button>
              <button
                onClick={handleSaveCustomer}
                className="flex-1 py-3 bg-[#33d4ff] text-white rounded-xl hover:bg-[#21b8e6] transition-colors font-medium"
              >
                {selectedCustomer ? 'שמור שינויים' : 'הוסף לקוח'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && selectedCustomer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={32} className="text-red-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-800 mb-2">מחיקת לקוח</h2>
              <p className="text-gray-600">האם למחוק את הלקוח "{selectedCustomer.name}"?</p>
              {selectedCustomer.totalTows > 0 && (
                <p className="text-sm text-amber-600 mt-2">שים לב: ללקוח יש {selectedCustomer.totalTows} גרירות</p>
              )}
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-100 transition-colors"
              >
                ביטול
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors"
              >
                מחק
              </button>
            </div>
          </div>
        </div>
      )}

      {showDuplicateWarning && duplicateCustomer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={32} className="text-amber-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-800 mb-2">לקוח קיים</h2>
              <p className="text-gray-600">נמצא לקוח קיים עם פרטים זהים:</p>
              <div className="mt-3 p-3 bg-gray-50 rounded-xl text-sm">
                <p className="font-medium text-gray-800">{duplicateCustomer.name}</p>
                <p className="text-gray-500">{duplicateCustomer.phone}</p>
              </div>
              <p className="text-sm text-gray-500 mt-3">האם להשתמש בלקוח הקיים?</p>
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <button
                onClick={() => setShowDuplicateWarning(false)}
                className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-100 transition-colors"
              >
                ליצור חדש
              </button>
              <button
                onClick={useDuplicateCustomer}
                className="flex-1 py-3 bg-[#33d4ff] text-white rounded-xl font-medium hover:bg-[#21b8e6] transition-colors"
              >
                השתמש בקיים
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
