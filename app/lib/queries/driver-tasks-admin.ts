import { supabase } from '@/app/lib/supabase'
import { DriverTaskWithDetails, TaskType, TaskSubtype } from '@/app/lib/types'

// ===== Task Types =====

export async function getTaskTypes(companyId: string): Promise<TaskType[]> {
  const { data, error } = await supabase
    .from('task_types')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('name')
  if (error) throw error
  return data || []
}

export async function createTaskType(
  companyId: string,
  name: string,
  color: string
): Promise<TaskType> {
  const { data, error } = await supabase
    .from('task_types')
    .insert({ company_id: companyId, name, color })
    .select()
    .single()
  if (error) throw error
  return data
}

// ===== Task Subtypes =====

export async function getTaskSubtypes(
  companyId: string,
  taskTypeId?: string
): Promise<TaskSubtype[]> {
  let query = supabase
    .from('task_subtypes')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('name')
  if (taskTypeId) {
    query = query.eq('task_type_id', taskTypeId)
  }
  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function createTaskSubtype(
  companyId: string,
  taskTypeId: string,
  name: string
): Promise<TaskSubtype> {
  const { data, error } = await supabase
    .from('task_subtypes')
    .insert({ company_id: companyId, task_type_id: taskTypeId, name })
    .select()
    .single()
  if (error) throw error
  return data
}

// ===== Driver Tasks =====

export async function getDriverTasks(
  companyId: string
): Promise<DriverTaskWithDetails[]> {
  const { data, error } = await supabase
    .from('driver_tasks')
    .select(`
      *,
      task_type:task_types(*),
      task_subtype:task_subtypes(*),
      driver:drivers(
        id,
        user:users(full_name)
      ),
      truck:tow_trucks(id, plate_number),
      created_by_user:users!driver_tasks_created_by_fkey(full_name)
    `)
    .eq('company_id', companyId)
    .order('due_at', { ascending: true })
  if (error) throw error
  return data || []
}

export async function createDriverTask(payload: {
  company_id: string
  task_type_id: string | null
  task_subtype_id: string | null
  driver_id: string | null
  truck_id: string | null
  created_by: string
  title: string | null
  description: string | null
  location_address: string | null
  location_lat: number | null
  location_lng: number | null
  contact_name: string | null
  contact_phone: string | null
  due_at: string
}): Promise<void> {
  const { error } = await supabase
    .from('driver_tasks')
    .insert(payload)
  if (error) throw error
}

export async function updateDriverTask(
  taskId: string,
  payload: Partial<{
    task_type_id: string | null
    task_subtype_id: string | null
    driver_id: string | null
    truck_id: string | null
    title: string | null
    description: string | null
    location_address: string | null
    location_lat: number | null
    location_lng: number | null
    contact_name: string | null
    contact_phone: string | null
    due_at: string
    status: string
    rejected_reason: string | null
    completed_at: string | null
    completion_note: string | null
  }>
): Promise<void> {
  const { error } = await supabase
    .from('driver_tasks')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', taskId)
  if (error) throw error
}

export async function deleteDriverTask(taskId: string): Promise<void> {
  const { error } = await supabase
    .from('driver_tasks')
    .delete()
    .eq('id', taskId)
  if (error) throw error
}