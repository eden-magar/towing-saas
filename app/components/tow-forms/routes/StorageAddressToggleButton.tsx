'use client'

import { Warehouse } from 'lucide-react'
import {
  ADDRESS_FIELD_ACTION_BTN_ACTIVE_CLASS,
  ADDRESS_FIELD_ACTION_BTN_CLASS,
  ADDRESS_FIELD_ACTION_ICON_SIZE,
} from './addressFieldActions'

/** Icon toggle for mark-as-storage — same size as pin / link / bookmark. */
export function StorageAddressToggleButton({
  active,
  onActivate,
  onClear,
  activateTitle = 'שמור באחסנה',
  clearTitle = 'בטל לאחסנה',
  disabled = false,
}: {
  active: boolean
  onActivate: () => void
  onClear: () => void
  activateTitle?: string
  clearTitle?: string
  disabled?: boolean
}) {
  const title = active ? clearTitle : activateTitle
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={active}
      title={title}
      aria-label={title}
      onClick={() => (active ? onClear() : onActivate())}
      className={`${ADDRESS_FIELD_ACTION_BTN_CLASS} ${
        active ? ADDRESS_FIELD_ACTION_BTN_ACTIVE_CLASS : ''
      }`}
    >
      <Warehouse size={ADDRESS_FIELD_ACTION_ICON_SIZE} aria-hidden />
    </button>
  )
}
