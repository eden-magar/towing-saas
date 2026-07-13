'use client'
import { useState, useEffect } from 'react'
import {
  DEFECT_OPTIONS,
  OTHER_DEFECT_VALUE,
  applyOtherText,
  defectOptionClassName,
  extractOtherText,
  isOtherSelected,
  toggleOther,
} from '../../../lib/constants/defects'
import { SelectorModalShell } from './SelectorModalShell'

interface DefectSelectorProps {
  selectedDefects: string[]
  onChange: (defects: string[]) => void
  label?: string
  /** Chip grid + אחר field only (for embedding in a parent modal). */
  variant?: 'default' | 'chipsOnly' | 'triggerOnly'
  /** Label on the compact trigger button (triggerOnly variant). */
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

  const chipClass = (selected: boolean, highlight?: boolean, brand = false) => {
    if (highlight) return defectOptionClassName(selected, true, 'chip')
    if (brand) {
      return selected
        ? 'bg-gt-brand text-white'
        : 'bg-gray-100 text-gray-600'
    }
    return defectOptionClassName(selected, false, 'chip')
  }

  const renderChips = (opts: {
    keyPrefix?: string
    minTouch?: boolean
    brand?: boolean
  }) => (
    <div className={`flex flex-wrap gap-2${opts.minTouch ? ' p-4' : ''}`}>
      {DEFECT_OPTIONS.map((defect) => {
        const Icon = defect.icon
        const selected = isSelected(defect.value)
        return (
          <button
            key={`${opts.keyPrefix ?? ''}${defect.value}`}
            type="button"
            onClick={() => toggleDefect(defect.value)}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm transition-colors ${
              opts.minTouch ? 'min-h-[44px] px-4 py-2.5' : ''
            } ${chipClass(selected, defect.highlight, opts.brand)}`}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            <span>{defect.label}</span>
          </button>
        )
      })}
    </div>
  )

  if (variant === 'chipsOnly') {
    return (
      <div>
        {renderChips({})}
        {isSelected(OTHER_DEFECT_VALUE) && (
          <div className="mt-3">
            <input
              type="text"
              value={otherText}
              onChange={(e) => updateOtherText(e.target.value)}
              placeholder="פרט את התקלה..."
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
            />
          </div>
        )}
      </div>
    )
  }

  if (variant === 'triggerOnly') {
    return (
      <div className="shrink-0">
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className={
            triggerClassName ??
            `relative flex w-full min-h-[36px] items-center justify-center rounded-lg border text-xs font-medium transition-colors ${
              selectedDefects.length > 0
                ? 'border-gt-brand bg-gt-brand-subtle text-gt-brand-text'
                : 'border-gray-200 text-gt-text-secondary hover:border-gt-border-strong hover:bg-gt-surface-hover'
            }`
          }
        >
          <span>{triggerLabel}</span>
          {selectedDefects.length > 0 && (
            <span
              className={
                triggerClassName
                  ? 'absolute -top-1.5 -left-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-gt-danger px-1 text-[11px] font-bold text-white'
                  : 'absolute top-1 left-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-gt-brand px-1 text-[11px] font-bold text-white'
              }
            >
              {selectedDefects.length}
            </span>
          )}
        </button>
        <SelectorModalShell open={showModal} onClose={() => setShowModal(false)} title={label}>
          {renderChips({ keyPrefix: 'modal-', minTouch: true, brand: true })}
          {isSelected(OTHER_DEFECT_VALUE) && (
            <div className="px-4 pb-4">
              <input
                type="text"
                value={otherText}
                onChange={(e) => updateOtherText(e.target.value)}
                placeholder="פרט את התקלה..."
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gt-brand"
              />
            </div>
          )}
        </SelectorModalShell>
      </div>
    )
  }

  return (
    <div>
      {!isMobile && (
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      )}
      {isMobile ? (
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className={`sm:hidden relative flex items-center justify-center w-full min-h-[48px] rounded-xl border text-sm font-medium transition-colors ${
            selectedDefects.length > 0
              ? 'border-[#33d4ff] bg-[#33d4ff]/5 text-gray-800'
              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <span>תקלות</span>
          {selectedDefects.length > 0 && (
            <span className="absolute top-1.5 left-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#33d4ff] text-white text-[11px] font-bold flex items-center justify-center">
              {selectedDefects.length}
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
        {renderChips({ keyPrefix: 'modal-', minTouch: true })}
        {isSelected(OTHER_DEFECT_VALUE) && (
          <div className="px-4 pb-4">
            <input
              type="text"
              value={otherText}
              onChange={(e) => updateOtherText(e.target.value)}
              placeholder="פרט את התקלה..."
              className={
                isMobile
                  ? 'w-full px-4 h-12 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]'
                  : 'w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]'
              }
            />
          </div>
        )}
      </SelectorModalShell>

      <div className="hidden sm:flex flex-wrap gap-2">
        {DEFECT_OPTIONS.map((defect) => {
          const Icon = defect.icon
          const selected = isSelected(defect.value)
          return (
            <button
              key={defect.value}
              type="button"
              onClick={() => toggleDefect(defect.value)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${chipClass(
                selected,
                defect.highlight
              )}`}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              <span>{defect.label}</span>
            </button>
          )
        })}
      </div>

      {!isMobile && isSelected(OTHER_DEFECT_VALUE) && (
        <div className="mt-3">
          <input
            type="text"
            value={otherText}
            onChange={(e) => updateOtherText(e.target.value)}
            placeholder="פרט את התקלה..."
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
            autoFocus
          />
        </div>
      )}
    </div>
  )
}
