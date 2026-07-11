// ==================== Vehicle Lookup Service ====================
// שירות חיפוש פרטי רכב - קודם ב-Supabase, אח"כ ב-data.gov.il

import { VehicleLookupResult, VehicleType } from './types'
import { supabase } from './supabase'

const REGISTRY_FETCH_TIMEOUT_MS = 9000
/** Negative-cache TTL for definitive registry-wide misses only. */
export const REGISTRY_MISS_TTL_MS = 24 * 60 * 60 * 1000
/** @deprecated Use REGISTRY_MISS_TTL_MS — kept for any external imports. */
export const VEHICLE_LOOKUP_MISS_TTL_DAYS = REGISTRY_MISS_TTL_MS / (24 * 60 * 60 * 1000)
/** Probe batch size for data.gov.il (no documented rate limit — conservative cap). */
const REGISTRY_PROBE_CONCURRENCY = 5

/** Three-way outcome for a single data.gov.il resource probe. */
type RegistryProbeResult =
  | { status: 'FOUND'; data: any }
  | { status: 'ABSENT' }
  | { status: 'ERROR' }

function notFoundLookupResult(error?: string): VehicleLookupResult {
  return {
    found: false,
    source: null,
    sourceLabel: '',
    data: null,
    error: error ?? 'הרכב לא נמצא במאגרי משרד התחבורה',
  }
}

class RegistryFetchError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RegistryFetchError'
  }
}

async function fetchJsonWithTimeout(
  url: string,
  externalSignal?: AbortSignal,
): Promise<unknown> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REGISTRY_FETCH_TIMEOUT_MS)

  const onExternalAbort = () => controller.abort()
  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timeoutId)
      controller.abort()
    } else {
      externalSignal.addEventListener('abort', onExternalAbort)
    }
  }

  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) {
      throw new RegistryFetchError(`HTTP ${response.status}`)
    }
    try {
      return await response.json()
    } catch {
      throw new RegistryFetchError('unparseable JSON body')
    }
  } finally {
    clearTimeout(timeoutId)
    externalSignal?.removeEventListener('abort', onExternalAbort)
  }
}

/** CKAN datastore_search body: success === true and records array present (may be empty). */
function parseCkanRecords(
  body: unknown,
): { ok: true; records: any[] } | { ok: false } {
  if (!body || typeof body !== 'object') return { ok: false }
  const parsed = body as { success?: boolean; result?: { records?: unknown } }
  if (parsed.success !== true) return { ok: false }
  if (!parsed.result || !Array.isArray(parsed.result.records)) return { ok: false }
  return { ok: true, records: parsed.result.records }
}


// מזהי המאגרים ב-data.gov.il
const API_RESOURCES = {
  private: '053cea08-09bc-40ec-8f7a-156f0677aff3',
  motorcycle: 'bf9df4e2-d90d-4c0a-a400-19e15af8e95f',
  heavy: 'cd3acc5c-03c3-4c89-9c54-d40f93c0d790',
  machinery: '58dc4654-16b1-42ed-8170-98fadec153ea',
  personal_import: '03adc637-b6fe-402b-9937-7c3d3afc9140',
  private_extra: '142afde2-6228-49f9-8a29-9b6c3a0cbe40',
  canceled_private: '851ecab1-0622-4dbe-a6c7-f950cf82abf9',
  canceled_heavy: '4e6b9724-4c1e-43f0-909a-154d4cc4e046',
  canceled_motorcycle: 'ec8cbc34-72e1-4b69-9c48-22821ba0bd6c',
  inactive: 'f6efe89a-fb3d-43a4-bb61-9bf12a9b9099',
}

// תוויות לסוגי רכב
const SOURCE_LABELS: Record<string, string> = {
  private: 'רכב פרטי',
  motorcycle: 'דו גלגלי',
  heavy: 'רכב כבד',
  machinery: 'צמ"ה',
  personal_import: 'יבוא אישי',
}

