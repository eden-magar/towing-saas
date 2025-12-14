// scripts/sync-vehicles.ts
// סקריפט לסנכרון נתוני רכבים מ-data.gov.il ל-Supabase
import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

// הגדרות
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// מזהי המאגרים
const RESOURCES = {
  private: '053cea08-09bc-40ec-8f7a-156f0677aff3',
  motorcycle: 'bf9df4e2-d90d-4c0a-a400-19e15af8e95f',
  heavy: 'cd3acc5c-03c3-4c89-9c54-d40f93c0d790',
  machinery: '58dc4654-16b1-42ed-8170-98fadec153ea',
}

// מיפוי שדות לפי סוג מאגר
const FIELD_MAPPINGS: Record<string, Record<string, string>> = {
  private: {
    license: 'mispar_rechev',
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
    license: 'mispar_rechev',
    manufacturer: 'tozeret_nm',
    model: 'degem_nm',
    year: 'shnat_yitzur',
    color: 'tzeva_rechev',
    fuelType: 'sug_delek_nm',
    totalWeight: 'mishkal_kolel',
    vehicleType: 'sug_rechev_nm',
    driveType: 'hanaa_nm',
  },
  heavy: {
    license: 'mispar_rechev',
    manufacturer: 'tozeret_nm',
    model: 'degem_nm',
    year: 'shnat_yitzur',
    color: 'tzeva_rechev',
    fuelType: 'sug_delek_nm',
    totalWeight: 'mishkal_kolel',
    vehicleType: 'kvutzat_sug_rechev',
    driveType: 'hanaa_nm',
  },
  machinery: {
    license: 'mispar_tzama',
    manufacturer: 'shilda_totzar_en_nm',
    model: 'degem_nm',
    year: 'shnat_yitzur',
    totalWeight: 'mishkal_kolel_ton',
    vehicleType: 'sug_tzama_nm',
    driveType: 'hanaa_nm',
  },
}

// פונקציה להמרת רשומה לפורמט אחיד
function mapRecord(record: any, sourceType: string) {
  const fields = FIELD_MAPPINGS[sourceType]
  
  let gearType = null
  if (fields.gearType && record[fields.gearType]) {
    const val = record[fields.gearType]
    gearType = val === 'A' ? 'אוטומטי' : val === 'M' ? 'ידני' : val
  }

  return {
    license_number: String(record[fields.license] || ''),
    source_type: sourceType,
    manufacturer: record[fields.manufacturer] || null,
    model: record[fields.model] || null,
    year: record[fields.year] ? parseInt(record[fields.year]) : null,
    color: record[fields.color] || null,
    fuel_type: record[fields.fuelType] || null,
    total_weight: record[fields.totalWeight] ? parseFloat(record[fields.totalWeight]) : null,
    vehicle_type: record[fields.vehicleType] || null,
    drive_type: record[fields.driveType] || null,
    drive_technology: record[fields.driveTechnology] || null,
    gear_type: gearType,
    raw_data: record,
  }
}

// פונקציה לשליפת נתונים מ-data.gov.il
async function fetchFromDataGov(resourceId: string, offset: number, limit: number) {
  const url = `https://data.gov.il/api/3/action/datastore_search?resource_id=${resourceId}&limit=${limit}&offset=${offset}`
  const response = await fetch(url)
  const data = await response.json()
  
  if (!data.success) {
    throw new Error(`API error: ${JSON.stringify(data.error)}`)
  }
  
  return data.result
}

// פונקציה להכנסת batch ל-Supabase
async function insertBatch(records: any[]) {
  const { error } = await supabase
    .from('vehicles')
    .upsert(records, { onConflict: 'license_number' })
  
  if (error) {
    console.error('Insert error:', error.message)
    return false
  }
  return true
}

// פונקציה לסנכרון מאגר בודד
async function syncResource(sourceType: string, resourceId: string) {
  console.log(`\n📦 מתחיל סנכרון: ${sourceType}`)
  
  const BATCH_SIZE = 5000 // כמה רשומות לשלוף בכל קריאה
  const INSERT_SIZE = 1000 // כמה רשומות להכניס בכל batch
  
  let offset = 0
  let totalInserted = 0
  let hasMore = true
  
  while (hasMore) {
    try {
      // שליפה מ-API
      const result = await fetchFromDataGov(resourceId, offset, BATCH_SIZE)
      const records = result.records
      
      if (records.length === 0) {
        hasMore = false
        break
      }
      
      // המרה והכנסה ב-batches
      const mapped = records.map((r: any) => mapRecord(r, sourceType))
      
      for (let i = 0; i < mapped.length; i += INSERT_SIZE) {
        const batch = mapped.slice(i, i + INSERT_SIZE)
        await insertBatch(batch)
        totalInserted += batch.length
      }
      
      console.log(`  ✓ ${totalInserted.toLocaleString()} רשומות (offset: ${offset})`)
      
      offset += BATCH_SIZE
      
      // השהייה קטנה למניעת rate limit
      await new Promise(resolve => setTimeout(resolve, 500))
      
    } catch (error) {
      console.error(`  ✗ שגיאה ב-offset ${offset}:`, error)
      // ממשיכים לבatch הבא
      offset += BATCH_SIZE
    }
  }
  
  console.log(`✅ ${sourceType}: סה"כ ${totalInserted.toLocaleString()} רשומות`)
  return totalInserted
}

// פונקציה ראשית
async function main() {
  console.log('🚗 מתחיל סנכרון נתוני רכבים...\n')
  console.log('=' .repeat(50))
  
  const startTime = Date.now()
  let grandTotal = 0
  
  // סנכרון כל המאגרים
  for (const [sourceType, resourceId] of Object.entries(RESOURCES)) {
    const count = await syncResource(sourceType, resourceId)
    grandTotal += count
  }
  
  const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1)
  
  console.log('\n' + '='.repeat(50))
  console.log(`🎉 סיום! סה"כ ${grandTotal.toLocaleString()} רשומות ב-${duration} דקות`)
}

// הרצה
main().catch(console.error)