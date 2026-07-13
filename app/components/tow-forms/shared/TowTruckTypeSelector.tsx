'use client'

import { useState } from 'react'
import { SelectorModalShell } from './SelectorModalShell'
import { vehicleActionTriggerClass } from './VehicleCardActions'

interface TowTruckTypeSelectorProps {
  selectedTypes: string[]
  onChange: (types: string[]) => void
  label?: string
  /** Compact trigger + modal only (no inline chip grid). */
  variant?: 'default' | 'triggerOnly'
  /** Label on the compact trigger button (triggerOnly variant). */
  triggerLabel?: string
  isMobile?: boolean
  /** Controlled open (e.g. from required-truck-type validation modal). */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Stretch trigger to fill VehicleCardActions cell. */
  fill?: boolean
}

export const TRUCK_TYPES = [
  { id: 'wheel_lift_cradle', label: 'משקפיים', icon: '🔧' },
  { id: 'flatbed', label: 'רמסע', icon: '🚛' },
  { id: 'carrier', label: 'מובילית', icon: '🚚' },
] as const

/** Trigger summary: "סוג גרר" | "גרר · רמסע" | "גרר · רמסע +1" */
export function formatTruckTypesTriggerLabel(
  selectedTypes: string[],
  emptyLabel = 'סוג גרר',
  filledPrefix = 'גרר',
): string {
  const labels = selectedTypes
    .map((id) => TRUCK_TYPES.find((t) => t.id === id)?.label)
    .filter((x): x is (typeof TRUCK_TYPES)[number]['label'] => Boolean(x))
  if (labels.length === 0) return emptyLabel
  if (labels.length === 1) return `${filledPrefix} · ${labels[0]}`
  if (labels.length === 2) return `${filledPrefix} · ${labels[0]}, ${labels[1]}`
  return `${filledPrefix} · ${labels[0]} +${labels.length - 1}`
}

export function TowTruckTypeSelector({
  selectedTypes,
  onChange,
  label = 'סוגי גרר מתאימים',
  variant = 'default',
  triggerLabel = 'סוג גרר',
  isMobile = false,
  open: openProp,
  onOpenChange,
  fill = false,
}: TowTruckTypeSelectorProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const showModal = openProp ?? internalOpen
  const setShowModal = (next: boolean) => {
    onOpenChange?.(next)
    if (openProp === undefined) setInternalOpen(next)
  }

  const toggleType = (typeId: string) => {
    if (selectedTypes.includes(typeId)) {
      onChange(selectedTypes.filter((t) => t !== typeId))
    } else {
      onChange([...selectedTypes, typeId])
    }
  }

  const typeList = (
    <div className="space-y-2 p-4">
      {TRUCK_TYPES.map((type) => (
        <button
          key={`modal-${type.id}`}
          type="button"
          onClick={() => toggleType(type.id)}
          className={`flex min-h-[48px] w-full items-center gap-3 rounded-xl border p-4 text-sm font-medium transition-all ${
            selectedTypes.includes(type.id)
              ? 'border-gt-brand bg-gt-brand text-white'
              : 'border-gray-200 bg-white text-gray-600'
          }`}
        >
          <span className="text-xl">{type.icon}</span>
          {type.label}
        </button>
      ))}
    </div>
  )

  if (variant === 'triggerOnly') {
    const summary = formatTruckTypesTriggerLabel(selectedTypes, triggerLabel)
    return (
      <div className={fill ? 'min-w-0 w-full' : 'shrink-0 min-w-0 max-w-full'}>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          title={summary}
          aria-label={summary}
          className={vehicleActionTriggerClass(selectedTypes.length > 0)}
        >
          <span aria-hidden>🚚</span>
          <span className="truncate">{summary}</span>
        </button>
        <SelectorModalShell
          open={showModal}
          onClose={() => setShowModal(false)}
          title={label}
          panelClassName="max-w-md sm:max-w-lg"
        >
          {typeList}
        </SelectorModalShell>
      </div>
    )
  }

  return (
    <div>
      {!isMobile && (
        <label className="mb-2 block text-sm font-medium text-gray-700">{label}</label>
      )}

      {isMobile ? (
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className={`relative flex min-h-[48px] w-full items-center justify-center rounded-xl border text-sm font-medium transition-colors sm:hidden ${
            selectedTypes.length > 0
              ? 'border-[#33d4ff] bg-[#33d4ff]/5 text-gray-800'
              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <span>גררים</span>
          {selectedTypes.length > 0 && (
            <span className="absolute top-1.5 left-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#33d4ff] px-1 text-[11px] font-bold text-white">
              {selectedTypes.length}
            </span>
          )}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="flex w-full items-center justify-between rounded-xl border border-gray-200 p-3 text-right text-sm hover:bg-gray-50 sm:hidden"
        >
          <span className="text-gray-600">
            {selectedTypes.length > 0
              ? TRUCK_TYPES.filter((t) => selectedTypes.includes(t.id))
                  .map((t) => `${t.icon} ${t.label}`)
                  .join(', ')
              : 'בחר סוגי גרר...'}
          </span>
          <span className="text-gray-400">▼</span>
        </button>
      )}

      <SelectorModalShell
        open={showModal}
        onClose={() => setShowModal(false)}
        title={label}
        overlayClassName="sm:hidden"
      >
        {typeList}
      </SelectorModalShell>

      <div className="hidden flex-wrap gap-2 sm:flex">
        {TRUCK_TYPES.map((type) => (
          <button
            key={type.id}
            type="button"
            onClick={() => toggleType(type.id)}
            className={`rounded-xl border px-4 py-2 text-sm font-medium transition-all ${
              selectedTypes.includes(type.id)
                ? 'border-[#33d4ff] bg-[#33d4ff] text-white'
                : 'border-gray-200 bg-white text-gray-600 hover:border-[#33d4ff]'
            }`}
          >
            <span className="ml-1">{type.icon}</span>
            {type.label}
          </button>
        ))}
      </div>
      {!isMobile && selectedTypes.length > 0 && (
        <p className="mt-2 text-xs text-gray-500">נבחרו {selectedTypes.length} סוגים</p>
      )}
    </div>
  )
}
