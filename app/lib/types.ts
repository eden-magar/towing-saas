// ==================== ENUMS ====================

export type UserRole = 'super_admin' | 'company_admin' | 'dispatcher' | 'driver' | 'customer'

export type DriverStatus = 'available' | 'on_way' | 'busy' | 'unavailable' | 'break'

export type TruckType = 'carrier' | 'carrier_large' | 'crane_tow' | 'dolly' | 'flatbed' | 'heavy_equipment' | 'heavy_rescue' | 'wheel_lift_cradle'

export type CustomerType = 'private' | 'business'

export type PaymentTerms = 'immediate' | 'monthly'

export type TowType = 'simple' | 'with_base' | 'transfer' | 'multi_vehicle' | 'exchange'

export type TowStatus = 'quote' | 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled'

// סוגי רכב - מעודכן לפי מאגרי משרד התחבורה
export type VehicleType = 'private' | 'motorcycle' | 'heavy' | 'machinery'

export type LegType = 'empty_drive' | 'pickup' | 'delivery'

export type LegStatus = 'pending' | 'in_progress' | 'completed'

export type ImageType = 'before_pickup' | 'after_pickup' | 'before_dropoff' | 'after_dropoff' | 'damage' | 'other'

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'cancelled'

export type NotificationType = 'new_tow' | 'status_update' | 'payment' | 'system'

// ==================== BASE TABLES ====================

