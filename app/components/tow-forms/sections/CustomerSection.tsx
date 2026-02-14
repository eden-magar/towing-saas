'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { CustomerWithDetails } from '../../../lib/queries/customers'
import { CustomerWithPricing } from '../../../lib/queries/price-lists'

interface CustomerSectionProps {
  customers: CustomerWithDetails[]
  customersWithPricing: CustomerWithPricing[]
  selectedCustomerId: string | null
  onCustomerSelect: (customerId: string | null, name: string, phone: string) => void
  customerName: string
  customerPhone: string
  onCustomerNameChange: (name: string) => void
  onCustomerPhoneChange: (phone: string) => void
  customerEmail: string
  customerAddress: string
  onCustomerEmailChange: (email: string) => void
  onCustomerAddressChange: (address: string) => void
  towDate: string
  towTime: string
  isToday: boolean
  onTowDateChange: (date: string) => void
  onTowTimeChange: (time: string) => void
  onIsTodayChange: (isToday: boolean) => void
  customerOrderNumber: string
  onCustomerOrderNumberChange: (value: string) => void
}

export function CustomerSection({
  customers,
  customersWithPricing,
  selectedCustomerId,
  onCustomerSelect,
  customerName,
  customerPhone,
  onCustomerNameChange,
  onCustomerPhoneChange,
  customerEmail,
  customerAddress,
  onCustomerEmailChange,
  onCustomerAddressChange,
  towDate,
  towTime,
  isToday,
  onTowDateChange,
  onTowTimeChange,
  onIsTodayChange,
  customerOrderNumber,
  onCustomerOrderNumberChange
}: CustomerSectionProps) {
  const [customerType, setCustomerType] = useState<'new' | 'existing'>('new')
  const [searchCustomer, setSearchCustomer] = useState('')
  const [showCustomerResults, setShowCustomerResults] = useState(false)

  // בדיקה אם ללקוח יש מחירון מותאם
  const selectedCustomerPricing = selectedCustomerId 
    ? customersWithPricing.find(c => c.customer_id === selectedCustomerId) 
    : null

  // סינון לקוחות לפי חיפוש
  const filteredCustomers = customers.filter(c => {
    if (!searchCustomer) return false
    const query = searchCustomer.toLowerCase()
    return c.name.toLowerCase().includes(query) || 
           (c.phone && c.phone.includes(query)) ||
           (c.id_number && c.id_number.includes(query))
  })

  const handleCustomerTypeChange = (type: 'new' | 'existing') => {
    setCustomerType(type)
    onCustomerSelect(null, '', '')
    setSearchCustomer('')
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-4 sm:px-5 py-3 sm:py-4 bg-gray-50 border-b border-gray-200">
        <h2 className="font-bold text-gray-800 flex items-center gap-2 text-sm sm:text-base">
          <span className="w-6 h-6 bg-[#33d4ff] text-white rounded-full flex items-center justify-center text-sm">1</span>
          פרטי לקוח
        </h2>
      </div>
      <div className="p-4 sm:p-5 space-y-4">
        {/* בחירת סוג לקוח */}
        <div className="flex gap-2">
          <button
            onClick={() => handleCustomerTypeChange('existing')}
            className={`flex-1 py-2.5 px-3 sm:px-4 rounded-xl text-sm font-medium transition-colors ${
              customerType === 'existing'
                ? 'bg-[#33d4ff] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            לקוח קיים
          </button>
          <button
            onClick={() => handleCustomerTypeChange('new')}
            className={`flex-1 py-2.5 px-3 sm:px-4 rounded-xl text-sm font-medium transition-colors ${
              customerType === 'new'
                ? 'bg-[#33d4ff] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            לקוח חדש
          </button>
        </div>

        {customerType === 'existing' ? (
          <div>
            {/* שדה חיפוש - מוסתר אחרי בחירת לקוח */}
            {!selectedCustomerId && (
              <>
                <label className="block text-sm font-medium text-gray-700 mb-1">חיפוש לקוח</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="שם, טלפון או ח.פ..."
                    value={searchCustomer}
                    onChange={(e) => {
                      setSearchCustomer(e.target.value)
                      setShowCustomerResults(e.target.value.length > 0)
                    }}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                  />
                  {showCustomerResults && filteredCustomers.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 overflow-hidden max-h-60 overflow-y-auto">
                      {filteredCustomers.map((customer) => (
                        <div
                          key={customer.id}
                          onClick={() => {
                            onCustomerSelect(customer.id, customer.name, customer.phone || '')
                            onCustomerEmailChange(customer.email || '')
                            onCustomerAddressChange(customer.address || '')
                            setSearchCustomer(customer.name)
                            setShowCustomerResults(false)
                          }}
                          className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-gray-800">{customer.name}</p>
                              <p className="text-sm text-gray-500">{customer.phone}</p>
                            </div>
                            <span className={`px-2 py-0.5 text-xs rounded ${
                              customer.customer_type === 'business'
                                ? 'bg-purple-100 text-purple-600' 
                                : 'bg-gray-100 text-gray-600'
                            }`}>
                              {customer.customer_type === 'business' ? 'עסקי' : 'פרטי'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
            
            {/* פרטי לקוח שנבחר */}
            {selectedCustomerId && (
              <>
                {selectedCustomerPricing && (selectedCustomerPricing.discount_percent > 0 || selectedCustomerPricing.price_items.length > 0) && (
                  <div className="mb-2 px-3 py-1.5 bg-purple-50 border border-purple-200 rounded-lg inline-flex items-center gap-1">
                    <span className="text-xs text-purple-600">🏷️ יש מחירון מותאם</span>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      שם לקוח <Check size={14} className="inline text-emerald-500" />
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      readOnly
                      onClick={() => {
                        onCustomerSelect(null, '', '')
                        setSearchCustomer('')
                      }}
                      className="w-full px-4 py-2.5 border border-emerald-200 bg-emerald-50 rounded-xl text-sm text-gray-700 cursor-pointer hover:bg-emerald-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      טלפון <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => onCustomerPhoneChange(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      מספר הזמנה
                    </label>
                    <input
                      type="text"
                      value={customerOrderNumber}
                      onChange={(e) => onCustomerOrderNumberChange(e.target.value)}
                      placeholder="אופציונלי"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">אימייל</label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => onCustomerEmailChange(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">כתובת</label>
                  <input
                    type="text"
                    value={customerAddress}
                    onChange={(e) => onCustomerAddressChange(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                  />
                </div>


              </>
            )}
          </div>
          ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                שם לקוח <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => onCustomerNameChange(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                טלפון <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => onCustomerPhoneChange(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                מספר הזמנה
              </label>
              <input
                type="text"
                value={customerOrderNumber}
                onChange={(e) => onCustomerOrderNumberChange(e.target.value)}
                placeholder="אופציונלי"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">אימייל</label>
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => onCustomerEmailChange(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">כתובת</label>
              <input
                type="text"
                value={customerAddress}
                onChange={(e) => onCustomerAddressChange(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
              />
            </div>
            
          </div>
        )}

        {/* תאריך ושעה */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">תאריך ביצוע</label>
            <div className="flex gap-2">
            <button
              onClick={() => {
                const now = new Date()
                const dateStr = now.toISOString().split('T')[0]
                const timeStr = now.toTimeString().slice(0, 5)
                onTowDateChange(dateStr)
                onTowTimeChange(timeStr)
                onIsTodayChange(true)
              }}
              className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-medium transition-colors ${
                isToday ? 'bg-[#33d4ff] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              עכשיו
            </button>

              <input
                type="date"
                value={towDate}
                onChange={(e) => {
                  onTowDateChange(e.target.value)
                  onIsTodayChange(false)
                }}
                className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">שעה</label>
            <input
              type="time"
              value={towTime}
              onChange={(e) => onTowTimeChange(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
