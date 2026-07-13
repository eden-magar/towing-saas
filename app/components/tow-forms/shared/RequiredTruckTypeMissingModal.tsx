'use client'

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
      title="סוג גרר לא נבחר"
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
              onClose()
              onChooseTruckType()
            }}
            className="w-full min-h-[44px] rounded-xl bg-gt-brand text-sm font-medium text-white transition-colors hover:bg-gt-brand-hover sm:flex-1"
          >
            בחר סוג גרר
          </button>
        </div>
      }
    >
      <div className="space-y-2 p-4 text-sm text-gt-text-secondary" dir="rtl">
        <p className="font-medium text-gt-text-primary">סוג גרר לא נבחר</p>
        <p>יש לבחור לפחות סוג גרר אחד לפני שמירת הגרירה.</p>
      </div>
    </SelectorModalShell>
  )
}