export interface Company {
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

export interface User {
  id: string
  email: string
  phone: string | null
  full_name: string
  role: UserRole
  company_id: string | null
  is_active: boolean
  id_number: string | null      
  address: string | null       
  created_at: string
  updated_at: string
}

export interface Driver {
  id: string
  user_id: string
  company_id: string
  license_number: string | null
  license_expiry: string | null
  status: DriverStatus
  license_type: string | null
  license_categories: string[]
  license_permits: string[]
  years_experience: number | null  
  notes: string | null
  work_hours_start: string | null
  work_hours_end: string | null
  created_at: string
  updated_at: string
}

export interface TowTruck {
  id: string
  company_id: string
  plate_number: string
  truck_type: TruckType
  vehicle_capacity: number
  max_weight_kg: number | null
  is_active: boolean
  notes: string | null
  // שדות חדשים:
  manufacturer: string | null
  model: string | null
  year: number | null
  color: string | null
  license_expiry: string | null
  insurance_expiry: string | null
  test_expiry: string | null
  // 
  created_at: string
  updated_at: string
}

export interface DriverTruckAssignment {
  id: string
  driver_id: string
  truck_id: string
  assigned_at: string
  unassigned_at: string | null
  is_current: boolean
}

export interface Customer {
  id: string
  user_id: string | null
  customer_type: CustomerType
  name: string
  id_number: string | null
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface CustomerCompany {
  id: string
  customer_id: string
  company_id: string
  payment_terms: PaymentTerms
  credit_limit: number | null
  notes: string | null
  is_active: boolean
  created_at: string
}

export interface CustomerContact {
  id: string
  company_id: string
  customer_id: string
  name: string
  phone: string | null
  role_or_title: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface CustomerContactInput {
  name: string
  phone?: string | null
  role_or_title?: string | null
  notes?: string | null
}

export interface PriceList {
  id: string
  company_id: string
  customer_company_id: string | null
  name: string
  // מעודכן לפי סוגי רכב חדשים
  base_price_private: number | null
  base_price_motorcycle: number | null
  base_price_heavy: number | null
  base_price_machinery: number | null
  price_per_km: number | null
  minimum_price: number | null
  night_surcharge_percent: number | null
  weekend_surcharge_percent: number | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Tow {
  id: string
  company_id: string
  customer_id: string | null
  driver_id: string | null
  second_driver_id: string | null
  second_driver_scheduled_at: string | null
  truck_id: string | null
  created_by: string
  tow_type: TowType
  status: TowStatus
  scheduled_at: string | null
  scheduled_end_at: string | null
  notes: string | null
  recommended_price: number | null
  final_price: number | null
  price_list_id: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
  order_number: string | null
  customer_order_number: string | null
  department: string | null
  ordered_by: string | null
  linked_tow_id: string | null
  payment_method: string | null
  cash_collected: number | null
  manually_closed_at: string | null
  manually_closed_by: string | null
}

export interface TowVehicle {
  id: string
  tow_id: string
  plate_number: string
  manufacturer: string | null
  model: string | null
  year: number | null
  vehicle_type: VehicleType
  color: string | null
  is_working: boolean
  tow_reason: string | null
  notes: string | null
  order_index: number
  created_at: string
}

export interface TowLeg {
  id: string
  tow_id: string
  tow_vehicle_id: string | null
  leg_type: LegType
  leg_order: number
  from_address: string | null
  from_lat: number | null
  from_lng: number | null
  to_address: string | null
  to_lat: number | null
  to_lng: number | null
  distance_km: number | null
  status: LegStatus
  started_at: string | null
  completed_at: string | null
  notes: string | null
  created_at: string
}

export interface TowStatusHistory {
  id: string
  tow_id: string
  tow_leg_id: string | null
  status: string
  changed_by: string
  notes: string | null
  created_at: string
}

export interface TowImage {
  id: string
  tow_id: string
  tow_vehicle_id: string | null
  uploaded_by: string
  image_url: string
  image_type: ImageType
  notes: string | null
  created_at: string
}

export interface Invoice {
  id: string
  company_id: string
  customer_id: string
  tow_id: string | null
  invoice_number: string
  external_invoice_id: string | null
  amount: number
  vat_amount: number
  total_amount: number
  status: InvoiceStatus
  issued_at: string
  due_date: string | null
  paid_at: string | null
  created_at: string
  updated_at: string
}

export interface InvoiceItem {
  id: string
  invoice_id: string
  tow_id: string | null
  description: string
  amount: number
}

export interface Notification {
  id: string
  user_id: string
  title: string
  body: string
  type: NotificationType
  is_read: boolean
  data: Record<string, unknown> | null
  created_at: string
}

export interface AuditLog {
  id: string
  user_id: string
  action: string
  table_name: string
  record_id: string
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  ip_address: string | null
  created_at: string
}

export interface SystemSettings {
  id: string
  key: string
  value: Record<string, unknown>
  description: string | null
  updated_at: string
}

export interface CompanySettings {
  id: string
  company_id: string
  kapaset_api_key: string | null
  sms_provider: string | null
  sms_api_key: string | null
  default_vat_percent: number | null
  working_hours_start: string | null
  working_hours_end: string | null
  night_hours_start: string | null
  night_hours_end: string | null
  created_at: string
  updated_at: string
}

// ==================== VEHICLE LOOKUP (data.gov.il) ====================

export interface VehicleLookupResult {
  found: boolean
  source: 'private' | 'motorcycle' | 'heavy' | 'machinery' | null
  sourceLabel: string
  data: {
    plateNumber: string
    manufacturer: string | null    // tozeret_nm
    model: string | null           // kinuy_mishari / degem_nm
    year: number | null            // shnat_yitzur
    color: string | null           // tzeva_rechev
    fuelType: string | null        // sug_delek_nm
    totalWeight: number | null     // mishkal_kolel
    vehicleType: string | null     // sug_rechev_nm
    driveType: string | null       // hanaa_nm - הנעה
    driveTechnology: string | null // technologiat_hanaa_nm - טכנולוגיית הנעה
    gearType: string | null        // automatic_ind - סוג גיר
    // שדות צמ"ה
    machineryType: string | null   // sug_tzama_nm - סוג צמ"ה
    selfWeight: number | null      // mishkal_ton - משקל עצמי
    totalWeightTon: number | null  // mishkal_kolel_ton - משקל כולל בטון
  } | null
  error?: string
}

// ==================== COMPOSITE TYPES (for JOINs) ====================

/** Driver linked to a truck (assignment join shape). */
export interface TruckAssignedDriver {
  id: string
  user: {
    full_name: string
    phone: string | null
  }
}

export interface DriverWithDetails extends Driver {
  user: User
  current_trucks: TowTruck[]
  today_tows_count?: number
}

export interface TowWithDetails extends Tow {
  customer: Customer | null
  driver: DriverWithDetails | null
  truck: TowTruck | null
  vehicles: TowVehicle[]
  legs: TowLeg[]
}

export interface CustomerWithCompanyDetails extends Customer {
  customer_company: CustomerCompany | null
}

export interface TruckWithDetails extends TowTruck {
  assigned_drivers: TruckAssignedDriver[]
  today_tows_count: number
  total_tows_count: number
}

// =====================================================
// להוסיף ל-types.ts - טייפים חדשים עבור tow_points
// =====================================================

// --- ENUMS ---

export type PointType = 'pickup' | 'dropoff' | 'exchange' | 'stop'

/**
 * Tow point lifecycle status.
 *
 * Runtime values written by `updatePointStatus`:
 *   pending → arrived → completed (or skipped)
 *
 * `en_route` is reserved: the customer portal already renders a label and
 * styling for it ("נהג בדרך"), but the driver flow currently goes directly
 * from `pending` to `arrived` without writing `en_route`. Kept in the type
 * so a future "driver en route" feature can be wired without re-adding it.
 */
export type PointStatus = 'pending' | 'en_route' | 'arrived' | 'completed' | 'skipped'

export type PointVehicleAction = 'pickup' | 'dropoff'

export type PointImageType = 'general' | 'vehicle' | 'damage' | 'signature' | 'other'


// --- BASE TABLES ---

export interface TowPoint {
  id: string
  tow_id: string
  point_order: number
  point_type: PointType
  
  // כתובת
  address: string | null
  lat: number | null
  lng: number | null
  
  // איש קשר
  contact_name: string | null
  contact_phone: string | null
  
  // סטטוס
  status: PointStatus
  arrived_at: string | null
  completed_at: string | null
  
  // מסירה (רק לפריקה)
  recipient_name: string | null
  recipient_phone: string | null
  
