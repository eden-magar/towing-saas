'use client'

import { useState } from 'react'
import { Search, User, ArrowLeftRight } from 'lucide-react'
import { CustomerWithDetails } from '../../../lib/queries/customers'
import { CustomerWithPricing } from '../../../lib/queries/price-lists'
import { PhoneInput } from '../../ui/PhoneInput'

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
  customerEmail: _customerEmail,
  customerAddress: _customerAddress,
  onCustomerEmailChange,
  onCustomerAddressChange,
  towDate,
  towTime,
  isToday,
  onTowDateChange,
  onTowTimeChange,
  onIsTodayChange,
  customerOrderNumber,
  onCustomerOrderNumberChange,
}: CustomerSectionProps) {
  const [customerType, setCustomerType] = useState<'new' | 'existing'>('new')
  const [searchCustomer, setSearchCustomer] = useState('')

  const selectedCustomerPricing = selectedCustomerId
    ? customersWithPricing.find((c) => c.customer_id === selectedCustomerId)
    : null

  const filteredCustomers = customers.filter((c) => {
    if (!searchCustomer.trim()) return true
    const query = searchCustomer.toLowerCase()
    return (
      c.name.toLowerCase().includes(query) ||
      (c.phone && c.phone.includes(query)) ||
      (c.id_number && c.id_number.includes(query))
    )
  })

  const handleCustomerTypeChange = (type: 'new' | 'existing') => {
    setCustomerType(type)
    onCustomerSelect(null, '', '')
    setSearchCustomer('')
  }

  const clearCustomer = () => {
    onCustomerSelect(null, '', '')
    setSearchCustomer('')
  }

  const showPricingBadge =
    selectedCustomerPricing &&
    (selectedCustomerPricing.discount_percent > 0 ||
      selectedCustomerPricing.price_items.length > 0)

  const selectCustomerFromList = (customer: CustomerWithDetails) => {
    onCustomerSelect(customer.id, customer.name, customer.phone || '')
    onCustomerEmailChange(customer.email || '')
    onCustomerAddressChange(customer.address || '')
    setSearchCustomer(customer.name)
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {customerType === 'existing' ? (
        !selectedCustomerId ? (
          <>
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
              <button
                type="button"
                onClick={() => handleCustomerTypeChange('new')}
                className="text-xs text-blue-600 hover:underline"
              >
                + לקוח חדש
              </button>
              <h2 className="font-bold text-gray-800 flex items-center gap-2 text-sm">
                <span className="w-6 h-6 bg-[#33d4ff] text-white rounded-full flex items-center justify-center text-xs">
                  1
                </span>
                פרטי לקוח
              </h2>
            </div>
            <div className="p-3 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="חפש לפי שם, טלפון..."
                  value={searchCustomer}
                  onChange={(e) => setSearchCustomer(e.target.value)}
                  className="w-full pr-9 pl-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]/40"
                />
              </div>
            </div>
            <div className="max-h-52 overflow-y-auto divide-y divide-gray-50">
              {filteredCustomers.map((customer) => (
                <button
                  key={customer.id}
                  type="button"
                  onClick={() => selectCustomerFromList(customer)}
                  className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 transition-colors gap-3"
                >
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded-md border ${
                        customer.customer_type === 'business'
                          ? 'bg-purple-50 text-purple-700 border-purple-200'
                          : 'bg-gray-50 text-gray-600 border-gray-200'
                      }`}
                    >
                      {customer.customer_type === 'business' ? 'עסקי' : 'פרטי'}
                    </span>
                    <span className="text-xs text-gray-500 dir-ltr">{customer.phone}</span>
                  </div>
                  <span className="font-medium text-sm text-gray-800 truncate">{customer.name}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
              <h2 className="font-bold text-gray-800 flex items-center gap-2 text-sm">
                <span className="w-6 h-6 bg-[#33d4ff] text-white rounded-full flex items-center justify-center text-xs">
                  1
                </span>
                פרטי לקוח
              </h2>
            </div>
            <div className="flex items-center justify-between px-4 py-3 gap-3">
              <button
                type="button"
                onClick={clearCustomer}
                className="flex items-center gap-1.5 text-xs text-gray-700 border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50 hover:border-gray-400 shrink-0 transition-colors"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                החלף לקוח
              </button>
              <div className="text-right flex-1 min-w-0">
                <div className="font-medium text-sm text-gray-800 truncate">{customerName}</div>
                <div className="flex items-center gap-2 justify-end mt-0.5 flex-wrap">
                  <span className="text-xs text-gray-500">{customerPhone}</span>
                  {showPricingBadge && (
                    <span className="text-xs bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded-md">
                      מחירון מותאם
                    </span>
                  )}
                </div>
              </div>
              <div className="w-8 h-8 rounded-full bg-[#33d4ff]/20 flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-[#33d4ff]" />
              </div>
            </div>
          </>
        )
      ) : (
        <>
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
            <button
              type="button"
              onClick={() => handleCustomerTypeChange('existing')}
              className="text-xs text-blue-600 hover:underline"
            >
              חזור ללקוח קיים
            </button>
            <h2 className="font-bold text-gray-800 flex items-center gap-2 text-sm">
              <span className="w-6 h-6 bg-[#33d4ff] text-white rounded-full flex items-center justify-center text-xs">
                1
              </span>
              פרטי לקוח
            </h2>
          </div>
          <div className="p-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={customerName}
                onChange={(e) => onCustomerNameChange(e.target.value)}
                placeholder="שם הלקוח *"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]/40"
              />
              <PhoneInput
                value={customerPhone}
                onChange={onCustomerPhoneChange}
                placeholder="טלפון"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]/40"
              />
            </div>
            <input
              type="text"
              value={customerOrderNumber}
              onChange={(e) => onCustomerOrderNumberChange(e.target.value)}
              placeholder="מספר הזמנה (אופציונלי)"
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]/40"
            />
          </div>
        </>
      )}

      <div className="px-4 pb-4 pt-2 border-t border-gray-100">
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => {
              const now = new Date()
              const dateStr = now.toISOString().split('T')[0]
              const timeStr = now.toTimeString().slice(0, 5)
              onTowDateChange(dateStr)
              onTowTimeChange(timeStr)
              onIsTodayChange(true)
            }}
            className={`py-2 px-2 rounded-xl text-sm font-medium transition-colors ${
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
            className="min-w-0 px-2 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]/40"
          />
          <input
            type="time"
            value={towTime}
            onChange={(e) => onTowTimeChange(e.target.value)}
            className="min-w-0 px-2 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]/40"
          />
        </div>
      </div>
    </div>
  )
}
