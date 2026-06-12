'use client'

import { Package } from 'lucide-react'
import { STORAGE_TAKE_OUT_CONFIRM_MESSAGE } from '../../lib/utils/storage-vehicle'

type StorageTakeOutConfirmModalProps = {
  open: boolean
  plateNumber?: string
  onConfirm: () => void
  onCancel: () => void
}

export function StorageTakeOutConfirmModal({
  open,
  plateNumber,
  onConfirm,
  onCancel,
}: StorageTakeOutConfirmModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-auto overflow-hidden"
        dir="rtl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="storage-take-out-title"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2 text-purple-700">
            <Package size={20} />
            <h3 id="storage-take-out-title" className="font-bold text-gray-800 text-base">
              רכב באחסנה
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            aria-label="סגור"
          >
            ✕
          </button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-sm text-gray-700 leading-relaxed">
            {STORAGE_TAKE_OUT_CONFIRM_MESSAGE}
          </p>
          {plateNumber && (
            <p className="text-sm font-mono font-semibold text-gray-900 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-center">
              {plateNumber}
            </p>
          )}
        </div>
        <div className="px-4 pb-4 flex gap-2">
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 py-2.5 bg-gt-brand text-white rounded-xl font-medium text-sm hover:bg-gt-brand-hover"
          >
            הוצא מהאחסנה
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50"
          >
            ביטול
          </button>
        </div>
      </div>
    </div>
  )
}
