import { supabase } from '../supabase'

// ==================== TYPES ====================

export interface CompanyDetails {
  id: string
  name: string
  business_number: string | null
  phone: string | null
  email: string | null
  address: string | null
  logo_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CompanySettings {
  id: string
  company_id: string
  kapaset_api_key: string | null
  sms_provider: string | null
  sms_api_key: string | null
  default_vat_percent: number
  working_hours_start: string | null
  working_hours_end: string | null
  night_hours_start: string | null
  night_hours_end: string | null
  evening_hours_start: string | null
  evening_hours_end: string | null
  shabbat_start: string | null
  shabbat_end: string | null
  base_address: string | null
  base_lat: number | null
  base_lng: number | null
  created_at: string
  updated_at: string
}

// ==================== GET COMPANY DETAILS ====================

export async function getCompanyDetails(companyId: string): Promise<CompanyDetails | null> {
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('id', companyId)
    .single()

  if (error) {
    console.error('Error fetching company details:', error)
    return null
  }

  return data
}

// ==================== UPDATE COMPANY DETAILS ====================

interface UpdateCompanyInput {
  name?: string
  business_number?: string
  phone?: string
  email?: string
  address?: string
  logo_url?: string
}

export async function updateCompanyDetails(
  companyId: string, 
  input: UpdateCompanyInput
): Promise<void> {
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (input.name !== undefined) updates.name = input.name
  if (input.business_number !== undefined) updates.business_number = input.business_number
  if (input.phone !== undefined) updates.phone = input.phone
  if (input.email !== undefined) updates.email = input.email
  if (input.address !== undefined) updates.address = input.address
  if (input.logo_url !== undefined) updates.logo_url = input.logo_url

  const { error } = await supabase
    .from('companies')
    .update(updates)
    .eq('id', companyId)

  if (error) {
    console.error('Error updating company details:', error)
    throw error
  }
}

// ==================== GET COMPANY SETTINGS ====================

export async function getCompanySettings(companyId: string): Promise<CompanySettings | null> {
  const { data, error } = await supabase
    .from('company_settings')
    .select('*')
    .eq('company_id', companyId)
    .single()

  if (error) {
    // If no settings exist, create default ones
    if (error.code === 'PGRST116') {
      return createDefaultSettings(companyId)
    }
    console.error('Error fetching company settings:', error)
    return null
  }

  return data
}

// ==================== CREATE DEFAULT SETTINGS ====================

async function createDefaultSettings(companyId: string): Promise<CompanySettings | null> {
  const defaultSettings = {
    company_id: companyId,
    default_vat_percent: 18,
    working_hours_start: '08:00',
    working_hours_end: '18:00',
    evening_hours_start: '15:00',
    evening_hours_end: '19:00',
    night_hours_start: '19:00',
    night_hours_end: '07:00',
    shabbat_start: '14:00',
    shabbat_end: '20:00'
  }

  const { data, error } = await supabase
    .from('company_settings')
    .insert(defaultSettings)
    .select()
    .single()

  if (error) {
    console.error('Error creating default settings:', error)
    return null
  }

  return data
}

// ==================== UPDATE COMPANY SETTINGS ====================

interface UpdateSettingsInput {
  default_vat_percent?: number
  working_hours_start?: string
  working_hours_end?: string
  night_hours_start?: string
  night_hours_end?: string
  evening_hours_start?: string
  evening_hours_end?: string
  shabbat_start?: string
  shabbat_end?: string
  base_address?: string
  base_lat?: number
  base_lng?: number
}

export async function updateCompanySettings(
  companyId: string, 
  input: UpdateSettingsInput
): Promise<void> {
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (input.default_vat_percent !== undefined) updates.default_vat_percent = input.default_vat_percent
  if (input.working_hours_start !== undefined) updates.working_hours_start = input.working_hours_start
  if (input.working_hours_end !== undefined) updates.working_hours_end = input.working_hours_end
  if (input.night_hours_start !== undefined) updates.night_hours_start = input.night_hours_start
  if (input.night_hours_end !== undefined) updates.night_hours_end = input.night_hours_end
  if (input.evening_hours_start !== undefined) updates.evening_hours_start = input.evening_hours_start
  if (input.evening_hours_end !== undefined) updates.evening_hours_end = input.evening_hours_end
  if (input.shabbat_start !== undefined) updates.shabbat_start = input.shabbat_start
  if (input.shabbat_end !== undefined) updates.shabbat_end = input.shabbat_end
  if (input.base_address !== undefined) updates.base_address = input.base_address
  if (input.base_lat !== undefined) updates.base_lat = input.base_lat
  if (input.base_lng !== undefined) updates.base_lng = input.base_lng

  const { error } = await supabase
    .from('company_settings')
    .update(updates)
    .eq('company_id', companyId)

  if (error) {
    console.error('Error updating company settings:', error)
    throw error
  }
}

// ==================== UPDATE INTEGRATIONS ====================

interface UpdateIntegrationsInput {
  kapaset_api_key?: string
  sms_provider?: string
  sms_api_key?: string
}

export async function updateIntegrations(
  companyId: string, 
  input: UpdateIntegrationsInput
): Promise<void> {
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (input.kapaset_api_key !== undefined) updates.kapaset_api_key = input.kapaset_api_key
  if (input.sms_provider !== undefined) updates.sms_provider = input.sms_provider
  if (input.sms_api_key !== undefined) updates.sms_api_key = input.sms_api_key

  const { error } = await supabase
    .from('company_settings')
    .update(updates)
    .eq('company_id', companyId)

  if (error) {
    console.error('Error updating integrations:', error)
    throw error
  }
}

// ==================== UPLOAD LOGO ====================

export async function uploadCompanyLogo(
  companyId: string, 
  file: File
): Promise<string> {
  const fileExt = file.name.split('.').pop()
  const fileName = `${companyId}/logo.${fileExt}`

  // Upload to storage
  const { error: uploadError } = await supabase.storage
    .from('company-logos')
    .upload(fileName, file, { upsert: true })

  if (uploadError) {
    console.error('Error uploading logo:', uploadError)
    throw uploadError
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('company-logos')
    .getPublicUrl(fileName)

  const logoUrl = urlData.publicUrl

  // Update company record
  await updateCompanyDetails(companyId, { logo_url: logoUrl })

  return logoUrl
}

// ==================== DELETE LOGO ====================

export async function deleteCompanyLogo(companyId: string): Promise<void> {
  // List files in company folder
  const { data: files, error: listError } = await supabase.storage
    .from('company-logos')
    .list(companyId)

  if (listError) {
    console.error('Error listing logo files:', listError)
    throw listError
  }

  // Delete all files in folder
  if (files && files.length > 0) {
    const filePaths = files.map(f => `${companyId}/${f.name}`)
    const { error: deleteError } = await supabase.storage
      .from('company-logos')
      .remove(filePaths)

    if (deleteError) {
      console.error('Error deleting logo files:', deleteError)
      throw deleteError
    }
  }

  // Update company record
  await updateCompanyDetails(companyId, { logo_url: '' })
}