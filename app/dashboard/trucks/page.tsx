'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { Plus, Search, Truck, Edit2, Trash2, X, User, CheckCircle, Clock, AlertTriangle, Wrench, XCircle, Upload, Eye, MoreHorizontal } from 'lucide-react'
import { useAuth } from '../../lib/AuthContext'
import { getTrucks, createTruck, updateTruck, deleteTruck, checkTruckDuplicate, uploadTruckDocument, getTruckDocumentSignedUrl } from '../../lib/queries/trucks'
import { TruckWithDetails, TruckAssignedDriver } from '../../lib/types'
import { DateInput } from '../../components/ui'
import { getDrivers } from '../../lib/queries/drivers'
import { DriverWithDetails } from '../../lib/types'
import { normalizePlate } from '../../lib/utils/plate-number'

type TruckDocFields = TruckWithDetails & {
  license_photo_url?: string | null
  tachograph_expiry?: string | null
  tachograph_photo_url?: string | null
  engineer_report_expiry?: string | null
  engineer_report_photo_url?: string | null
}

function formatVehicleLine(truck: TruckWithDetails) {
  if (!truck.manufacturer) return '-'
  const parts = [truck.manufacturer, truck.model].filter(Boolean).join(' ')
  return truck.year ? `${parts} · ${truck.year}` : parts
}

function formatExpiryTooltip(dateStr: string | null) {
  if (!dateStr) return 'תאריך לא הוזן'
  return `תוקף עד ${new Date(dateStr).toLocaleDateString('he-IL')}`
}

function getExpiryPillClasses(
  dateStr: string | null,
  isExpired: (d: string | null) => boolean,
  isExpiringSoon: (d: string | null) => boolean
) {
  if (!dateStr) return 'bg-gray-50 text-gray-500'
  if (isExpired(dateStr)) return 'bg-red-50 text-red-700'
  if (isExpiringSoon(dateStr)) return 'bg-amber-50 text-amber-700'
  return 'bg-emerald-50 text-emerald-700'
}

function getDriverInitials(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '??'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function DriverInitialsAvatar({ fullName }: { fullName: string }) {
  return (
    <span
      className="w-6 h-6 shrink-0 rounded-full bg-blue-50 text-blue-700 text-[10px] font-medium inline-flex items-center justify-center"
      aria-hidden
    >
      {getDriverInitials(fullName)}
    </span>
  )
}

function TableDriversCell({ assignedDrivers }: { assignedDrivers: TruckAssignedDriver[] }) {
  if (assignedDrivers.length === 0) {
    return <span className="text-sm text-stone-400">ללא נהג משויך</span>
  }
  const first = assignedDrivers[0]
  if (assignedDrivers.length === 1) {
    return (
      <span className="inline-flex items-center gap-[7px] text-sm text-stone-800">
        <DriverInitialsAvatar fullName={first.user.full_name} />
        {first.user.full_name}
      </span>
    )
  }
  const allNames = assignedDrivers.map((d) => d.user.full_name).join(', ')
  return (
    <span className="inline-flex items-center gap-[7px] text-sm text-stone-800" title={allNames}>
      <DriverInitialsAvatar fullName={first.user.full_name} />
      <span>
        {first.user.full_name}
        <span className="text-stone-400"> +{assignedDrivers.length - 1}</span>
      </span>
    </span>
  )
}

function TableVehicleCell({ truck }: { truck: TruckWithDetails }) {
  if (!truck.manufacturer) {
    return <span className="text-sm text-stone-500">-</span>
  }
  const line1 = [truck.manufacturer, truck.model].filter(Boolean).join(' ')
  return (
    <div>
      <p className="text-sm text-stone-800 leading-tight">{line1}</p>
      {truck.year != null && truck.year > 0 && (
        <p className="text-[11px] text-stone-500 leading-tight mt-0.5">{truck.year}</p>
      )}
    </div>
  )
}

function TableStatusPill({
  status,
}: {
  status: 'available' | 'busy' | 'maintenance' | 'inactive'
}) {
  const styles: Record<typeof status, { bg: string; text: string; label: string }> = {
    busy: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'בפעילות' },
    available: { bg: 'bg-stone-100', text: 'text-stone-600', label: 'פנוי' },
    inactive: { bg: 'bg-stone-100', text: 'text-stone-400', label: 'לא פעיל' },
    maintenance: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'בטיפול' },
  }
  const s = styles[status]
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}
    >
      <span className="w-[5px] h-[5px] rounded-full bg-current shrink-0" />
      {s.label}
    </span>
  )
}

function TowCountCell({ value }: { value: number }) {
  const n = value || 0
  return (
    <span
      className={`tabular-nums text-sm ${n === 0 ? 'text-stone-400' : 'text-stone-800 font-medium'}`}
    >
      {n}
    </span>
  )
}

function CompactDriversCell({ assignedDrivers }: { assignedDrivers: TruckAssignedDriver[] }) {
  if (assignedDrivers.length === 0) {
    return <span className="text-sm text-gray-400">ללא נהג משויך</span>
  }
  if (assignedDrivers.length === 1) {
    return <span className="text-sm text-gray-800">{assignedDrivers[0].user.full_name}</span>
  }
  const allNames = assignedDrivers.map((d) => d.user.full_name).join(', ')
  return (
    <span className="text-sm text-gray-800" title={allNames}>
      {assignedDrivers[0].user.full_name} +{assignedDrivers.length - 1}
    </span>
  )
}