// שמות השדות לפי סוג מאגר
const FIELD_MAPPINGS: Record<string, Record<string, string>> = {
  private: {
    manufacturer: 'tozeret_nm',
    model: 'kinuy_mishari',
    year: 'shnat_yitzur',
    color: 'tzeva_rechev',
    fuelType: 'sug_delek_nm',
    totalWeight: 'mishkal_kolel',
    vehicleType: 'sug_rechev_nm',
    driveType: 'hanaa_nm',
    driveTechnology: 'technologiat_hanaa_nm',
    gearType: 'automatic_ind',
    chassis: 'misgeret',
  },
  motorcycle: {
    manufacturer: 'tozeret_nm',
    model: 'degem_nm',
    year: 'shnat_yitzur',
    color: 'tzeva_rechev',
    fuelType: 'sug_delek_nm',
    totalWeight: 'mishkal_kolel',
    vehicleType: 'sug_rechev_nm',
    driveType: 'hanaa_nm',
    driveTechnology: '',
    gearType: '',
    chassis: 'misgeret',
  },
  heavy: {
    manufacturer: 'tozeret_nm',
    model: 'degem_nm',
    year: 'shnat_yitzur',
    color: 'tzeva_rechev',
    fuelType: 'sug_delek_nm',
    totalWeight: 'mishkal_kolel',
    vehicleType: 'sug_rechev_nm',
    driveType: 'hanaa_nm',
    driveTechnology: '',
    gearType: '',
    chassis: 'mispar_shilda',
  },
  machinery: {
    manufacturer: 'shilda_totzar_en_nm',
    model: 'degem_nm',
    year: 'shnat_yitzur',
    color: '',
    fuelType: '',
    totalWeight: 'mishkal_kolel_ton',
    vehicleType: 'sug_tzama_nm',
    driveType: '',
    driveTechnology: '',
    gearType: '',
    chassis: 'mispar_shilda',
  },
  personal_import: {
    manufacturer: 'tozeret_nm',
    model: 'degem_nm',
    year: 'shnat_yitzur',
    color: '',
    fuelType: 'sug_delek_nm',
    totalWeight: 'mishkal_kolel',
    vehicleType: 'sug_rechev_nm',
    driveType: '',
    driveTechnology: '',
    gearType: '',
    chassis: 'shilda',
    importType: 'sug_yevu',
  },
}

type ResourceProbe = {
  resourceId: string
  source: string
  fuzzyQFallback?: boolean
  mapAs?: keyof typeof FIELD_MAPPINGS
  sourceLabel?: string
  registryStatus?: 'cancelled' | 'inactive'
}

type RegistryRaceResult =
  | { status: 'FOUND'; data: any; probe: ResourceProbe }
  | { status: 'ABSENT' }
  | { status: 'ERROR' }

/**
 * משקל עצמי (mishkal_azmi) ברכב כבד מגיע בק"ג. ערך 0 / ריק => לא זמין (null).
 */
function parseCurbWeightKg(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = parseFloat(String(value))
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}

/**
 * חיפוש רכב ב-Supabase (מהיר)
 */
