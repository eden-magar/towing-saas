// סקריפט לסנכרון מאגר private_extra לטבלת vehicle_models
import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const RESOURCE_ID = '142afde2-6228-49f9-8a29-9b6c3a0cbe40'
const BATCH_SIZE = 5000
const INSERT_BATCH = 1000

async function fetchBatch(offset: number) {
  const url = `https://data.gov.il/api/3/action/datastore_search?resource_id=${RESOURCE_ID}&limit=${BATCH_SIZE}&offset=${offset}`
  const response = await fetch(url)
  const data = await response.json()
  return data.result
}

async function syncVehicleModels() {
  console.log('🚀 מתחיל סנכרון מאגר דגמי רכב...')
  
  // בדיקת גודל המאגר
  const initialResult = await fetchBatch(0)
  const totalRecords = initialResult.total
  console.log(`📊 סה"כ רשומות במאגר: ${totalRecords.toLocaleString()}`)

  let offset = 0
  let totalInserted = 0
  const startTime = Date.now()

  while (offset < totalRecords) {
    const result = await fetchBatch(offset)
    const records = result.records

    if (!records || records.length === 0) break

    // מיפוי הנתונים והסרת כפילויות
    const modelsMap = new Map()
    
    records.forEach((record: any) => {
      let gearType = record.automatic_ind
      if (gearType === '1' || gearType === 1) {
        gearType = 'אוטומטי'
      } else if (gearType === '0' || gearType === 0 || gearType === 'M') {
        gearType = 'ידני'
      } else if (gearType === 'A') {
        gearType = 'אוטומטי'
      }

      const manufacturer = record.tozeret_nm || null
      const model = record.kinuy_mishari || null
      const year = record.shnat_yitzur ? parseInt(record.shnat_yitzur) : null

      if (!manufacturer || !model) return

      const key = `${manufacturer}_${model}_${year}`
      
      // שמירת רק הרשומה הראשונה לכל שילוב ייחודי
      if (!modelsMap.has(key)) {
        modelsMap.set(key, {
          manufacturer,
          model,
          year,
          total_weight: record.mishkal_kolel ? parseFloat(record.mishkal_kolel) : null,
          drive_type: record.hanaa_nm || null,
          drive_technology: record.technologiat_hanaa_nm || null,
          gear_type: gearType || null,
          engine_volume: record.nefach_manoa || null,
          model_code: record.degem_cd || null,
          raw_data: record
        })
      }
    })

    const models = Array.from(modelsMap.values())

    // הכנסה לסופרבייס בבאצ'ים
    for (let i = 0; i < models.length; i += INSERT_BATCH) {
      const batch = models.slice(i, i + INSERT_BATCH)
      
      const { error } = await supabase
        .from('vehicle_models')
        .upsert(batch, { 
          onConflict: 'manufacturer,model,year',
          ignoreDuplicates: false 
        })

      if (error) {
        console.error('שגיאה בהכנסה:', error.message)
      } else {
        totalInserted += batch.length
      }
    }

    offset += BATCH_SIZE
    const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1)
    console.log(`⏳ ${offset.toLocaleString()}/${totalRecords.toLocaleString()} (${elapsed} דקות)`)

    // המתנה קצרה
    await new Promise(r => setTimeout(r, 500))
  }

  const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1)
  console.log(`\n✅ סנכרון הושלם!`)
  console.log(`📊 נוספו/עודכנו: ${totalInserted.toLocaleString()} דגמים`)
  console.log(`⏱️ זמן כולל: ${totalTime} דקות`)
}

syncVehicleModels()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('שגיאה:', err)
    process.exit(1)
  })