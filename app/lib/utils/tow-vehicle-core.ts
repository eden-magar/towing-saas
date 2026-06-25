import { getVehicleTypeLabel, isKnownVehicleType } from '../vehicle-lookup'

/** tow_vehicles row shape (snake_case) accepted by {@link toTowVehicleCoreInfo}. */
export type TowVehicleDbRow = {
  plate_number?: string | null
  manufacturer?: string | null
  model?: string | null
  year?: number | null
  color?: string | null
  vehicle_type?: string | null
  registry_source?: string | null
  vehicle_code?: string | null
  is_working?: boolean | null
  tow_reason?: string | null
  total_weight?: number | null
  curb_weight_kg?: number | null
  self_weight_ton?: number | null
  total_weight_ton?: number | null
  machinery_type?: string | null
  chassis?: string | null
  fuel_type?: string | null
  import_type?: string | null
}

export type TowVehicleCoreInfo = {
  plate: string
  manufacturer: string | null
  model: string | null
  year: number | null
  color: string | null
  vehicleTypeLabel: string
  machineryType: string | null
  selfWeightTon: number | null
  totalWeightTon: number | null
  totalWeightKg: number | null
  curbWeightKg: number | null
  vehicleCode: string | null
  isWorking: boolean | null
  defects: string[]
  weightLines: { label: string; value: string }[]
  chassis: string | null
  fuelType: string | null
  importType: string | null
}

const MANUAL_VEHICLE_TYPE_LABELS: Record<string, string> = {
  van: 'רכב מסחרי',
  suv: "ג'יפ / SUV",
  truck: 'משאית',
  bus: 'אוטובוס / מיניבוס',
  other: 'אחר',
}

function isMachineryRow(row: TowVehicleDbRow): boolean {
  return (
    row.registry_source === 'machinery' ||
    row.vehicle_type === 'machinery' ||
    !!row.machinery_type ||
    row.self_weight_ton != null ||
    row.total_weight_ton != null
  )
}

function resolveVehicleTypeLabel(row: TowVehicleDbRow): string {
  if (row.registry_source === 'machinery' || row.vehicle_type === 'machinery') {
    return getVehicleTypeLabel('machinery')
  }
  const vehicleType = row.vehicle_type
  if (vehicleType && isKnownVehicleType(vehicleType)) {
    return getVehicleTypeLabel(vehicleType)
  }
  if (vehicleType && MANUAL_VEHICLE_TYPE_LABELS[vehicleType]) {
    return MANUAL_VEHICLE_TYPE_LABELS[vehicleType]
  }
  return ''
}

function buildWeightLines(row: TowVehicleDbRow): TowVehicleCoreInfo['weightLines'] {
  if (isMachineryRow(row)) {
    const lines: TowVehicleCoreInfo['weightLines'] = []
    if (row.self_weight_ton != null) {
      lines.push({ label: 'משקל עצמי', value: `${row.self_weight_ton} טון` })
    }
    if (row.total_weight_ton != null) {
      lines.push({ label: 'משקל כולל', value: `${row.total_weight_ton} טון` })
    }
    return lines
  }
  const lines: TowVehicleCoreInfo['weightLines'] = []
  if (row.total_weight != null) {
    lines.push({ label: 'משקל', value: `${row.total_weight} ק"ג` })
  }
  // משקל עצמי (רכב כבד) — 0 / חסר נחשב כלא זמין ולא מוצג
  if (row.curb_weight_kg != null && row.curb_weight_kg > 0) {
    lines.push({ label: 'משקל עצמי', value: `${row.curb_weight_kg} ק"ג` })
  }
  return lines
}

function parseDefects(towReason: string | null | undefined): string[] {
  if (!towReason?.trim()) return []
  return towReason
    .split(', ')
    .map((d) => d.trim())
    .filter(Boolean)
}

function parseOptionalNumber(value: string | number | null | undefined): number | null {
  if (value == null || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

/** Live lookup / form state (camelCase) → {@link TowVehicleDbRow} for the shared formatter. */
export type VehicleLookupFormInput = {
  source?: string | null
  data?: {
    manufacturer?: string | null
    model?: string | null
    year?: number | string | null
    color?: string | null
    driveType?: string | null
    gearType?: string | null
    totalWeight?: number | string | null
    curbWeightKg?: number | string | null
    machineryType?: string | null
    selfWeight?: number | string | null
    totalWeightTon?: number | string | null
    chassis?: string | null
    fuelType?: string | null
    importType?: string | null
  } | null
  /** Form-selected category (van, machinery, etc.) when distinct from registry source. */
  vehicleType?: string | null
  manualWeight?: string | number | null
}

export function vehicleLookupFormToDbRow(input: VehicleLookupFormInput): TowVehicleDbRow {
  const d = input.data
  const registrySource = input.source ?? null
  const vehicleType = input.vehicleType ?? registrySource ?? null
  const parsedManualWeight = parseOptionalNumber(input.manualWeight)
  const parsedDataWeight = parseOptionalNumber(d?.totalWeight ?? null)
  const parsedCurbWeight = parseOptionalNumber(d?.curbWeightKg ?? null)

  return {
    manufacturer: d?.manufacturer ?? null,
    model: d?.model ?? null,
    year: parseOptionalNumber(d?.year ?? null),
    color: d?.color ?? null,
    vehicle_type: vehicleType,
    registry_source: registrySource,
    total_weight: parsedDataWeight ?? parsedManualWeight,
    curb_weight_kg: parsedCurbWeight != null && parsedCurbWeight > 0 ? parsedCurbWeight : null,
    self_weight_ton: parseOptionalNumber(d?.selfWeight ?? null),
    total_weight_ton: parseOptionalNumber(d?.totalWeightTon ?? null),
    machinery_type: d?.machineryType ?? null,
    chassis: d?.chassis?.trim() || null,
    fuel_type: d?.fuelType?.trim() || null,
    import_type: d?.importType?.trim() || null,
  }
}

export function toTowVehicleCoreInfoFromLookup(
  input: VehicleLookupFormInput
): TowVehicleCoreInfo {
  return toTowVehicleCoreInfo(vehicleLookupFormToDbRow(input))
}

export function toTowVehicleCoreInfo(row: TowVehicleDbRow): TowVehicleCoreInfo {
  const machinery = isMachineryRow(row)
  return {
    plate: row.plate_number ?? '',
    manufacturer: row.manufacturer ?? null,
    model: row.model ?? null,
    year: row.year ?? null,
    color: row.color ?? null,
    vehicleTypeLabel: resolveVehicleTypeLabel(row),
    machineryType: row.machinery_type ?? null,
    selfWeightTon: machinery ? (row.self_weight_ton ?? null) : null,
    totalWeightTon: machinery ? (row.total_weight_ton ?? null) : null,
    totalWeightKg: machinery ? null : (row.total_weight ?? null),
    curbWeightKg: machinery ? null : (row.curb_weight_kg != null && row.curb_weight_kg > 0 ? row.curb_weight_kg : null),
    vehicleCode: row.vehicle_code ?? null,
    isWorking: row.is_working ?? null,
    defects: parseDefects(row.tow_reason),
    weightLines: buildWeightLines(row),
    chassis: row.chassis?.trim() || null,
    fuelType: row.fuel_type?.trim() || null,
    importType: row.import_type?.trim() || null,
  }
}