async function searchInSupabase(licenseNumber: string): Promise<VehicleLookupResult | null> {
  try {
    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .eq('license_number', licenseNumber)
      .single()

    if (error || !data) {
      return null
    }

    const isPrivate = data.source_type === 'private'
    const isMachinery = data.source_type === 'machinery'
    const isMotorcycle = data.source_type === 'motorcycle'
    const isHeavy = data.source_type === 'heavy'

    // משתנים למידע נוסף
    let driveType = data.drive_type
    let driveTechnology = data.drive_technology
    let gearType = data.gear_type
    let totalWeight = data.total_weight

    // לרכב פרטי - שליפת מידע נוסף מטבלת vehicle_models
    if (isPrivate) {
      const { data: modelData } = await supabase
        .from('vehicle_models')
        .select('*')
        .eq('manufacturer', data.manufacturer)
        .eq('model', data.model)
        .eq('year', data.year)
        .single()

      if (modelData) {
        console.log('✅ נמצא מידע נוסף מטבלת דגמים')
        driveType = modelData.drive_type || driveType
        driveTechnology = modelData.drive_technology || driveTechnology
        gearType = modelData.gear_type || gearType
        totalWeight = modelData.total_weight || totalWeight
      }
    }

    // לצמ"ה - שליפת שדות נוספים מ-raw_data
    let machineryType = null
    let selfWeight = null
    let totalWeightTon = null

    if (isMachinery && data.raw_data) {
      machineryType = data.raw_data.sug_tzama_nm || data.vehicle_type
      selfWeight = data.raw_data.mishkal_ton !== undefined ? data.raw_data.mishkal_ton : null
      totalWeightTon = data.raw_data.mishkal_kolel_ton !== undefined ? data.raw_data.mishkal_kolel_ton : null
      driveType = data.raw_data.hanaa_nm || driveType
    }

    // לדו גלגלי - שליפת סוג רכב מ-raw_data
    let motorcycleType = null
    if (isMotorcycle && data.raw_data) {
      motorcycleType = data.raw_data.sug_rechev_nm || data.vehicle_type
    }

    // לרכב כבד - משקל עצמי מ-raw_data (mishkal_azmi, ק"ג; 0 => null)
    let curbWeightKg: number | null = null
    if (isHeavy && data.raw_data) {
      curbWeightKg = parseCurbWeightKg(data.raw_data.mishkal_azmi)
    }

    return {
      found: true,
      source: data.source_type as VehicleType,
      sourceLabel: SOURCE_LABELS[data.source_type] || 'רכב',
      data: {
        plateNumber: data.license_number,
        manufacturer: data.manufacturer,
        model: data.model,
        year: data.year,
        color: data.color,
        fuelType: data.fuel_type,
        totalWeight: isMachinery ? null : totalWeight,
        vehicleType: isMotorcycle ? motorcycleType : data.vehicle_type,
        driveType: driveType,
        driveTechnology: driveTechnology,
        gearType: gearType,
        chassis: readChassisFromCacheRow(data),
        importType: readImportTypeFromCacheRow(data),
        curbWeightKg: curbWeightKg,
        // שדות צמ"ה
        machineryType: machineryType,
        selfWeight: selfWeight,
        totalWeightTon: totalWeightTon,
      },
    }
  } catch (error) {
    console.error('Error searching in Supabase:', error)
    return null
  }
}

/**
 * Negative cache: recent confirmed miss for this plate (within TTL).
 */
async function searchMissInSupabase(licenseNumber: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('vehicle_lookup_misses')
      .select('expires_at')
      .eq('license_number', licenseNumber)
      .maybeSingle()

    if (error || !data?.expires_at) return false
    return new Date(data.expires_at).getTime() > Date.now()
  } catch (error) {
    console.error('Error searching vehicle lookup miss cache:', error)
    return false
  }
}

/**
 * Record a confirmed registry miss (service-role via /api/vehicles/cache).
 */
async function saveMissToSupabase(licenseNumber: string): Promise<void> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) {
      console.error('Vehicle miss cache write skipped: no session')
      return
    }

    void fetch('/api/vehicles/cache', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        licenseNumber,
        isMiss: true,
        missTtlMs: REGISTRY_MISS_TTL_MS,
      }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          console.error('Error saving vehicle miss to cache:', body)
        }
      })
      .catch((error) => {
        console.error('Error saving vehicle miss to cache:', error)
      })
  } catch (error) {
    console.error('Error initiating vehicle miss cache write:', error)
  }
}

/**
 * שמירת רכב ב-Supabase (לאחר מציאה ב-API) — service-role via /api/vehicles/cache
 */
async function saveToSupabase(
  licenseNumber: string,
  sourceType: string,
  mappedData: VehicleLookupResult['data'],
  rawData: any
): Promise<void> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) {
      console.error('Vehicle cache write skipped: no session')
      return
    }

    void fetch('/api/vehicles/cache', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        licenseNumber,
        sourceType,
        mappedData,
        rawData,
      }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          console.error('Error saving vehicle to cache:', body)
        }
      })
      .catch((error) => {
        console.error('Error saving vehicle to cache:', error)
      })
  } catch (error) {
    console.error('Error initiating vehicle cache write:', error)
  }
}

/**
 * חיפוש רכב במאגר ספציפי ב-API — FOUND / ABSENT / ERROR (never collapse ERROR→ABSENT).
 */
