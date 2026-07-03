'use client'

import { useEffect, useState } from 'react'
import { useTowForm } from '../../../hooks/useTowForm'
import { useCustomerOrderers } from '../../../hooks/useCustomerOrderers'
import { shouldOfferSaveCustomerOrderer } from '../../../lib/utils/customer-orderer-save-ui'
import {
  CreateCustomerSection,
  type CreateCustomerTab,
} from '../../tow-forms/sections/CreateCustomerSection'

type Form = ReturnType<typeof useTowForm>

/**
 * Customer & schedule section (mobile scroll page). Hosts the existing
 * (prop-driven) CreateCustomerSection, which renders its own FormCard chrome.
 * customerTab/customerSearch are view-only concerns kept local here (they live
 * locally on the desktop page too); everything else is shared form state.
 */
export function SectionCustomer({ form }: { form: Form }) {
  const [customerTab, setCustomerTab] = useState<CreateCustomerTab>('existing')
  const [customerSearch, setCustomerSearch] = useState('')
  const [saveOrdererToCustomer, setSaveOrdererToCustomer] = useState(false)

  const handleNowClick = () => {
    const now = new Date()
    form.setTowDate(now.toISOString().split('T')[0])
    form.setTowTime(now.toTimeString().slice(0, 5))
    form.setIsToday(true)
  }

  const isBusinessCustomer =
    customerTab === 'existing' &&
    !!form.selectedCustomerId &&
    form.customers.find((c) => c.id === form.selectedCustomerId)?.customer_type ===
      'business'

  const { savedOrderers, orderersLoading } = useCustomerOrderers(
    form.companyId,
    isBusinessCustomer ? form.selectedCustomerId : null,
  )

  const showSaveOrdererOption = shouldOfferSaveCustomerOrderer(
    isBusinessCustomer,
    form.selectedCustomerId,
    form.department,
    form.orderedBy,
    savedOrderers,
  )

  useEffect(() => {
    setSaveOrdererToCustomer(false)
  }, [form.selectedCustomerId])

  useEffect(() => {
    if (!showSaveOrdererOption) {
      setSaveOrdererToCustomer(false)
    }
  }, [showSaveOrdererOption])

  return (
    <CreateCustomerSection
      isMobile
      customers={form.customers}
      customersLoading={form.customersLoading}
      customerIdsWithPersonalPricing={form.customerIdsWithPersonalPricing}
      selectedCustomerPricing={form.selectedCustomerPricing}
      selectedCustomerId={form.selectedCustomerId}
      customerTab={customerTab}
      onCustomerTabChange={setCustomerTab}
      customerSearch={customerSearch}
      onCustomerSearchChange={setCustomerSearch}
      customerName={form.customerName}
      customerPhone={form.customerPhone}
      onCustomerNameChange={form.setCustomerName}
      onCustomerPhoneChange={form.setCustomerPhone}
      onCustomerSelect={form.handleCustomerSelect}
      customerStoredVehicles={form.customerStoredVehicles}
      towDate={form.towDate}
      towTime={form.towTime}
      towEndDate={form.towEndDate}
      towEndTime={form.towEndTime}
      onTowDateChange={form.setTowDate}
      onTowTimeChange={form.setTowTime}
      onTowEndDateChange={form.setTowEndDate}
      onTowEndTimeChange={form.setTowEndTime}
      onNowClick={handleNowClick}
      customerOrderNumber={form.customerOrderNumber}
      onCustomerOrderNumberChange={form.setCustomerOrderNumber}
      isBusinessCustomer={isBusinessCustomer}
      department={form.department}
      onDepartmentChange={form.setDepartment}
      orderedBy={form.orderedBy}
      onOrderedByChange={form.setOrderedBy}
      savedOrderers={savedOrderers}
      orderersLoading={orderersLoading}
      showSaveOrdererPill={showSaveOrdererOption}
      saveOrdererToCustomer={saveOrdererToCustomer}
      onSaveOrdererToggle={() => setSaveOrdererToCustomer((v) => !v)}
      onOrdererSelected={() => setSaveOrdererToCustomer(false)}
    />
  )
}
