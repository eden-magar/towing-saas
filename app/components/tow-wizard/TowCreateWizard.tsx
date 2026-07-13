'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Check, Truck } from 'lucide-react'
import { useTowForm } from '../../hooks/useTowForm'
import { useQuoteGate } from '../../hooks/useQuoteGate'
import { useContactsSave } from '../../hooks/useContactsSave'
import { useAddressesSave } from '../../hooks/useAddressesSave'
import { FormCard } from '../ui'
import { FlashNotice, useFlashNotice } from '../ui/FlashNotice'
import {
  RequiredTruckTypeMissingModal,
  isRequiredTruckTypeError,
  TowTruckTypeSelector,
} from '../tow-forms/shared'
import { SectionTowType } from './sections/SectionTowType'
import { SectionCustomer } from './sections/SectionCustomer'
import { SectionSingleRoute } from './sections/SectionSingleRoute'
import { SectionPricing } from './sections/SectionPricing'
import { SectionQuoteGate } from './sections/SectionQuoteGate'
import { SectionContacts } from './sections/SectionContacts'
import { SectionPayment } from './sections/SectionPayment'

/**
 * Mobile-only tow creation page — a single continuous scrolling page of
 * sections (no step navigation / progress bar). Renders inline within the
 * dashboard layout so the app's mobile menu bar remains the top header.
 * Consumes useTowForm() directly so all state/pricing/save logic is shared
 * with the desktop create form.
 */
export function TowCreateWizard() {
  const router = useRouter()
  const persistContactsRef = useRef<() => Promise<void>>(async () => {})
  const persistAddressesRef = useRef<() => Promise<number>>(async () => 0)
  const [truckTypePickerOpen, setTruckTypePickerOpen] = useState(false)
  const lastPersistedAddressCountRef = useRef(0)
  const { notice, setNotice } = useFlashNotice()
  const form = useTowForm(undefined, {
    beforeSaveTow: async () => {
      await persistContactsRef.current()
      await persistAddressesRef.current()
    },
  })
  const contactsSave = useContactsSave(form)
  const addressesSave = useAddressesSave(form)
  const quoteGate = useQuoteGate(form, {
    persistTowCustomerContacts: contactsSave.persistTowCustomerContacts,
    persistTowCustomerAddresses: addressesSave.persistTowCustomerAddresses,
  })

  useEffect(() => {
    persistContactsRef.current = contactsSave.persistTowCustomerContacts
  }, [contactsSave.persistTowCustomerContacts])

  useEffect(() => {
    persistAddressesRef.current = async () => {
      const count = await addressesSave.persistTowCustomerAddresses()
      lastPersistedAddressCountRef.current = count
      return count
    }
  }, [addressesSave.persistTowCustomerAddresses])

  useEffect(() => {
    if (!form.showAssignNowModal) return
    const count = lastPersistedAddressCountRef.current
    if (count > 0) {
      setNotice(count === 1 ? 'הכתובת נשמרה ללקוח' : 'הכתובות נשמרו ללקוח')
    }
  }, [form.showAssignNowModal, setNotice])

  return (
    <div dir="rtl" className="max-w-2xl mx-auto pb-6">
      {/* In-flow page header (back + title) — the app menu bar stays above this */}
      <div className="flex items-center gap-3 mb-3">
        <button
          type="button"
          onClick={() => router.push('/dashboard/tows')}
          className="w-10 h-10 shrink-0 rounded-xl border border-gray-200 bg-white text-gray-600 flex items-center justify-center"
          aria-label="חזרה לרשימת הגרירות"
        >
          <ArrowRight size={20} />
        </button>
        <h1 className="text-xl font-bold text-gray-900">גרירה חדשה</h1>
      </div>

      <FlashNotice message={notice} />

      {form.error && !isRequiredTruckTypeError(form.error) && (
        <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {form.error}
        </div>
      )}
      <RequiredTruckTypeMissingModal
        open={isRequiredTruckTypeError(form.error)}
        onClose={() => {
          form.setError('')
          form.setTruckTypeError(false)
        }}
        onChooseTruckType={() => {
          form.setTruckTypeError(false)
          setTruckTypePickerOpen(true)
        }}
      />
      <div className="sr-only" aria-hidden>
        <TowTruckTypeSelector
          variant="triggerOnly"
          open={truckTypePickerOpen}
          onOpenChange={setTruckTypePickerOpen}
          selectedTypes={form.requiredTruckTypes}
          onChange={(types) => {
            form.setRequiredTruckTypes(types)
            if (types.length > 0) form.setTruckTypeError(false)
          }}
        />
      </div>

      {/* Continuous scroll of sections — order matches desktop create/page.tsx */}
      <SectionCustomer form={form} />

      <FormCard icon={Truck} title="סוג גרירה">
        <SectionTowType form={form} />
      </FormCard>

      {form.towType === 'single' && (
        <SectionSingleRoute form={form} addressesSave={addressesSave} />
      )}
      {form.towType === 'single' && <SectionPricing form={form} />}

      {form.towType === 'single' && !quoteGate.isEditingClosedTow && (
        <SectionQuoteGate form={form} quoteGate={quoteGate} />
      )}

      {/* Sections 7–9 — LOCKED until quoteApproved (mirrors desktop create/page.tsx) */}
      <div
        style={{
          opacity: quoteGate.lockedOpacity,
          pointerEvents: quoteGate.lockedPointer as React.CSSProperties['pointerEvents'],
        }}
      >
        {/* Driver (גרר ונהג) intentionally not built in-form on mobile —
            relies on the post-save "assign now" modal instead. */}

        {form.towType === 'single' && quoteGate.quoteApproved && (
          <SectionContacts form={form} contactsSave={contactsSave} />
        )}

        {form.towType === 'single' && quoteGate.quoteApproved && (
          <SectionPayment form={form} />
        )}
      </div>

      {form.showAssignNowModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check size={32} className="text-emerald-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">
                הגרירה נשמרה בהצלחה!
              </h2>
              <p className="text-gray-500 mb-2">
                מחיר: <span className="font-bold">₪{form.finalPrice.toFixed(2)}</span>
              </p>
              <p className="text-gray-600">האם לשבץ נהג עכשיו?</p>
            </div>
            <div className="flex gap-3 p-5 bg-gray-50 border-t border-gray-300">
              <button
                type="button"
                onClick={() => router.push('/dashboard')}
                className="flex-1 min-h-[48px] py-3 border border-gray-300 text-gray-600 rounded-xl hover:bg-gray-100 font-medium"
              >
                אחר כך
              </button>
              <button
                type="button"
                onClick={() => router.push(`/dashboard/tows/${form.savedTowId}`)}
                className="flex-1 min-h-[48px] py-3 bg-[#33d4ff] text-white rounded-xl hover:bg-[#21b8e6] font-medium flex items-center justify-center gap-2"
              >
                <Truck size={18} />
                שבץ נהג
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
