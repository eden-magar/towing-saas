'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Truck } from 'lucide-react'
import { useTowForm } from '../../hooks/useTowForm'
import { useQuoteGate } from '../../hooks/useQuoteGate'
import { useContactsSave } from '../../hooks/useContactsSave'
import { FormCard } from '../ui'
import { SectionTowType } from './sections/SectionTowType'
import { SectionCustomer } from './sections/SectionCustomer'
import { SectionPlaceholder } from './sections/SectionPlaceholder'
import { SectionSingleRoute } from './sections/SectionSingleRoute'
import { SectionPricing } from './sections/SectionPricing'
import { SectionQuoteGate } from './sections/SectionQuoteGate'
import { SectionContacts } from './sections/SectionContacts'

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
  const form = useTowForm(undefined, {
    beforeSaveTow: () => persistContactsRef.current(),
  })
  const contactsSave = useContactsSave(form)
  const quoteGate = useQuoteGate(form, {
    persistTowCustomerContacts: contactsSave.persistTowCustomerContacts,
  })

  useEffect(() => {
    persistContactsRef.current = contactsSave.persistTowCustomerContacts
  }, [contactsSave.persistTowCustomerContacts])

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

      {form.error && (
        <div className="mb-3 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
          {form.error}
        </div>
      )}

      {/* Continuous scroll of sections — order matches desktop create/page.tsx */}
      <SectionCustomer form={form} />

      <FormCard icon={Truck} title="סוג גרירה">
        <SectionTowType form={form} />
      </FormCard>

      {form.towType === 'single' && <SectionSingleRoute form={form} />}

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
        {form.towType === 'single' && quoteGate.quoteApproved && (
          <SectionContacts form={form} contactsSave={contactsSave} />
        )}

        <SectionPlaceholder quoteApproved={quoteGate.quoteApproved} />
      </div>
    </div>
  )
}
