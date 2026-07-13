'use client'

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'

export type PortalSuggestDropdownProps = {
  anchorRef: RefObject<HTMLElement | null>
  /** When true, measure + show the portal panel. */
  open: boolean
  /** Used to estimate height for flip-above. */
  itemCount: number
  children: ReactNode
  /** Optional upper bound on panel width (e.g. mobile). */
  maxWidth?: number
  /** Row height estimate for flip calculation. Default 40; use ~52 for two-line rows. */
  rowHeightEstimate?: number
  className?: string
  dir?: 'rtl' | 'ltr'
}

type DropdownPosition = {
  top: number
  left: number
  width: number
}

const DROPDOWN_GAP = 4
const DROPDOWN_MAX_HEIGHT = 160 // matches max-h-40
const VIEWPORT_MARGIN = 8
const MIN_WIDTH = 280
const DEFAULT_ROW_HEIGHT = 40
const Z_INDEX = 100

function computePosition(
  rect: DOMRect,
  itemCount: number,
  rowHeightEstimate: number,
  maxWidth?: number
): DropdownPosition {
  const viewportMax = window.innerWidth - VIEWPORT_MARGIN * 2
  let width = Math.max(rect.width, MIN_WIDTH)
  if (maxWidth != null) {
    width = Math.min(width, maxWidth)
  }
  width = Math.min(width, viewportMax)

  let left = rect.left
  if (left + width > window.innerWidth - VIEWPORT_MARGIN) {
    left = window.innerWidth - width - VIEWPORT_MARGIN
  }
  if (left < VIEWPORT_MARGIN) {
    left = VIEWPORT_MARGIN
  }

  const estimatedHeight = Math.min(
    Math.max(itemCount, 1) * rowHeightEstimate,
    DROPDOWN_MAX_HEIGHT
  )
  const spaceBelow = window.innerHeight - rect.bottom - DROPDOWN_GAP
  const spaceAbove = rect.top - DROPDOWN_GAP
  const openAbove =
    spaceBelow < estimatedHeight + VIEWPORT_MARGIN && spaceAbove > spaceBelow

  const top = openAbove
    ? Math.max(VIEWPORT_MARGIN, rect.top - DROPDOWN_GAP - estimatedHeight)
    : rect.bottom + DROPDOWN_GAP

  return { top, left, width }
}

/**
 * Shared fixed+portal suggestion panel: minWidth, viewport clamp, flip-above, z-index 100.
 */
export function PortalSuggestDropdown({
  anchorRef,
  open,
  itemCount,
  children,
  maxWidth,
  rowHeightEstimate = DEFAULT_ROW_HEIGHT,
  className = 'max-h-40 overflow-y-auto divide-y divide-gray-100 border border-gray-200 rounded-xl bg-white shadow-lg',
  dir = 'rtl',
}: PortalSuggestDropdownProps) {
  const [mounted, setMounted] = useState(false)
  const [pos, setPos] = useState<DropdownPosition | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const updatePosition = useCallback(() => {
    const el = anchorRef.current
    if (!el) return
    setPos(
      computePosition(
        el.getBoundingClientRect(),
        itemCount,
        rowHeightEstimate,
        maxWidth
      )
    )
  }, [anchorRef, itemCount, rowHeightEstimate, maxWidth])

  useLayoutEffect(() => {
    if (!open) {
      setPos(null)
      return
    }

    updatePosition()
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)

    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [open, updatePosition, itemCount])

  if (!mounted || !open || !pos) return null

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        width: pos.width,
        zIndex: Z_INDEX,
      }}
      className={className}
      dir={dir}
    >
      {children}
    </div>,
    document.body
  )
}
