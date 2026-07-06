'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
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
import {
  dateInputStatusClass,
  inputWrapperStatusClass,
  type GetRequestFieldStatus,
} from '../shared/RequestFieldTag'

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
  /** When provided (fromRequest flow), drives amber/blue field highlighting. */
  getRequestFieldStatus?: GetRequestFieldStatus
}

function hasPersonalPricing(customerIdsWithPersonalPricing: string[], customerId: string) {
  return customerIdsWithPersonalPricing.includes(customerId)
}

/** True when towDate/towTime match today and current clock (within a few minutes). */
function isScheduledForNow(date: string, time: string): boolean {
  if (!date || !time) return true
  const now = new Date()
  const today = now.toISOString().split('T')[0]
  if (date !== today) return false
  const [h, m] = time.split(':').map((part) => parseInt(part, 10))
  if (Number.isNaN(h) || Number.isNaN(m)) return false
  const scheduled = new Date(now)
  scheduled.setHours(h, m, 0, 0)
  return Math.abs(scheduled.getTime() - now.getTime()) <= 5 * 60 * 1000
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
  getRequestFieldStatus,
}: CreateCustomerSectionProps) {
  const isNarrow = narrowColumn ?? false
  const isMobileSized = isMobile ?? false
  const compact = isMobileSized || isNarrow
  const [isFocused, setIsFocused] = useState(false)
  const skipScheduleExpandRef = useRef(false)
  const [showEndTime, setShowEndTime] = useState(
    () => !!(towEndTime || towEndDate),
  )
  const [useCustomTime, setUseCustomTime] = useState(
    () => !!(towDate && towTime && !isScheduledForNow(towDate, towTime)),
  )

  useEffect(() => {
    if (skipScheduleExpandRef.current) {
      skipScheduleExpandRef.current = false
      return
    }
    if (towDate && towTime && !isScheduledForNow(towDate, towTime)) {
      setUseCustomTime(true)
    }
  }, [towDate, towTime])

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

  const customerOrderNumberStatus = getRequestFieldStatus?.(
    'customerOrderNumber',
    customerOrderNumber,
  )
  const departmentStatus = getRequestFieldStatus?.('department', department)
  const orderedByStatus = getRequestFieldStatus?.('orderedBy', orderedBy)
  const towDateStatus = getRequestFieldStatus?.('towDate', towDate)
  const towTimeStatus = getRequestFieldStatus?.('towTime', towTime)
  const towEndDateStatus = getRequestFieldStatus?.('towEndDate', towEndDate)
  const towEndTimeStatus = getRequestFieldStatus?.('towEndTime', towEndTime)

  const scheduleMinH = isNarrow ? 'min-h-[36px]' : compact ? 'min-h-[48px]' : 'min-h-[40px]'
  const scheduleText = isNarrow ? 'text-xs' : 'text-sm'
  const scheduleBtn = (active: boolean) =>
    active
      ? `${scheduleMinH} rounded-lg border ${scheduleText} font-medium transition-colors bg-gt-brand text-white border-gt-brand px-1`
      : `${scheduleMinH} rounded-lg border ${scheduleText} font-medium transition-colors bg-white text-gray-600 border-gray-300 hover:bg-gray-50 px-1`
  const formCardClass = isNarrow ? 'mb-0' : undefined
  const narrowInputClass = 'h-9 py-0 leading-9'
  const fieldInputClass = isNarrow
    ? `text-right ${narrowInputClass}`
    : compact
      ? 'text-right h-12'
      : 'text-right'
  const sectionPaddingX = compact ? 'px-3' : 'px-4'
  const sectionPaddingY = isNarrow ? 'py-2' : compact ? 'py-2.5' : 'py-3'
  const showBusinessFields =
    isBusinessCustomer && onDepartmentChange && onOrderedByChange
  const businessFieldsGridClass = isNarrow
    ? 'grid grid-cols-1 gap-2'
    : 'grid grid-cols-1 sm:grid-cols-2 gap-2'

  const inlineCustomerOrderNumberField = (
    <div className="w-full sm:w-auto sm:max-w-[11rem] shrink-0">
      <label className="block text-[10px] sm:text-xs font-semibold text-gray-800 mb-0.5 text-right">
        מס׳ הזמנת לקוח
      </label>
      <div className={inputWrapperStatusClass('', customerOrderNumberStatus)}>
        <Input
          type="text"
          value={customerOrderNumber}
          onChange={(e) => onCustomerOrderNumberChange(e.target.value)}
          placeholder="מס׳ הזמנת לקוח"
          className={`w-full text-right font-semibold border-2 focus:border-gt-brand ${
            customerOrderNumberStatus ? '' : 'border-gt-brand/35'
          } ${compact ? 'h-10 text-sm' : 'h-9 text-sm'}`}
        />
      </div>
    </div>
  )

  const sectionIdentityHeader = (identityContent: ReactNode) => (
    <div
      className={`${sectionPaddingX} py-3.5 sm:py-4 border-b border-gray-100`}
      dir="rtl"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">{identityContent}</div>
        {inlineCustomerOrderNumberField}
      </div>
    </div>
  )

  const identityAvatar = (muted = false) => (
    <div
      className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
        muted ? 'bg-gray-100' : 'bg-[#33d4ff]/20'
      }`}
    >
      <User className={`w-4 h-4 ${muted ? 'text-gray-400' : 'text-[#33d4ff]'}`} />
    </div>
  )

  const casualIdentityContent = (
    <>
      {identityAvatar(true)}
      <div className="text-right flex-1 min-w-0">
        <p className="text-base sm:text-lg font-semibold text-gray-900 leading-tight">
          לקוח מזדמן
        </p>
        <p className="text-xs sm:text-sm text-gray-500 mt-1">הזן פרטי לקוח חדש</p>
      </div>
    </>
  )

  const selectedIdentityContent = (
    <>
      {identityAvatar()}
      <div className="text-right flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap justify-start">
          <span className="text-base sm:text-lg font-semibold text-gray-900 leading-tight truncate">
            {customerName}
          </span>
          {priceListBadge && (
            <span className="shrink-0 text-xs bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-md">
              {priceListBadge}
            </span>
          )}
        </div>
        {customerPhone ? (
          <p className="text-xs sm:text-sm text-gray-500 mt-1">{customerPhone}</p>
        ) : null}
      </div>
    </>
  )

  const fieldsAndScheduleSection = (
    <div
      className={`${sectionPaddingX} ${sectionPaddingY} border-t border-gray-100 space-y-3`}
      dir="rtl"
    >
      {showBusinessFields && (
        <div className={businessFieldsGridClass}>
          <div>
            <label className="block text-xs text-gray-500 font-medium mb-1 text-right">
              שם מחלקה
            </label>
            <div className={inputWrapperStatusClass('', departmentStatus)}>
              <Input
                type="text"
                value={department}
                onChange={(e) => onDepartmentChange!(e.target.value)}
                placeholder="מחלקה (אופציונלי)"
                className={fieldInputClass}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 font-medium mb-1 text-right">
              מזמין
            </label>
            <div className={inputWrapperStatusClass('', orderedByStatus)}>
              <OrdererNameAutocomplete
                value={orderedBy}
                onChange={onOrderedByChange!}
                onSelectOrderer={(orderer) => {
                  onDepartmentChange!(orderer.department ?? '')
                  onOrderedByChange!(orderer.name)
                  onOrdererSelected?.()
                }}
                orderers={savedOrderers}
                loading={orderersLoading}
                placeholder="מזמין (אופציונלי)"
                className={fieldInputClass}
                isMobile={isMobileSized && !isNarrow}
              />
            </div>
            {showSaveOrdererPill && onSaveOrdererToggle && (
              <div className="mt-1 flex justify-end">
                <SaveCustomerOrdererPill
                  visible
                  active={saveOrdererToCustomer}
                  onToggle={onSaveOrdererToggle}
                  className="!text-xs !px-2 !py-0.5"
                />
              </div>
            )}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => {
              skipScheduleExpandRef.current = true
              onNowClick()
              setUseCustomTime(false)
            }}
            className={scheduleBtn(!useCustomTime)}
          >
            עכשיו
          </button>
          <button
            type="button"
            onClick={() => setUseCustomTime(true)}
            className={scheduleBtn(useCustomTime)}
          >
            בחר מועד אחר
          </button>
          <button
            type="button"
            onClick={() => setShowEndTime((v) => !v)}
            className={scheduleBtn(showEndTime)}
          >
            הזן מועד סיום (אופציונלי)
          </button>
        </div>
        {useCustomTime && (
          <div className="flex items-center gap-2">
            <div className={inputWrapperStatusClass('flex-1 min-w-0', towTimeStatus)}>
              <TimeInput
                value={towTime}
                onChange={onTowTimeChange}
                narrowColumn={isNarrow}
                isMobile={isMobileSized && !isNarrow}
                className="w-full"
              />
            </div>
            <DateInput
              value={towDate}
              onChange={onTowDateChange}
              narrowColumn={isNarrow}
              isMobile={isMobileSized && !isNarrow}
              className={dateInputStatusClass('flex-1', towDateStatus)}
            />
          </div>
        )}
        {showEndTime && (
          <div className="pt-2 border-t border-gray-200 flex flex-col items-stretch gap-2">
            <span
              className={
                isNarrow ? 'text-xs font-medium text-gray-500' : 'text-sm text-gray-600'
              }
            >
              שעת סיום (אופציונלי)
            </span>
            <div className="flex items-center gap-2">
              <div className={inputWrapperStatusClass('flex-1 min-w-0', towEndTimeStatus)}>
                <TimeInput
                  value={towEndTime}
                  onChange={(v) => {
                    onTowEndTimeChange(v)
                    if (v && !towEndDate && towDate) {
                      onTowEndDateChange(towDate)
                    }
                  }}
                  narrowColumn={isNarrow}
                  isMobile={isMobileSized && !isNarrow}
                  className="w-full"
                />
              </div>
              <DateInput
                value={towEndDate}
                onChange={onTowEndDateChange}
                narrowColumn={isNarrow}
                isMobile={isMobileSized && !isNarrow}
                className={dateInputStatusClass('flex-1', towEndDateStatus)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )

  const editOrderNumberBlock =
    editTowId && orderNumber ? (
      <div className={`${sectionPaddingX} py-2 border-t border-gray-100`}>
        <p className="text-xs text-gray-500 mb-1">מספר הזמנה</p>
        <div className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-xl text-sm text-gray-600 font-mono">
          #{orderNumber}
        </div>
      </div>
    ) : null

  const storedVehiclesBlock =
    customerStoredVehicles.length > 0 ? (
      <div className={`${sectionPaddingX} pb-4 pt-0 border-t border-gray-100`}>
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
    ) : null

  if (customerTab === 'casual') {
    return (
      <FormCard
        icon={User}
        title="פרטי לקוח"
        description="לקוח מזדמן - הזן פרטים חדשים"
        className={formCardClass}
        actions={
          <Button
            type="button"
            variant="secondary"
            size={compact ? 'md' : 'sm'}
            className={isNarrow ? 'min-h-[36px]' : compact ? 'min-h-[48px]' : undefined}
            onClick={switchToExisting}
          >
            חזור ללקוח קיים
          </Button>
        }
      >
        {sectionIdentityHeader(casualIdentityContent)}
        <div className={`${sectionPaddingX} py-3`} dir="rtl">
          <div
            className={
              compact
                ? 'grid grid-cols-1 gap-2'
                : 'grid grid-cols-1 sm:grid-cols-2 gap-2'
            }
          >
            <Input
              type="text"
              value={customerName}
              onChange={(e) => onCustomerNameChange(e.target.value)}
              placeholder="שם הלקוח *"
              className={isNarrow ? narrowInputClass : compact ? 'h-12' : undefined}
            />
            <PhoneInput
              value={customerPhone}
              onChange={onCustomerPhoneChange}
              placeholder="טלפון"
              className={isNarrow ? narrowInputClass : compact ? 'h-12' : undefined}
            />
          </div>
        </div>
        {editOrderNumberBlock}
        {fieldsAndScheduleSection}
      </FormCard>
    )
  }

  if (!selectedCustomerId) {
    return (
      <FormCard
        icon={User}
        title="פרטי לקוח"
        description="בחר לקוח קיים או צור לקוח מזדמן"
        className={formCardClass}
        actions={
          <Button
            type="button"
            variant="secondary"
            size={compact ? 'md' : 'sm'}
            className={isNarrow ? 'min-h-[36px]' : compact ? 'min-h-[48px]' : undefined}
            onClick={switchToWalkIn}
          >
            לקוח מזדמן
          </Button>
        }
      >
        <div
          className={`${sectionPaddingX} py-3.5 sm:py-4 border-b border-gray-100`}
          dir="rtl"
        >
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div className="relative flex-1 min-w-0 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <Input
                type="text"
                value={customerSearch}
                onChange={(e) => onCustomerSearchChange(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setTimeout(() => setIsFocused(false), 150)}
                placeholder="חפש לפי שם, טלפון, ת.ז..."
                disabled={customersLoading}
                className={
                  isNarrow
                    ? `pl-9 pr-3 text-right w-full ${narrowInputClass}`
                    : compact
                      ? 'pl-9 pr-3 text-right h-12 w-full'
                      : 'pl-9 pr-3 text-right w-full'
                }
              />
            </div>
            {inlineCustomerOrderNumberField}
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
        {editOrderNumberBlock}
        {fieldsAndScheduleSection}
      </FormCard>
    )
  }

  return (
    <FormCard
      icon={User}
      title="פרטי לקוח"
      description="לקוח נבחר"
      className={formCardClass}
      actions={
        <Button
          type="button"
          variant="secondary"
          size={compact ? 'md' : 'sm'}
          className={isNarrow ? 'min-h-[36px]' : compact ? 'min-h-[48px]' : undefined}
          onClick={clearCustomer}
        >
          <ArrowLeftRight size={12} />
          החלף לקוח
        </Button>
      }
    >
      {sectionIdentityHeader(selectedIdentityContent)}
      {editOrderNumberBlock}
      {fieldsAndScheduleSection}
      {storedVehiclesBlock}
    </FormCard>
  )
}