async function searchInResource(
  licenseNumber: string,
  resourceId: string,
  source: string,
  options?: { fuzzyQFallback?: boolean; signal?: AbortSignal },
): Promise<RegistryProbeResult> {
  try {
    const cleanLicense = licenseNumber.replace(/[^0-9]/g, '')

    const url1 = `https://data.gov.il/api/3/action/datastore_search?resource_id=${resourceId}&filters={"mispar_rechev":"${parseInt(cleanLicense, 10).toString()}"}`

    const data1 = await fetchJsonWithTimeout(url1, options?.signal)
    const ckan1 = parseCkanRecords(data1)
    if (!ckan1.ok) {
      return { status: 'ERROR' }
    }
    if (ckan1.records.length > 0) {
      return { status: 'FOUND', data: ckan1.records[0] }
    }

    const url2 = `https://data.gov.il/api/3/action/datastore_search?resource_id=${resourceId}&q=${cleanLicense}`

    const data2 = await fetchJsonWithTimeout(url2, options?.signal)
    const ckan2 = parseCkanRecords(data2)
    if (!ckan2.ok) {
      return { status: 'ERROR' }
    }

    if (ckan2.records.length > 0) {
      const record = ckan2.records.find((rec: any) => {
        const recLicense = String(rec.mispar_rechev || rec.MISPAR_RECHEV || '')
          .replace(/[^0-9]/g, '')
        if (recLicense === cleanLicense || recLicense === parseInt(cleanLicense, 10).toString()) {
          return true
        }
        if (options?.fuzzyQFallback) {
          return Object.values(rec).some(
            (val) => val != null && val.toString().includes(cleanLicense),
          )
        }
        return false
      })

      if (record) {
        return { status: 'FOUND', data: record }
      }
    }

    return { status: 'ABSENT' }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn(`[vehicle-lookup] ${source} lookup timed out or aborted`)
    } else if (error instanceof RegistryFetchError) {
      console.warn(`[vehicle-lookup] ${source} lookup error:`, error.message)
    } else {
      console.warn(
        `[vehicle-lookup] ${source} lookup skipped (network):`,
        error instanceof Error ? error.message : error,
      )
    }
    return { status: 'ERROR' }
  }
}

/**
 * Probe resources in concurrent batches. FOUND wins immediately.
 * ERROR from any probe (when no FOUND) is preserved — never treated as ABSENT.
 */
async function raceResourceProbes(
  licenseNumber: string,
  probes: ResourceProbe[],
): Promise<RegistryRaceResult> {
  const parentAbort = new AbortController()
  let sawError = false

  for (let i = 0; i < probes.length; i += REGISTRY_PROBE_CONCURRENCY) {
    const batch = probes.slice(i, i + REGISTRY_PROBE_CONCURRENCY)
    const outcomes = await Promise.all(
      batch.map(async (probe) => ({
        probe,
        result: await searchInResource(licenseNumber, probe.resourceId, probe.source, {
          fuzzyQFallback: probe.fuzzyQFallback,
          signal: parentAbort.signal,
        }),
      })),
    )

    const hit = outcomes.find((o) => o.result.status === 'FOUND')
    if (hit && hit.result.status === 'FOUND') {
      parentAbort.abort()
      return { status: 'FOUND', data: hit.result.data, probe: hit.probe }
    }

    if (outcomes.some((o) => o.result.status === 'ERROR')) {
      sawError = true
    }
  }

  return sawError ? { status: 'ERROR' } : { status: 'ABSENT' }
}

/**
 * מיפוי נתונים גולמיים לפורמט אחיד
 */
function readChassisField(rawData: any, column: string | undefined, source: string): string | null {
  if (column && rawData[column] != null && String(rawData[column]).trim()) {
    return String(rawData[column]).trim()
  }
  if (source === 'heavy' && rawData.misgeret != null && String(rawData.misgeret).trim()) {
    return String(rawData.misgeret).trim()
  }
  return null
}

function readChassisFromCacheRow(data: { chassis?: string | null; raw_data?: any; source_type?: string }): string | null {
  if (data.chassis?.trim()) return data.chassis.trim()
  if (!data.raw_data) return null
  const source = data.source_type || ''
  const fields = FIELD_MAPPINGS[source]
  if (!fields?.chassis) return null
  return readChassisField(data.raw_data, fields.chassis, source)
}

