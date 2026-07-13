'use client'

import { useState } from 'react'
import { SelectorModalShell } from './SelectorModalShell'
import { vehicleActionTriggerClass, useVehicleActionsCompact } from './VehicleCardActions'

interface TowTruckTypeSelectorProps {
  selectedTypes: string[]
  onChange: (types: string[]) => void
  label?: string
  /** Compact trigger + modal only (no inline chip grid). */
  variant?: 'default' | 'triggerOnly' | 'gridOnly'
  /** Label on the compact trigger button (triggerOnly variant). */
  triggerLabel?: string
  isMobile?: boolean
  /** Controlled open (e.g. from required-truck-type validation modal). */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Render only the picker modal (host for validation CTA). */
  hideTrigger?: boolean
}

export const TRUCK_TYPES = [
  { id: 'wheel_lift_cradle', label: 'משקפיים', icon: '🔧' },
  { id: 'flatbed', label: 'רמסע', icon: '🚛' },
  { id: 'carrier', label: 'מובילית', icon: '🚚' },
] as const

/** Neutral vs accent tile classes — sibling of fault grid tiles. */
export function truckTypeOptionClassName(selected: boolean): string {
  return selected
    ? 'border-[#33d4ff] bg-[#33d4ff]/10 text-gt-text-primary ring-1 ring-[#33d4ff]'
    : 'border-gray-200 bg-white text-gray-700 hover:border-[#33d4ff]/60'
}

/** Base label + optional value for the compact trigger (value may truncate). */
export function truckTypesTriggerParts(
  selectedTypes: string[],
  emptyLabel = 'סוג גרר',
  filledPrefix = 'גרר',
): { label: string; value: string | null } {
  const labels = selectedTypes
    .map((id) => TRUCK_TYPES.find((t) => t.id === id)?.label)
    .filter((x): x is (typeof TRUCK_TYPES)[number]['label'] => Boolean(x))
  if (labels.length === 0) return { label: emptyLabel, value: null }
  if (labels.length === 1) return { label: filledPrefix, value: labels[0] }
  if (labels.length === 2) {
    return { label: filledPrefix, value: `${labels[0]}, ${labels[1]}` }
  }
  return { label: filledPrefix, value: `${labels[0]} +${labels.length - 1}` }
}

/** Trigger summary: "סוג גרר" | "גרר · רמסע" | "גרר · רמסע +1" */
export function formatTruckTypesTriggerLabel(
  selectedTypes: string[],
  emptyLabel = 'סוג גרר',
  filledPrefix = 'גרר',
): string {
  const { label, value } = truckTypesTriggerParts(
    selectedTypes,
    emptyLabel,
    filledPrefix,
  )
  return value ? `${label} · ${value}` : label
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
  hideTrigger = false,
}: TowTruckTypeSelectorProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const showModal = openProp ?? internalOpen
  const compact = useVehicleActionsCompact()
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

  const renderGrid = (opts: { keyPrefix?: string; padded?: boolean }) => (
    <div
      className={`grid grid-cols-2 gap-2 sm:grid-cols-3${opts.padded ? ' p-4' : ''}`}
      dir="rtl"
    >
      {TRUCK_TYPES.map((type) => {
        const selected = selectedTypes.includes(type.id)
        return (
          <button
            key={`${opts.keyPrefix ?? ''}${type.id}`}
            type="button"
            onClick={() => toggleType(type.id)}
            aria-pressed={selected}
            className={`flex h-full min-h-[4.5rem] w-full flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-3 text-center text-sm font-medium transition-colors ${truckTypeOptionClassName(
              selected,
            )}`}
          >
            <span className="text-xl leading-none" aria-hidden>
              {type.icon}
            </span>
            <span className="line-clamp-2 w-full leading-snug">{type.label}</span>
          </button>
        )
      })}
    </div>
  )

  if (variant === 'gridOnly') {
    return <div>{renderGrid({})}</div>
  }

  if (variant === 'triggerOnly') {
    const summary = formatTruckTypesTriggerLabel(selectedTypes, triggerLabel)
    const { label: baseLabel, value: valueSuffix } = truckTypesTriggerParts(
      selectedTypes,
      triggerLabel,
    )
    return (
      <div className="max-w-full shrink-0 min-w-0">
        {!hideTrigger && (
          <button
            type="button"
            onClick={() => setShowModal(true)}
            title={summary}
            aria-label={summary}
            className={vehicleActionTriggerClass(selectedTypes.length > 0, '', compact)}
          >
            <span aria-hidden className={compact ? 'text-xs' : undefined}>
              🚚
            </span>
            <span className="inline-flex min-w-0 max-w-full items-center">
              <span className="shrink-0">{baseLabel}</span>
              {valueSuffix ? (
                <span
                  className={
                    compact
                      ? 'min-w-0 max-w-[6.5rem] truncate'
                      : 'min-w-0 max-w-[8rem] truncate sm:max-w-[10rem]'
                  }
                >
                  {' · '}
                  {valueSuffix}
                </span>
              ) : null}
            </span>
          </button>
        )}
        <SelectorModalShell
          open={showModal}
          onClose={() => setShowModal(false)}
          title={label}
          panelClassName="max-w-md sm:max-w-lg"
        >
          {renderGrid({ keyPrefix: 'modal-', padded: true })}
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
        {renderGrid({ keyPrefix: 'modal-', padded: true })}
      </SelectorModalShell>

      <div className="hidden sm:block">{renderGrid({})}</div>
      {!isMobile && selectedTypes.length > 0 && (
        <p className="mt-2 text-xs text-gray-500">נבחרו {selectedTypes.length} סוגים</p>
      )}
    </div>
  )
}
