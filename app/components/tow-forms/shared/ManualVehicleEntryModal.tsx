'use client'

import { useEffect, useState } from 'react'
import { Check, PenLine } from 'lucide-react'
import type { VehicleType } from '../../../lib/types'
import { normalizePlate } from '../../../lib/utils/plate-number'
import { SelectorModalShell } from './SelectorModalShell'
import { vehicleActionTriggerClass, useVehicleActionsCompact } from './VehicleCardActions'

export type ManualVehicleEntryValues = {
  plateNumber: string
  vehicleType: VehicleType | ''
  manufacturer: string
  color: string
  chassis: string
  weight: string
}

interface ManualVehicleEntryModalProps {
  open: boolean
  onClose: () => void
  /** Commit draft values and keep manual-entry mode active. */
  onSave: (values: ManualVehicleEntryValues) => void
  /** Current (committed) values — snapshotted when the modal opens. */
  values: ManualVehicleEntryValues
}

const inputClass =
  'w-full rounded-xl border border-gt-border-field px-3 py-2.5 text-sm hover:border-gt-border focus:outline-none focus:border-gt-brand focus:ring-[3px] focus:ring-gt-brand/20'
const labelClass = 'mb-1 block text-xs font-medium text-gray-600'

/**
 * Manual vehicle details modal (sibling shell to faults / truck-type pickers).
 * Plate edits here bind to the same plate state on save, without triggering registry lookup.
 */
export function ManualVehicleEntryModal({
  open,
  onClose,
  onSave,
  values,
}: ManualVehicleEntryModalProps) {
  const [draft, setDraft] = useState<ManualVehicleEntryValues>(values)

  useEffect(() => {
    if (open) setDraft(values)
  }, [open, values])

  const plateDigits = draft.plateNumber.replace(/[^0-9]/g, '')
  const canSave = plateDigits.length >= 5 && !!draft.vehicleType

  const update = <K extends keyof ManualVehicleEntryValues>(
    key: K,
    value: ManualVehicleEntryValues[K],
  ) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <SelectorModalShell
      open={open}
      onClose={onClose}
      title="פרטי רכב ידנית"
      panelClassName="max-w-lg"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-3" dir="rtl">
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[44px] rounded-xl border border-gt-border bg-white text-sm font-medium text-gt-text-secondary transition-colors hover:bg-gt-surface-hover sm:flex-1"
          >
            ביטול
          </button>
          <button
            type="button"
            disabled={!canSave}
            onClick={() => {
              if (!canSave) return
              onSave({
                ...draft,
                plateNumber: normalizePlate(draft.plateNumber),
              })
              onClose()
            }}
            className="w-full min-h-[44px] rounded-xl bg-gt-brand text-sm font-medium text-white transition-colors hover:bg-gt-brand-hover disabled:cursor-not-allowed disabled:opacity-50 sm:flex-1"
          >
            שמור
          </button>
        </div>
      }
    >
      <div className="space-y-3 p-4" dir="rtl">
        <p className="text-sm font-medium text-amber-800">
          הרכב לא נמצא במאגר — יש למלא ידנית
        </p>

        <div>
          <label className={labelClass}>מספר רכב *</label>
          <input
            type="text"
            value={draft.plateNumber}
            onChange={(e) => update('plateNumber', normalizePlate(e.target.value))}
            placeholder="1234567"
            dir="ltr"
            className={`${inputClass} font-mono font-semibold tracking-widest`}
            autoComplete="off"
          />
        </div>

        <hr className="border-gt-border-subtle" />

        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0">
            <label className={labelClass}>סוג רכב *</label>
            <select
              value={draft.vehicleType}
              onChange={(e) => update('vehicleType', e.target.value as VehicleType | '')}
              className={`${inputClass} bg-white`}
            >
              <option value="">בחר סוג רכב</option>
              <option value="private">פרטי</option>
              <option value="suv">ג&apos;יפ / SUV</option>
              <option value="truck">משאית</option>
              <option value="heavy">צמ&quot;ה</option>
              <option value="motorcycle">אופנוע</option>
              <option value="bus">אוטובוס</option>
              <option value="van">רכב מסחרי</option>
              <option value="other">אחר</option>
            </select>
          </div>
          <div className="min-w-0">
            <label className={labelClass}>יצרן</label>
            <input
              type="text"
              value={draft.manufacturer}
              onChange={(e) => update('manufacturer', e.target.value)}
              placeholder="למשל: טויוטה"
              className={inputClass}
            />
          </div>
          <div className="min-w-0">
            <label className={labelClass}>צבע</label>
            <input
              type="text"
              value={draft.color}
              onChange={(e) => update('color', e.target.value)}
              placeholder="למשל: לבן"
              className={inputClass}
            />
          </div>
          <div className="min-w-0">
            <label className={labelClass}>משקל (ק&quot;ג)</label>
            <input
              type="number"
              value={draft.weight}
              onChange={(e) => update('weight', e.target.value)}
              placeholder="אופציונלי"
              className={inputClass}
            />
          </div>
          <div className="col-span-2 min-w-0">
            <label className={labelClass}>מספר שלדה</label>
            <input
              type="text"
              value={draft.chassis}
              onChange={(e) => update('chassis', e.target.value)}
              placeholder="אופציונלי"
              className={`${inputClass} font-mono`}
            />
          </div>
        </div>
      </div>
    </SelectorModalShell>
  )
}

/** Trigger + modal for pages that do not use VehicleLookup. */
export function ManualVehicleEntryTrigger({
  values,
  onSave,
  active = false,
  disabled = false,
  className,
}: {
  values: ManualVehicleEntryValues
  onSave: (values: ManualVehicleEntryValues) => void
  active?: boolean
  disabled?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const compact = useVehicleActionsCompact()
  const iconClass = compact ? 'h-3.5 w-3.5 shrink-0' : 'h-4 w-4 shrink-0'
  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        title="פרטי רכב ידנית"
        aria-label="פרטי רכב ידנית"
        className={className ?? vehicleActionTriggerClass(active, '', compact)}
      >
        {active ? (
          <Check className={iconClass} aria-hidden />
        ) : (
          <PenLine className={iconClass} aria-hidden />
        )}
        <span className="shrink-0">{compact ? 'ידני' : 'פרטי רכב ידנית'}</span>
      </button>
      <ManualVehicleEntryModal
        open={open}
        onClose={() => setOpen(false)}
        values={values}
        onSave={onSave}
      />
    </>
  )
}