function readImportTypeFromCacheRow(data: {
  import_type?: string | null
  raw_data?: any
  source_type?: string
}): string | null {
  if (data.import_type?.trim()) return data.import_type.trim()
  if (data.source_type === 'personal_import' && data.raw_data?.sug_yevu) {
    const v = String(data.raw_data.sug_yevu).trim()
    if (v) return v
  }
  return null
}

/** Flat private-style mapping for cancelled / inactive registries */
function mapCancelledInactiveVehicleData(
  rawData: any,
  licenseNumber: string
): NonNullable<VehicleLookupResult['data']> {
  const degem = rawData.degem_nm != null ? String(rawData.degem_nm).trim() : ''
  const kinuy = rawData.kinuy_mishari != null ? String(rawData.kinuy_mishari).trim() : ''
  const model = degem || kinuy || null

  return {
    plateNumber: licenseNumber,
    manufacturer: rawData.tozeret_nm ? String(rawData.tozeret_nm).trim() || null : null,
    model,
    year: rawData.shnat_yitzur != null ? parseInt(String(rawData.shnat_yitzur), 10) : null,
    color: rawData.tzeva_rechev ? String(rawData.tzeva_rechev).trim() || null : null,
    fuelType: rawData.sug_delek_nm ? String(rawData.sug_delek_nm).trim() || null : null,
    totalWeight:
      rawData.mishkal_kolel != null && rawData.mishkal_kolel !== ''
        ? parseFloat(String(rawData.mishkal_kolel))
        : null,
    vehicleType: rawData.sug_rechev_nm ? String(rawData.sug_rechev_nm).trim() || null : null,
    driveType: null,
    driveTechnology: null,
    gearType: null,
    chassis: rawData.misgeret ? String(rawData.misgeret).trim() || null : null,
    importType: null,
    curbWeightKg: parseCurbWeightKg(rawData.mishkal_azmi),
    machineryType: null,
    selfWeight: null,
    totalWeightTon: null,
  }
}

function mapVehicleData(rawData: any, source: string, licenseNumber: string): VehicleLookupResult['data'] {
  const fields = FIELD_MAPPINGS[source]
  const isMachinery = source === 'machinery'
  
  const gearValue = rawData[fields.gearType]
  let gearType: string | null = null
  if (gearValue === 'A' || gearValue === 'אוטומטי') {
    gearType = 'אוטומטי'
  } else if (gearValue === 'M' || gearValue === 'ידני') {
    gearType = 'ידני'
  } else if (gearValue) {
    gearType = gearValue
  }
  
  return {
    plateNumber: licenseNumber,
    manufacturer: rawData[fields.manufacturer] || null,
    model: rawData[fields.model] || rawData['kinuy_mishari'] || null,
    year: rawData[fields.year] ? parseInt(rawData[fields.year], 10) : null,
    color: rawData[fields.color] || null,
    fuelType: rawData[fields.fuelType] || null,
    totalWeight: isMachinery ? null : (rawData[fields.totalWeight] ? parseFloat(rawData[fields.totalWeight]) : null),
    vehicleType: rawData[fields.vehicleType] || null,
    driveType: rawData[fields.driveType] || null,
    driveTechnology: rawData[fields.driveTechnology] || null,
    gearType: gearType,
    chassis: readChassisField(rawData, fields.chassis, source),
    importType:
      fields.importType && rawData[fields.importType]
        ? String(rawData[fields.importType]).trim() || null
        : null,
    curbWeightKg: source === 'heavy' ? parseCurbWeightKg(rawData.mishkal_azmi) : null,
    // שדות צמ"ה
    machineryType: isMachinery ? (rawData.sug_tzama_nm || null) : null,
    selfWeight: isMachinery ? (rawData.mishkal_ton ? parseFloat(rawData.mishkal_ton) : null) : null,
    totalWeightTon: isMachinery ? (rawData.mishkal_kolel_ton ? parseFloat(rawData.mishkal_kolel_ton) : null) : null,
  }
}

