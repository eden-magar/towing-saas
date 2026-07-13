'use client'

import { AlertTriangle } from 'lucide-react'
import { SelectorModalShell } from './SelectorModalShell'

/** Same string `useTowSave` / quote-save set via `setError` for missing truck type. */
export const REQUIRED_TRUCK_TYPE_MESSAGE = 'יש לבחור סוג גרר נדרש'

export function isRequiredTruckTypeError(message: string | null | undefined): boolean {
  return message === REQUIRED_TRUCK_TYPE_MESSAGE
}

interface RequiredTruckTypeMissingModalProps {
  open: boolean
  onClose: () => void
  /** Opens the existing truck-type picker (controlled `TowTruckTypeSelector`). */
  onChooseTruckType: () => void
}

/**
 * Centered modal when save is blocked for missing required truck type.
 * Replaces the fixed top error strip for this message only.
 *
 * Exchange: save only requires `requiredTruckTypes` (the primary / working-vehicle
 * picker). Defective “גרר נוסף” is a separate optional path — this CTA opens the
 * primary picker. If they still lack something else, the next save attempt surfaces it.
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
              // Open picker first, then dismiss this dialog — same open state the
              // vehicle-card / host TowTruckTypeSelector listens to.
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
        <p>יש לבחור לפחות סוג גרר אחד לפני שמירת הגרירה. לחצו «בחר סוג גרר» לבחירה מהרשימה.</p>
      </div>
    </SelectorModalShell>
  )
}
