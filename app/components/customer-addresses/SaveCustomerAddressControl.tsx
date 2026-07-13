'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Bookmark, BookmarkCheck, X } from 'lucide-react'
import { SelectorModalShell } from '../tow-forms/shared/SelectorModalShell'
import {
  ADDRESS_FIELD_ACTION_BTN_ACTIVE_CLASS,
  ADDRESS_FIELD_ACTION_BTN_CLASS,
  ADDRESS_FIELD_ACTION_ICON_SIZE,
} from '../tow-forms/routes/addressFieldActions'

export type CustomerAddressPendingDraft = {
  label: string
  notes: string
}

interface SaveCustomerAddressControlProps {
  /** Offer control when address is eligible to save for the selected customer. */
  visible: boolean
  /** Address text shown read-only in the modal. */
  address: string
  /** Queued save draft — chip state when non-null. */
  pending: CustomerAddressPendingDraft | null
  onConfirm: (draft: CustomerAddressPendingDraft) => void
  onClear: () => void
  disabled?: boolean
  className?: string
}

/**
 * Compact save-to-customer-address control: quiet bookmark trigger + modal.
 * Does not insert — parent keeps deferred pending state until tow/event save.
 */
export function SaveCustomerAddressControl({
  visible,
  address,
  pending,
  onConfirm,
  onClear,
  disabled = false,
  className = '',
}: SaveCustomerAddressControlProps) {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [notes, setNotes] = useState('')
  const labelInputRef = useRef<HTMLInputElement>(null)
  const titleId = useId()
  const canSave = label.trim().length > 0

  useEffect(() => {
    if (!open) return
    setLabel(pending?.label ?? '')
    setNotes(pending?.notes ?? '')
    const t = window.setTimeout(() => labelInputRef.current?.focus(), 50)
    return () => window.clearTimeout(t)
  }, [open, pending])

  if (!visible && !pending) return null

  const openModal = () => {
    if (disabled) return
    setOpen(true)
  }

  const closeModal = () => setOpen(false)

  const handleConfirm = () => {
    if (!canSave) return
    onConfirm({ label: label.trim(), notes: notes.trim() })
    setOpen(false)
  }

  const handleClear = () => {
    onClear()
    setOpen(false)
  }

  return (
    <div className={`inline-flex items-center ${className}`} dir="rtl">
      {pending ? (
        <button
          type="button"
          onClick={openModal}
          disabled={disabled}
          title={`עריכת כתובת שמורה: ${pending.label}`}
          aria-label={`כתובת ממתינה לשמירה: ${pending.label}`}
          className={`${ADDRESS_FIELD_ACTION_BTN_CLASS} ${ADDRESS_FIELD_ACTION_BTN_ACTIVE_CLASS}`}
        >
          <BookmarkCheck size={ADDRESS_FIELD_ACTION_ICON_SIZE} aria-hidden />
        </button>
      ) : (
        <button
          type="button"
          onClick={openModal}
          disabled={disabled}
          title="שמור כתובת קבועה"
          aria-label="שמור כתובת קבועה"
          className={ADDRESS_FIELD_ACTION_BTN_CLASS}
        >
          <Bookmark size={ADDRESS_FIELD_ACTION_ICON_SIZE} aria-hidden />
        </button>
      )}

      <SelectorModalShell
        open={open}
        onClose={closeModal}
        title="שמירת כתובת קבועה"
        panelClassName="max-w-sm"
        footer={
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!canSave || disabled}
                className="min-h-[44px] flex-1 rounded-xl bg-gt-brand text-sm font-medium text-white transition-colors hover:bg-gt-brand-hover disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                שמור
              </button>
              <button
                type="button"
                onClick={closeModal}
                disabled={disabled}
                className="min-h-[44px] flex-1 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                ביטול
              </button>
            </div>
            {pending && (
              <button
                type="button"
                onClick={handleClear}
                disabled={disabled}
                className="inline-flex min-h-[40px] items-center justify-center gap-1.5 text-sm text-red-500 hover:text-red-600 disabled:opacity-50"
              >
                <X size={14} aria-hidden />
                הסר מהשמירה
              </button>
            )}
          </div>
        }
      >
        <div className="space-y-4 p-4" dir="rtl">
          <div>
            <p className="mb-1 text-xs font-medium text-gray-500">כתובת</p>
            <p
              id={titleId}
              className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5 text-sm text-gray-800 leading-snug"
            >
              {address.trim() || '—'}
            </p>
          </div>

          <div>
            <label
              htmlFor={`${titleId}-label`}
              className="mb-1 block text-xs font-medium text-gray-500"
            >
              שם הכתובת <span className="text-red-500">*</span>
            </label>
            <input
              id={`${titleId}-label`}
              ref={labelInputRef}
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              disabled={disabled}
              placeholder='לדוגמה: מגרש רמלה'
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-[#33d4ff] focus:outline-none focus:ring-2 focus:ring-[#33d4ff]/30 disabled:opacity-50"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canSave) {
                  e.preventDefault()
                  handleConfirm()
                }
              }}
            />
          </div>

          <div>
            <label
              htmlFor={`${titleId}-notes`}
              className="mb-1 block text-xs font-medium text-gray-500"
            >
              הערות
            </label>
            <textarea
              id={`${titleId}-notes`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={disabled}
              rows={2}
              placeholder='לדוגמה: להיכנס משער אחורי'
              className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-[#33d4ff] focus:outline-none focus:ring-2 focus:ring-[#33d4ff]/30 disabled:opacity-50"
            />
          </div>
        </div>
      </SelectorModalShell>
    </div>
  )
}
