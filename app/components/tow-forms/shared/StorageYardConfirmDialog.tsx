'use client'

interface StorageYardConfirmDialogProps {
  open: boolean
  role: 'pickup' | 'dropoff'
  onConfirm: () => void
  /** Explicit "לא, רק כתובת" */
  onDecline: () => void
  /** Backdrop / outside click — distinct from decline for audit */
  onDismiss: () => void
}

/**
 * Lightweight confirm when a typed address matches the company yard
 * but the storage flag is not set yet.
 */
export function StorageYardConfirmDialog({
  open,
  role,
  onConfirm,
  onDecline,
  onDismiss,
}: StorageYardConfirmDialogProps) {
  if (!open) return null

  const isPickup = role === 'pickup'
  const title = isPickup
    ? 'הכתובת שהוזנה היא כתובת האחסנה. האם הרכב יוצא מהאחסנה?'
    : 'הכתובת שהוזנה היא כתובת האחסנה. האם הרכב נכנס לאחסנה?'
  const confirmLabel = isPickup ? 'כן, הוצא מהאחסנה' : 'כן, הכנס לאחסנה'

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-4 sm:items-center"
      onClick={onDismiss}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="storage-yard-confirm-title"
        className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p
          id="storage-yard-confirm-title"
          className="text-sm font-medium text-gt-text-primary leading-snug"
        >
          {title}
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row-reverse">
          <button
            type="button"
            onClick={onConfirm}
            className="min-h-[44px] flex-1 rounded-xl bg-gt-brand px-3 text-sm font-medium text-white hover:bg-gt-brand-hover transition-colors"
          >
            {confirmLabel}
          </button>
          <button
            type="button"
            onClick={onDecline}
            className="min-h-[44px] flex-1 rounded-xl border border-gt-border-field bg-white px-3 text-sm font-medium text-gt-text-secondary hover:bg-gt-surface-hover transition-colors"
          >
            לא, רק כתובת
          </button>
        </div>
      </div>
    </div>
  )
}