function ExpiryPillsRow({
  truck,
  isExpired,
  isExpiringSoon,
  onViewDocument,
  viewingDocument,
  compact = false,
}: {
  truck: TruckDocFields
  isExpired: (d: string | null) => boolean
  isExpiringSoon: (d: string | null) => boolean
  onViewDocument: (path: string | null | undefined, e?: React.MouseEvent) => void
  viewingDocument: boolean
  compact?: boolean
}) {
  const pills = [
    {
      key: 'license',
      label: 'רישיון',
      date: truck.license_expiry,
      photoUrl: truck.license_photo_url,
      docTitle: 'צפה ברישיון רכב',
    },
    {
      key: 'insurance',
      label: 'ביטוח',
      date: truck.insurance_expiry,
    },
    {
      key: 'tachograph',
      label: 'טכוגרף',
      date: truck.tachograph_expiry ?? null,
      photoUrl: truck.tachograph_photo_url,
      docTitle: 'צפה בתעודת כיול טכוגרף',
    },
    {
      key: 'engineer',
      label: 'תסקיר',
      date: truck.engineer_report_expiry ?? null,
      photoUrl: truck.engineer_report_photo_url,
      docTitle: 'צפה בתסקיר מהנדס',
    },
  ] as const

  return (
    <div
      className={
        compact
          ? 'flex flex-nowrap gap-1 whitespace-nowrap'
          : 'flex flex-wrap gap-1'
      }
    >
      {pills.map((pill) => (
        <span
          key={pill.key}
          title={formatExpiryTooltip(pill.date)}
          className={`inline-flex shrink-0 items-center gap-0.5 font-medium ${getExpiryPillClasses(
            pill.date,
            isExpired,
            isExpiringSoon
          )} ${
            compact
              ? 'text-[10px] px-[7px] py-0.5 rounded-[5px]'
              : 'text-xs px-1.5 py-0.5 rounded'
          }`}
        >
          {pill.label}
          {'photoUrl' in pill && pill.photoUrl && (
            <button
              type="button"
              title={pill.docTitle}
              onClick={(e) => onViewDocument(pill.photoUrl, e)}
              disabled={viewingDocument}
              className="p-0 leading-none rounded hover:bg-black/5 disabled:opacity-50"
            >
              <Eye size={12} className="w-3 h-3" />
            </button>
          )}
        </span>
      ))}
    </div>
  )
}

