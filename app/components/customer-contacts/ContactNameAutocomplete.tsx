'use client'

import { useMemo, useState, useRef } from 'react'
import { Loader2 } from 'lucide-react'
import { Input } from '../ui'
import { PortalSuggestDropdown } from '../shared/PortalSuggestDropdown'
import type { CustomerContact } from '@/app/lib/types'

interface ContactNameAutocompleteProps {
  value: string
  onChange: (name: string) => void
  onSelectContact: (contact: CustomerContact) => void
  contacts: CustomerContact[]
  loading?: boolean
  disabled?: boolean
  placeholder?: string
  className?: string
}

/** Two-line rows need a taller estimate for flip-above. */
const CONTACT_ROW_HEIGHT_ESTIMATE = 52

export function ContactNameAutocomplete({
  value,
  onChange,
  onSelectContact,
  contacts,
  loading = false,
  disabled = false,
  placeholder = 'שם',
  className = 'w-full',
}: ContactNameAutocompleteProps) {
  const anchorRef = useRef<HTMLDivElement>(null)
  const [isFocused, setIsFocused] = useState(false)

  const filteredContacts = useMemo(() => {
    const query = value.trim().toLowerCase()
    if (!query) return contacts
    return contacts.filter((contact) => {
      const name = contact.name.toLowerCase()
      const phone = contact.phone ?? ''
      const role = contact.role_or_title?.toLowerCase() ?? ''
      return name.includes(query) || phone.includes(query) || role.includes(query)
    })
  }, [value, contacts])

  const visibleContacts = filteredContacts.slice(0, 10)

  const showList =
    isFocused &&
    !disabled &&
    contacts.length > 0 &&
    (loading || filteredContacts.length > 0)

  const dropdownOpen = showList && !loading

  return (
    <div ref={anchorRef} className="relative">
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setTimeout(() => setIsFocused(false), 150)}
        placeholder={placeholder}
        disabled={disabled}
        className={className}
      />

      {loading && isFocused && (
        <div className="pointer-events-none absolute top-full left-0 right-0 mt-1 flex items-center justify-end gap-2 text-xs text-gray-500">
          <span>טוען אנשי קשר...</span>
          <Loader2 className="w-3.5 h-3.5 animate-spin text-[#33d4ff]" />
        </div>
      )}

      <PortalSuggestDropdown
        anchorRef={anchorRef}
        open={dropdownOpen}
        itemCount={visibleContacts.length}
        rowHeightEstimate={CONTACT_ROW_HEIGHT_ESTIMATE}
      >
        {visibleContacts.map((contact) => (
          <button
            key={contact.id}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onSelectContact(contact)
              setIsFocused(false)
            }}
            className="w-full flex flex-col items-stretch gap-0.5 px-3 py-2 hover:bg-gray-50 transition-colors text-right"
          >
            <span className="w-full min-w-0 truncate text-sm text-gray-800 font-medium">
              {contact.name}
            </span>
            {(contact.role_or_title || contact.phone) && (
              <div className="flex items-center gap-2 text-xs text-gray-400 min-w-0">
                {contact.role_or_title && (
                  <span className="shrink-0 bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-md">
                    {contact.role_or_title}
                  </span>
                )}
                {contact.phone && (
                  <span className="min-w-0 truncate" dir="ltr">
                    <bdi>{contact.phone}</bdi>
                  </span>
                )}
              </div>
            )}
          </button>
        ))}
      </PortalSuggestDropdown>
    </div>
  )
}
