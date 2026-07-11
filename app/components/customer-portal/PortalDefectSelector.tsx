'use client'

import { useEffect, useState } from 'react'
import {
  DEFECT_OPTIONS,
  defectOptionClassName,
} from '@/app/lib/constants/defects'
import { SelectorModalShell } from '@/app/components/tow-forms/shared/SelectorModalShell'
import { PORTAL_DEFECTS_TRIGGER_CLASS } from './portalRequestActionStyles'

interface PortalDefectSelectorProps {
  selectedDefects: string[]
  onChange: (defects: string[]) => void
  label?: string
  triggerLabel?: string
  /** Optional class override for the trigger button. */
  triggerClassName?: string
}

/**
 * Customer-portal defects picker — grid tiles + multi-select hint.
 * Separate from the shared dashboard DefectSelector (pill / chips layout).
 */
export function PortalDefectSelector({
  selectedDefects,
  onChange,
  label = 'תקלות',
  triggerLabel = 'בחר תקלות',
  triggerClassName = PORTAL_DEFECTS_TRIGGER_CLASS,
}: PortalDefectSelectorProps) {
  const [otherText, setOtherText] = useState('')
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    const otherDefect = selectedDefects.find((d) => d.startsWith('אחר:'))
    if (otherDefect) {
      setOtherText(otherDefect.replace('אחר: ', ''))
    }
  }, [])

  const toggleDefect = (defect: string) => {
    if (defect === 'אחר') {
      const hasOther = selectedDefects.some((d) => d === 'אחר' || d.startsWith('אחר:'))
      if (hasOther) {
        onChange(selectedDefects.filter((d) => d !== 'אחר' && !d.startsWith('אחר:')))
        setOtherText('')
        return
      }
    }

    if (selectedDefects.includes(defect)) {
      onChange(selectedDefects.filter((d) => d !== defect))
    } else {
      onChange([...selectedDefects, defect])
    }
  }

  const updateOtherText = (text: string) => {
    setOtherText(text)
    const filtered = selectedDefects.filter((d) => d !== 'אחר' && !d.startsWith('אחר:'))
    if (text.trim()) {
      onChange([...filtered, `אחר: ${text}`])
    } else {
      onChange([...filtered, 'אחר'])
    }
  }

  const isSelected = (defect: string) => {
    if (defect === 'אחר') {
      return selectedDefects.some((d) => d === 'אחר' || d.startsWith('אחר:'))
    }
    return selectedDefects.includes(defect)
  }

  return (
    <div className="shrink-0">
      <button
        type="button"
        onClick={() => setShowModal(true)}
        className={triggerClassName}
      >
        <span>{triggerLabel}</span>
        {selectedDefects.length > 0 && (
          <span className="absolute -top-1.5 -left-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-gt-danger px-1 text-[11px] font-bold text-white">
            {selectedDefects.length}
          </span>
        )}
      </button>

      <SelectorModalShell
        open={showModal}
        onClose={() => setShowModal(false)}
        title={label}
        subtitle="ניתן לסמן יותר מתקלה אחת"
        panelClassName="max-w-md sm:max-w-lg lg:max-w-2xl"
      >
        <div className="grid grid-cols-1 gap-2 p-4 sm:grid-cols-2 sm:gap-2.5 lg:grid-cols-3 lg:gap-3">
          {DEFECT_OPTIONS.map((defect) => {
            const Icon = defect.icon
            const selected = isSelected(defect.value)
            return (
              <button
                key={defect.value}
                type="button"
                onClick={() => toggleDefect(defect.value)}
                aria-pressed={selected}
                className={`flex h-full min-h-[48px] w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-start text-sm transition-colors ${
                  defect.highlight
                    ? defectOptionClassName(selected, true, 'grid')
                    : selected
                      ? 'border-gt-brand bg-gt-brand-subtle text-gt-brand-text'
                      : 'border-gt-border-field bg-white text-gt-text-secondary hover:border-gt-border hover:bg-gt-surface-hover'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                <span className="leading-snug">{defect.label}</span>
              </button>
            )
          })}
        </div>

        {isSelected('אחר') && (
          <div className="px-4 pb-4">
            <input
              type="text"
              value={otherText}
              onChange={(e) => updateOtherText(e.target.value)}
              placeholder="פרט את התקלה..."
              className="w-full rounded-xl border border-gt-border-field px-4 py-2.5 text-sm text-gt-text-primary placeholder:text-gt-text-tertiary hover:border-gt-border focus:outline-none focus:border-gt-brand focus:ring-[3px] focus:ring-gt-brand/20"
            />
          </div>
        )}
      </SelectorModalShell>
    </div>
  )
}