/**
 * שליפת מידע נוסף מהמאגר המורחב לרכב פרטי
 */
async function fetchExtraPrivateInfo(vehicle: any, signal?: AbortSignal): Promise<any> {
  try {
    const model = `${vehicle.tozeret_nm || ''} ${vehicle.kinuy_mishari || ''}`.trim()
    const query = encodeURIComponent(model)
    const url = `https://data.gov.il/api/3/action/datastore_search?resource_id=${API_RESOURCES.private_extra}&q=${query}`

    const data = await fetchJsonWithTimeout(url, signal)
    const ckan = parseCkanRecords(data)
    if (!ckan.ok || ckan.records.length === 0) {
      return null
    }

    const match = ckan.records.find(
      (record: any) =>
        record.shnat_yitzur == vehicle.shnat_yitzur &&
        record.degem_cd == vehicle.degem_cd &&
        record.nefach_manoa == vehicle.nefach_manoa,
    )

    if (match) {
      if ('automatic_ind' in match) {
        match.automatic_ind =
          match.automatic_ind === '1' || match.automatic_ind === 1 ? 'אוטומטי' : 'ידני'
      }
      return match
    }

    return null
  } catch (error) {
    console.error('Error fetching extra private info:', error)
    return null
  }
}

/**
 * Fallback after active-registry miss: cancelled registries, then inactive.
 * Not cached to Supabase — status may change if the vehicle is reactivated.
 */
async function searchCancelledOrInactive(
  licenseNumber: string,
): Promise<
  | { status: 'FOUND'; result: VehicleLookupResult }
  | { status: 'ABSENT' }
  | { status: 'ERROR' }
> {
  const probes: ResourceProbe[] = [
    {
      resourceId: API_RESOURCES.canceled_private,
      source: 'canceled_private',
      mapAs: 'private',
      sourceLabel: SOURCE_LABELS.private,
      registryStatus: 'cancelled',
      fuzzyQFallback: true,
    },
    {
      resourceId: API_RESOURCES.canceled_heavy,
      source: 'canceled_heavy',
      mapAs: 'heavy',
      sourceLabel: SOURCE_LABELS.heavy,
      registryStatus: 'cancelled',
      fuzzyQFallback: true,
    },
    {
      resourceId: API_RESOURCES.canceled_motorcycle,
      source: 'canceled_motorcycle',
      mapAs: 'motorcycle',
      sourceLabel: SOURCE_LABELS.motorcycle,
      registryStatus: 'cancelled',
      fuzzyQFallback: true,
    },
    {
      resourceId: API_RESOURCES.inactive,
      source: 'inactive',
      mapAs: 'private',
      sourceLabel: 'רכב לא פעיל',
      registryStatus: 'inactive',
    },
  ]

  const hit = await raceResourceProbes(licenseNumber, probes)
  if (hit.status === 'FOUND') {
    if (!hit.probe.mapAs) return { status: 'ERROR' }
    return {
      status: 'FOUND',
      result: {
        found: true,
        source: hit.probe.mapAs as VehicleLookupResult['source'],
        sourceLabel: hit.probe.sourceLabel ?? SOURCE_LABELS[hit.probe.mapAs],
        registryStatus: hit.probe.registryStatus,
        data: mapCancelledInactiveVehicleData(hit.data, licenseNumber),
      },
    }
  }
  return hit.status === 'ERROR' ? { status: 'ERROR' } : { status: 'ABSENT' }
}

/**
 * חיפוש רכב - קודם ב-Supabase, אח"כ ב-API
 */