export default function TrucksPage() {
  const { companyId } = useAuth()
  const searchParams = useSearchParams()
  const editFromQueryHandled = useRef<string | null>(null)

  // Data states
  const [trucks, setTrucks] = useState<TruckWithDetails[]>([])
  const [drivers, setDrivers] = useState<DriverWithDetails[]>([])
  const [pageLoading, setPageLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // UI states
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'carrier' | 'carrier_large' | 'crane_tow' | 'dolly' | 'flatbed' | 'heavy_equipment' | 'heavy_rescue' | 'wheel_lift_cradle'>('all')  
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'busy' | 'maintenance'>('all')
  const [showModal, setShowModal] = useState(false)
  const [editingTruck, setEditingTruck] = useState<TruckWithDetails | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false)
  const [showExpiryWarning, setShowExpiryWarning] = useState(false)
  const [expiryWarningMessage, setExpiryWarningMessage] = useState('')
  const [uploading, setUploading] = useState<string | null>(null)
  const [viewingDocument, setViewingDocument] = useState(false)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  // File refs
  const licensePhotoRef = useRef<HTMLInputElement>(null)
  const tachographPhotoRef = useRef<HTMLInputElement>(null)
  const engineerReportPhotoRef = useRef<HTMLInputElement>(null)

  const [formData, setFormData] = useState({
    plate: '',
    type: '' as '' | 'carrier' | 'carrier_large' | 'crane_tow' | 'dolly' | 'flatbed' | 'heavy_equipment' | 'heavy_rescue' | 'wheel_lift_cradle',
    manufacturer: '',
    model: '',
    year: new Date().getFullYear(),
    color: '',
    maxWeight: 0,
    permittedWeight: 0,
    upperPlatformWeight: 0,
    lowerPlatformWeight: 0,
    vehicleCapacity: 1,
    licenseExpiry: '',
    insuranceExpiry: '',
    licensePhotoUrl: '',
    tachographExpiry: '',
    tachographPhotoUrl: '',
    engineerReportExpiry: '',
    engineerReportPhotoUrl: '',
    lastWinterInspection: '',
    driverAssignment: 'none' as 'existing' | 'none',
    selectedDriverIds: [] as string[],
    initialStatus: 'available' as 'available' | 'inactive',
    notes: '',
  })

  const typeConfig: Record<string, { label: string; color: string; iconBg: string }> = {
    carrier: { label: 'מובילית', color: 'bg-blue-100 text-blue-600', iconBg: 'bg-blue-100' },
    carrier_large: { label: 'מובילית 10+', color: 'bg-indigo-100 text-indigo-600', iconBg: 'bg-indigo-100' },
    crane_tow: { label: 'גרר מנוף', color: 'bg-purple-100 text-purple-600', iconBg: 'bg-purple-100' },
    dolly: { label: 'דולי', color: 'bg-pink-100 text-pink-600', iconBg: 'bg-pink-100' },
    flatbed: { label: 'רמסע', color: 'bg-cyan-100 text-cyan-600', iconBg: 'bg-cyan-100' },
    heavy_equipment: { label: 'ציוד כבד', color: 'bg-amber-100 text-amber-600', iconBg: 'bg-amber-100' },
    heavy_rescue: { label: 'חילוץ כבד', color: 'bg-red-100 text-red-600', iconBg: 'bg-red-100' },
    wheel_lift_cradle: { label: 'משקפיים', color: 'bg-emerald-100 text-emerald-600', iconBg: 'bg-emerald-100' },
  }

  const statusConfig = {
    available: { label: 'פנוי', color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
    busy: { label: 'בפעילות', color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
    maintenance: { label: 'בטיפול', color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
    inactive: { label: 'לא פעיל', color: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' },
  }

  useEffect(() => {
    if (companyId) {
      loadData()
    }
  }, [companyId])

  const loadData = async () => {
    if (!companyId) return

    setPageLoading(true)
    try {
      const [trucksData, driversData] = await Promise.all([
        getTrucks(companyId),
        getDrivers(companyId)
      ])
      setTrucks(trucksData)
      setDrivers(driversData)
    } catch (err) {
      console.error('Error loading data:', err)
      setError('שגיאה בטעינת הנתונים')
    } finally {
      setPageLoading(false)
    }
  }

  const getTruckStatus = (truck: TruckWithDetails): 'available' | 'busy' | 'maintenance' | 'inactive' => {
    if (!truck.is_active) return 'inactive'
    if (truck.assigned_drivers.length > 0) return 'busy'
    return 'available'
  }

  const stats = {
    total: trucks.length,
    available: trucks.filter(t => t.is_active && t.assigned_drivers.length === 0).length,
    busy: trucks.filter(t => t.is_active && t.assigned_drivers.length > 0).length,
    maintenance: 0,
  }

  const filteredTrucks = trucks.filter(truck => {
    const status = getTruckStatus(truck)
    if (typeFilter !== 'all' && truck.truck_type !== typeFilter) return false
    if (statusFilter !== 'all' && status !== statusFilter) return false
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const plateQuery = normalizePlate(searchQuery)
      const matchesPlate =
        plateQuery.length > 0 &&
        normalizePlate(truck.plate_number).includes(plateQuery)
      if (!matchesPlate &&
          !(truck.manufacturer?.toLowerCase().includes(query)) &&
          !(truck.model?.toLowerCase().includes(query))) {
        return false
      }
    }
    return true
  })

  const isExpired = (dateStr: string | null) => {
    if (!dateStr) return false
    const date = new Date(dateStr)
    return date < new Date()
  }

  const isExpiringSoon = (dateStr: string | null) => {
    if (!dateStr) return false
    const date = new Date(dateStr)
    const today = new Date()
    const thirtyDays = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
    return date > today && date <= thirtyDays
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    return date.toLocaleDateString('he-IL')
  }

  const resetForm = () => {
    setFormData({
      plate: '',
      type: '',
      manufacturer: '',
      model: '',
      year: new Date().getFullYear(),
      color: '',
      maxWeight: 0,
      permittedWeight: 0,
      upperPlatformWeight: 0,
      lowerPlatformWeight: 0,
      vehicleCapacity: 1,
      licenseExpiry: '',
      insuranceExpiry: '',
      licensePhotoUrl: '',
      tachographExpiry: '',
      tachographPhotoUrl: '',
      engineerReportExpiry: '',
      engineerReportPhotoUrl: '',
      lastWinterInspection: '',
      driverAssignment: 'none',
      selectedDriverIds: [],
      initialStatus: 'available',
      notes: '',
    })
    setShowExpiryWarning(false)
    setShowDuplicateWarning(false)
    setError('')
  }

  const openAddModal = () => {
    setEditingTruck(null)
    resetForm()
    setShowModal(true)
  }

  const openEditModal = (truck: TruckWithDetails) => {
    setEditingTruck(truck)
    const truckData = truck as any
    setFormData({
      plate: truck.plate_number,
      type: truck.truck_type as any,
      manufacturer: truck.manufacturer || '',
      model: truck.model || '',
      year: truck.year || new Date().getFullYear(),
      color: truck.color || '',
      maxWeight: truck.max_weight_kg || 0,
      permittedWeight: truckData.permitted_weight_kg || 0,
      upperPlatformWeight: truckData.upper_platform_weight_kg || 0,
      lowerPlatformWeight: truckData.lower_platform_weight_kg || 0,
      vehicleCapacity: truck.vehicle_capacity,
      licenseExpiry: truck.license_expiry || '',
      insuranceExpiry: truck.insurance_expiry || '',
      licensePhotoUrl: truckData.license_photo_url || '',
      tachographExpiry: truckData.tachograph_expiry || '',
      tachographPhotoUrl: truckData.tachograph_photo_url || '',
      engineerReportExpiry: truckData.engineer_report_expiry || '',
      engineerReportPhotoUrl: truckData.engineer_report_photo_url || '',
      lastWinterInspection: truckData.last_winter_inspection || '',
      driverAssignment: truck.assigned_drivers.length > 0 ? 'existing' : 'none',
      selectedDriverIds: truck.assigned_drivers.map((d) => d.id),
      initialStatus: truck.is_active ? 'available' : 'inactive',
      notes: truck.notes || '',
    })
    setShowModal(true)
  }

  useEffect(() => {
    const editId = searchParams.get('edit')
    if (!editId) {
      editFromQueryHandled.current = null
      return
    }
    if (pageLoading || trucks.length === 0) return
    if (editFromQueryHandled.current === editId) return
    const truck = trucks.find((t) => t.id === editId)
    if (truck) {
      editFromQueryHandled.current = editId
      openEditModal(truck)
    }
  }, [searchParams, pageLoading, trucks])

  const handleFileUpload = async (file: File, docType: string) => {
    if (!companyId || !formData.plate) {
      setError('יש להזין מספר רישוי לפני העלאת קבצים')
      return
    }

    setUploading(docType)
    try {
      const path = await uploadTruckDocument(file, companyId, formData.plate, docType)
      
      switch (docType) {
        case 'license':
          setFormData(prev => ({ ...prev, licensePhotoUrl: path }))
          break
        case 'tachograph':
          setFormData(prev => ({ ...prev, tachographPhotoUrl: path }))
          break
        case 'engineer_report':
          setFormData(prev => ({ ...prev, engineerReportPhotoUrl: path }))
          break
      }
    } catch (err) {
      console.error('Error uploading file:', err)
      setError('שגיאה בהעלאת הקובץ')
    } finally {
      setUploading(null)
    }
  }

  const handleViewDocument = async (
    pathOrUrl: string | null | undefined,
    e?: React.MouseEvent
  ) => {
    e?.stopPropagation()
    if (!pathOrUrl || viewingDocument) return
    setViewingDocument(true)
    try {
      const signedUrl = await getTruckDocumentSignedUrl(pathOrUrl)
      if (!signedUrl) {
        alert('לא ניתן לטעון את המסמך')
        return
      }
      window.open(signedUrl, '_blank', 'noopener,noreferrer')
    } catch {
      alert('לא ניתן לטעון את המסמך')
    } finally {
      setViewingDocument(false)
    }
  }

  const checkExpiryDates = () => {
    const warnings = []
    if (isExpired(formData.licenseExpiry)) warnings.push('רישיון רכב')
    if (warnings.length > 0) {
      setExpiryWarningMessage(warnings.join(' ו') + ' פג תוקף!')
      return true
    }
    return false
  }

  const handleSave = async () => {
    if (!formData.plate || !formData.type || !companyId) return

    const isDuplicate = await checkTruckDuplicate(
      companyId,
      normalizePlate(formData.plate),
      editingTruck?.id
    )

    if (isDuplicate) {
      setShowDuplicateWarning(true)
      return
    }

    if (checkExpiryDates() && !showExpiryWarning) {
      setShowExpiryWarning(true)
      return
    }

    setSaving(true)
    setError('')

    try {
      if (editingTruck) {
        await updateTruck({
          truckId: editingTruck.id,
          plateNumber: formData.plate,
          truckType: formData.type,
          manufacturer: formData.manufacturer || undefined,
          model: formData.model || undefined,
          year: formData.year || undefined,
          color: formData.color || undefined,
          vehicleCapacity: formData.vehicleCapacity,
          maxWeightKg: formData.maxWeight || undefined,
          permittedWeightKg: formData.permittedWeight || undefined,
          upperPlatformWeightKg: formData.upperPlatformWeight || undefined,
          lowerPlatformWeightKg: formData.lowerPlatformWeight || undefined,
          licenseExpiry: formData.licenseExpiry || undefined,
          insuranceExpiry: formData.insuranceExpiry || undefined,
          licensePhotoUrl: formData.licensePhotoUrl || undefined,
          tachographExpiry: formData.tachographExpiry || undefined,
          tachographPhotoUrl: formData.tachographPhotoUrl || undefined,
          engineerReportExpiry: formData.engineerReportExpiry || undefined,
          engineerReportPhotoUrl: formData.engineerReportPhotoUrl || undefined,
          lastWinterInspection: formData.lastWinterInspection || undefined,
          notes: formData.notes || undefined,
          isActive: formData.initialStatus === 'available',
          driverIds: formData.driverAssignment === 'existing' ? formData.selectedDriverIds : [],
        })
      } else {
        await createTruck({
          companyId,
          plateNumber: formData.plate,
          truckType: formData.type,
          manufacturer: formData.manufacturer || undefined,
          model: formData.model || undefined,
          year: formData.year || undefined,
          color: formData.color || undefined,
          vehicleCapacity: formData.vehicleCapacity,
          maxWeightKg: formData.maxWeight || undefined,
          permittedWeightKg: formData.permittedWeight || undefined,
          upperPlatformWeightKg: formData.upperPlatformWeight || undefined,
          lowerPlatformWeightKg: formData.lowerPlatformWeight || undefined,
          licenseExpiry: formData.licenseExpiry || undefined,
          insuranceExpiry: formData.insuranceExpiry || undefined,
          licensePhotoUrl: formData.licensePhotoUrl || undefined,
          tachographExpiry: formData.tachographExpiry || undefined,
          tachographPhotoUrl: formData.tachographPhotoUrl || undefined,
          engineerReportExpiry: formData.engineerReportExpiry || undefined,
          engineerReportPhotoUrl: formData.engineerReportPhotoUrl || undefined,
          lastWinterInspection: formData.lastWinterInspection || undefined,
          notes: formData.notes || undefined,
          isActive: formData.initialStatus === 'available',
          driverIds:
            formData.driverAssignment === 'existing' && formData.selectedDriverIds.length > 0
              ? formData.selectedDriverIds
              : undefined,
        })
      }

      await loadData()
      setShowModal(false)
      resetForm()
    } catch (err) {
      console.error('Error saving truck:', err)
      setError('שגיאה בשמירת הגרר')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (truckId: string) => {
    try {
      await deleteTruck(truckId)
      await loadData()
      setShowDeleteConfirm(null)
    } catch (err) {
      console.error('Error deleting truck:', err)
      setError('שגיאה במחיקת הגרר')
    }
  }

  const selectableDrivers = drivers.filter((d) => d.status !== 'unavailable')

  const toggleSelectedDriver = (driverId: string) => {
    setFormData((prev) => {
      const nextIds = prev.selectedDriverIds.includes(driverId)
        ? prev.selectedDriverIds.filter((id) => id !== driverId)
        : [...prev.selectedDriverIds, driverId]
      return {
        ...prev,
        selectedDriverIds: nextIds,
        driverAssignment: nextIds.length > 0 ? 'existing' : 'none',
      }
    })
  }

  // מחיקת קובץ מה-state
  const handleFileDelete = (docType: string) => {
    switch (docType) {
      case 'license':
        setFormData(prev => ({ ...prev, licensePhotoUrl: '' }))
        break
      case 'tachograph':
        setFormData(prev => ({ ...prev, tachographPhotoUrl: '' }))
        break
      case 'engineer_report':
        setFormData(prev => ({ ...prev, engineerReportPhotoUrl: '' }))
        break
    }
  }

  // קומפוננטת העלאת קובץ
  const FileUploadField = ({ 
    label, 
    docType, 
    currentUrl, 
    inputRef 
  }: { 
    label: string
    docType: string
    currentUrl: string
    inputRef: React.RefObject<HTMLInputElement>
  }) => (
    <div>
      <label className="block text-sm text-gray-600 mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="file"
          ref={inputRef}
          accept="image/*,.pdf"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFileUpload(file, docType)
          }}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading === docType || !formData.plate}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 border rounded-lg transition-colors disabled:opacity-50 ${
            currentUrl 
              ? 'border-emerald-300 bg-emerald-50 text-emerald-700' 
              : 'border-gray-200 hover:bg-gray-50 text-gray-600'
          }`}
        >
          {uploading === docType ? (
            <div className="w-4 h-4 border-2 border-[#33d4ff] border-t-transparent rounded-full animate-spin" />
          ) : currentUrl ? (
            <CheckCircle size={16} className="text-emerald-600" />
          ) : (
            <Upload size={16} />
          )}
          <span className="text-sm">
            {uploading === docType ? 'מעלה...' : currentUrl ? 'החלף קובץ' : 'העלה קובץ'}
          </span>
        </button>
        {currentUrl && (
          <>
            <button
              type="button"
              onClick={() => handleViewDocument(currentUrl)}
              disabled={viewingDocument}
              className="p-2 text-[#33d4ff] hover:bg-cyan-50 rounded-lg transition-colors disabled:opacity-50"
              title="צפה בקובץ"
            >
              <Eye size={18} />
            </button>
            <button
              type="button"
              onClick={() => handleFileDelete(docType)}
              className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              title="מחק קובץ"
            >
              <Trash2 size={18} />
            </button>
          </>
        )}
      </div>
      {!formData.plate && (
        <p className="text-xs text-amber-600 mt-1">יש להזין מספר רישוי קודם</p>
      )}
    </div>
  )

  if (pageLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-[#33d4ff] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-gray-500">טוען גררים...</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl">
          {error}
        </div>
      )}

      <div className="mb-6">
        <div className="flex items-center justify-between mb-4 lg:mb-0">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800">ניהול גררים</h1>
            <p className="text-gray-500 mt-1 text-sm hidden sm:block">צפייה וניהול צי הגררים</p>
          </div>
          <button
            onClick={openAddModal}
            className="hidden lg:flex items-center justify-center gap-2 px-4 py-2.5 bg-[#33d4ff] hover:bg-[#21b8e6] text-white rounded-xl transition-colors"
          >
            <Plus size={20} />
            הוסף גרר
          </button>
        </div>
        <button
          onClick={openAddModal}
          className="lg:hidden flex items-center justify-center gap-2 px-4 py-2.5 bg-[#33d4ff] hover:bg-[#21b8e6] text-white rounded-xl transition-colors w-full"
        >
          <Plus size={20} />
          הוסף גרר
        </button>
      </div>

      {/* סטטיסטיקות */}
      <div className="grid grid-cols-4 gap-2 sm:gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-1">
            <Truck size={18} className="text-blue-600" />
          </div>
          <p className="text-lg sm:text-2xl font-bold text-gray-800">{stats.total}</p>
          <p className="text-xs text-gray-500">סה״כ</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-emerald-100 rounded-lg flex items-center justify-center mx-auto mb-1">
            <CheckCircle size={18} className="text-emerald-600" />
          </div>
          <p className="text-lg sm:text-2xl font-bold text-gray-800">{stats.available}</p>
          <p className="text-xs text-gray-500">פנויים</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-1">
            <Clock size={18} className="text-blue-600" />
          </div>
          <p className="text-lg sm:text-2xl font-bold text-gray-800">{stats.busy}</p>
          <p className="text-xs text-gray-500">בפעילות</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-amber-100 rounded-lg flex items-center justify-center mx-auto mb-1">
            <Wrench size={18} className="text-amber-600" />
          </div>
          <p className="text-lg sm:text-2xl font-bold text-gray-800">{stats.maintenance}</p>
          <p className="text-xs text-gray-500">בטיפול</p>
        </div>
      </div>

      {/* סינון וחיפוש */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="חיפוש לפי מספר רישוי, יצרן או דגם..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-10 pl-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white min-w-[140px]"
            >
              <option value="all">כל הסוגים</option>
              <option value="crane_tow">גרר מנוף</option>
              <option value="dolly">דולי (מערסל ידני)</option>
              <option value="heavy_rescue">חילוץ כבד</option>
              <option value="carrier">מובילית</option>
              <option value="carrier_large">מובילית 10+ רכבים</option>
              <option value="wheel_lift_cradle">משקפיים (מערסל)</option>
              <option value="heavy_equipment">ציוד כבד/לובי</option>
              <option value="flatbed">רמסע</option>
            </select>
          </div>
        </div>
      </div>

      {/* רשימת גררים */}
      {filteredTrucks.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-12 text-center">
          <Truck size={48} className="mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-800 mb-2">לא נמצאו גררים</h3>
          <p className="text-gray-500">נסה לשנות את החיפוש או הסינון</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden lg:block bg-stone-50 p-1.5 overflow-x-auto">
            <table className="w-full bg-white rounded-lg overflow-hidden">
              <thead className="bg-stone-100 border-b border-stone-200">
                <tr>
                  <th className="text-right px-3.5 py-2.5 text-sm font-medium text-stone-600">רישוי</th>
                  <th className="text-right px-3.5 py-2.5 text-sm font-medium text-stone-600">רכב</th>
                  <th className="text-right px-3.5 py-2.5 text-sm font-medium text-stone-600">נהגים</th>
                  <th className="text-right px-3.5 py-2.5 text-sm font-medium text-stone-600">סטטוס</th>
                  <th className="text-right px-3.5 py-2.5 text-sm font-medium text-stone-600 min-w-[220px]">תוקפים</th>
                  <th className="text-center px-3.5 py-2.5 text-sm font-medium text-stone-600">היום</th>
                  <th className="text-center px-3.5 py-2.5 text-sm font-medium text-stone-600">סה״כ</th>
                  <th className="text-right px-3.5 py-2.5 text-sm font-medium text-stone-600 w-14">פעולות</th>
                </tr>
              </thead>
              <tbody>
                {filteredTrucks.map((truck) => {
                  const status = getTruckStatus(truck)
                  const truckData = truck as TruckDocFields
                  const typeLabel =
                    typeConfig[truck.truck_type as keyof typeof typeConfig]?.label || truck.truck_type
                  return (
                    <tr
                      key={truck.id}
                      onClick={() => openEditModal(truck)}
                      className={`border-b border-stone-200 last:border-b-0 hover:bg-stone-50 cursor-pointer transition-colors ${
                        !truck.is_active ? 'opacity-60' : ''
                      }`}
                    >
                      <td className="px-3.5 py-2.5 text-sm">
                        <p className="font-mono font-bold text-stone-800 leading-tight">{truck.plate_number}</p>
                        <p className="text-xs text-stone-500 mt-0.5 leading-tight">{typeLabel}</p>
                      </td>
                      <td className="px-3.5 py-2.5 text-sm">
                        <TableVehicleCell truck={truck} />
                      </td>
                      <td className="px-3.5 py-2.5 text-sm">
                        <TableDriversCell assignedDrivers={truck.assigned_drivers} />
                      </td>
                      <td className="px-3.5 py-2.5 text-sm">
                        <TableStatusPill status={status} />
                      </td>
                      <td
                        className="px-3.5 py-2.5 text-sm min-w-[220px]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExpiryPillsRow
                          truck={truckData}
                          isExpired={isExpired}
                          isExpiringSoon={isExpiringSoon}
                          onViewDocument={handleViewDocument}
                          viewingDocument={viewingDocument}
                          compact
                        />
                      </td>
                      <td className="px-3.5 py-2.5 text-sm text-center">
                        <TowCountCell value={truck.today_tows_count} />
                      </td>
                      <td className="px-3.5 py-2.5 text-sm text-center">
                        <TowCountCell value={truck.total_tows_count} />
                      </td>
                      <td className="px-3.5 py-2.5 text-sm" onClick={(e) => e.stopPropagation()}>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() =>
                              setOpenMenuId(openMenuId === truck.id ? null : truck.id)
                            }
                            className="p-1.5 hover:bg-stone-100 rounded-lg"
                          >
                            <MoreHorizontal size={18} className="text-stone-400" />
                          </button>
                          {openMenuId === truck.id && (
                            <div className="absolute left-0 top-full mt-1 w-40 bg-white rounded-xl shadow-lg border border-stone-200 py-1 z-10">
                              <button
                                type="button"
                                onClick={() => {
                                  openEditModal(truck)
                                  setOpenMenuId(null)
                                }}
                                className="w-full px-4 py-2 text-right text-sm text-stone-700 hover:bg-stone-50 flex items-center gap-2"
                              >
                                <Edit2 size={16} />
                                ערוך
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setShowDeleteConfirm(truck.id)
                                  setOpenMenuId(null)
                                }}
                                className="w-full px-4 py-2 text-right text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                              >
                                <Trash2 size={16} />
                                מחק
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="lg:hidden">
            {filteredTrucks.map((truck) => {
              const status = getTruckStatus(truck)
              const truckData = truck as TruckDocFields
              const typeLabel =
                typeConfig[truck.truck_type as keyof typeof typeConfig]?.label || truck.truck_type
              return (
                <div
                  key={truck.id}
                  className={`border-b border-gray-100 last:border-b-0 ${!truck.is_active ? 'opacity-60' : ''}`}
                >
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => openEditModal(truck)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') openEditModal(truck)
                    }}
                    className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-mono font-bold text-lg text-gray-800">{truck.plate_number}</p>
                        <p className="text-sm text-gray-500 mt-0.5">
                          {typeLabel} · {formatVehicleLine(truck)}
                        </p>
                      </div>
                      <div className="flex items-start gap-2 shrink-0">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-lg ${statusConfig[status]?.color}`}
                        >
                          {statusConfig[status]?.label}
                        </span>
                        <div className="relative" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() =>
                              setOpenMenuId(openMenuId === truck.id ? null : truck.id)
                            }
                            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                          >
                            <MoreHorizontal size={20} />
                          </button>
                          {openMenuId === truck.id && (
                            <>
                              <div
                                className="fixed inset-0 z-10"
                                onClick={() => setOpenMenuId(null)}
                              />
                              <div className="absolute left-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-gray-200 z-20 overflow-hidden min-w-[140px]">
                                <button
                                  type="button"
                                  onClick={() => {
                                    openEditModal(truck)
                                    setOpenMenuId(null)
                                  }}
                                  className="flex items-center gap-2 w-full px-4 py-3 text-sm text-gray-700 hover:bg-gray-50"
                                >
                                  <Edit2 size={16} />
                                  עריכה
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setShowDeleteConfirm(truck.id)
                                    setOpenMenuId(null)
                                  }}
                                  className="flex items-center gap-2 w-full px-4 py-3 text-sm text-red-600 hover:bg-red-50"
                                >
                                  <Trash2 size={16} />
                                  מחיקה
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">
                      <CompactDriversCell assignedDrivers={truck.assigned_drivers} />
                    </p>
                    <div className="mb-2" onClick={(e) => e.stopPropagation()}>
                      <ExpiryPillsRow
                        truck={truckData}
                        isExpired={isExpired}
                        isExpiringSoon={isExpiringSoon}
                        onViewDocument={handleViewDocument}
                        viewingDocument={viewingDocument}
                      />
                    </div>
                    <p className="text-xs text-gray-500">
                      גרירות היום:{' '}
                      <span className="font-medium text-gray-700">{truck.today_tows_count || 0}</span>
                      {' · '}
                      סה״כ:{' '}
                      <span className="font-medium text-gray-700">{truck.total_tows_count || 0}</span>
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {openMenuId && (
        <div
          className="fixed inset-0 z-[5] hidden lg:block"
          onClick={() => setOpenMenuId(null)}
        />
      )}

      {/* Modal הוספה/עריכה */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end lg:items-center justify-center z-50">
          <div className="bg-white w-full lg:rounded-2xl lg:max-w-2xl lg:mx-4 overflow-hidden max-h-[95vh] flex flex-col rounded-t-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-[#33d4ff] text-white flex-shrink-0">
              <h2 className="font-bold text-lg">
                {editingTruck ? 'עריכת גרר' : 'הוספת גרר חדש'}
              </h2>
              <button
                onClick={() => { setShowModal(false); resetForm(); }}
                className="p-2 hover:bg-white/20 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-5 overflow-y-auto flex-1">
              {/* פרטי רכב */}
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 bg-[#33d4ff] text-white rounded-full flex items-center justify-center text-sm">1</span>
                  פרטי רכב
                </h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">מספר רישוי *</label>
                      <input
                        type="text"
                        value={formData.plate}
                        onChange={(e) =>
                          setFormData({ ...formData, plate: normalizePlate(e.target.value) })
                        }
                        placeholder="12-345-67"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff] font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">סוג גרר *</label>
                      <select
                        value={formData.type}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white"
                      >
                        <option value="">בחר סוג</option>
                        <option value="crane_tow">גרר מנוף</option>
                        <option value="dolly">דולי (מערסל ידני)</option>
                        <option value="heavy_rescue">חילוץ כבד</option>
                        <option value="carrier">מובילית</option>
                        <option value="carrier_large">מובילית 10+ רכבים</option>
                        <option value="wheel_lift_cradle">משקפיים (מערסל)</option>
                        <option value="heavy_equipment">ציוד כבד/לובי</option>
                        <option value="flatbed">רמסע</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">יצרן</label>
                      <input
                        type="text"
                        value={formData.manufacturer}
                        onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                        placeholder="לדוגמה: מרצדס"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">דגם</label>
                      <input
                        type="text"
                        value={formData.model}
                        onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                        placeholder="לדוגמה: אקטרוס"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">שנת ייצור</label>
                      <input
                        type="number"
                        value={formData.year}
                        onChange={(e) => setFormData({ ...formData, year: Number(e.target.value) })}
                        min="2000"
                        max="2030"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">קיבולת רכבים</label>
                      <input
                        type="number"
                        value={formData.vehicleCapacity}
                        onChange={(e) => setFormData({ ...formData, vehicleCapacity: Number(e.target.value) })}
                        min="1"
                        max="20"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* משקלים */}
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 bg-[#33d4ff] text-white rounded-full flex items-center justify-center text-sm">2</span>
                  משקלים (ק״ג)
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">משקל כולל</label>
                    <input
                      type="number"
                      value={formData.maxWeight || ''}
                      onChange={(e) => setFormData({ ...formData, maxWeight: Number(e.target.value) })}
                      placeholder="0"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">משקל מורשה</label>
                    <input
                      type="number"
                      value={formData.permittedWeight || ''}
                      onChange={(e) => setFormData({ ...formData, permittedWeight: Number(e.target.value) })}
                      placeholder="0"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">משטח עליון</label>
                    <input
                      type="number"
                      value={formData.upperPlatformWeight || ''}
                      onChange={(e) => setFormData({ ...formData, upperPlatformWeight: Number(e.target.value) })}
                      placeholder="0"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">משטח תחתון</label>
                    <input
                      type="number"
                      value={formData.lowerPlatformWeight || ''}
                      onChange={(e) => setFormData({ ...formData, lowerPlatformWeight: Number(e.target.value) })}
                      placeholder="0"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                    />
                  </div>
                </div>
              </div>

              {/* רישיון רכב ומסמכים */}
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 bg-[#33d4ff] text-white rounded-full flex items-center justify-center text-sm">3</span>
                  רישיון רכב ומסמכים
                </h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">תוקף רישיון רכב</label>
                      <DateInput
                        value={formData.licenseExpiry}
                        onChange={(licenseExpiry) => setFormData({ ...formData, licenseExpiry })}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">תוקף ביטוח</label>
                      <DateInput
                        value={formData.insuranceExpiry}
                        onChange={(insuranceExpiry) => setFormData({ ...formData, insuranceExpiry })}
                        className="w-full"
                      />
                    </div>
                  </div>
                  <FileUploadField
                    label="צילום רישיון רכב + נספח"
                    docType="license"
                    currentUrl={formData.licensePhotoUrl}
                    inputRef={licensePhotoRef as React.RefObject<HTMLInputElement>}
                  />
                </div>
              </div>

              {/* טכוגרף ותסקיר מהנדס */}
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 bg-[#33d4ff] text-white rounded-full flex items-center justify-center text-sm">4</span>
                  טכוגרף ותסקיר מהנדס
                </h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">תוקף כיול טכוגרף</label>
                      <DateInput
                        value={formData.tachographExpiry}
                        onChange={(tachographExpiry) => setFormData({ ...formData, tachographExpiry })}
                        className="w-full"
                      />
                    </div>
                    <FileUploadField
                      label="צילום תעודת כיול"
                      docType="tachograph"
                      currentUrl={formData.tachographPhotoUrl}
                      inputRef={tachographPhotoRef as React.RefObject<HTMLInputElement>}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">תוקף תסקיר מהנדס</label>
                      <DateInput
                        value={formData.engineerReportExpiry}
                        onChange={(engineerReportExpiry) => setFormData({ ...formData, engineerReportExpiry })}
                        className="w-full"
                      />
                    </div>
                    <FileUploadField
                      label="צילום תסקיר מהנדס"
                      docType="engineer_report"
                      currentUrl={formData.engineerReportPhotoUrl}
                      inputRef={engineerReportPhotoRef as React.RefObject<HTMLInputElement>}
                    />
                  </div>
                </div>
              </div>

              {/* בדיקת חורף */}
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 bg-[#33d4ff] text-white rounded-full flex items-center justify-center text-sm">5</span>
                  בדיקת חורף
                </h3>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">תאריך בדיקת חורף אחרונה</label>
                  <DateInput
                    value={formData.lastWinterInspection}
                    onChange={(lastWinterInspection) => setFormData({ ...formData, lastWinterInspection })}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500 mt-1">תזכורת תופיע מ-1 בספטמבר כל שנה</p>
                </div>
              </div>

              {/* שיוך נהגים */}
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 bg-[#33d4ff] text-white rounded-full flex items-center justify-center text-sm">6</span>
                  שיוך נהגים
                </h3>
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setFormData({ ...formData, driverAssignment: 'existing' })
                      }
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                        formData.driverAssignment === 'existing' ? 'bg-[#33d4ff] text-white' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      בחר נהגים
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          driverAssignment: 'none',
                          selectedDriverIds: [],
                        })
                      }
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                        formData.driverAssignment === 'none' ? 'bg-[#33d4ff] text-white' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      ללא נהג משויך
                    </button>
                  </div>

                  {formData.driverAssignment === 'existing' && (
                    <div className="space-y-2">
                      <p className="text-sm text-gray-600">בחר נהגים (ניתן לבחור יותר מאחד):</p>
                      {selectableDrivers.length === 0 ? (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                          <p className="text-sm text-amber-800">אין נהגים זמינים במערכת</p>
                        </div>
                      ) : (
                        selectableDrivers.map((driver) => {
                          const checked = formData.selectedDriverIds.includes(driver.id)
                          return (
                            <label
                              key={driver.id}
                              className={`flex items-center gap-4 p-3 rounded-xl border-2 cursor-pointer transition-colors ${
                                checked
                                  ? 'border-[#33d4ff] bg-cyan-50'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleSelectedDriver(driver.id)}
                                className="w-4 h-4 text-[#33d4ff] rounded"
                              />
                              <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                                <User size={18} className="text-gray-600" />
                              </div>
                              <div className="flex-1">
                                <span className="font-medium text-gray-800">{driver.user.full_name}</span>
                                <p className="text-sm text-gray-500">{driver.user.phone}</p>
                              </div>
                            </label>
                          )
                        })
                      )}
                      {formData.selectedDriverIds.length > 0 && (
                        <p className="text-xs text-gray-500">
                          נבחרו {formData.selectedDriverIds.length} נהגים
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* סטטוס התחלתי */}
              {!editingTruck && (
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <h3 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                    <span className="w-6 h-6 bg-[#33d4ff] text-white rounded-full flex items-center justify-center text-sm">7</span>
                    סטטוס התחלתי
                  </h3>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setFormData({ ...formData, initialStatus: 'available' })}
                      className={`flex-1 p-3 rounded-xl border-2 text-center transition-all ${
                        formData.initialStatus === 'available'
                          ? 'border-emerald-500 bg-emerald-50'
                          : 'border-gray-200'
                      }`}
                    >
                      <CheckCircle size={24} className={`mx-auto mb-1 ${formData.initialStatus === 'available' ? 'text-emerald-600' : 'text-gray-400'}`} />
                      <p className={`text-sm font-medium ${formData.initialStatus === 'available' ? 'text-emerald-700' : 'text-gray-600'}`}>פעיל</p>
                    </button>
                    <button
                      onClick={() => setFormData({ ...formData, initialStatus: 'inactive' })}
                      className={`flex-1 p-3 rounded-xl border-2 text-center transition-all ${
                        formData.initialStatus === 'inactive'
                          ? 'border-gray-500 bg-gray-50'
                          : 'border-gray-200'
                      }`}
                    >
                      <XCircle size={24} className={`mx-auto mb-1 ${formData.initialStatus === 'inactive' ? 'text-gray-600' : 'text-gray-400'}`} />
                      <p className={`text-sm font-medium ${formData.initialStatus === 'inactive' ? 'text-gray-700' : 'text-gray-600'}`}>לא פעיל</p>
                    </button>
                  </div>
                </div>
              )}

              {/* הערות */}
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 bg-[#33d4ff] text-white rounded-full flex items-center justify-center text-sm">
                    {editingTruck ? '7' : '8'}
                  </span>
                  הערות
                </h3>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="הערות על הגרר (תקלות ידועות, מגבלות וכו')..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                />
              </div>
            </div>

            <div className="flex gap-3 px-5 py-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
              <button
                onClick={() => { setShowModal(false); resetForm(); }}
                className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-100 transition-colors font-medium"
              >
                ביטול
              </button>
              <button
                onClick={handleSave}
                disabled={!formData.plate || !formData.type || saving}
                className="flex-1 py-3 bg-[#33d4ff] text-white rounded-xl hover:bg-[#21b8e6] disabled:bg-gray-300 transition-colors font-medium"
              >
                {saving ? 'שומר...' : editingTruck ? 'שמור' : 'הוסף גרר'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* אזהרת כפילות */}
      {showDuplicateWarning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={32} className="text-red-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-800 mb-2">גרר כבר קיים</h2>
              <p className="text-gray-600">גרר עם מספר רישוי {formData.plate} כבר קיים במערכת</p>
            </div>
            <div className="px-5 pb-5">
              <button
                onClick={() => setShowDuplicateWarning(false)}
                className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
              >
                הבנתי
              </button>
            </div>
          </div>
        </div>
      )}

      {/* אזהרת תוקף */}
      {showExpiryWarning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={32} className="text-amber-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-800 mb-2">תוקף פג</h2>
              <p className="text-gray-600">{expiryWarningMessage}</p>
              <p className="text-gray-600 mt-2">האם להמשיך בכל זאת?</p>
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <button
                onClick={() => setShowExpiryWarning(false)}
                className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-100 transition-colors"
              >
                חזור
              </button>
              <button
                onClick={() => {
                  setShowExpiryWarning(false)
                  handleSave()
                }}
                className="flex-1 py-3 bg-amber-600 text-white rounded-xl font-medium hover:bg-amber-700 transition-colors"
              >
                המשך בכל זאת
              </button>
            </div>
          </div>
        </div>
      )}

      {/* אישור מחיקה */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={28} className="text-red-600" />
              </div>
              <h3 className="font-bold text-gray-800 text-lg mb-2">מחיקת גרר</h3>
              <p className="text-gray-500">האם למחוק את הגרר?</p>
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-100 transition-colors"
              >
                ביטול
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                className="flex-1 py-3 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors"
              >
                מחק
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}