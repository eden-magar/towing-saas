'use client'

import { useState } from 'react'
import {
  toTowVehicleCoreInfoFromLookup,
  type VehicleLookupFormInput,
} from '../../../lib/utils/tow-vehicle-core'

type LookupChipData = NonNullable<VehicleLookupFormInput['data']>

interface VehicleCoreLookupChipsProps {
  source?: string | null
  data: LookupChipData
  vehicleType?: string | null
  className?: string
  /**
   * Compact strip (יצרן · סוג דלק · משקל · הנעה) with an inline accordion
   * for the remaining fields. Collapsed by default.
   */
  collapsible?: boolean
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span className="px-2 py-0.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-700">
      <span className="text-gray-400">{label}: </span>
      {value}
    </span>
  )
}

function CompactStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-medium text-gt-text-tertiary">{label}</div>
      <div className="truncate text-xs font-medium text-gt-text">{value || '—'}</div>
    </div>
  )
}

export function VehicleCoreLookupChips({
  source,
  data,
  vehicleType,
  className = 'flex flex-wrap gap-1.5 p-2.5 bg-gray-50 rounded-xl',
  collapsible = false,
}: VehicleCoreLookupChipsProps) {
  const core = toTowVehicleCoreInfoFromLookup({ source, data, vehicleType })
  const [expanded, setExpanded] = useState(false)

  const weightValue =
    core.weightLines.length > 0
      ? core.weightLines.map((l) => l.value).join(' · ')
      : ''

  if (!collapsible) {
    return (
      <div className={className}>
        {core.manufacturer && <Chip label="יצרן" value={core.manufacturer} />}
        {core.model && <Chip label="דגם" value={core.model} />}
        {core.year != null && <Chip label="שנה" value={String(core.year)} />}
        {core.color && <Chip label="צבע" value={core.color} />}
        {core.vehicleTypeLabel && <Chip label="סוג" value={core.vehicleTypeLabel} />}
        {core.machineryType && <Chip label="סוג צמ״ה" value={core.machineryType} />}
        {core.chassis && <Chip label="מספר שלדה" value={core.chassis} />}
        {core.fuelType && <Chip label="סוג דלק" value={core.fuelType} />}
        {core.importType && <Chip label="סוג ייבוא" value={core.importType} />}
        {core.weightLines.map((line) => (
          <Chip key={line.label} label={line.label} value={line.value} />
        ))}
        {data.driveType && <Chip label="הנעה" value={data.driveType} />}
        {data.gearType && <Chip label="גיר" value={data.gearType} />}
      </div>
    )
  }

  const hasExtra =
    !!core.model ||
    core.year != null ||
    !!core.color ||
    !!core.chassis ||
    !!core.vehicleTypeLabel ||
    !!core.machineryType ||
    !!core.importType ||
    !!data.gearType ||
    core.weightLines.length > 1

  return (
    <div className="rounded-xl border border-gt-border-subtle bg-gt-surface-subtle/80">
      <div className="grid grid-cols-2 gap-2 px-3 py-2.5 sm:grid-cols-4">
        <CompactStat label="יצרן" value={core.manufacturer || ''} />
        <CompactStat label="סוג דלק" value={core.fuelType || ''} />
        <CompactStat label="משקל" value={weightValue} />
        <CompactStat label="הנעה" value={data.driveType || ''} />
      </div>
      {hasExtra ? (
        <>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="flex w-full items-center justify-between border-t border-gt-border-subtle px-3 py-1.5 text-xs font-medium text-gt-text-secondary hover:bg-white/60"
          >
            <span>פרטים נוספים</span>
            <span className="text-gt-text-tertiary" aria-hidden>
              {expanded ? '▾' : '◂'}
            </span>
          </button>
          {expanded ? (
            <div className="flex flex-wrap gap-1.5 border-t border-gt-border-subtle px-3 py-2.5">
              {core.model && <Chip label="דגם" value={core.model} />}
              {core.year != null && <Chip label="שנה" value={String(core.year)} />}
              {core.color && <Chip label="צבע" value={core.color} />}
              {core.chassis && <Chip label="מספר שלדה" value={core.chassis} />}
              {core.vehicleTypeLabel && (
                <Chip label="סוג רכב" value={core.vehicleTypeLabel} />
              )}
              {core.machineryType && (
                <Chip label="סוג צמ״ה" value={core.machineryType} />
              )}
              {core.importType && <Chip label="סוג ייבוא" value={core.importType} />}
              {data.gearType && <Chip label="גיר" value={data.gearType} />}
              {core.weightLines.slice(1).map((line) => (
                <Chip key={line.label} label={line.label} value={line.value} />
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
