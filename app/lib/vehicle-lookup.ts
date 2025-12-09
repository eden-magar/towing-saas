// ==================== Vehicle Lookup Service ====================
// שירות חיפוש פרטי רכב ממאגרי משרד התחבורה (data.gov.il)

import { VehicleLookupResult, VehicleType } from './types'

// מזהי המאגרים ב-data.gov.il
const API_RESOURCES = {
  private: '053cea08-09bc-40ec-8f7a-156f0677aff3',      // רכב פרטי
  motorcycle: 'bf9df4e2-d90d-4c0a-a400-19e15af8e95f',   // דו גלגלי / טרקטורון
  heavy: 'cd3acc5c-03c3-4c89-9c54-d40f93c0d790',        // רכב כבד (מעל 3.5 טון)
  machinery: '58dc4654-16b1-42ed-8170-98fadec153ea',    // צמ"ה
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
  },
  motorcycle: {
    manufacturer: 'tozeret_nm',
    model: 'degem_nm',
    year: 'shnat_yitzur',
    color: 'tzeva_rechev',
    fuelType: 'sug_delek_nm',
    totalWeight: 'mishkal_kolel',
    vehicleType: 'sug_rechev_nm',
  },
  heavy: {
    manufacturer: 'tozeret_nm',
    model: 'degem_nm',
    year: 'shnat_yitzur',
    color: 'tzeva_rechev',
    fuelType: 'sug_delek_nm',
    totalWeight: 'mishkal_kolel',
    vehicleType: 'sug_rechev_nm',
  },
  machinery: {
    manufacturer: 'shilda_totzar_en_nm',
    model: 'degem_nm',
    year: 'shnat_yitzur',
    color: '',
    fuelType: '',
    totalWeight: 'mishkal_kolel_ton',
    vehicleType: 'sug_tzama_nm',
  },
}

/**
 * חיפוש רכב במאגר ספציפי
 */
async function searchInResource(
  licenseNumber: string,
  resourceId: string,
  source: string
): Promise<{ found: boolean; data: any }> {
  try {
    // ניקוי מספר הרישוי
    const cleanLicense = licenseNumber.replace(/[^0-9]/g, '')
    
    // ניסיון ראשון - חיפוש עם filter
    const url1 = `https://data.gov.il/api/3/action/datastore_search?resource_id=${resourceId}&filters={"mispar_rechev":"${parseInt(cleanLicense, 10).toString()}"}`
    
    const response1 = await fetch(url1)
    const data1 = await response1.json()
    
    if (data1.success && data1.result?.records?.length > 0) {
      return { found: true, data: data1.result.records[0] }
    }
    
    // ניסיון שני - חיפוש כללי
    const url2 = `https://data.gov.il/api/3/action/datastore_search?resource_id=${resourceId}&q=${cleanLicense}`
    
    const response2 = await fetch(url2)
    const data2 = await response2.json()
    
    if (data2.success && data2.result?.records?.length > 0) {
      // בדיקה שהרשומה מכילה את מספר הרישוי
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
  
  return {
    plateNumber: licenseNumber,
    manufacturer: rawData[fields.manufacturer] || null,
    model: rawData[fields.model] || rawData['kinuy_mishari'] || null,
    year: rawData[fields.year] ? parseInt(rawData[fields.year], 10) : null,
    color: rawData[fields.color] || null,
    fuelType: rawData[fields.fuelType] || null,
    totalWeight: rawData[fields.totalWeight] ? parseFloat(rawData[fields.totalWeight]) : null,
    vehicleType: rawData[fields.vehicleType] || null,
  }
}

/**
 * חיפוש רכב בכל המאגרים
 * מחזיר את הרכב מהמאגר הראשון שמצא אותו
 */
export async function lookupVehicle(licenseNumber: string): Promise<VehicleLookupResult> {
  // ניקוי מספר הרישוי
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
  
  // סדר החיפוש: פרטי, דו גלגלי, כבד, צמ"ה
  const searchOrder: Array<keyof typeof API_RESOURCES> = ['private', 'motorcycle', 'heavy', 'machinery']
  
  for (const source of searchOrder) {
    const result = await searchInResource(cleanLicense, API_RESOURCES[source], source)
    
    if (result.found) {
      return {
        found: true,
        source: source as VehicleType,
        sourceLabel: SOURCE_LABELS[source],
        data: mapVehicleData(result.data, source, cleanLicense),
      }
    }
  }
  
  // לא נמצא באף מאגר
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