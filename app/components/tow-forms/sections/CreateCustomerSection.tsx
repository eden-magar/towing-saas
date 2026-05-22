'use client'

import { useState } from 'react'
import { Search, User, ArrowLeftRight } from 'lucide-react'
import type { CustomerWithDetails } from '../../../lib/queries/customers'
import type { CustomerWithPricing } from '../../../lib/queries/price-lists'
import {
  getStoredVehicleStatusDisplay,
  type StoredVehicleWithCustomer,
} from '../../../lib/queries/storage'
import { Input, Button, FormCard } from '../../ui'

export type CreateCustomerTab = 'existing' | 'casual'

export interface CreateCustomerSectionProps {
  customers: CustomerWithDetails[]
  customersWithPricing: CustomerWithPricing[]
  selectedCustomerId: string | null
  customerTab: CreateCustomerTab
  onCustomerTabChange: (tab: CreateCustomerTab) => void
  customerSearch: string
  onCustomerSearchChange: (q: string) => void
  customerName: string
  customerPhone: string
  onCustomerNameChange: (v: string) => void
  onCustomerPhoneChange: (v: string) => void
  onCustomerSelect: (customerId: string | null, name: string, phone: string) => void
  customerStoredVehicles: StoredVehicleWithCustomer[]
  towDate: string
  towTime: string
  onTowDateChange: (v: string) => void
  onTowTimeChange: (v: string) => void
  onNowClick: () => void
  customerOrderNumber: string
  onCustomerOrderNumberChange: (v: string) => void
  editTowId?: string | null
  orderNumber?: string | null
}

function hasPersonalPricing(
  customersWithPricing: CustomerWithPricing[],
  customerId: string
) {
  return customersWithPricing.some((cp) => cp.customer_id === customerId)
}

