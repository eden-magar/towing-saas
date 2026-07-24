'use client'

import { AlertTriangle } from 'lucide-react'
import {
  REQUIRED_TRUCK_TYPE_MESSAGE,
  isMissingAddressCoordinatesError,
  isRequiredTruckTypeError,
  isSaveBlockingValidationError,
} from '../../../lib/utils/tow-save-blocking'
import { SelectorModalShell } from './SelectorModalShell'

export {
  REQUIRED_TRUCK_TYPE_MESSAGE,
  MISSING_ROUTE_ADDRESSES_MESSAGE,
  MISSING_STORAGE_PLATE_MESSAGE,
  MISSING_STORAGE_DESTINATION_MESSAGE,
  MISSING_ADDRESS_COORDINATES_MESSAGE,
  STORAGE_FOLLOW_UP_LIVE_BLOCK_MESSAGE,
  isRequiredTruckTypeError,
  isMissingAddressCoordinatesError,
  isSaveBlockingValidationError,
} from '../../../lib/utils/tow-save-blocking'

interface RequiredTruckTypeMissingModalProps {
  open: boolean
  onClose: () => void
  /** Opens the existing truck-type picker (controlled `TowTruckTypeSelector`). */
  onChooseTruckType: () => void
}

/**
 * Centered modal when save is blocked for missing required truck type.
 *
 * Exchange: save only requires `requiredTruckTypes` (the primary / working-vehicle
 * picker). Defective “גרר נוסף” is a separate optional path — this CTA opens the
 * primary picker.
 */
export function RequiredTruckTypeMissingModal({
  open,
  onClose,
  onChooseTruckType,
}: RequiredTruckTypeMissingModalProps) {
  return (
    <SelectorModalShell
      open={open}
      onClose={onClose}
      tone="danger"
      title={
        <span className="inline-flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" aria-hidden />
          סוג גרר לא נבחר
        </span>
      }
      panelClassName="max-w-md"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-3" dir="rtl">
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[44px] rounded-xl border border-gt-border bg-white text-sm font-medium text-gt-text-secondary transition-colors hover:bg-gt-surface-hover sm:flex-1"
          >
            סגור
          </button>
          <button
            type="button"
            onClick={() => {
              onChooseTruckType()
              onClose()
            }}
            className="w-full min-h-[44px] rounded-xl bg-gt-brand text-sm font-medium text-white transition-colors hover:bg-gt-brand-hover sm:flex-1"
          >
            בחר סוג גרר
          </button>
        </div>
      }
    >
      <div className="p-4 text-sm text-gt-text-secondary" dir="rtl">
        <p>
          {REQUIRED_TRUCK_TYPE_MESSAGE}. לחצו «בחר סוג גרר» לבחירה מהרשימה.
        </p>
      </div>
    </SelectorModalShell>
  )
}

interface TowSaveBlockingModalProps {
  open: boolean
  message: string
  onClose: () => void
  /** When set (missing-coords block), shown under the message. */
  fieldLabel?: string | null
  /** Escape hatch: opens PinDropModal for the blocked address field. */
  onOpenPinDrop?: (() => void) | null
}

/**
 * Generic centered modal for other save-blocking validation errors
 * (missing route addresses, storage plate, missing coords, etc.).
 * Truck-type uses {@link RequiredTruckTypeMissingModal} instead (has a picker CTA).
 * Missing-coords uses a pin-drop CTA when {@link onOpenPinDrop} is provided.
 */
export function TowSaveBlockingModal({
  open,
  message,
  onClose,
  fieldLabel,
  onOpenPinDrop,
}: TowSaveBlockingModalProps) {
  // Truck-type has its own CTA modal — never double-render.
  if (isRequiredTruckTypeError(message)) return null
  if (!isSaveBlockingValidationError(message)) return null

  const showPinCta =
    isMissingAddressCoordinatesError(message) && !!onOpenPinDrop

  return (
    <SelectorModalShell
      open={open}
      onClose={onClose}
      tone="danger"
      title={
        <span className="inline-flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" aria-hidden />
          לא ניתן לשמור
        </span>
      }
      panelClassName="max-w-md"
      footer={
        showPinCta ? (
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-3" dir="rtl">
            <button
              type="button"
              onClick={onClose}
              className="w-full min-h-[44px] rounded-xl border border-gt-border bg-white text-sm font-medium text-gt-text-secondary transition-colors hover:bg-gt-surface-hover sm:flex-1"
            >
              סגור
            </button>
            <button
              type="button"
              onClick={() => {
                onOpenPinDrop()
                onClose()
              }}
              className="w-full min-h-[44px] rounded-xl bg-gt-brand text-sm font-medium text-white transition-colors hover:bg-gt-brand-hover sm:flex-1"
            >
              סמן על המפה
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[44px] rounded-xl bg-gt-brand text-sm font-medium text-white transition-colors hover:bg-gt-brand-hover"
          >
            הבנתי
          </button>
        )
      }
    >
      <div className="p-4 text-sm text-gt-text-secondary space-y-2" dir="rtl">
        <p>{message}</p>
        {showPinCta && fieldLabel ? (
          <p className="text-gt-text">
            חסר מיקום מדויק עבור: <span className="font-medium">{fieldLabel}</span>
          </p>
        ) : null}
      </div>
    </SelectorModalShell>
  )
}
