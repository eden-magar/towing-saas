'use client'
import { useState, useEffect } from 'react'
import {
  DEFECT_OPTIONS,
  OTHER_DEFECT_VALUE,
  OTHER_DEFECT_PREFIX,
  applyOtherText,
  defectOptionClassName,
  extractOtherText,
  isOtherSelected,
  toggleOther,
} from '../../../lib/constants/defects'
import { SelectorModalShell } from './SelectorModalShell'
import { vehicleActionTriggerClass } from './VehicleCardActions'

/** Short label for a defect value (first segment before `/`, or אחר text). */
function shortDefectLabel(raw: string): string {
  if (raw === OTHER_DEFECT_VALUE) return 'אחר'
  if (raw.startsWith(OTHER_DEFECT_PREFIX)) {
    const text = raw.slice(OTHER_DEFECT_PREFIX.length).trim()
    return text || 'אחר'
  }
  const option = DEFECT_OPTIONS.find((o) => o.value === raw)
  const base = option?.label ?? raw
  return base.split('/')[0]?.trim() || base
}

/** Base label + optional value suffix for the compact trigger (value may truncate). */
export function defectsTriggerParts(
  selectedDefects: string[],
  emptyLabel = 'תקלות',
): { label: string; value: string | null } {
  const shorts = selectedDefects.map(shortDefectLabel).filter(Boolean)
  if (shorts.length === 0) return { label: emptyLabel, value: null }
  if (shorts.length === 1) return { label: emptyLabel, value: shorts[0] }
  if (shorts.length === 2) {
    return { label: emptyLabel, value: `${shorts[0]}, ${shorts[1]}` }
  }
  return { label: emptyLabel, value: `${shorts[0]} +${shorts.length - 1}` }
}

/** Trigger summary: "תקלות" | "תקלות · מנוע, תקר" | "תקלות · מנוע +2" */
export function formatDefectsTriggerLabel(
  selectedDefects: string[],
  emptyLabel = 'תקלות',
): string {
  const { label, value } = defectsTriggerParts(selectedDefects, emptyLabel)
  return value ? `${label} · ${value}` : label
}

interface DefectSelectorProps {
  selectedDefects: string[]
  onChange: (defects: string[]) => void
  label?: string
  /** Chip grid + אחר field only (for embedding in a parent modal). */
  variant?: 'default' | 'chipsOnly' | 'triggerOnly'
  /** Base label on the compact trigger (triggerOnly). Value summary is appended. */
  triggerLabel?: string
  /** Optional class override for the triggerOnly button (e.g. compact red inline). */
  triggerClassName?: string
  isMobile?: boolean
}

export function DefectSelector({
  selectedDefects,
  onChange,
  label = 'תקלה',
  variant = 'default',
  triggerLabel = 'תקלות',
  triggerClassName,
  isMobile = false,
}: DefectSelectorProps) {
  const [otherText, setOtherText] = useState(() => extractOtherText(selectedDefects))
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    setOtherText(extractOtherText(selectedDefects))
  }, [selectedDefects])

  const toggleDefect = (defect: string) => {
    if (defect === OTHER_DEFECT_VALUE) {
      if (isOtherSelected(selectedDefects)) {
        setOtherText('')
      }
      onChange(toggleOther(selectedDefects))
      return
    }

    if (selectedDefects.includes(defect)) {
      onChange(selectedDefects.filter((d) => d !== defect))
    } else {
      onChange([...selectedDefects, defect])
    }
  }

  const updateOtherText = (text: string) => {
    setOtherText(text)
    onChange(applyOtherText(selectedDefects, text))
  }

  const isSelected = (defect: string) => {
    if (defect === OTHER_DEFECT_VALUE) return isOtherSelected(selectedDefects)
    return selectedDefects.includes(defect)
  }

  const renderGrid = (opts: { keyPrefix?: string; padded?: boolean }) => (
    <div
      className={`grid grid-cols-2 gap-2 sm:grid-cols-3${opts.padded ? ' p-4' : ''}`}
      dir="rtl"
    >
      {DEFECT_OPTIONS.map((defect) => {
        const Icon = defect.icon
        const selected = isSelected(defect.value)
        return (
          <button
            key={`${opts.keyPrefix ?? ''}${defect.value}`}
            type="button"
            onClick={() => toggleDefect(defect.value)}
            className={`flex h-full min-h-[4.5rem] w-full flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-3 text-center text-sm font-medium transition-colors ${defectOptionClassName(
              selected,
              defect.highlight,
              'grid',
            )}`}
          >
            <Icon className="h-5 w-5 shrink-0" aria-hidden />
            <span className="line-clamp-2 w-full leading-snug">{defect.label}</span>
          </button>
        )
      })}
    </div>
  )

  const otherField = (className: string) =>
    isSelected(OTHER_DEFECT_VALUE) ? (
      <div className={className}>
        <input
          type="text"
          value={otherText}
          onChange={(e) => updateOtherText(e.target.value)}
          placeholder="פרט את התקלה..."
          className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gt-brand"
        />
      </div>
    ) : null

  if (variant === 'chipsOnly') {
    return (
      <div>
        {renderGrid({})}
        {otherField('mt-3')}
      </div>
    )
  }

  if (variant === 'triggerOnly') {
    const summary = formatDefectsTriggerLabel(selectedDefects, triggerLabel)
    const { label: baseLabel, value: valueSuffix } = defectsTriggerParts(
      selectedDefects,
      triggerLabel,
    )
    return (
      <div className="max-w-full shrink-0">
        <button
          type="button"
          onClick={() => setShowModal(true)}
          title={summary}
          aria-label={summary}
          className={
            triggerClassName ?? vehicleActionTriggerClass(selectedDefects.length > 0)
          }
        >
          <span aria-hidden>🔧</span>
          <span className="inline-flex min-w-0 max-w-full items-center">
            <span className="shrink-0">{baseLabel}</span>
            {valueSuffix ? (
              <span className="min-w-0 max-w-[8rem] truncate sm:max-w-[10rem]">
                {' · '}
                {valueSuffix}
              </span>
            ) : null}
          </span>
        </button>
        <SelectorModalShell open={showModal} onClose={() => setShowModal(false)} title={label}>
          {renderGrid({ keyPrefix: 'modal-', padded: true })}
          {otherField('px-4 pb-4')}
        </SelectorModalShell>
      </div>
    )
  }

  return (
    <div>
      {!isMobile && (
        <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      )}
      {isMobile ? (
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className={`relative flex min-h-[48px] w-full items-center justify-center rounded-xl border text-sm font-medium transition-colors sm:hidden ${
            selectedDefects.length > 0
              ? 'border-[#33d4ff] bg-[#33d4ff]/5 text-gray-800'
              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <span>תקלות</span>
          {selectedDefects.length > 0 && (
            <span className="absolute top-1.5 left-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#33d4ff] px-1 text-[11px] font-bold text-white">
              {selectedDefects.length}
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
            {selectedDefects.length > 0 ? selectedDefects.join(', ') : 'בחר תקלות...'}
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
        {otherField('px-4 pb-4')}
      </SelectorModalShell>

      <div className="hidden sm:block">{renderGrid({})}</div>

      {!isMobile && otherField('mt-3')}
    </div>
  )
}
