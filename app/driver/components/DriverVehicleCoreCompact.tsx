'use client'

import type { DriverTaskVehicle } from '@/app/lib/queries/driver-tasks'
import { toTowVehicleCoreInfo, type TowVehicleDbRow } from '@/app/lib/utils/tow-vehicle-core'

export function driverTaskVehicleToCoreRow(v: DriverTaskVehicle): TowVehicleDbRow {
  return {
    plate_number: v.plate_number,
    manufacturer: v.manufacturer,
    model: v.model,
    year: v.year,
    color: v.color,
    vehicle_type: v.vehicle_type ?? null,
    registry_source: v.registry_source ?? null,
    vehicle_code: v.vehicle_code ?? null,
    is_working: v.is_working,
    tow_reason: v.tow_reason,
    total_weight: v.total_weight,
    self_weight_ton: v.self_weight_ton ?? null,
    total_weight_ton: v.total_weight_ton ?? null,
    machinery_type: v.machinery_type ?? null,
    chassis: v.chassis ?? null,
    fuel_type: v.fuel_type ?? null,
    import_type: v.import_type ?? null,
  }
}

function CompactChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex max-w-full text-[11px] bg-gray-50 border border-gray-200 text-gray-600 px-1.5 py-0.5 rounded-md leading-tight">
      <span className="text-gray-400 shrink-0">{label}: </span>
      <span className="truncate">{value}</span>
    </span>
  )
}

/** Phone-friendly core vehicle chips — uses shared {@link toTowVehicleCoreInfo}. */
export function DriverVehicleCoreCompact({ vehicle }: { vehicle: DriverTaskVehicle }) {
  const core = toTowVehicleCoreInfo(driverTaskVehicleToCoreRow(vehicle))

  const makeModelYear = [core.manufacturer, core.model, core.year != null ? String(core.year) : null]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {makeModelYear && <CompactChip label="רכב" value={makeModelYear} />}
      {core.vehicleTypeLabel && <CompactChip label="סוג" value={core.vehicleTypeLabel} />}
      {core.color && <CompactChip label="צבע" value={core.color} />}
      {core.machineryType && <CompactChip label="סוג צמ״ה" value={core.machineryType} />}
      {core.weightLines.map((line) => (
        <CompactChip key={line.label} label={line.label} value={line.value} />
      ))}
      {core.fuelType && <CompactChip label="דלק" value={core.fuelType} />}
      {core.chassis && <CompactChip label="שילדה" value={core.chassis} />}
      {core.importType && <CompactChip label="ייבוא" value={core.importType} />}
    </div>
  )
}

export function driverVehicleDisplayName(vehicle: DriverTaskVehicle): string {
  const core = toTowVehicleCoreInfo(driverTaskVehicleToCoreRow(vehicle))
  const name = [core.manufacturer, core.model].filter(Boolean).join(' ')
  if (name) {
    return core.year != null ? `${name} (${core.year})` : name
  }
  return core.vehicleTypeLabel || 'רכב'
}
