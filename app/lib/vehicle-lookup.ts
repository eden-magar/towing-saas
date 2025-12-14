// ==================== Vehicle Lookup Service ====================
// שירות חיפוש פרטי רכב - קודם ב-Supabase, אח"כ ב-data.gov.il

import { VehicleLookupResult, VehicleType } from './types'
import { supabase } from './supabase'

// מזהי המאגרים ב-data.gov.il
const API_RESOURCES = {
  private: '053cea08-09bc-40ec-8f7a-156f0677aff3',
  motorcycle: 'bf9df4e2-d90d-4c0a-a400-19e15af8e95f',
  heavy: 'cd3acc5c-03c3-4c89-9c54-d40f93c0d790',
  machinery: '58dc4654-16b1-42ed-8170-98fadec153ea',
  private_extra: '142afde2-6228-49f9-8a29-9b6c3a0cbe40',
}

// תוויות לסוגי רכב
const SOURCE_LABELS: Record<string, string> = {
  private: 'רכב פרטי',
  motorcycle: 'דו גלגלי',
  heavy: 'רכב כבד',
  machinery: 'צמ"ה',
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
  },
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
 * שמירת רכב ב-Supabase (לאחר מציאה ב-API)
 */
async function saveToSupabase(
  licenseNumber: string,
  sourceType: string,
  mappedData: VehicleLookupResult['data'],
  rawData: any
): Promise<void> {
  try {
    await supabase.from('vehicles').upsert({
      license_number: licenseNumber,
      source_type: sourceType,
      manufacturer: mappedData?.manufacturer,
      model: mappedData?.model,
      year: mappedData?.year,
      color: mappedData?.color,
      fuel_type: mappedData?.fuelType,
      total_weight: mappedData?.totalWeight,
      vehicle_type: mappedData?.vehicleType,
      drive_type: mappedData?.driveType,
      drive_technology: mappedData?.driveTechnology,
      gear_type: mappedData?.gearType,
      raw_data: rawData,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'license_number' })
  } catch (error) {
    console.error('Error saving to Supabase:', error)
  }
}

/**
 * חיפוש רכב במאגר ספציפי ב-API
 */
async function searchInResource(
  licenseNumber: string,
  resourceId: string,
  source: string
): Promise<{ found: boolean; data: any }> {
  try {
    const cleanLicense = licenseNumber.replace(/[^0-9]/g, '')
    
    const url1 = `https://data.gov.il/api/3/action/datastore_search?resource_id=${resourceId}&filters={"mispar_rechev":"${parseInt(cleanLicense, 10).toString()}"}`
    
    const response1 = await fetch(url1)
    const data1 = await response1.json()
    
    if (data1.success && data1.result?.records?.length > 0) {
      return { found: true, data: data1.result.records[0] }
    }
    
    const url2 = `https://data.gov.il/api/3/action/datastore_search?resource_id=${resourceId}&q=${cleanLicense}`
    
    const response2 = await fetch(url2)
    const data2 = await response2.json()
    
    if (data2.success && data2.result?.records?.length > 0) {
      const record = data2.result.records.find((rec: any) => {
        const recLicense = String(rec.mispar_rechev || '').replace(/[^0-9]/g, '')
        return recLicense === cleanLicense || recLicense === parseInt(cleanLicense, 10).toString()
      })
      
      if (record) {
        return { found: true, data: record }
      }
    }
    
    return { found: false, data: null }
  } catch (error) {
    console.error(`Error searching in ${source}:`, error)
    return { found: false, data: null }
  }
}

/**
 * מיפוי נתונים גולמיים לפורמט אחיד
 */
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
    // שדות צמ"ה
    machineryType: isMachinery ? (rawData.sug_tzama_nm || null) : null,
    selfWeight: isMachinery ? (rawData.mishkal_ton ? parseFloat(rawData.mishkal_ton) : null) : null,
    totalWeightTon: isMachinery ? (rawData.mishkal_kolel_ton ? parseFloat(rawData.mishkal_kolel_ton) : null) : null,
  }
}

/**
 * שליפת מידע נוסף מהמאגר המורחב לרכב פרטי
 */
async function fetchExtraPrivateInfo(vehicle: any): Promise<any> {
  try {
    const model = `${vehicle.tozeret_nm || ''} ${vehicle.kinuy_mishari || ''}`.trim()
    const query = encodeURIComponent(model)
    const url = `https://data.gov.il/api/3/action/datastore_search?resource_id=${API_RESOURCES.private_extra}&q=${query}`
    
    const response = await fetch(url)
    const data = await response.json()
    
    if (data.success && data.result?.records?.length > 0) {
      const match = data.result.records.find((record: any) =>
        record.shnat_yitzur == vehicle.shnat_yitzur &&
        record.degem_cd == vehicle.degem_cd &&
        record.nefach_manoa == vehicle.nefach_manoa
      )
      
      if (match) {
        if ('automatic_ind' in match) {
          match.automatic_ind = match.automatic_ind === '1' || match.automatic_ind === 1
            ? 'אוטומטי'
            : 'ידני'
        }
        return match
      }
    }
    
    return null
  } catch (error) {
    console.error('Error fetching extra private info:', error)
    return null
  }
}

/**
 * חיפוש רכב - קודם ב-Supabase, אח"כ ב-API
 */
export async function lookupVehicle(licenseNumber: string): Promise<VehicleLookupResult> {
  const cleanLicense = licenseNumber.replace(/[^0-9]/g, '')
  
  if (cleanLicense.length < 5) {
    return {
      found: false,
      source: null,
      sourceLabel: '',
      data: null,
      error: 'מספר רישוי קצר מדי',
    }
  }

  // שלב 1: חיפוש ב-Supabase (מהיר)
  const supabaseResult = await searchInSupabase(cleanLicense)
  if (supabaseResult) {
    console.log('✅ נמצא ב-Supabase')
    return supabaseResult
  }

  console.log('🔍 לא נמצא ב-Supabase, מחפש ב-API...')
  
  // שלב 2: Fallback ל-API
  const searchOrder: Array<keyof typeof API_RESOURCES> = ['private', 'motorcycle', 'heavy', 'machinery']
  
  for (const source of searchOrder) {
    const result = await searchInResource(cleanLicense, API_RESOURCES[source], source)
    
    if (result.found) {
      const mappedData = mapVehicleData(result.data, source, cleanLicense)
      
      if (source === 'private' && mappedData) {
        const extraData = await fetchExtraPrivateInfo(result.data)
        if (extraData) {
          mappedData.totalWeight = extraData.mishkal_kolel ? parseFloat(extraData.mishkal_kolel) : mappedData.totalWeight
          mappedData.driveType = extraData.hanaa_nm || mappedData.driveType
          mappedData.driveTechnology = extraData.technologiat_hanaa_nm || mappedData.driveTechnology
          mappedData.gearType = extraData.automatic_ind || mappedData.gearType
        }
      }

      // שמירה ב-Supabase לפעם הבאה
      await saveToSupabase(cleanLicense, source, mappedData, result.data)
      console.log('💾 נשמר ב-Supabase')
      
      return {
        found: true,
        source: source as VehicleType,
        sourceLabel: SOURCE_LABELS[source],
        data: mappedData,
      }
    }
  }
  
  return {
    found: false,
    source: null,
    sourceLabel: '',
    data: null,
    error: 'הרכב לא נמצא במאגרי משרד התחבורה',
  }
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
  }
  return labels[type] || 'רכב פרטי'
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
  }
  return icons[type] || '🚗'
}