'use client'

import { useState } from 'react'
import { Plus, Trash2, Pencil, Check } from 'lucide-react'
import { ManualSurcharge, newManualSurchargeId } from '../../../lib/utils/manual-surcharge'

interface ManualSurchargeSectionProps {
  manualSurcharges: ManualSurcharge[]
  onChange: (lines: ManualSurcharge[]) => void
  label?: string
}

/**
 * Ad-hoc add-on lines (free-text name + manual ₪ price) that exist only on this order.
 * Persisted inside price_breakdown.service_surcharges as is_ad_hoc lines — never added to the
 * predefined service_surcharges catalog.
 *
 * A line is committed (read-only row) until the user edits it. Newly added lines start in the
 * editable state and become read-only once confirmed via "אישור". "Confirmed" is a UI-only
 * concept (tracked locally); persistence still sanitizes empty/zero lines out at save time.
 */
export function ManualSurchargeSection({
  manualSurcharges,
  onChange,
  label = 'תוספות ידניות',
}: ManualSurchargeSectionProps) {
  // Ids currently in the editable state (new or being edited). All others render read-only.
  const [editingIds, setEditingIds] = useState<Set<string>>(new Set())

  const setEditing = (id: string, on: boolean) => {
    setEditingIds((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const addLine = () => {
    const id = newManualSurchargeId()
    onChange([...manualSurcharges, { id, label: '', amount: 0 }])
    setEditing(id, true)
  }

  const updateLine = (id: string, patch: Partial<Pick<ManualSurcharge, 'label' | 'amount'>>) => {
    onChange(manualSurcharges.map((line) => (line.id === id ? { ...line, ...patch } : line)))
  }

  const removeLine = (id: string) => {
    onChange(manualSurcharges.filter((line) => line.id !== id))
    setEditing(id, false)
  }

  const isEditing = (line: ManualSurcharge) => editingIds.has(line.id)
  const canConfirm = (line: ManualSurcharge) => line.label.trim().length > 0 && line.amount > 0

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>

      {manualSurcharges.length === 0 ? (
        <p className="text-xs text-gray-400 mb-2">לא נוספו תוספות ידניות</p>
      ) : (
        <div className="mb-2 border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
          {manualSurcharges.map((line) => {
            if (!isEditing(line)) {
              // שורה מאושרת (קריאה בלבד) — תואמת לשורות התוספות המוגדרות מראש
              return (
                <div key={line.id} className="flex items-center gap-3 px-3 py-2.5 bg-white">
                  <span className="flex-1 min-w-0 text-sm text-gray-700 truncate">{line.label}</span>
                  <span className="shrink-0 text-sm font-medium text-gray-800">₪{line.amount}</span>
                  <div className="shrink-0 flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => setEditing(line.id, true)}
                      className="p-1.5 text-gray-400 hover:text-[#33d4ff]"
                      aria-label="ערוך תוספת"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeLine(line.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500"
                      aria-label="הסר תוספת"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              )
            }

            // שורה במצב עריכה
            const nameInvalid = line.label.trim().length === 0
            return (
              <div key={line.id} className="flex items-center gap-2 px-3 py-2.5 bg-[#33d4ff]/5">
                <input
                  type="text"
                  value={line.label}
                  onChange={(e) => updateLine(line.id, { label: e.target.value })}
                  placeholder="שם התוספת"
                  className={`flex-1 min-w-0 px-3 py-2 border rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white ${
                    nameInvalid ? 'border-red-300' : 'border-gray-200'
                  }`}
                />
                <div className="relative w-24 shrink-0">
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₪</span>
                  <input
                    type="number"
                    min={0}
                    value={line.amount || ''}
                    onChange={(e) => updateLine(line.id, { amount: Math.max(0, Number(e.target.value)) })}
                    placeholder="0"
                    className="w-full pr-7 pl-2 py-2 border border-gray-200 rounded-lg text-sm text-left focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setEditing(line.id, false)}
                  disabled={!canConfirm(line)}
                  className="shrink-0 inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium bg-[#33d4ff] text-white hover:bg-[#0bb8e6] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Check size={15} />
                  אישור
                </button>
                <button
                  type="button"
                  onClick={() => removeLine(line.id)}
                  className="shrink-0 p-2 text-gray-400 hover:text-red-500"
                  aria-label="הסר תוספת"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      <button
        type="button"
        onClick={addLine}
        className="inline-flex items-center gap-1.5 px-3 py-2 border border-[#33d4ff] text-[#33d4ff] rounded-lg text-sm font-medium hover:bg-[#33d4ff]/5 transition-colors"
      >
        <Plus size={16} />
        הוסף תוספת
      </button>
    </div>
  )
}