export function CreateCustomerSection({
  customers,
  customersWithPricing,
  selectedCustomerId,
  customerTab,
  onCustomerTabChange,
  customerSearch,
  onCustomerSearchChange,
  customerName,
  customerPhone,
  onCustomerNameChange,
  onCustomerPhoneChange,
  onCustomerSelect,
  customerStoredVehicles,
  towDate,
  towTime,
  onTowDateChange,
  onTowTimeChange,
  onNowClick,
  customerOrderNumber,
  onCustomerOrderNumberChange,
  editTowId,
  orderNumber,
}: CreateCustomerSectionProps) {
  const [isFocused, setIsFocused] = useState(false)

  const filteredCustomers = customers.filter((c) => {
    const q = customerSearch.trim()
    if (!q) return true
    const idNum = (c as { id_number?: string }).id_number
    return (
      (c.name?.toLowerCase() ?? '').includes(q.toLowerCase()) ||
      (c.phone?.includes(q) ?? false) ||
      (idNum?.includes(q) ?? false)
    )
  })

  const showCustomerList = isFocused || customerSearch.length > 0

  const switchToWalkIn = () => onCustomerTabChange('casual')
  const switchToExisting = () => onCustomerTabChange('existing')
  const clearCustomer = () => onCustomerSelect(null, '', '')

  const priceListBadge =
    selectedCustomerId && hasPersonalPricing(customersWithPricing, selectedCustomerId)
      ? 'מחירון אישי'
      : null

  const schedulingFooter = (
    <>
      {editTowId && orderNumber && (
        <div className="px-3 py-2 border-t border-gray-100">
          <p className="text-xs text-gray-500 mb-1">מספר הזמנה</p>
          <div className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-xl text-sm text-gray-600 font-mono">
            #{orderNumber}
          </div>
        </div>
      )}
      <div className="px-3 py-2.5 border-t border-gray-100 flex items-center gap-2 flex-wrap" dir="rtl">
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={onNowClick}
          className="shrink-0"
        >
          עכשיו
        </Button>
        <Input
          type="date"
          value={towDate}
          onChange={(e) => onTowDateChange(e.target.value)}
          className="flex-1 min-w-[7rem]"
        />
        <Input
          type="time"
          value={towTime}
          onChange={(e) => onTowTimeChange(e.target.value)}
          className="flex-1 min-w-[7rem]"
        />
        <Input
          type="text"
          value={customerOrderNumber}
          onChange={(e) => onCustomerOrderNumberChange(e.target.value)}
          placeholder="מס׳ הזמנת לקוח"
          className="flex-1 min-w-[8rem]"
        />
      </div>
    </>
  )

  if (customerTab === 'casual') {
    return (
      <FormCard
        icon={User}
        title="פרטי לקוח"
        description="לקוח מזדמן - הזן פרטים חדשים"
        actions={
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={switchToExisting}
          >
            חזור ללקוח קיים
          </Button>
        }
      >
        <div className="p-3 space-y-3">
          <Input
            type="text"
            value={customerName}
            onChange={(e) => onCustomerNameChange(e.target.value)}
            placeholder="שם הלקוח *"
          />
          <Input
            type="tel"
            value={customerPhone}
            onChange={(e) => onCustomerPhoneChange(e.target.value)}
            placeholder="טלפון"
          />
        </div>
        {schedulingFooter}
      </FormCard>
    )
  }

  if (!selectedCustomerId) {
    return (
      <FormCard
        icon={User}
        title="פרטי לקוח"
        description="בחר לקוח קיים או צור לקוח מזדמן"
        actions={
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={switchToWalkIn}
          >
            לקוח מזדמן
          </Button>
        }
      >
        <div className="px-3 py-2 border-b border-gray-100" dir="rtl">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <Input
              type="text"
              value={customerSearch}
              onChange={(e) => onCustomerSearchChange(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setTimeout(() => setIsFocused(false), 150)}
              placeholder="חפש לפי שם, טלפון, ת.ז..."
              className="pl-9 pr-3 text-right"
            />
          </div>
        </div>

        {showCustomerList && (
          <div
            className="max-h-48 overflow-y-auto divide-y divide-gray-100"
            dir="rtl"
          >
            {filteredCustomers.slice(0, 10).map((customer) => {
              const listBadge = hasPersonalPricing(customersWithPricing, customer.id)
                ? 'מחירון אישי'
                : null
              return (
                <button
                  key={customer.id}
                  type="button"
                  onClick={() =>
                    onCustomerSelect(customer.id, customer.name || '', customer.phone || '')
                  }
                  className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50 transition-colors text-right"
                >
                  <div className="flex items-center gap-2">
                    {listBadge && (
                      <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-md">
                        {listBadge}
                      </span>
                    )}
                    <span className="text-xs text-gray-400">{customer.phone}</span>
                  </div>
                  <span className="text-sm text-gray-800 font-medium">{customer.name}</span>
                </button>
              )
            })}
          </div>
        )}
        {schedulingFooter}
      </FormCard>
    )
  }

  return (
    <FormCard
      icon={User}
      title="פרטי לקוח"
      description="לקוח נבחר"
      actions={
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={clearCustomer}
        >
          <ArrowLeftRight size={12} />
          החלף לקוח
        </Button>
      }
    >
      <div className="flex items-center justify-between px-4 py-3 gap-2">
        <div className="text-right flex-1 min-w-0">
          <div className="font-medium text-sm text-gray-800 truncate">{customerName}</div>
          <div className="flex items-center gap-2 justify-end mt-0.5 flex-wrap">
            <span className="text-xs text-gray-500">{customerPhone}</span>
            {priceListBadge && (
              <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-md">
                {priceListBadge}
              </span>
            )}
          </div>
        </div>
        <div className="w-8 h-8 rounded-full bg-[#33d4ff]/20 flex items-center justify-center shrink-0">
          <User className="w-4 h-4 text-[#33d4ff]" />
        </div>
      </div>

      {customerStoredVehicles.length > 0 && (
        <div className="px-4 pb-4 pt-0 border-t border-gray-100">
          <p className="text-xs text-gray-500 mb-2">רכבים באחסנה</p>
          <div className="flex flex-wrap gap-2">
            {customerStoredVehicles.map((v) => {
              const statusDisplay = getStoredVehicleStatusDisplay(v.current_status)
              const isReserved = v.current_status === 'reserved_for_tow'
              return (
                <div
                  key={v.id}
                  className={`px-3 py-1.5 rounded-lg text-sm border flex items-center gap-1 flex-wrap ${
                    isReserved
                      ? 'border-amber-300 bg-amber-50'
                      : 'border-gray-300 bg-white'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      v.vehicle_condition === 'operational' ? 'bg-green-500' : 'bg-red-500'
                    }`}
                  />
                  <span>
                    {v.plate_number} — {v.vehicle_data?.model || ''}
                  </span>
                  <span className="text-xs text-gray-400 mr-1">
                    {v.vehicle_condition === 'operational' ? 'תקין' : 'תקול'}
                  </span>
                  {v.current_status !== 'stored' && (
                    <span
                      className={`text-xs font-medium px-1.5 py-0.5 rounded ${statusDisplay.badgeClass}`}
                    >
                      {statusDisplay.label}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            בחירת רכב תתאפשר לאחר בחירת סוג גרירה
          </p>
        </div>
      )}
      {schedulingFooter}
    </FormCard>
  )
}
