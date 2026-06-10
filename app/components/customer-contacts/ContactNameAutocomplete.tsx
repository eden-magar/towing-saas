'use client'

import { useMemo, useState, useRef, useCallback, useLayoutEffect, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Loader2 } from 'lucide-react'
import { Input } from '../ui'
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

interface DropdownPosition {
  top: number
  left: number
  width: number
}

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
  const [mounted, setMounted] = useState(false)
  const [dropdownPos, setDropdownPos] = useState<DropdownPosition | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

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

  const showList =
    isFocused &&
    !disabled &&
    contacts.length > 0 &&
    (loading || filteredContacts.length > 0)

  const updateDropdownPosition = useCallback(() => {
    const el = anchorRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setDropdownPos({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    })
  }, [])

  useLayoutEffect(() => {
    if (!showList || loading) {
      setDropdownPos(null)
      return
    }

    updateDropdownPosition()
    window.addEventListener('scroll', updateDropdownPosition, true)
    window.addEventListener('resize', updateDropdownPosition)

    return () => {
      window.removeEventListener('scroll', updateDropdownPosition, true)
      window.removeEventListener('resize', updateDropdownPosition)
    }
  }, [showList, loading, updateDropdownPosition, filteredContacts.length, value])

  const dropdown =
    mounted && showList && !loading && dropdownPos
      ? createPortal(
          <div
            style={{
              position: 'fixed',
              top: dropdownPos.top,
              left: dropdownPos.left,
              width: dropdownPos.width,
              zIndex: 50,
            }}
            className="max-h-40 overflow-y-auto divide-y divide-gray-100 border border-gray-200 rounded-xl bg-white shadow-lg"
            dir="rtl"
          >
            {filteredContacts.slice(0, 10).map((contact) => (
              <button
                key={contact.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onSelectContact(contact)
                  setIsFocused(false)
                }}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 transition-colors text-right"
              >
                <div className="flex items-center gap-2 text-xs text-gray-400 min-w-0">
                  {contact.role_or_title && (
                    <span className="shrink-0 bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-md">
                      {contact.role_or_title}
                    </span>
                  )}
                  {contact.phone && <span className="truncate">{contact.phone}</span>}
                </div>
                <span className="text-sm text-gray-800 font-medium shrink-0 mr-2">
                  {contact.name}
                </span>
              </button>
            ))}
          </div>,
          document.body
        )
      : null

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

      {dropdown}
    </div>
  )
}
