'use client'

import { useState } from 'react'
import { Search, User, ArrowLeftRight, Loader2 } from 'lucide-react'
import type { CustomerListItem } from '../../../lib/queries/customers'
import type { CustomerWithPricing } from '../../../lib/queries/price-lists'
import {
  getStoredVehicleStatusDisplay,
  type StoredVehicleWithCustomer,
} from '../../../lib/queries/storage'
import { Input, Button, FormCard, TimeInput, DateInput } from '../../ui'
import { PhoneInput } from '../../ui/PhoneInput'
import { OrdererNameAutocomplete } from '../../customer-orderers/OrdererNameAutocomplete'
import { SaveCustomerOrdererPill } from '../../customer-orderers/SaveCustomerOrdererPill'
import type { CustomerOrderer } from '../../../lib/types'

export type CreateCustomerTab = 'existing' | 'casual'

export interface CreateCustomerSectionProps {
  customers: CustomerListItem[]
  customersLoading: boolean
  customerIdsWithPersonalPricing: string[]
  selectedCustomerPricing: CustomerWithPricing | null
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
  towEndDate: string
  towEndTime: string
  onTowDateChange: (v: string) => void
  onTowTimeChange: (v: string) => void
  onTowEndDateChange: (v: string) => void
  onTowEndTimeChange: (v: string) => void
  onNowClick: () => void
  customerOrderNumber: string
  onCustomerOrderNumberChange: (v: string) => void
  isBusinessCustomer?: boolean
  department?: string
  onDepartmentChange?: (v: string) => void
  orderedBy?: string
  onOrderedByChange?: (v: string) => void
  savedOrderers?: CustomerOrderer[]
  orderersLoading?: boolean
  showSaveOrdererPill?: boolean
  saveOrdererToCustomer?: boolean
  onSaveOrdererToggle?: () => void
  onOrdererSelected?: () => void
  editTowId?: string | null
  orderNumber?: string | null
  /** When true, applies mobile-only layout/tap-target tweaks. Desktop path is unaffected. */
  isMobile?: boolean
  /**
   * When true, renders the compact stacked layout (same density as mobile) but
   * tuned for a narrow desktop column: department/orderer stack vertically.
   * Additive — existing desktop/mobile callers are unaffected.
   */
  narrowColumn?: boolean
}

function hasPersonalPricing(customerIdsWithPersonalPricing: string[], customerId: string) {
  return customerIdsWithPersonalPricing.includes(customerId)
}

