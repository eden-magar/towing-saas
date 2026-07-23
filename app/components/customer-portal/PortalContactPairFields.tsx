'use client'

import { useState } from 'react'
import { PortalContactNameAutocomplete } from './PortalContactNameAutocomplete'
import { PortalContactPhoneAutocomplete } from './PortalContactPhoneAutocomplete'
import { SavePortalContactPill } from './SavePortalContactPill'
import {
  completeCustomerPortalContactPhone,
  createCustomerPortalContact,
  shouldOfferSavePortalContact,
} from '@/app/lib/queries/customer-portal-contacts'
import { phoneFromSelectedPortalContact } from '@/app/lib/utils/portal-contact-save-ui'
import type { CustomerPortalContact } from '@/app/lib/types'

interface PortalContactPairFieldsProps {
  name: string
  phone: string
  onNameChange: (name: string) => void
  onPhoneChange: (phone: string) => void
  contacts: CustomerPortalContact[]
  onContactsChange: (contacts: CustomerPortalContact[]) => void
  contactsLoading?: boolean
  companyId: string | null
  customerId: string | null
  userId: string | null
  canEdit: boolean
  disabled?: boolean
  namePlaceholder?: string
  phonePlaceholder?: string
  nameHasError?: boolean
  nameError?: string
  phoneError?: string
  /** When true, wrap each field in a labeled FormField-like block via children layout. */
  stacked?: boolean
}

/**
 * Name + phone pair with portal saved-contact autocomplete and explicit save.
 */
export function PortalContactPairFields({
  name,
  phone,
  onNameChange,
  onPhoneChange,
  contacts,
  onContactsChange,
  contactsLoading = false,
  companyId,
  customerId,
  userId,
  canEdit,
  disabled = false,
  namePlaceholder = 'שם',
  phonePlaceholder = 'טלפון',
  nameHasError = false,
  nameError,
  phoneError,
  stacked = true,
}: PortalContactPairFieldsProps) {
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [completionTarget, setCompletionTarget] = useState<CustomerPortalContact | null>(null)

  const showSave = shouldOfferSavePortalContact(name, phone, contacts, canEdit)

  const applyContact = (contact: CustomerPortalContact) => {
    onNameChange(contact.name)
    onPhoneChange(phoneFromSelectedPortalContact(contact.phone, phone))
    setSavedFlash(false)
    setSaveError('')
  }

  const upsertLocal = (contact: CustomerPortalContact) => {
    const without = contacts.filter((c) => c.id !== contact.id)
    onContactsChange(
      [...without, contact].sort((a, b) => a.name.localeCompare(b.name, 'he'))
    )
  }

  const handleSave = async () => {
    if (!companyId || !customerId || !userId || !showSave) return
    setSaving(true)
    setSaveError('')
    try {
      const result = await createCustomerPortalContact(companyId, customerId, userId, {
        name,
        phone,
      })
      if (result.status === 'completion_available') {
        setCompletionTarget(result.contact)
        return
      }
      upsertLocal(result.contact)
      setSavedFlash(true)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'שגיאה בשמירת איש הקשר')
    } finally {
      setSaving(false)
    }
  }

  const confirmCompletion = async () => {
    if (!companyId || !customerId || !completionTarget) return
    setSaving(true)
    setSaveError('')
    try {
      const updated = await completeCustomerPortalContactPhone(
        companyId,
        customerId,
        completionTarget.id,
        phone
      )
      upsertLocal(updated)
      setCompletionTarget(null)
      setSavedFlash(true)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'שגיאה בעדכון איש הקשר')
    } finally {
      setSaving(false)
    }
  }

  const nameField = (
    <div>
      <PortalContactNameAutocomplete
        value={name}
        onChange={(v) => {
          onNameChange(v)
          setSavedFlash(false)
          setSaveError('')
        }}
        onSelectContact={applyContact}
        contacts={contacts}
        loading={contactsLoading}
        disabled={disabled}
        placeholder={namePlaceholder}
        hasError={nameHasError}
      />
      {nameError && <p className="mt-1 text-xs text-gt-danger">{nameError}</p>}
    </div>
  )

  const phoneField = (
    <div>
      <PortalContactPhoneAutocomplete
        value={phone}
        onChange={(v) => {
          onPhoneChange(v)
          setSavedFlash(false)
          setSaveError('')
        }}
        onSelectContact={applyContact}
        contacts={contacts}
        loading={contactsLoading}
        disabled={disabled}
        placeholder={phonePlaceholder}
      />
      {phoneError && <p className="mt-1 text-xs text-gt-danger">{phoneError}</p>}
    </div>
  )

  return (
    <div className="space-y-1.5">
      {stacked ? (
        <>
          {nameField}
          {phoneField}
        </>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {nameField}
          {phoneField}
        </div>
      )}

      <SavePortalContactPill
        visible={showSave || savedFlash}
        saved={savedFlash}
        saving={saving}
        onSave={handleSave}
        disabled={disabled || !companyId || !customerId || !userId}
      />

      {saveError && (
        <p className="text-xs text-gt-danger" role="alert">
          {saveError}
        </p>
      )}

      {completionTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden" dir="rtl">
            <div className="p-5 space-y-3">
              <h3 className="font-bold text-gray-900">השלמת איש קשר קיים</h3>
              <p className="text-sm text-gray-600">
                נמצא איש קשר בשם &quot;{completionTarget.name}&quot; ללא טלפון. לעדכן אותו עם המספר
                החדש במקום ליצור רשומה חדשה?
              </p>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setCompletionTarget(null)}
                  className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-100"
                  disabled={saving}
                >
                  ביטול
                </button>
                <button
                  type="button"
                  onClick={confirmCompletion}
                  className="flex-1 py-2.5 bg-[#33d4ff] text-white rounded-xl font-medium hover:bg-[#21b8e6] disabled:bg-gray-300"
                  disabled={saving}
                >
                  עדכן
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
