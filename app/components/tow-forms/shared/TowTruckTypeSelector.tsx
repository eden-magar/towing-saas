'use client'

import { useState } from 'react'
import { SelectorModalShell } from './SelectorModalShell'

interface TowTruckTypeSelectorProps {
  selectedTypes: string[]
  onChange: (types: string[]) => void
  label?: string
  /** Compact trigger + modal only (no inline chip grid). */
  variant?: 'default' | 'triggerOnly'
  /** Label on the compact trigger button (triggerOnly variant). */
  triggerLabel?: string
  isMobile?: boolean
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
}: TowTruckTypeSelectorProps) {
  const [showModal, setShowModal] = useState(false)
  
  const toggleType = (typeId: string) => {
    if (selectedTypes.includes(typeId)) {
      onChange(selectedTypes.filter(t => t !== typeId))
    } else {
      onChange([...selectedTypes, typeId])
    }
  }

  if (variant === 'triggerOnly') {
    const summary = formatTruckTypesTriggerLabel(selectedTypes, triggerLabel)
    return (
      <div className="shrink-0 min-w-0 max-w-full">
        <button
          type="button"
          onClick={() => setShowModal(true)}
          title={summary}
          aria-label={summary}
          className={`inline-flex max-w-full min-h-[36px] items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors ${
            selectedTypes.length > 0
              ? 'border-gt-brand bg-gt-brand-subtle text-gt-brand-text'
              : 'border-gray-200 text-gt-text-secondary hover:border-gt-border-strong hover:bg-gt-surface-hover'
          }`}
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
        </SelectorModalShell>
      </div>
    )
  }

  return (
    <div>
      {!isMobile && (
        <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      )}
      
      {/* כפתור מובייל */}
      {isMobile ? (
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className={`sm:hidden relative flex items-center justify-center w-full min-h-[48px] rounded-xl border text-sm font-medium transition-colors ${
            selectedTypes.length > 0
              ? 'border-[#33d4ff] bg-[#33d4ff]/5 text-gray-800'
              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <span>גררים</span>
          {selectedTypes.length > 0 && (
            <span className="absolute top-1.5 left-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#33d4ff] text-white text-[11px] font-bold flex items-center justify-center">
              {selectedTypes.length}
            </span>
          )}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="sm:hidden w-full p-3 border border-gray-200 rounded-xl text-sm text-right flex items-center justify-between hover:bg-gray-50"
        >
          <span className="text-gray-600">
            {selectedTypes.length > 0 
              ? TRUCK_TYPES.filter(t => selectedTypes.includes(t.id)).map(t => `${t.icon} ${t.label}`).join(', ')
              : 'בחר סוגי גרר...'}
          </span>
          <span className="text-gray-400">▼</span>
        </button>
      )}

      {/* מודל מובייל */}
      <SelectorModalShell
        open={showModal}
        onClose={() => setShowModal(false)}
        title={label}
        overlayClassName="sm:hidden"
      >
        <div className="space-y-2 p-4">
          {TRUCK_TYPES.map((type) => (
            <button
              key={`modal-${type.id}`}
              type="button"
              onClick={() => toggleType(type.id)}
              className={`w-full min-h-[48px] p-4 rounded-xl text-sm font-medium transition-all border flex items-center gap-3 ${
                selectedTypes.includes(type.id)
                  ? 'bg-[#33d4ff] text-white border-[#33d4ff]'
                  : 'bg-white text-gray-600 border-gray-200'
              }`}
            >
              <span className="text-xl">{type.icon}</span>
              {type.label}
            </button>
          ))}
        </div>
      </SelectorModalShell>

      {/* דסקטופ */}
      <div className="hidden sm:flex flex-wrap gap-2">
        {TRUCK_TYPES.map((type) => (
          <button
            key={type.id}
            type="button"
            onClick={() => toggleType(type.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
              selectedTypes.includes(type.id)
                ? 'bg-[#33d4ff] text-white border-[#33d4ff]'
                : 'bg-white text-gray-600 border-gray-200 hover:border-[#33d4ff]'
            }`}
          >
            <span className="ml-1">{type.icon}</span>
            {type.label}
          </button>
        ))}
      </div>
      {!isMobile && selectedTypes.length > 0 && (
        <p className="text-xs text-gray-500 mt-2">
          נבחרו {selectedTypes.length} סוגים
        </p>
      )}
    </div>
  )
}