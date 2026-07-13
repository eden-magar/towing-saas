'use client'

import { useMemo, useState, useRef } from 'react'
import { Loader2 } from 'lucide-react'
import { Input } from '../ui'
import { PortalSuggestDropdown } from '../shared/PortalSuggestDropdown'
import type { CustomerOrderer } from '@/app/lib/types'

interface OrdererNameAutocompleteProps {
  value: string
  onChange: (name: string) => void
  onSelectOrderer: (orderer: CustomerOrderer) => void
  orderers: CustomerOrderer[]
  loading?: boolean
  disabled?: boolean
  placeholder?: string
  className?: string
  /** When true, widens the dropdown beyond a narrow anchor (e.g. 2-col mobile row). */
  isMobile?: boolean
}

const MOBILE_DROPDOWN_MAX_WIDTH = 360

export function OrdererNameAutocomplete({
  value,
  onChange,
  onSelectOrderer,
  orderers,
  loading = false,
  disabled = false,
  placeholder = 'מזמין',
  className = 'w-full',
  isMobile = false,
}: OrdererNameAutocompleteProps) {
  const isMobileLayout = isMobile ?? false
  const anchorRef = useRef<HTMLDivElement>(null)
  const [isFocused, setIsFocused] = useState(false)

  const filteredOrderers = useMemo(() => {
    const query = value.trim().toLowerCase()
    if (!query) return orderers
    return orderers.filter((orderer) => {
      const name = orderer.name.toLowerCase()
      const department = orderer.department?.toLowerCase() ?? ''
      return name.includes(query) || department.includes(query)
    })
  }, [value, orderers])

  const visibleOrderers = filteredOrderers.slice(0, 10)

  const showList =
    isFocused &&
    !disabled &&
    orderers.length > 0 &&
    (loading || filteredOrderers.length > 0)

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
          <span>טוען מזמינים...</span>
          <Loader2 className="w-3.5 h-3.5 animate-spin text-[#33d4ff]" />
        </div>
      )}

      <PortalSuggestDropdown
        anchorRef={anchorRef}
        open={dropdownOpen}
        itemCount={visibleOrderers.length}
        maxWidth={isMobileLayout ? MOBILE_DROPDOWN_MAX_WIDTH : undefined}
      >
        {visibleOrderers.map((orderer) => (
          <button
            key={orderer.id}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onSelectOrderer(orderer)
              setIsFocused(false)
            }}
            className="w-full flex flex-col items-stretch gap-0.5 px-3 py-2 hover:bg-gray-50 transition-colors text-right"
          >
            <span className="w-full min-w-0 truncate text-sm text-gray-800 font-medium">
              {orderer.name}
            </span>
            {orderer.department && (
              <div className="flex items-center gap-2 text-xs text-gray-400 min-w-0">
                <span className="shrink-0 bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded-md">
                  {orderer.department}
                </span>
              </div>
            )}
          </button>
        ))}
      </PortalSuggestDropdown>
    </div>
  )
}