export async function lookupVehicle(licenseNumber: string): Promise<VehicleLookupResult> {
  const cleanLicense = licenseNumber.replace(/[^0-9]/g, '')

  if (cleanLicense.length < 5) {
    return notFoundLookupResult('מספר רישוי קצר מדי')
  }

  // שלב 1: חיפוש ב-Supabase (מהיר) — positive cache
  const supabaseResult = await searchInSupabase(cleanLicense)
  if (supabaseResult) {
    console.log('✅ נמצא ב-Supabase')
    return supabaseResult
  }

  // שלב 1b: negative cache — skip external API if recently confirmed miss
  const recentMiss = await searchMissInSupabase(cleanLicense)
  if (recentMiss) {
    console.log('⏭️ שלילי ב-cache — דילוג על API')
    return notFoundLookupResult()
  }

  console.log('🔍 לא נמצא ב-Supabase, מחפש ב-API...')

  const activeProbes: ResourceProbe[] = [
    { resourceId: API_RESOURCES.private, source: 'private' },
    { resourceId: API_RESOURCES.motorcycle, source: 'motorcycle' },
    { resourceId: API_RESOURCES.heavy, source: 'heavy' },
    { resourceId: API_RESOURCES.machinery, source: 'machinery' },
    { resourceId: API_RESOURCES.personal_import, source: 'personal_import' },
  ]

  const activeHit = await raceResourceProbes(cleanLicense, activeProbes)
  if (activeHit.status === 'FOUND') {
    const source = activeHit.probe.source as keyof typeof FIELD_MAPPINGS
    const mappedData = mapVehicleData(activeHit.data, source, cleanLicense)

    if (source === 'private' && mappedData) {
      const extraData = await fetchExtraPrivateInfo(activeHit.data)
      if (extraData) {
        mappedData.totalWeight = extraData.mishkal_kolel
          ? parseFloat(extraData.mishkal_kolel)
          : mappedData.totalWeight
        mappedData.driveType = extraData.hanaa_nm || mappedData.driveType
        mappedData.driveTechnology =
          extraData.technologiat_hanaa_nm || mappedData.driveTechnology
        mappedData.gearType = extraData.automatic_ind || mappedData.gearType
      }
    }

    await saveToSupabase(cleanLicense, source, mappedData, activeHit.data)
    console.log('💾 נשמר ב-Supabase')

    return {
      found: true,
      source: source as VehicleType,
      sourceLabel: SOURCE_LABELS[source],
      data: mappedData,
    }
  }

  const cancelledOrInactive = await searchCancelledOrInactive(cleanLicense)
  if (cancelledOrInactive.status === 'FOUND') {
    console.log(`⚠️ נמצא במאגר ${cancelledOrInactive.result.registryStatus}`)
    return cancelledOrInactive.result
  }

  // Miss cache only on definitive registry-wide ABSENT (never on ERROR).
  if (activeHit.status === 'ERROR' || cancelledOrInactive.status === 'ERROR') {
    console.warn('⚠️ שגיאת מאגר — לא נשמר miss (יישלח שוב בחיפוש הבא)')
    return notFoundLookupResult(
      'לא ניתן לאמת מול מאגר משרד התחבורה כרגע — נסו שוב',
    )
  }

  void saveMissToSupabase(cleanLicense)

  return notFoundLookupResult()
}

/**
 * המרת סוג רכב מ-API לסוג פנימי
 */
export function getVehicleTypeFromSource(source: string | null): VehicleType {
  switch (source) {
    case 'private':
      return 'private'
    case 'motorcycle':
      return 'motorcycle'
    case 'heavy':
      return 'heavy'
    case 'machinery':
      return 'machinery'
    case 'personal_import':
      return 'personal_import'
    default:
      return 'private'
  }
}

/**
 * קבלת תווית סוג רכב
 */
export function getVehicleTypeLabel(type: VehicleType): string {
  const labels: Record<VehicleType, string> = {
    private: 'רכב פרטי',
    motorcycle: 'דו גלגלי',
    heavy: 'רכב כבד',
    machinery: 'צמ"ה',
    personal_import: 'יבוא אישי',
  }
  return labels[type] || 'רכב פרטי'
}

export function isKnownVehicleType(value: unknown): value is VehicleType {
  return (
    value === 'private' ||
    value === 'motorcycle' ||
    value === 'heavy' ||
    value === 'machinery' ||
    value === 'personal_import'
  )
}

/**
 * אייקון לסוג רכב
 */
export function getVehicleTypeIcon(type: VehicleType): string {
  const icons: Record<VehicleType, string> = {
    private: '🚗',
    motorcycle: '🏍️',
    heavy: '🚚',
    machinery: '🚜',
    personal_import: '🚗',
  }
  return icons[type] || '🚗'
}