'use client'

import { useMemo, useState, useRef, useCallback, useLayoutEffect, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Loader2 } from 'lucide-react'
import { Input } from '../ui'
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

interface DropdownPosition {
  top: number
  left: number
  width: number
}

const DROPDOWN_GAP = 4
const DROPDOWN_MAX_HEIGHT = 160
const ROW_HEIGHT_ESTIMATE = 40
const VIEWPORT_MARGIN = 8
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
  const anchorRef = useRef<HTMLDivElement>(null)
  const [isFocused, setIsFocused] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [dropdownPos, setDropdownPos] = useState<DropdownPosition | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const filteredOrderers = useMemo(() => {
    const query = value.trim().toLowerCase()
    if (!query) return orderers
    return orderers.filter((orderer) => {
      const name = orderer.name.toLowerCase()
      const department = orderer.department?.toLowerCase() ?? ''
      return name.includes(query) || department.includes(query)
    })
  }, [value, orderers])

  const showList =
    isFocused &&
    !disabled &&
    orderers.length > 0 &&
    (loading || filteredOrderers.length > 0)

  const updateDropdownPosition = useCallback(() => {
    const el = anchorRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()

    const width = isMobile
      ? Math.min(MOBILE_DROPDOWN_MAX_WIDTH, window.innerWidth - VIEWPORT_MARGIN * 2)
      : rect.width

    let left = rect.left
    if (isMobile) {
      if (left + width > window.innerWidth - VIEWPORT_MARGIN) {
        left = Math.max(VIEWPORT_MARGIN, window.innerWidth - width - VIEWPORT_MARGIN)
      }
    }

    const estimatedHeight = Math.min(
      Math.max(filteredOrderers.length, 1) * ROW_HEIGHT_ESTIMATE,
      DROPDOWN_MAX_HEIGHT,
    )
    const spaceBelow = window.innerHeight - rect.bottom - DROPDOWN_GAP
    const spaceAbove = rect.top - DROPDOWN_GAP
    const openAbove =
      spaceBelow < estimatedHeight + VIEWPORT_MARGIN && spaceAbove > spaceBelow

    const top = openAbove
      ? Math.max(VIEWPORT_MARGIN, rect.top - DROPDOWN_GAP - estimatedHeight)
      : rect.bottom + DROPDOWN_GAP

    setDropdownPos({ top, left, width })
  }, [filteredOrderers.length, isMobile])

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
  }, [showList, loading, updateDropdownPosition, filteredOrderers.length, value])

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
            {filteredOrderers.slice(0, 10).map((orderer) => (
              <button
                key={orderer.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onSelectOrderer(orderer)
                  setIsFocused(false)
                }}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 transition-colors text-right"
              >
                <div className="flex items-center gap-2 text-xs text-gray-400 min-w-0">
                  {orderer.department && (
                    <span className="shrink-0 bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded-md">
                      {orderer.department}
                    </span>
                  )}
                </div>
                <span className="text-sm text-gray-800 font-medium shrink-0 mr-2">
                  {orderer.name}
                </span>
              </button>
            ))}
          </div>,
          document.body,
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
          <span>טוען מזמינים...</span>
          <Loader2 className="w-3.5 h-3.5 animate-spin text-[#33d4ff]" />
        </div>
      )}

      {dropdown}
    </div>
  )
}
