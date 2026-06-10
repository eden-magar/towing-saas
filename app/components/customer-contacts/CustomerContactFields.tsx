'use client'

import type { ReactNode } from 'react'
import { ContactNameAutocomplete } from './ContactNameAutocomplete'
import { SaveCustomerContactPill } from './SaveCustomerContactPill'
import { PhoneInput } from '../ui/PhoneInput'
import type { CustomerContact } from '@/app/lib/types'

interface CustomerContactFieldsProps {
  name: string
  phone: string
  onNameChange: (name: string) => void
  onPhoneChange: (phone: string) => void
  savedContacts: CustomerContact[]
  contactsLoading?: boolean
  showSavePill?: boolean
  saveActive?: boolean
  onSaveToggle?: () => void
  disabled?: boolean
  header?: ReactNode
  nameInputClassName?: string
  phoneInputClassName?: string
  onSelectContact?: () => void
}

export function CustomerContactFields({
  name,
  phone,
  onNameChange,
  onPhoneChange,
  savedContacts,
  contactsLoading = false,
  showSavePill = false,
  saveActive = false,
  onSaveToggle,
  disabled = false,
  header,
  nameInputClassName = 'w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm',
  phoneInputClassName = 'w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm',
  onSelectContact,
}: CustomerContactFieldsProps) {
  return (
    <div>
      {header}
      <div className="grid grid-cols-2 gap-2">
        <ContactNameAutocomplete
          value={name}
          onChange={onNameChange}
          onSelectContact={(contact) => {
            onNameChange(contact.name)
            onPhoneChange(contact.phone ?? '')
            onSelectContact?.()
          }}
          contacts={savedContacts}
          loading={contactsLoading}
          disabled={disabled}
          placeholder="שם"
          className={nameInputClassName}
        />
        <PhoneInput
          value={phone}
          onChange={onPhoneChange}
          placeholder="טלפון"
          className={phoneInputClassName}
        />
      </div>
      {showSavePill && onSaveToggle && (
        <SaveCustomerContactPill
          className="mt-2"
          visible
          active={saveActive}
          onToggle={onSaveToggle}
          disabled={disabled}
        />
      )}
    </div>
  )
}