  notes: string | null
  order_notes?: string | null
  driver_visited_at?: string | null
  driver_notes?: string | null
  is_storage?: boolean
  /** Set when point_type is stop; null for pickup/dropoff/exchange */
  stop_subtype?:
    | 'key'
    | 'customer_pickup'
    | 'customer_dropoff'
    | 'other'
    | 'customer'
    | 'general'
    | null
  created_at: string
  updated_at: string
}

export interface TowPointVehicle {
  id: string
  tow_point_id: string
  tow_vehicle_id: string
  action: PointVehicleAction
  created_at: string
}

export interface TowPointImage {
  id: string
  tow_point_id: string
  tow_vehicle_id: string | null
  uploaded_by: string
  image_url: string
  image_type: PointImageType
  notes: string | null
  created_at: string
}


// --- COMPOSITE TYPES ---

export interface TowPointWithDetails extends TowPoint {
  vehicles: (TowPointVehicle & {
    vehicle: TowVehicle
  })[]
  images: TowPointImage[]
}

export interface TowWithPoints extends Tow {
  customer: Customer | null
  driver: DriverWithDetails | null
  truck: TowTruck | null
  vehicles: TowVehicle[]
  points: TowPointWithDetails[]
  // Fallback לגרירות ישנות
  legs?: TowLeg[]
}


// --- DRIVER APP TYPES ---

export interface DriverTowPoint {
  id: string
  point_order: number
  point_type: PointType
  address: string
  contact_name: string | null
  contact_phone: string | null
  status: PointStatus
  arrived_at: string | null
  completed_at: string | null
  vehicles: {
    id: string
    plate_number: string
    manufacturer: string | null
    model: string | null
    color: string | null
    action: PointVehicleAction
  }[]
  images_count: number
}

export interface DriverActiveTow {
  id: string
  tow_type: TowType
  status: TowStatus
  scheduled_at: string | null
  created_at: string
  notes: string | null
  customer: {
    name: string
    phone: string | null
  } | null
  points: DriverTowPoint[]
  total_vehicles: number
}


// ==================== CUSTOMER PORTAL ====================

export type CustomerUserRole = 'admin' | 'manager' | 'viewer'

export interface CustomerUser {
  id: string
  customer_id: string
  user_id: string
  role: CustomerUserRole
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CustomerUserWithDetails extends CustomerUser {
  user: {
    full_name: string
    email: string
    phone: string | null
  }
}

export interface CustomerPortalTow {
  id: string
  order_number: string | null
  customer_order_number: string | null
  status: TowStatus
  tow_type: TowType
  scheduled_at: string | null
  created_at: string
  started_at: string | null
  completed_at: string | null
  vehicles: {
    plate_number: string
    manufacturer: string | null
    model: string | null
    color: string | null
  }[]
  points: {
    id: string
    point_order: number
    point_type: PointType
    stop_subtype?: 'key' | 'customer_pickup' | 'customer_dropoff' | 'other' | null
    address: string | null
    status: PointStatus
    arrived_at: string | null
    completed_at: string | null
  }[]
  driver: {
    full_name: string
    phone: string | null
  } | null
}

export interface CustomerPortalTowDetail extends CustomerPortalTow {
  notes: string | null
  visibility_overrides: Record<string, boolean> | null
  final_price: number | null
  points: (CustomerPortalTow['points'][0] & {
    contact_name: string | null
    contact_phone: string | null
    recipient_name: string | null
    recipient_phone: string | null
    notes: string | null
  })[]
  images: {
    id: string
    image_url: string
    image_type: ImageType
    tow_point_id: string | null
    tow_vehicle_id: string | null
    created_at: string
  }[]
}

// ==================== קופה קטנה ====================
export type CashTransactionType = 'collection' | 'transfer' | 'approval'

export interface DriverCashTransaction {
  id: string
  driver_id: string
  tow_id: string | null
  amount: number
  type: CashTransactionType
  notes: string | null
  created_at: string
  created_by: string
}

export interface TowChangeLog {
  id: string
  tow_id: string
  changed_by: string
  changed_at: string
  field_name: string
  old_value: string | null
  new_value: string | null
  user?: {
    full_name: string
  }
}

// ===== Driver Tasks =====

export type TaskStatus = 'pending' | 'accepted' | 'in_progress' | 'done' | 'rejected'

export interface TaskType {
  id: string
  company_id: string
  name: string
  color: string
  is_active: boolean
  created_at: string
}

export interface TaskSubtype {
  id: string
  company_id: string
  task_type_id: string
  name: string
  is_active: boolean
  created_at: string
}

export interface DriverTask {
  id: string
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
  status: TaskStatus
  rejected_reason: string | null
  completed_at: string | null
  completion_note: string | null
  created_at: string
  updated_at: string
}

export interface DriverTaskWithDetails extends DriverTask {
  task_type: TaskType | null
  task_subtype: TaskSubtype | null
  driver: {
    id: string
    user: {
      full_name: string
    }
  } | null
  truck: {
    id: string
    plate_number: string
  } | null
  created_by_user: {
    full_name: string
  } | null
}

export interface DriverTaskImage {
  id: string
  task_id: string
  uploaded_by: string | null
  file_url: string
  notes: string | null
  created_at: string
}