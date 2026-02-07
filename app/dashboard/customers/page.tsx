'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { 
  Search, 
  Plus, 
  User, 
  Building2, 
  Edit2, 
  Trash2, 
  X,
  AlertTriangle,
  ChevronLeft
} from 'lucide-react'
import { useAuth } from '../../lib/AuthContext'
import { 
  getCustomers, 
  createCustomer, 
  updateCustomer, 
  deleteCustomer, 
  checkCustomerDuplicate,
  CustomerWithDetails 
} from '../../lib/queries/customers'

export default function CustomersPage() {
  const { companyId } = useAuth()
  const router = useRouter()

  // Data states
  const [customers, setCustomers] = useState<CustomerWithDetails[]>([])
  const [pageLoading, setPageLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // UI states
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'private' | 'business'>('all')
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerWithDetails | null>(null)
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false)
  const [duplicateField, setDuplicateField] = useState('')

  const [formData, setFormData] = useState({
    type: 'private' as 'private' | 'business',
    name: '',
    idNumber: '',
    phone: '',
    email: '',
    address: '',
    paymentTerms: 'immediate' as 'immediate' | 'monthly',
    creditLimit: 0,
    notes: '',
  })

  // טעינת נתונים
  useEffect(() => {
    if (companyId) {
      loadData()
    }
  }, [companyId])

  const loadData = async () => {
    if (!companyId) return

    setPageLoading(true)
    try {
      const data = await getCustomers(companyId)
      setCustomers(data)
    } catch (err) {
      console.error('Error loading customers:', err)
      setError('שגיאה בטעינת הנתונים')
    } finally {
      setPageLoading(false)
    }
  }

  const stats = {
    total: customers.length,
    business: customers.filter(c => c.customer_type === 'business').length,
    private: customers.filter(c => c.customer_type === 'private').length,
    withBalance: customers.filter(c => c.open_balance > 0).length,
    totalBalance: customers.reduce((sum, c) => sum + c.open_balance, 0)
  }

  const filteredCustomers = customers.filter(c => {
    if (typeFilter !== 'all' && c.customer_type !== typeFilter) return false
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      if (!c.name.toLowerCase().includes(query) && 
          !(c.phone && c.phone.includes(query)) && 
          !(c.id_number && c.id_number.includes(query))) {
        return false
      }
    }
    return true
  })

  const resetForm = () => {
    setFormData({
      type: 'private',
      name: '',
      idNumber: '',
      phone: '',
      email: '',
      address: '',
      paymentTerms: 'immediate',
      creditLimit: 0,
      notes: '',
    })
    setError('')
  }

  const handleAddCustomer = () => {
    setSelectedCustomer(null)
    resetForm()
    setShowCustomerModal(true)
  }

  const handleEditCustomer = (customer: CustomerWithDetails) => {
    setSelectedCustomer(customer)
    setFormData({
      type: customer.customer_type,
      name: customer.name,
      idNumber: customer.id_number || '',
      phone: customer.phone || '',
      email: customer.email || '',
      address: customer.address || '',
      paymentTerms: customer.company_relation?.payment_terms || 'immediate',
      creditLimit: customer.company_relation?.credit_limit || 0,
      notes: customer.notes || '',
    })
    setShowCustomerModal(true)
  }

  const handleDeleteCustomer = (customer: CustomerWithDetails) => {
    setSelectedCustomer(customer)
    setShowDeleteConfirm(true)
  }

  const confirmDelete = async () => {
    if (!selectedCustomer?.company_relation) return

    try {
      await deleteCustomer(selectedCustomer.company_relation.id)
      await loadData()
      setShowDeleteConfirm(false)
      setSelectedCustomer(null)
    } catch (err) {
      console.error('Error deleting customer:', err)
      setError('שגיאה במחיקת הלקוח')
    }
  }

  const handleSaveCustomer = async () => {
    if (!formData.name || !companyId) return

    // בדיקת כפילויות
    const duplicates = await checkCustomerDuplicate(
      companyId,
      formData.phone || undefined,
      formData.idNumber || undefined,
      selectedCustomer?.id
    )

    if (duplicates.phone || duplicates.idNumber) {
      setDuplicateField(duplicates.phone ? 'טלפון' : 'ת.ז./ח.פ')
      setShowDuplicateWarning(true)
      return
    }

    setSaving(true)
    setError('')

    try {
      if (selectedCustomer) {
        await updateCustomer({
          customerId: selectedCustomer.id,
          companyRelationId: selectedCustomer.company_relation!.id,
          customerType: formData.type,
          name: formData.name,
          idNumber: formData.idNumber || undefined,
          phone: formData.phone || undefined,
          email: formData.email || undefined,
          address: formData.address || undefined,
          notes: formData.notes || undefined,
          paymentTerms: formData.paymentTerms,
          creditLimit: formData.creditLimit || undefined,
        })
      } else {
        await createCustomer({
          companyId,
          customerType: formData.type,
          name: formData.name,
          idNumber: formData.idNumber || undefined,
          phone: formData.phone || undefined,
          email: formData.email || undefined,
          address: formData.address || undefined,
          notes: formData.notes || undefined,
          paymentTerms: formData.paymentTerms,
          creditLimit: formData.creditLimit || undefined,
        })
      }

      await loadData()
      setShowCustomerModal(false)
      resetForm()
    } catch (err) {
      console.error('Error saving customer:', err)
      setError('שגיאה בשמירת הלקוח')
    } finally {
      setSaving(false)
    }
  }

  if (pageLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-[#33d4ff] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-gray-500">טוען לקוחות...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl">
          {error}
        </div>
      )}

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

      {/* סטטיסטיקות */}
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

      {/* טבלה */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="חיפוש לפי שם, טלפון או ת.ז..."
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

        {/* Desktop Header */}
        <div className="hidden lg:grid lg:grid-cols-12 gap-4 px-5 py-3 bg-gray-50 text-sm font-medium text-gray-500 border-b border-gray-200">
          <div className="col-span-3">לקוח</div>
          <div className="col-span-2">טלפון / אימייל</div>
          <div className="col-span-2">כתובת</div>
          <div className="col-span-1">גרירות</div>
          <div className="col-span-2">יתרה</div>
          <div className="col-span-2">פעולות</div>
        </div>

        <div className="divide-y divide-gray-100">
          {filteredCustomers.map((customer) => (
            <div key={customer.id} className="px-5 py-4 hover:bg-gray-50 transition-colors">
              {/* Desktop */}
              <div className="hidden lg:grid lg:grid-cols-12 gap-4 items-center">
                <div className="col-span-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      customer.customer_type === 'business' ? 'bg-purple-100' : 'bg-blue-100'
                    }`}>
                      {customer.customer_type === 'business' ? (
                        <Building2 size={20} className="text-purple-600" />
                      ) : (
                        <User size={20} className="text-blue-600" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-800">{customer.name}</span>
                        {customer.customer_type === 'business' && (
                          <span className="px-1.5 py-0.5 bg-purple-100 text-purple-600 text-xs rounded">עסקי</span>
                        )}
                      </div>
                      {customer.id_number && (
                        <p className="text-xs text-gray-400">
                          {customer.customer_type === 'business' ? 'ח.פ' : 'ת.ז'}: {customer.id_number}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="col-span-2">
                  {customer.phone && (
                    <a href={`tel:${customer.phone}`} className="text-[#33d4ff] hover:text-[#21b8e6] text-sm">
                      {customer.phone}
                    </a>
                  )}
                  {customer.email && (
                    <p className="text-xs text-gray-500 truncate">{customer.email}</p>
                  )}
                </div>

                <div className="col-span-2">
                  <p className="text-sm text-gray-600 truncate">{customer.address || '-'}</p>
                </div>

                <div className="col-span-1">
                  <span className="text-sm font-medium text-gray-800">{customer.total_tows}</span>
                </div>

                <div className="col-span-2">
                  {customer.open_balance > 0 ? (
                    <div>
                      <span className="font-medium text-red-600">{customer.open_balance.toLocaleString()} ש״ח</span>
                      {customer.company_relation?.payment_terms === 'monthly' && (
                        <p className="text-xs text-gray-500">שוטף + 30</p>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm text-emerald-600">מאופס</span>
                  )}
                </div>

                <div className="col-span-2">
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

              {/* Mobile */}
              <div className="lg:hidden">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      customer.customer_type === 'business' ? 'bg-purple-100' : 'bg-blue-100'
                    }`}>
                      {customer.customer_type === 'business' ? (
                        <Building2 size={20} className="text-purple-600" />
                      ) : (
                        <User size={20} className="text-blue-600" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-800">{customer.name}</span>
                        {customer.customer_type === 'business' && (
                          <span className="px-1.5 py-0.5 bg-purple-100 text-purple-600 text-xs rounded">עסקי</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {customer.open_balance > 0 && (
                      <span className="font-medium text-red-600">{customer.open_balance.toLocaleString()} ש״ח</span>
                    )}
                    <button onClick={() => router.push(`/dashboard/customers/${customer.id}`)} className="p-2 text-gray-400">
                      <ChevronLeft size={20} />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-600">
                  {customer.phone && (
                    <a href={`tel:${customer.phone}`} className="text-[#33d4ff]">{customer.phone}</a>
                  )}
                  <span>•</span>
                  <span>{customer.total_tows} גרירות</span>
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

      {/* Modal הוספה/עריכה */}
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
              {/* סוג לקוח */}
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 bg-[#33d4ff] text-white rounded-full flex items-center justify-center text-sm">1</span>
                  סוג לקוח
                </h3>
                <div className="flex gap-3">
                  <button
                    onClick={() => setFormData({ ...formData, type: 'private' })}
                    className={`flex-1 p-4 rounded-xl border-2 text-center transition-all ${
                      formData.type === 'private' ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
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
                      formData.type === 'business' ? 'border-purple-600 bg-purple-50' : 'border-gray-200 hover:border-gray-300'
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

              {/* פרטים בסיסיים */}
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 bg-[#33d4ff] text-white rounded-full flex items-center justify-center text-sm">2</span>
                  פרטים בסיסיים
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      {formData.type === 'business' ? 'שם החברה / העסק *' : 'שם מלא *'}
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      {formData.type === 'business' ? 'ח.פ / עוסק מורשה' : 'תעודת זהות'}
                    </label>
                    <input
                      type="text"
                      value={formData.idNumber}
                      onChange={(e) => setFormData({ ...formData, idNumber: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                    />
                  </div>
                </div>
              </div>

              {/* פרטי התקשרות */}
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 bg-[#33d4ff] text-white rounded-full flex items-center justify-center text-sm">3</span>
                  פרטי התקשרות
                </h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">טלפון</label>
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

              {/* תנאי תשלום */}
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 bg-[#33d4ff] text-white rounded-full flex items-center justify-center text-sm">4</span>
                  תנאי תשלום
                </h3>
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setFormData({ ...formData, paymentTerms: 'immediate' })}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                        formData.paymentTerms === 'immediate' ? 'bg-[#33d4ff] text-white' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      מיידי
                    </button>
                    <button
                      onClick={() => setFormData({ ...formData, paymentTerms: 'monthly' })}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                        formData.paymentTerms === 'monthly' ? 'bg-[#33d4ff] text-white' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      שוטף + 30
                    </button>
                  </div>

                  {formData.paymentTerms === 'monthly' && (
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
                  )}
                </div>
              </div>

              {/* הערות */}
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 bg-[#33d4ff] text-white rounded-full flex items-center justify-center text-sm">5</span>
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
                disabled={!formData.name || saving}
                className="flex-1 py-3 bg-[#33d4ff] text-white rounded-xl hover:bg-[#21b8e6] disabled:bg-gray-300 transition-colors font-medium"
              >
                {saving ? 'שומר...' : selectedCustomer ? 'שמור שינויים' : 'הוסף לקוח'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* מודל מחיקה */}
      {showDeleteConfirm && selectedCustomer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={32} className="text-red-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-800 mb-2">מחיקת לקוח</h2>
              <p className="text-gray-600">האם למחוק את הלקוח "{selectedCustomer.name}"?</p>
              {selectedCustomer.total_tows > 0 && (
                <p className="text-sm text-amber-600 mt-2">שים לב: ללקוח יש {selectedCustomer.total_tows} גרירות</p>
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

      {/* אזהרת כפילות */}
      {showDuplicateWarning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={32} className="text-amber-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-800 mb-2">לקוח כבר קיים</h2>
              <p className="text-gray-600">נמצא לקוח קיים עם אותו {duplicateField}</p>
            </div>
            <div className="px-5 pb-5">
              <button
                onClick={() => setShowDuplicateWarning(false)}
                className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
              >
                הבנתי
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}