'use client'

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
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span className="px-2 py-0.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-700">
      <span className="text-gray-400">{label}: </span>
      {value}
    </span>
  )
}

export function VehicleCoreLookupChips({
  source,
  data,
  vehicleType,
  className = 'flex flex-wrap gap-1.5 p-2.5 bg-gray-50 rounded-xl',
}: VehicleCoreLookupChipsProps) {
  const core = toTowVehicleCoreInfoFromLookup({ source, data, vehicleType })

  return (
    <div className={className}>
      {core.manufacturer && <Chip label="יצרן" value={core.manufacturer} />}
      {core.model && <Chip label="דגם" value={core.model} />}
      {core.year != null && <Chip label="שנה" value={String(core.year)} />}
      {core.color && <Chip label="צבע" value={core.color} />}
      {core.vehicleTypeLabel && <Chip label="סוג" value={core.vehicleTypeLabel} />}
      {core.machineryType && <Chip label="סוג צמ״ה" value={core.machineryType} />}
      {core.weightLines.map((line) => (
        <Chip key={line.label} label={line.label} value={line.value} />
      ))}
      {data.driveType && <Chip label="הנעה" value={data.driveType} />}
      {data.gearType && <Chip label="גיר" value={data.gearType} />}
    </div>
  )
}