export function CreateCustomerSection({
  customers,
  customersLoading,
  customerIdsWithPersonalPricing,
  selectedCustomerPricing: _selectedCustomerPricing,
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
  towEndDate,
  towEndTime,
  onTowDateChange,
  onTowTimeChange,
  onTowEndDateChange,
  onTowEndTimeChange,
  onNowClick,
  customerOrderNumber,
  onCustomerOrderNumberChange,
  isBusinessCustomer = false,
  department = '',
  onDepartmentChange,
  orderedBy = '',
  onOrderedByChange,
  savedOrderers = [],
  orderersLoading = false,
  showSaveOrdererPill = false,
  saveOrdererToCustomer = false,
  onSaveOrdererToggle,
  onOrdererSelected,
  editTowId,
  orderNumber,
  isMobile = false,
  narrowColumn = false,
}: CreateCustomerSectionProps) {
  // narrow-column reuses the mobile compact/stacked visual treatment
  const compact = isMobile || narrowColumn
  const [isFocused, setIsFocused] = useState(false)
  // Mobile-only: collapse the optional end-time behind a button. Start expanded
  // if either end field already has a value so existing data is never hidden.
  const [showEndTime, setShowEndTime] = useState(
    () => !!(towEndTime || towEndDate),
  )
  // Mobile-only: "עכשיו" (default) vs "בחר מועד אחר" toggle. When false the
  // time/date pickers stay hidden and towDate/towTime hold the "now" values.
  const [useCustomTime, setUseCustomTime] = useState(false)

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
    selectedCustomerId && hasPersonalPricing(customerIdsWithPersonalPricing, selectedCustomerId)
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
      {compact ? (
        <div
          className="px-3 py-2 border-t border-gray-100 flex flex-col items-stretch gap-2"
          dir="rtl"
        >
          <Input
            type="text"
            value={customerOrderNumber}
            onChange={(e) => onCustomerOrderNumberChange(e.target.value)}
            placeholder="מס׳ הזמנת לקוח"
            className="w-full h-12"
          />
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => {
                onNowClick()
                setUseCustomTime(false)
              }}
              className={
                !useCustomTime
                  ? 'min-h-[48px] rounded-lg border text-sm font-medium transition-colors bg-gt-brand text-white border-gt-brand'
                  : 'min-h-[48px] rounded-lg border text-sm font-medium transition-colors bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }
            >
              עכשיו
            </button>
            <button
              type="button"
              onClick={() => setUseCustomTime(true)}
              className={
                useCustomTime
                  ? 'min-h-[48px] rounded-lg border text-sm font-medium transition-colors bg-gt-brand text-white border-gt-brand'
                  : 'min-h-[48px] rounded-lg border text-sm font-medium transition-colors bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }
            >
              מועד אחר
            </button>
            <button
              type="button"
              onClick={() => setShowEndTime((v) => !v)}
              className={
                showEndTime
                  ? 'min-h-[48px] rounded-lg border text-sm font-medium transition-colors bg-gt-brand text-white border-gt-brand'
                  : 'min-h-[48px] rounded-lg border text-sm font-medium transition-colors bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }
            >
              מועד סיום
            </button>
          </div>
          {useCustomTime && (
            <div className="flex items-center gap-2">
              <TimeInput
                value={towTime}
                onChange={onTowTimeChange}
                isMobile
                className="flex-1"
              />
              <DateInput
                value={towDate}
                onChange={onTowDateChange}
                isMobile
                className="flex-1"
              />
            </div>
          )}
          {showEndTime && (
            <div className="pt-2 mt-1 border-t border-gray-200 flex flex-col items-stretch gap-2">
              <span className="text-sm text-gray-600">שעת סיום (אופציונלי)</span>
              <div className="flex items-center gap-2">
                <TimeInput
                  value={towEndTime}
                  onChange={(v) => {
                    onTowEndTimeChange(v)
                    if (v && !towEndDate && towDate) {
                      onTowEndDateChange(towDate)
                    }
                  }}
                  isMobile
                  className="flex-1"
                />
                <DateInput
                  value={towEndDate}
                  onChange={onTowEndDateChange}
                  isMobile
                  className="flex-1"
                />
              </div>
            </div>
          )}
        </div>
      ) : (
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
          <DateInput
            value={towDate}
            onChange={onTowDateChange}
            className="flex-1 min-w-[7rem]"
          />
          <TimeInput
            value={towTime}
            onChange={onTowTimeChange}
            className="flex-1 min-w-[7rem]"
          />
          <Input
            type="text"
            value={customerOrderNumber}
            onChange={(e) => onCustomerOrderNumberChange(e.target.value)}
            placeholder="מס׳ הזמנת לקוח"
            className="flex-1 min-w-[8rem]"
          />
          <span className="text-sm text-gray-600 shrink-0">שעת סיום (אופציונלי)</span>
          <TimeInput
            value={towEndTime}
            onChange={(v) => {
              onTowEndTimeChange(v)
              if (v && !towEndDate && towDate) {
                onTowEndDateChange(towDate)
              }
            }}
            className="flex-1 min-w-[7rem]"
          />
          <DateInput
            value={towEndDate}
            onChange={onTowEndDateChange}
            className="flex-1 min-w-[7rem]"
          />
        </div>
      )}
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
            size={compact ? 'md' : 'sm'}
            className={compact ? 'min-h-[48px]' : undefined}
            onClick={switchToExisting}
          >
            חזור ללקוח קיים
          </Button>
        }
      >
        <div
          className={compact ? 'p-3 grid grid-cols-1 gap-2' : 'p-3 grid grid-cols-2 gap-2'}
          dir="rtl"
        >
          <Input
            type="text"
            value={customerName}
            onChange={(e) => onCustomerNameChange(e.target.value)}
            placeholder="שם הלקוח *"
            className={compact ? 'h-12' : undefined}
          />
          <PhoneInput
            value={customerPhone}
            onChange={onCustomerPhoneChange}
            placeholder="טלפון"
            className={compact ? 'h-12' : undefined}
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
            size={compact ? 'md' : 'sm'}
            className={compact ? 'min-h-[48px]' : undefined}
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
              disabled={customersLoading}
              className={compact ? 'pl-9 pr-3 text-right h-12' : 'pl-9 pr-3 text-right'}
            />
          </div>
          {customersLoading && (
            <div className="mt-2 flex items-center justify-end gap-2 text-xs text-gt-text-secondary">
              <span>טוען לקוחות...</span>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-gt-brand" />
            </div>
          )}
        </div>

        {showCustomerList && !customersLoading && (
          <div
            className="max-h-48 overflow-y-auto divide-y divide-gray-100"
            dir="rtl"
          >
            {filteredCustomers.slice(0, 10).map((customer) => {
              const listBadge = hasPersonalPricing(customerIdsWithPersonalPricing, customer.id)
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
          size={compact ? 'md' : 'sm'}
          className={compact ? 'min-h-[48px]' : undefined}
          onClick={clearCustomer}
        >
          <ArrowLeftRight size={12} />
          החלף לקוח
        </Button>
      }
    >
      <div className="flex items-center justify-between px-4 py-3 gap-2">
        {compact ? (
          <div className="text-right flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base font-semibold text-gray-900 truncate">
                {customerName}
              </span>
              {priceListBadge && (
                <span className="shrink-0 text-xs bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-md">
                  {priceListBadge}
                </span>
              )}
            </div>
            <div className="mt-0.5">
              <span className="text-xs text-gray-500">{customerPhone}</span>
            </div>
          </div>
        ) : (
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
        )}
        <div className="w-8 h-8 rounded-full bg-[#33d4ff]/20 flex items-center justify-center shrink-0">
          <User className="w-4 h-4 text-[#33d4ff]" />
        </div>
      </div>

      {isBusinessCustomer && onDepartmentChange && onOrderedByChange && (
        <div className="px-4 pb-3 border-t border-gray-100 space-y-2" dir="rtl">
          <div className={narrowColumn ? 'grid grid-cols-1 gap-2' : isMobile ? 'grid grid-cols-2 gap-2' : 'grid grid-cols-1 sm:grid-cols-2 gap-2'}>
            {compact ? (
              <div>
                <label className="block text-xs text-gray-500 mb-1 text-right">מחלקה</label>
                <Input
                  type="text"
                  value={department}
                  onChange={(e) => onDepartmentChange(e.target.value)}
                  placeholder="מחלקה (אופציונלי)"
                  className="text-right"
                />
              </div>
            ) : (
              <Input
                type="text"
                value={department}
                onChange={(e) => onDepartmentChange(e.target.value)}
                placeholder="מחלקה (אופציונלי)"
                className="text-right"
              />
            )}
            {compact ? (
              <div>
                <label className="block text-xs text-gray-500 mb-1 text-right">מזמין</label>
                <OrdererNameAutocomplete
                  value={orderedBy}
                  onChange={onOrderedByChange}
                  onSelectOrderer={(orderer) => {
                    onDepartmentChange(orderer.department ?? '')
                    onOrderedByChange(orderer.name)
                    onOrdererSelected?.()
                  }}
                  orderers={savedOrderers}
                  loading={orderersLoading}
                  placeholder="מזמין (אופציונלי)"
                  className="text-right"
                  isMobile
                />
              </div>
            ) : (
              <OrdererNameAutocomplete
                value={orderedBy}
                onChange={onOrderedByChange}
                onSelectOrderer={(orderer) => {
                  onDepartmentChange(orderer.department ?? '')
                  onOrderedByChange(orderer.name)
                  onOrdererSelected?.()
                }}
                orderers={savedOrderers}
                loading={orderersLoading}
                placeholder="מזמין (אופציונלי)"
                className="text-right"
              />
            )}
          </div>
          {showSaveOrdererPill && onSaveOrdererToggle && (
            <SaveCustomerOrdererPill
              visible
              active={saveOrdererToCustomer}
              onToggle={onSaveOrdererToggle}
            />
          )}
        </div>
      )}

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
