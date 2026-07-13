'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { DriverCalendarPicker } from '../../../components/DriverCalendarPicker'
import { TimeInput, DateInput } from '../../../components/ui'
import { getServiceSurcharges, ServiceSurcharge, getBasePriceList, getTimeSurcharges, getActiveTimeSurcharges, TimeSurcharge } from '../../../lib/queries/price-lists'
import { calculateTowPrice, computeStoredPriceBreakdownTotals, type TowPriceResult } from '../../../lib/utils/price-calculator'
import {
  computeCancellationFee,
  computeCancellationFeeBreakdown,
  extractCancellationFeeFromTotal,
} from '../../../lib/utils/cancellation-fee'
import { getCompanySettings } from '../../../lib/queries/settings'
import { normalizePlate } from '../../../lib/utils/plate-number'
import {
  buildCalendarViewSnapshotForScheduledDate,
  persistCalendarViewForReturn,
} from '../../../lib/utils/calendar-view-session'
import { getTowTypeLabel } from '../../../lib/utils/tow-type-labels'
import { getTruckTypeLabel } from '../../../lib/utils/truck-type-labels'
import { getVehicleTypeLabel, isKnownVehicleType } from '../../../lib/vehicle-lookup'
import { dateToYyyyMmDd, formatTodayYyyyMmDd, yyyyMmDdToDisplay } from '../../../lib/utils/date-input-normalize'
import { toTowVehicleCoreInfo } from '../../../lib/utils/tow-vehicle-core'
import { ServiceSurchargeSelector, ManualSurchargeSection, SelectedService, TowTruckTypeSelector } from '../../../components/tow-forms/shared'
import {
  extractManualSurcharges,
  manualSurchargesToBreakdown,
  excludeManualSurcharges,
  type ManualSurcharge,
} from '../../../lib/utils/manual-surcharge'
import { excludeTowLevelServices } from '../../../lib/utils/tow-service-surcharge'
import { 
  ArrowRight, 
  Edit2, 
  X, 
  Phone, 
  MapPin, 
  User, 
  Truck, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  FileText,
  Image,
  ChevronLeft,
  Search,
  AlertCircle,
  Plus,
  Trash2,
  Save,
  RefreshCw,
  Mail,
  Receipt,
  Eye,
  Link2,
  Calendar,
} from 'lucide-react'
import { useAuth } from '../../../lib/AuthContext'
import { useDebouncedCallback } from '../../../hooks/useDebouncedCallback'
import { canApproveQuote, canEditClosedTow, isClosedTowStatus } from '../../../lib/utils/can-edit-closed-tow'
import {
  resolvePortalVisibilityFlag,
  getPortalVisibilityOverrideState,
  PORTAL_VISIBILITY_FLAGS,
  PORTAL_VISIBILITY_LABELS,
  applyPortalVisibilityOverrideToTow,
  buildPortalVisibilityServerUpdate,
  type PortalVisibilityFlag,
  type PortalVisibilityOverrideState,
} from '../../../lib/utils/portal-visibility'
import { approveTowQuote, getTowWithPoints, getTowDetailLight, updateTow, updateTowStatus, assignDriver, getTowChangeLogs, TowWithDetails, createLinkedTow, manualCloseTow } from '../../../lib/queries/tows'
import { getRejectionRequestsForTow, approveRejectionRequest, denyRejectionRequest, REJECTION_REASONS } from '../../../lib/queries/rejection-requests'
import { supabase } from '../../../lib/supabase'
import { getDrivers } from '../../../lib/queries/drivers'
import { getTrucks } from '../../../lib/queries/trucks'
import { insertDriverTruckAssignments, driverHasCurrentAssignment } from '../../../lib/queries/driver-truck-assignments'
import { getCustomersLite, CustomerListItem } from '../../../lib/queries/customers'
import { createInvoiceFromTow, towHasInvoice } from '../../../lib/queries/invoices'
import { DriverWithDetails, TruckWithDetails } from '../../../lib/types'

type RoutePointLite = { point_type: string; point_order: number }

function getRoutePointLabel(
  point: RoutePointLite,
  towType: string | undefined | null,
  allPoints: RoutePointLite[]
): string {
  const sorted = [...allPoints].sort((a, b) => a.point_order - b.point_order)
  const po = point.point_order
  const pt = point.point_type

  if (towType !== 'exchange') {
    if (pt === 'pickup') return 'איסוף'
    if (pt === 'dropoff') return 'יעד'
    if (pt === 'exchange') return 'נקודת החלפה'
    return 'עצירה'
  }

  const hasExchangePoint = sorted.some(p => p.point_type === 'exchange')

  if (hasExchangePoint) {
    if (pt === 'exchange') return 'נקודת החלפה'
    if (pt === 'pickup') return 'איסוף תקין'
    if (pt === 'dropoff') return 'פריקה תקול'
    return 'עצירה'
  }

  if (sorted.length === 4) {
    if (po === 0 && pt === 'pickup') return 'איסוף תקין'
    if (po === 1 && pt === 'dropoff') return 'פריקה תקין'
    if (po === 2 && pt === 'pickup') return 'איסוף תקול'
    if (po === 3 && pt === 'dropoff') return 'פריקה תקול'
  }

  if (pt === 'pickup') return 'איסוף'
  if (pt === 'dropoff') return 'יעד'
  if (pt === 'exchange') return 'נקודת החלפה'
  return 'עצירה'
}

function buildVehiclePlateLookup(
  vehicles: { id: string; plate_number: string }[] | undefined | null
): Record<string, string> {
  const lookup: Record<string, string> = {}
  if (!vehicles) return lookup
  for (const v of vehicles) {
    if (v?.id && v.plate_number) lookup[v.id] = v.plate_number
  }
  return lookup
}

interface EditVehicle {
  id: string
  plateNumber: string
  manufacturer: string
  model: string
  year: number
  vehicleType: string
  color: string
  towReason: string
}

function CancellationFeeBreakdownDisplay({
  feeBeforeVat,
  vatAmount,
  feeTotal,
  vatPercentLabel,
}: {
  feeBeforeVat: number
  vatAmount: number
  feeTotal: number
  vatPercentLabel: number
}) {
  const format = (n: number) => `${n.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₪`
  const rowClass = 'flex items-baseline justify-between gap-3 min-w-0'
  const labelClass = 'text-gray-600 shrink-0 whitespace-nowrap'
  const amountClass = 'font-medium tabular-nums shrink-0 text-gray-800'
  return (
    <div className="text-sm text-amber-900 min-w-0">
      <div className="space-y-1">
        <div className={rowClass}>
          <span className={labelClass}>עלות ביטול</span>
          <span className={amountClass}>{format(feeBeforeVat)}</span>
        </div>
        <div className={rowClass}>
          <span className={labelClass}>{`מע"מ (${vatPercentLabel}%)`}</span>
          <span className={amountClass}>{format(vatAmount)}</span>
        </div>
      </div>
      <div className={`${rowClass} mt-2 pt-2 border-t border-amber-200/80`}>
        <span className="font-semibold text-amber-900 shrink-0 whitespace-nowrap">סה&quot;כ</span>
        <span className="font-bold tabular-nums shrink-0 text-amber-900">{format(feeTotal)}</span>
      </div>
    </div>
  )
}

export default function TowDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const { user, companyId } = useAuth()
  const towId = params.id as string
  
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [tow, setTow] = useState<TowWithDetails | null>(null)
  
  const [drivers, setDrivers] = useState<DriverWithDetails[]>([])
  const [trucks, setTrucks] = useState<TruckWithDetails[]>([])
  const [customers, setCustomers] = useState<CustomerListItem[]>([])
  
  const [activeTab, setActiveTab] = useState<'details' | 'history' | 'images' | 'portal'>('details')
  const [isEditing, setIsEditing] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [showChangeDriverModal, setShowChangeDriverModal] = useState(false)
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null)
  const [selectedTruckId, setSelectedTruckId] = useState<string | null>(null)
  const [driverSearch, setDriverSearch] = useState('')
  const [showCantEditModal, setShowCantEditModal] = useState(false)
  const [showRemoveDriverConfirm, setShowRemoveDriverConfirm] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelStep, setCancelStep] = useState<'warning' | 'reason' | 'confirm' | 'linked'>('reason')
  const [linkedCancelCandidates, setLinkedCancelCandidates] = useState<
    { id: string; order_number: string | null; status: string }[]
  >([])
  const [cancelStatusForCascade, setCancelStatusForCascade] = useState<
    'cancelled' | 'cancelled_charged' | null
  >(null)
  const [cancellingLinked, setCancellingLinked] = useState(false)
  const [selectedCancellationReason, setSelectedCancellationReason] = useState('')
  const [cancellationDetails, setCancellationDetails] = useState('')
  const [chargeCancellationFee, setChargeCancellationFee] = useState(false)
  const [cancellationPercent, setCancellationPercent] = useState('')
  const [notifyCustomer, setNotifyCustomer] = useState(true)
  const [showCantCancelModal, setShowCantCancelModal] = useState(false)
  const [showManualCloseModal, setShowManualCloseModal] = useState(false)
  const [showManualCloseDateConfirm, setShowManualCloseDateConfirm] = useState(false)
  const [manualClosing, setManualClosing] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [closeEndDate, setCloseEndDate] = useState('')
  const [closeEndTime, setCloseEndTime] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [approvingQuote, setApprovingQuote] = useState(false)
  const [showLinkedTowModal, setShowLinkedTowModal] = useState(false)
  const [creatingLinkedTow, setCreatingLinkedTow] = useState(false)
  const [linkedTowDriverId, setLinkedTowDriverId] = useState<string | null>(null)
  const [linkedTowTruckId, setLinkedTowTruckId] = useState<string | null>(null)
  const [linkedTowScheduleDate, setLinkedTowScheduleDate] = useState<Date>(new Date())

  // Invoice state
  const [hasInvoice, setHasInvoice] = useState(false)
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [creatingInvoice, setCreatingInvoice] = useState(false)
  const [invoiceData, setInvoiceData] = useState({
    description: '',
    amount: ''
  })

  // Edit form state
  const [editCustomerId, setEditCustomerId] = useState<string | null>(null)
  const [editCustomerSearch, setEditCustomerSearch] = useState('')
  const [showCustomerResults, setShowCustomerResults] = useState(false)
  const [editNotes, setEditNotes] = useState('')
  const [editVehicles, setEditVehicles] = useState<EditVehicle[]>([])
  const [editFromAddress, setEditFromAddress] = useState('')
  const [editToAddress, setEditToAddress] = useState('')
  const [editFinalPrice, setEditFinalPrice] = useState(0)
  // Service surcharges
  const [serviceSurchargesData, setServiceSurchargesData] = useState<ServiceSurcharge[]>([])
  const [editSelectedServices, setEditSelectedServices] = useState<SelectedService[]>([])
  const [editManualSurcharges, setEditManualSurcharges] = useState<ManualSurcharge[]>([])
  // Tow-level catalog lines are preserved verbatim here (no editor on this quick-edit surface).
  const [editTowLevelLines, setEditTowLevelLines] = useState<any[]>([])

  const [editScheduledDate, setEditScheduledDate] = useState('')
  const [editScheduledTime, setEditScheduledTime] = useState('')
  const [editScheduledEndDate, setEditScheduledEndDate] = useState('')
  const [editScheduledEndTime, setEditScheduledEndTime] = useState('')
  const [editRequiredTruckTypes, setEditRequiredTruckTypes] = useState<string[]>([])

  const [endEditOpen, setEndEditOpen] = useState(false)
  const [endEditDate, setEndEditDate] = useState('')
  const [endEditTime, setEndEditTime] = useState('')
  const [endEditSaving, setEndEditSaving] = useState(false)

  const [showAllDrivers, setShowAllDrivers] = useState(false)
  const [scheduleDate, setScheduleDate] = useState(new Date())

  const [changeLogs, setChangeLogs] = useState<any[]>([])
  const [childTows, setChildTows] = useState<
    { id: string; order_number: string | null; status: string; scheduled_at: string | null; created_at: string }[]
  >([])
  const [rejectionRequests, setRejectionRequests] = useState<any[]>([])
  const [processingRejection, setProcessingRejection] = useState(false)
  const [timeSurchargesData, setTimeSurchargesData] = useState<TimeSurcharge[]>([])
  const [basePriceList, setBasePriceList] = useState<any>(null)
  const [vatRate, setVatRate] = useState(0.18)

  const [driversTrucksLoaded, setDriversTrucksLoaded] = useState(false)
  const [driversTrucksLoading, setDriversTrucksLoading] = useState(false)
  const [customersLoaded, setCustomersLoaded] = useState(false)
  const [customersLoading, setCustomersLoading] = useState(false)
  const [pricingLoaded, setPricingLoaded] = useState(false)
  const [pricingLoading, setPricingLoading] = useState(false)
  const [changeLogsLoaded, setChangeLogsLoaded] = useState(false)
  const [changeLogsLoading, setChangeLogsLoading] = useState(false)
  const [priceChangeModal, setPriceChangeModal] = useState<{
    oldPrice: number
    newPrice: number
    newBreakdown: any[]
    newResult: TowPriceResult
    activeSurcharges: TimeSurcharge[]
  } | null>(null)

  const manualClosingRef = useRef(false)
  const refreshInFlightRef = useRef(false)
  const refreshPendingRef = useRef(false)

  const statusConfig: Record<string, { label: string; color: string }> = {
    pending: { label: 'ממתין לשיבוץ', color: 'bg-orange-100 text-orange-700 border-orange-200' },
    assigned: { label: 'שובץ נהג', color: 'bg-amber-100 text-amber-700 border-amber-200' },
    driver_accepted: { label: 'נהג אישר', color: 'bg-amber-100 text-amber-700 border-amber-200' },
    driver_on_way: { label: 'נהג בדרך', color: 'bg-blue-100 text-blue-700 border-blue-200' },
    arrived_pickup: { label: 'הגיע למוצא', color: 'bg-blue-100 text-blue-700 border-blue-200' },
    loading: { label: 'מעמיס', color: 'bg-blue-100 text-blue-700 border-blue-200' },
    in_progress: { label: 'בדרך ליעד', color: 'bg-blue-100 text-blue-700 border-blue-200' },
    completed: { label: 'הושלם', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    cancelled: { label: 'בוטל', color: 'bg-red-100 text-red-700 border-red-200' },
    cancelled_charged: { label: 'בוטל בחיוב', color: 'bg-amber-100 text-amber-800 border-amber-200' },
    quote: { label: 'הצעת מחיר', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  }

  const loadEssentialData = useCallback(async (isInitial: boolean) => {
    if (!companyId || !towId) return
    if (isInitial) setLoading(true)
    else setIsRefreshing(true)
    try {
      const [towData, rejections, childrenRes, companySettings] = await Promise.all([
        getTowWithPoints(towId),
        getRejectionRequestsForTow(towId),
        supabase
          .from('tows')
          .select('id, order_number, status, scheduled_at, created_at')
          .eq('linked_tow_id', towId)
          .eq('company_id', companyId)
          .order('created_at', { ascending: true }),
        getCompanySettings(companyId),
      ])
      if (companySettings?.default_vat_percent != null) {
        setVatRate(companySettings.default_vat_percent / 100)
      }
      setTow(towData)
      setRejectionRequests(rejections)
      setChildTows(childrenRes.error ? [] : childrenRes.data || [])
      if (towData) {
        const invoiceExists = await towHasInvoice(towId)
        setHasInvoice(invoiceExists)
      } else {
        setHasInvoice(false)
      }
    } catch (err) {
      console.error('Error loading tow:', err)
      setError('שגיאה בטעינת הגרירה')
    } finally {
      if (isInitial) setLoading(false)
      else setIsRefreshing(false)
    }
  }, [companyId, towId])

  const runRefreshTow = useCallback(async () => {
    if (!companyId || !towId) return
    if (refreshInFlightRef.current) {
      refreshPendingRef.current = true
      return
    }
    refreshInFlightRef.current = true
    refreshPendingRef.current = false
    try {
      await loadEssentialData(false)
    } finally {
      refreshInFlightRef.current = false
      if (refreshPendingRef.current) {
        refreshPendingRef.current = false
        await runRefreshTow()
      }
    }
  }, [companyId, towId, loadEssentialData])

  const debouncedRefreshTow = useDebouncedCallback(() => {
    void runRefreshTow()
  }, 300)

  const refreshTow = useCallback(() => runRefreshTow(), [runRefreshTow])

  const refreshTowLight = useCallback(async () => {
    if (!towId) return
    try {
      const light = await getTowDetailLight(towId)
      if (!light) return

      const pointPatchById = new Map(light.points.map((p) => [p.id, p]))

      setTow((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          ...light.tow,
          vehicles: prev.vehicles,
          legs: prev.legs,
          points:
            prev.points?.map((p) => {
              const patch = pointPatchById.get(p.id)
              if (!patch) return p
              return {
                ...p,
                status: patch.status,
                completed_at: patch.completed_at,
              }
            }) ?? [],
        }
      })
    } catch (err) {
      console.error('Error refreshing tow (light):', err)
    }
  }, [towId])

  const onTowRealtimeUpdate = useCallback(() => {
    if (manualClosingRef.current) return
    debouncedRefreshTow()
  }, [debouncedRefreshTow])

  const loadDriversAndTrucks = useCallback(async () => {
    if (!companyId || driversTrucksLoaded || driversTrucksLoading) return
    setDriversTrucksLoading(true)
    try {
      const [driversData, trucksData] = await Promise.all([
        getDrivers(companyId),
        getTrucks(companyId),
      ])
      setDrivers(driversData)
      setTrucks(trucksData)
      setDriversTrucksLoaded(true)
    } catch (err) {
      console.error('Error loading drivers/trucks:', err)
    } finally {
      setDriversTrucksLoading(false)
    }
  }, [companyId, driversTrucksLoaded, driversTrucksLoading])

  const loadCustomers = useCallback(async () => {
    if (!companyId || customersLoaded || customersLoading) return
    setCustomersLoading(true)
    try {
      const customersData = await getCustomersLite(companyId)
      setCustomers(customersData)
      setCustomersLoaded(true)
    } catch (err) {
      console.error('Error loading customers:', err)
    } finally {
      setCustomersLoading(false)
    }
  }, [companyId, customersLoaded, customersLoading])

  const loadSurchargesAndPricing = useCallback(async () => {
    if (!companyId) return null
    if (pricingLoaded) {
      return {
        serviceSurcharges: serviceSurchargesData,
        basePriceList,
        timeSurcharges: timeSurchargesData,
      }
    }
    if (pricingLoading) return null
    setPricingLoading(true)
    try {
      const [serviceSurcharges, basePriceListData, timeSurchargesDataResult] = await Promise.all([
        getServiceSurcharges(companyId),
        getBasePriceList(companyId),
        getTimeSurcharges(companyId),
      ])
      setServiceSurchargesData(serviceSurcharges)
      setBasePriceList(basePriceListData)
      setTimeSurchargesData(timeSurchargesDataResult)
      setPricingLoaded(true)
      return {
        serviceSurcharges,
        basePriceList: basePriceListData,
        timeSurcharges: timeSurchargesDataResult,
      }
    } catch (err) {
      console.error('Error loading pricing:', err)
      return null
    } finally {
      setPricingLoading(false)
    }
  }, [companyId, pricingLoaded, pricingLoading, serviceSurchargesData, basePriceList, timeSurchargesData])

  const loadChangeLogs = useCallback(async (force = false) => {
    if (!towId) return
    if ((changeLogsLoaded && !force) || changeLogsLoading) return
    setChangeLogsLoading(true)
    try {
      const logs = await getTowChangeLogs(towId)
      setChangeLogs(logs)
      setChangeLogsLoaded(true)
    } catch (err) {
      console.error('Error loading change logs:', err)
    } finally {
      setChangeLogsLoading(false)
    }
  }, [towId, changeLogsLoaded, changeLogsLoading])

  const openDriverModal = useCallback((type: 'assign' | 'change') => {
    if (type === 'assign') setShowAssignModal(true)
    else setShowChangeDriverModal(true)
    void Promise.all([loadDriversAndTrucks(), loadSurchargesAndPricing()])
  }, [loadDriversAndTrucks, loadSurchargesAndPricing])

  const handleTabChange = useCallback((tab: 'details' | 'history' | 'images' | 'portal') => {
    setActiveTab(tab)
    if (tab === 'history') void loadChangeLogs()
  }, [loadChangeLogs])

  const handlePortalVisibilityOverrideChange = useCallback(
    async (flag: PortalVisibilityFlag, state: PortalVisibilityOverrideState) => {
      if (!tow) return
      const snapshot = tow
      setTow((prev) => (prev ? applyPortalVisibilityOverrideToTow(prev, flag, state) : prev))
      try {
        const serverUpdate = buildPortalVisibilityServerUpdate(
          flag,
          state,
          snapshot.visibility_overrides,
        )
        await updateTow({
          towId: tow.id,
          ...serverUpdate,
        })
        void refreshTow()
      } catch (err) {
        setTow(snapshot)
        console.error('Error updating portal visibility override:', err)
        alert('שגיאה בעדכון הרשאות התצוגה')
      }
    },
    [tow, refreshTow],
  )

  const handleBackToCalendar = useCallback(() => {
    if (tow?.scheduled_at) {
      const scheduled = new Date(tow.scheduled_at)
      if (!Number.isNaN(scheduled.getTime())) {
        persistCalendarViewForReturn(
          buildCalendarViewSnapshotForScheduledDate(scheduled)
        )
      }
    }
    router.push('/dashboard/calendar')
  }, [tow?.scheduled_at, router])

  useEffect(() => {
    setDriversTrucksLoaded(false)
    setCustomersLoaded(false)
    setPricingLoaded(false)
    setChangeLogsLoaded(false)
    setDrivers([])
    setTrucks([])
    setCustomers([])
    setChangeLogs([])
    setServiceSurchargesData([])
    setBasePriceList(null)
    setTimeSurchargesData([])
  }, [towId])

  useEffect(() => {
    if (companyId && towId) {
      void loadEssentialData(true)
    }
  }, [companyId, towId, loadEssentialData])

  useEffect(() => {
    if (!towId) return

    const channel = supabase
      .channel(`tow-realtime-${towId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tow_points',
        filter: `tow_id=eq.${towId}`
      }, onTowRealtimeUpdate)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tow_images',
        filter: `tow_id=eq.${towId}`
      }, onTowRealtimeUpdate)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'tows',
        filter: `id=eq.${towId}`
      }, onTowRealtimeUpdate)
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [towId, onTowRealtimeUpdate])

  const canEdit = tow
    ? !isClosedTowStatus(tow.status) || canEditClosedTow(user?.role)
    : false
  const canManualClose =
    tow != null && (tow.status === 'assigned' || tow.status === 'in_progress')
  const canApproveQuoteTow =
    tow?.status === 'quote' && canApproveQuote(user?.role)

  const vehiclePlateById = useMemo(
    () => buildVehiclePlateLookup(tow?.vehicles),
    [tow?.vehicles]
  )

  const showEndTimeEditor =
    tow != null && (tow.status === 'in_progress' || tow.status === 'completed')

  const getEndTimeDisplaySource = () => {
    if (!tow) return null
    if (tow.status === 'completed') return tow.completed_at
    return tow.scheduled_end_at
  }

  const openEndTimeEditor = () => {
    if (!tow) return
    const source = getEndTimeDisplaySource()
    if (source) {
      const d = new Date(source)
      setEndEditDate(dateToYyyyMmDd(d))
      setEndEditTime(d.toTimeString().slice(0, 5))
    } else {
      setEndEditDate('')
      setEndEditTime('')
    }
    setEndEditOpen(true)
  }

  const handleSaveEndTime = async () => {
    if (!tow) return
    const iso =
      endEditDate && endEditTime
        ? new Date(`${endEditDate}T${endEditTime}:00`).toISOString()
        : null
    setEndEditSaving(true)
    try {
      if (tow.status === 'completed') {
        await updateTow({ towId: tow.id, completedAt: iso })
      } else {
        await updateTow({ towId: tow.id, scheduledEndAt: iso })
      }
      await refreshTow()
      setEndEditOpen(false)
    } catch (err) {
      console.error('Error saving end time:', err)
      alert('שגיאה בשמירת שעת הסיום')
    } finally {
      setEndEditSaving(false)
    }
  }

  const getDriverTrucks = (driverId: string) =>
    trucks.filter((t) => (t.assigned_drivers ?? []).some((d) => d.id === driverId))

  // סינון נהגים לפי סוג גרר נדרש ולפי חיפוש
  const filteredDrivers = drivers.filter(driver => {
  // הגנה על נהגים ללא user
  if (!driver.user?.full_name) return false
  
  // סינון לפי חיפוש
  const matchesSearch = driver.user.full_name.toLowerCase().includes(driverSearch.toLowerCase()) || 
                        (driver.user.phone && driver.user.phone.includes(driverSearch))
  if (!matchesSearch) return false
  
  // אם אין דרישות גרר - מציגים את כולם
  const requiredTypes = tow?.required_truck_types as string[] | undefined
  if (!requiredTypes || requiredTypes.length === 0) return true
  
  // בדיקה אם לנהג יש גרר מתאים
  const driverTrucks = getDriverTrucks(driver.id)
  return driverTrucks.some(truck => requiredTypes.includes(truck.truck_type))
})

  // נהגים עם גרר מתאים
  const driversWithMatchingTruck = filteredDrivers.filter(
    (driver) => getDriverTrucks(driver.id).length > 0
  )

  const filteredCustomers = customers.filter(c => {
    if (!editCustomerSearch) return false
    const query = editCustomerSearch.toLowerCase()
    return c.name.toLowerCase().includes(query) || 
           (c.phone && c.phone.includes(query))
  })

  const getFromAddress = () => {
    // קודם ננסה מ-points (המבנה החדש)
    if (tow?.points && tow.points.length > 0) {
      const firstPoint = tow.points.find(p => p.point_type === 'pickup') || tow.points[0]
      return firstPoint.address || 'לא צוין'
    }
    // fallback ל-legs (המבנה הישן)
    if (!tow?.legs || tow.legs.length === 0) return 'לא צוין'
    return tow.legs[0].from_address || 'לא צוין'
  }

  const getToAddress = () => {
    // קודם ננסה מ-points (המבנה החדש)
    if (tow?.points && tow.points.length > 0) {
      const lastPoint = [...tow.points].reverse().find(p => p.point_type === 'dropoff') || tow.points[tow.points.length - 1]
      return lastPoint.address || 'לא צוין'
    }
    // fallback ל-legs (המבנה הישן)
    if (!tow?.legs || tow.legs.length === 0) return 'לא צוין'
    return tow.legs[tow.legs.length - 1].to_address || 'לא צוין'
  }

  const handleEditClick = () => {
    if (!canEdit) {
      setShowCantEditModal(true)
    } else if (tow) {
      // Initialize edit form with current values
      setEditCustomerId(tow.customer_id)
      setEditCustomerSearch(tow.customer?.name || '')
      setEditNotes(tow.notes || '')
      setEditFinalPrice(tow.final_price || 0)
      setEditFromAddress(getFromAddress())
      setEditToAddress(getToAddress())
      const scheduledDate = new Date(tow.scheduled_at || tow.created_at)
      setEditScheduledDate(scheduledDate.toISOString().split('T')[0])
      setEditScheduledTime(scheduledDate.toTimeString().slice(0, 5))
      if (tow.scheduled_end_at) {
        const endDate = new Date(tow.scheduled_end_at)
        setEditScheduledEndDate(endDate.toISOString().split('T')[0])
        setEditScheduledEndTime(endDate.toTimeString().slice(0, 5))
      } else {
        setEditScheduledEndDate('')
        setEditScheduledEndTime('')
      }
      setEditRequiredTruckTypes((tow.required_truck_types as string[]) || [])
      setEditVehicles(tow.vehicles?.map((v: any) => ({
        id: v.id,
        plateNumber: v.plate_number,
        manufacturer: v.manufacturer || '',
        model: v.model || '',
        year: v.year || new Date().getFullYear(),
        vehicleType: v.vehicle_type || '',
        color: v.color || '',
        towReason: v.tow_reason || ''
      })) || [])
      // Initialize selected services from price breakdown (catalog only; ad-hoc lines are separate)
      if (tow.price_breakdown?.service_surcharges) {
        const catalogLines = excludeTowLevelServices(
          excludeManualSurcharges(tow.price_breakdown.service_surcharges)
        )
        const services: SelectedService[] = catalogLines.map((s: any) => ({
          id: s.id,
          quantity: s.units || undefined,
          manualPrice: s.price_type === 'manual' ? s.amount : undefined
        }))
        setEditSelectedServices(services)
        setEditTowLevelLines(
          tow.price_breakdown.service_surcharges.filter((s: any) => s.is_tow_level === true)
        )
        setEditManualSurcharges(extractManualSurcharges(tow.price_breakdown.service_surcharges))
      } else {
        setEditSelectedServices([])
        setEditTowLevelLines([])
        setEditManualSurcharges([])
      }

      setIsEditing(true)
      void Promise.all([loadCustomers(), loadSurchargesAndPricing()])
    }
  }
  const handleCancelEdit = () => {
    setIsEditing(false)
  }

  const handleSaveChanges = async () => {
    if (!tow) return
    
    if (editVehicles.length === 0) {
      alert('חייב להיות לפחות רכב אחד בגרירה')
      return
    }

    // יצירת תאריך חדש
    const newScheduledAt = new Date(`${editScheduledDate}T${editScheduledTime}:00`)
    const newScheduledEndAt =
      editScheduledEndDate && editScheduledEndTime
        ? new Date(`${editScheduledEndDate}T${editScheduledEndTime}:00`).toISOString()
        : null

    // חישוב מחדש של תוספות שירות
    let newPriceBreakdown = tow.price_breakdown ? { ...tow.price_breakdown } : null
    let newFinalPrice = editFinalPrice

    if (newPriceBreakdown) {
      // חישוב תוספות שירות חדשות
      const catalogServiceSurcharges = editSelectedServices.map(selected => {
        const service = serviceSurchargesData.find(s => s.id === selected.id)
        if (!service) return null

        let amount = 0
        let units: number | undefined = undefined

        if (service.price_type === 'manual') {
          amount = selected.manualPrice || 0
        } else if (service.price_type === 'per_unit') {
          units = selected.quantity || 1
          amount = service.price * units
        } else {
          amount = service.price
        }

        return {
          id: service.id,
          label: service.label,
          price: service.price,
          price_type: service.price_type,
          units,
          amount
        }
      }).filter((s): s is NonNullable<typeof s> => s !== null && s.amount > 0)

      const newServiceSurcharges = [
        ...catalogServiceSurcharges,
        ...editTowLevelLines,
        ...manualSurchargesToBreakdown(editManualSurcharges),
      ]

      // עדכון ה-breakdown
      newPriceBreakdown.service_surcharges = newServiceSurcharges

      // חישוב מחדש של הסכומים
      const baseSubtotal = newPriceBreakdown.base_price + newPriceBreakdown.distance_price
      const timeAmount = newPriceBreakdown.time_surcharges.reduce((max, s) => Math.max(max, s.amount), 0)
      const locationAmount = newPriceBreakdown.location_surcharges.reduce((sum, s) => sum + s.amount, 0)
      const servicesAmount = newServiceSurcharges.reduce((sum, s) => sum + s.amount, 0)

      const beforeDiscount = baseSubtotal + timeAmount + locationAmount + servicesAmount
      const discountAmount = Math.round(beforeDiscount * newPriceBreakdown.discount_percent / 100)
      const beforeVat = beforeDiscount - discountAmount
      const vatAmount = Math.round(beforeVat * 0.18)
      const total = beforeVat + vatAmount

      newPriceBreakdown.subtotal = beforeDiscount
      newPriceBreakdown.discount_amount = discountAmount
      newPriceBreakdown.vat_amount = vatAmount
      newPriceBreakdown.total = total

      newFinalPrice = total
    }

    setSaving(true)
    try {
      await updateTow({
        towId: tow.id,
        customerId: editCustomerId,
        notes: editNotes || null,
        finalPrice: newFinalPrice || null,
        scheduledAt: newScheduledAt.toISOString(),
        scheduledEndAt: newScheduledEndAt,
        priceBreakdown: newPriceBreakdown,
        requiredTruckTypes: editRequiredTruckTypes,
        vehicles: editVehicles.map(v => ({
          plateNumber: v.plateNumber,
          manufacturer: v.manufacturer || undefined,
          model: v.model || undefined,
          year: v.year || undefined,
          vehicleType: v.vehicleType as any || undefined,
          color: v.color || undefined,
          towReason: v.towReason || undefined
        })),
        legs: [{
          legType: 'pickup',
          fromAddress: editFromAddress,
          toAddress: editToAddress
        }]
      })
      await refreshTow()
      if (changeLogsLoaded) void loadChangeLogs(true)
      setIsEditing(false)
    } catch (err) {
      console.error('Error saving changes:', err)
      alert('שגיאה בשמירת השינויים')
    } finally {
      setSaving(false)
    }
  }

  const addVehicle = () => {
    setEditVehicles([...editVehicles, {
      id: crypto.randomUUID(),
      plateNumber: '',
      manufacturer: '',
      model: '',
      year: new Date().getFullYear(),
      vehicleType: '',
      color: '',
      towReason: ''
    }])
  }

  const removeVehicle = (id: string) => {
    if (editVehicles.length <= 1) {
      alert('חייב להיות לפחות רכב אחד')
      return
    }
    setEditVehicles(editVehicles.filter(v => v.id !== id))
  }

  const updateVehicle = (id: string, field: keyof EditVehicle, value: any) => {
    setEditVehicles(editVehicles.map(v => v.id === id ? { ...v, [field]: value } : v))
  }

  const handleAssignDriver = async () => {
    if (!selectedDriverId || !selectedTruckId || !tow) return

    const pricing = await loadSurchargesAndPricing()

    // חישוב מחיר חדש לפי שעה חדשה
    if (
      tow.price_breakdown &&
      pricing?.basePriceList &&
      pricing.timeSurcharges.length > 0 &&
      tow.price_mode === 'recommended'
    ) {
      const newDate = scheduleDate.toISOString().split('T')[0]
      const newTime = scheduleDate.toTimeString().slice(0, 5)
      const activeSurcharges = getActiveTimeSurcharges(pricing.timeSurcharges, newTime, newDate, false)
      const locationSurcharges = (tow.price_breakdown.location_surcharges || []).map((s: any) => ({ percent: s.percent }))
      const serviceSurcharges = (tow.price_breakdown.service_surcharges || []).map((s: any) => ({ amount: s.amount }))

      const basePriceOverride =
        tow.tow_type === 'exchange'
          ? (tow.price_breakdown?.base_price ?? undefined)
          : undefined

      const newResult = calculateTowPrice({
        priceList: {
          base_prices: {
            private: pricing.basePriceList.base_price_private || 0,
            motorcycle: pricing.basePriceList.base_price_motorcycle || 0,
            heavy: pricing.basePriceList.base_price_heavy || 0,
            machinery: pricing.basePriceList.base_price_machinery || 0,
            personal_import: pricing.basePriceList.base_price_private || 0,
          },
          price_per_km: pricing.basePriceList.price_per_km || 12,
          minimum_price: pricing.basePriceList.minimum_price || 250,
        },
        vehicleType: (tow.price_breakdown.vehicle_type as any) || 'private',
        distanceKm: tow.price_breakdown.distance_km || 0,
        timeSurcharges: pricing.timeSurcharges,
        towDate: newDate,
        towTime: newTime,
        isHoliday: false,
        activeTimeSurchargeIds: activeSurcharges.map(s => s.id),
        hasManualTimeSurchargeOverride: true,
        locationSurcharges,
        serviceSurcharges,
        priceMode: 'recommended',
        discountPercent: tow.price_breakdown.discount_percent || 0,
        vatPercent: 0.18,
        ...(basePriceOverride !== undefined ? { basePriceOverride } : {}),
      })

      const oldPrice = tow.price_breakdown.total
      const newPrice = newResult.total

      if (Math.abs(oldPrice - newPrice) > 1) {
        setPriceChangeModal({
          oldPrice,
          newPrice,
          newBreakdown: newResult.breakdown,
          newResult,
          activeSurcharges,
        })
        return
      }
    }

    await doAssign()
  }

  const doAssign = async (useNewPrice?: boolean) => {
    if (!selectedDriverId || !selectedTruckId || !tow) return
    setAssigning(true)
    try {
      await assignDriver(tow.id, selectedDriverId, selectedTruckId, scheduleDate?.toISOString())
      try {
        // Check the DB (not possibly-stale local state) before seeding a permanent
        // assignment. insertDriverTruckAssignments is idempotent against the unique
        // index, so a concurrent seed is a benign no-op rather than a thrown error.
        if (!(await driverHasCurrentAssignment(selectedDriverId))) {
          await insertDriverTruckAssignments(selectedDriverId, [selectedTruckId])
        }
      } catch (err) {
        console.error('Failed to create permanent driver-truck assignment:', err)
      }
      if (useNewPrice && priceChangeModal) {
        await updateTow({
          towId: tow.id,
          finalPrice: priceChangeModal.newPrice,
          recommendedPrice: priceChangeModal.newPrice,
          priceBreakdown: tow.price_breakdown ? {
            ...tow.price_breakdown,
            base_price: priceChangeModal.newResult.basePrice,
            distance_price: priceChangeModal.newResult.distancePrice,
            subtotal: priceChangeModal.newResult.subtotal,
            time_surcharges: priceChangeModal.activeSurcharges
              .filter(s => s.surcharge_percent === priceChangeModal.newResult.maxTimeSurchargePercent)
              .map(s => ({
                id: s.id,
                label: s.label,
                percent: s.surcharge_percent,
                amount: priceChangeModal.newResult.subtotal * (s.surcharge_percent / 100),
              })),
            vat_amount: priceChangeModal.newResult.vatAmount,
            discount_amount: priceChangeModal.newResult.discountAmount,
            total: priceChangeModal.newResult.total,
          } : null,
        })
      }
      closeDriverModal()
      setPriceChangeModal(null)
      router.push('/dashboard')
    } catch (err) {
      console.error('Error assigning driver:', err)
      alert('שגיאה בשיבוץ הנהג')
    } finally {
      setAssigning(false)
    }
  }

  const handleCreateLinkedTow = async () => {
    if (!linkedTowDriverId || !linkedTowTruckId || !tow || !companyId || !user) return
    setCreatingLinkedTow(true)
    try {
      await createLinkedTow(tow.id, {
        companyId,
        createdBy: user.id,
        driverId: linkedTowDriverId,
        truckId: linkedTowTruckId,
        scheduledAt: linkedTowScheduleDate.toISOString(),
      })
      await refreshTow()
      setShowLinkedTowModal(false)
      setLinkedTowDriverId(null)
      setLinkedTowTruckId(null)
    } catch (err) {
      console.error(err)
      alert('שגיאה ביצירת גרירה מקושרת')
    } finally {
      setCreatingLinkedTow(false)
    }
  }

  const handleRemoveDriver = async () => {
    if (!tow) return
    try {
      await assignDriver(tow.id, null as any, null as any)
      await updateTowStatus(tow.id, 'pending')
      await refreshTow()
      setShowRemoveDriverConfirm(false)
    } catch (err) {
      console.error('Error removing driver:', err)
    }
  }

  const handleCancelClick = () => {
    if (!tow) return
    if (tow.status === 'completed' || tow.status === 'cancelled' || tow.status === 'cancelled_charged') {
      setShowCantCancelModal(true)
      return
    }

    if (['in_progress', 'driver_on_way', 'arrived_pickup', 'loading'].includes(tow.status)) {
      setCancelStep('warning')
    } else {
      setCancelStep('reason')
    }
    setShowCancelModal(true)
  }

  const handleApproveQuote = async () => {
    if (!tow || !canApproveQuoteTow) return
    setApprovingQuote(true)
    try {
      const result = await approveTowQuote(tow.id)
      if (!result.approved) {
        alert(
          result.reason === 'not_quote'
            ? 'ההצעה כבר אושרה או שאינה בהצעת מחיר'
            : 'הגרירה לא נמצאה'
        )
        return
      }
      await refreshTow()
      if (changeLogsLoaded) void loadChangeLogs(true)
    } catch (err) {
      console.error('Error approving tow quote:', err)
      alert('שגיאה באישור ההצעה')
    } finally {
      setApprovingQuote(false)
    }
  }

  const handleConfirmManualClose = async () => {
    if (!tow || !user?.id) return
    const snapshot = structuredClone(tow)
    manualClosingRef.current = true
    setManualClosing(true)
    try {
      const endTimeIso =
        closeEndDate && closeEndTime
          ? new Date(`${closeEndDate}T${closeEndTime}:00`).toISOString()
          : undefined
      await manualCloseTow(tow.id, user.id, endTimeIso, user.full_name)

      const now = new Date().toISOString()
      const completedAt = endTimeIso ?? now

      setTow((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          status: 'completed',
          completed_at: completedAt,
          manually_closed_at: now,
          manually_closed_by: user.id,
          manually_closed_by_user: { full_name: user.full_name },
          points:
            prev.points?.map((p) =>
              p.status === 'skipped'
                ? p
                : { ...p, status: 'completed' as const, completed_at: completedAt }
            ) ?? [],
        }
      })

      setShowManualCloseDateConfirm(false)
      setShowManualCloseModal(false)
      if (changeLogsLoaded) void loadChangeLogs(true)
      void refreshTowLight()
    } catch (err) {
      setTow(snapshot)
      console.error('Error manually closing tow:', err)
      alert(err instanceof Error ? err.message : 'שגיאה בסגירה ידנית של הגרירה')
    } finally {
      manualClosingRef.current = false
      setManualClosing(false)
    }
  }

  const handleManualCloseSubmit = () => {
    if (closeEndDateDiffersFromScheduled) {
      setShowManualCloseDateConfirm(true)
      return
    }
    void handleConfirmManualClose()
  }

  const openManualCloseModal = () => {
    const n = new Date()
    setCloseEndDate(formatTodayYyyyMmDd(n))
    setCloseEndTime(n.toTimeString().slice(0, 5))
    setShowManualCloseDateConfirm(false)
    setShowManualCloseModal(true)
  }

  const closeEndDateDiffersFromScheduled = useMemo(() => {
    if (!tow?.scheduled_at || !closeEndDate) return false
    const scheduledLocalDate = dateToYyyyMmDd(new Date(tow.scheduled_at))
    return closeEndDate !== scheduledLocalDate
  }, [tow?.scheduled_at, closeEndDate])

  const scheduledCloseDisplay = useMemo(() => {
    if (!tow?.scheduled_at) return ''
    const d = new Date(tow.scheduled_at)
    const date = yyyyMmDdToDisplay(dateToYyyyMmDd(d))
    const time = d.toTimeString().slice(0, 5)
    return `${date} בשעה ${time}`
  }, [tow?.scheduled_at])

  const selectedCloseDisplay = useMemo(() => {
    if (!closeEndDate) return ''
    const date = yyyyMmDdToDisplay(closeEndDate)
    return closeEndTime ? `${date} בשעה ${closeEndTime}` : date
  }, [closeEndDate, closeEndTime])

  const parsedCancellationPercent = parseFloat(cancellationPercent)
  const vatPercentLabel = Math.round(vatRate * 100)
  const previewCancellationFeeBreakdown =
    tow && chargeCancellationFee && Number.isFinite(parsedCancellationPercent)
      ? computeCancellationFeeBreakdown(tow, parsedCancellationPercent, vatRate)
      : null
  const storedCancellationFeeDisplay = tow && Number(tow.cancellation_fee) > 0
    ? extractCancellationFeeFromTotal(Number(tow.cancellation_fee), vatRate)
    : null

  const handleConfirmCancel = async () => {
    if (!tow) return
    setIsCancelling(true)
    try {
      const fee =
        chargeCancellationFee && Number.isFinite(parsedCancellationPercent) && parsedCancellationPercent > 0
          ? computeCancellationFee(tow, parsedCancellationPercent, vatRate)
          : undefined
      const cancelStatus = fee && fee > 0 ? 'cancelled_charged' as const : 'cancelled' as const

      await updateTowStatus(
        tow.id,
        cancelStatus,
        selectedCancellationReason,
        cancellationDetails.trim() || undefined,
        fee && fee > 0 ? fee : undefined,
        user?.id
      )

      // Gather linked tows (both directions) that are still cancellable, so we
      // can offer an optional cascade. Terminal statuses are excluded so the
      // prompt never appears for tows that are already done.
      const isCancellable = (status: string) =>
        !['cancelled', 'cancelled_charged', 'completed'].includes(status)

      const candidates: { id: string; order_number: string | null; status: string }[] = []

      // Parent direction: this tow points to a parent via linked_tow_id.
      if (tow.linked_tow_id) {
        const { data: parent } = await supabase
          .from('tows')
          .select('id, order_number, status')
          .eq('id', tow.linked_tow_id)
          .maybeSingle()
        if (parent && isCancellable(parent.status)) {
          candidates.push({ id: parent.id, order_number: parent.order_number, status: parent.status })
        }
      }

      // Child direction: tows whose linked_tow_id points to this tow (already loaded).
      for (const child of childTows) {
        if (isCancellable(child.status)) {
          candidates.push({ id: child.id, order_number: child.order_number, status: child.status })
        }
      }

      await refreshTow()
      if (changeLogsLoaded) void loadChangeLogs(true)

      if (candidates.length > 0) {
        // Keep the modal open and move to the linked-cancel prompt. Reason/details
        // are intentionally retained so the cascade can reuse them.
        setLinkedCancelCandidates(candidates)
        setCancelStatusForCascade(cancelStatus)
        setCancelStep('linked')
      } else {
        setShowCancelModal(false)
        setSelectedCancellationReason('')
        setCancellationDetails('')
        setChargeCancellationFee(false)
        setCancellationPercent('')
        setCancelStep('reason')
      }
    } catch (err) {
      console.error('Error cancelling tow:', err)
    } finally {
      setIsCancelling(false)
    }
  }

  const resetCancelState = () => {
    setShowCancelModal(false)
    setSelectedCancellationReason('')
    setCancellationDetails('')
    setChargeCancellationFee(false)
    setCancellationPercent('')
    setCancelStep('reason')
    setLinkedCancelCandidates([])
    setCancelStatusForCascade(null)
    setCancellingLinked(false)
  }

  // Cascade cancellation: cancel each linked tow with the SAME status the user
  // picked, but with NO fee (fee is per-tow). Calls updateTowStatus directly so
  // it never re-enters handleConfirmCancel — no prompt loop.
  const handleCascadeCancelLinked = async () => {
    if (!cancelStatusForCascade || linkedCancelCandidates.length === 0) {
      resetCancelState()
      return
    }
    setCancellingLinked(true)
    try {
      for (const candidate of linkedCancelCandidates) {
        await updateTowStatus(
          candidate.id,
          cancelStatusForCascade,
          selectedCancellationReason || 'ביטול גרירה מקושרת',
          cancellationDetails.trim() || undefined,
          undefined,
          user?.id
        )
      }
      await refreshTow()
      if (changeLogsLoaded) void loadChangeLogs(true)
      resetCancelState()
    } catch (err) {
      console.error('Error cancelling linked tow:', err)
      setCancellingLinked(false)
    }
  }

  const handleSkipLinkedCancel = () => {
    resetCancelState()
  }

  const closeCancelModal = () => {
    resetCancelState()
  }

  const closeDriverModal = () => {
    setShowAssignModal(false)
    setShowChangeDriverModal(false)
    setSelectedDriverId(null)
    setSelectedTruckId(null)
    setShowAllDrivers(false)
    setScheduleDate(new Date())
  }

  // ==================== Invoice Functions ====================
  
  const openInvoiceModal = () => {
    if (!tow) return
    setInvoiceData({
      description: `גרירה - ${getFromAddress()} → ${getToAddress()}`,
      amount: tow.final_price?.toString() || ''
    })
    setShowInvoiceModal(true)
  }

  const handleCreateInvoice = async () => {
    if (!tow || !companyId || !invoiceData.amount) return
    setCreatingInvoice(true)
    try {
      await createInvoiceFromTow(
        companyId,
        tow.id,
        tow.customer_id,
        parseFloat(invoiceData.amount),
        invoiceData.description || `גרירה - ${getFromAddress()} → ${getToAddress()}`
      )
      setHasInvoice(true)
      setShowInvoiceModal(false)
      alert('החשבונית נוצרה בהצלחה!')
    } catch (error) {
      console.error('Error creating invoice:', error)
      alert('שגיאה ביצירת חשבונית')
    } finally {
      setCreatingInvoice(false)
    }
  }

  const renderDriverModal = () => {
    const assignDriverTrucks = selectedDriverId ? getDriverTrucks(selectedDriverId) : []
    const assignTruckOptions =
      assignDriverTrucks.length > 0
        ? assignDriverTrucks
        : trucks.filter((t) => t.is_active)

    return (
  <div className="fixed inset-0 bg-black/50 flex items-end lg:items-center justify-center z-50">
    <div className="bg-white w-full lg:max-w-2xl lg:rounded-2xl lg:mx-4 overflow-hidden max-h-[90vh] flex flex-col rounded-t-2xl">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-[#33d4ff] text-white flex-shrink-0">
        <h2 className="font-bold text-lg">{tow?.driver ? 'שינוי נהג' : 'שיבוץ נהג'}</h2>
        <button onClick={closeDriverModal} className="p-2 hover:bg-white/20 rounded-lg">
          <X size={20} />
        </button>
      </div>

      {driversTrucksLoading && drivers.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-[#33d4ff] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !selectedDriverId ? (
        <DriverCalendarPicker
          companyId={companyId || ''}
          drivers={drivers}
          requiredTruckTypes={(tow?.required_truck_types as string[]) || []}
          onConfirm={(driverId, date, time) => {
            setSelectedDriverId(driverId)
            setScheduleDate(new Date(date + 'T' + time + ':00'))
            const driverTrucks = getDriverTrucks(driverId)
            if (driverTrucks.length === 1) {
              setSelectedTruckId(driverTrucks[0].id)
            } else {
              setSelectedTruckId(null)
            }
          }}
          onClose={closeDriverModal}
        />
      ) : (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-4">
            <button
              onClick={() => {
                setSelectedDriverId(null)
                setSelectedTruckId(null)
              }}
              className="flex items-center gap-2 text-[#33d4ff] text-sm font-medium"
            >
              <ArrowRight size={18} />
              חזור לרשימת נהגים
            </button>

            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center">
                  <User size={24} className="text-gray-400" />
                </div>
                <div>
                  <p className="font-bold text-gray-800">
                    {drivers.find(d => d.id === selectedDriverId)?.user?.full_name}
                  </p>
                  <p className="text-sm text-gray-500">
                    {drivers.find(d => d.id === selectedDriverId)?.user?.phone}
                  </p>
                </div>
              </div>
            </div>

            {assignDriverTrucks.length === 1 ? (
              <div className="p-3 bg-gray-50 rounded-xl text-sm text-gray-600 flex items-center gap-2">
                <Truck size={16} className="text-gray-400" />
                {`${getTruckTypeLabel(assignDriverTrucks[0].truck_type)} — ${assignDriverTrucks[0].plate_number}`}
              </div>
            ) : (
              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  בחירת משאית
                </label>
                <select
                  value={selectedTruckId || ''}
                  onChange={(e) => setSelectedTruckId(e.target.value || null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                >
                  <option value="">בחרי משאית...</option>
                  {assignTruckOptions.map((truck) => (
                    <option key={truck.id} value={truck.id}>
                      {truck.plate_number}
                      {(truck.manufacturer || truck.model)
                        ? ` — ${[truck.manufacturer, truck.model].filter(Boolean).join(' ')}`
                        : ` — ${getTruckTypeLabel(truck.truck_type)}`}
                    </option>
                  ))}
                </select>
                {assignDriverTrucks.length === 0 && (
                  <p className="text-xs text-amber-700 mt-1.5 flex items-center gap-1">
                    <AlertTriangle size={12} />
                    לנהג זה אין משאית משויכת — בחרי משאית מהרשימה
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {selectedDriverId && (
        <div className="flex gap-3 px-5 py-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <button
            onClick={closeDriverModal}
            className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-100 transition-colors font-medium"
          >
            ביטול
          </button>
          <button
            onClick={handleAssignDriver}
            disabled={!selectedDriverId || !selectedTruckId || assigning}
            className="flex-1 py-3 bg-[#33d4ff] text-white rounded-xl hover:bg-[#21b8e6] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {assigning ? 'משבץ...' : tow?.driver ? 'שנה נהג' : 'שבץ נהג'}
          </button>
        </div>
      )}
    </div>
  </div>
)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-[#33d4ff] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">טוען גרירה...</p>
        </div>
      </div>
    )
  }

  if (error || !tow) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error || 'הגרירה לא נמצאה'}</p>
          <Link href="/dashboard/tows" className="text-[#33d4ff]">חזרה לרשימת גרירות</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {isRefreshing && (
        <div className="fixed top-4 left-4 z-50">
          <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
        </div>
      )}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex justify-between items-center h-14 sm:h-16 gap-3">
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href="/dashboard/tows"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-gt-brand text-gt-brand text-xs font-medium hover:bg-gt-brand-subtle transition-colors"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                חזרה לעמוד הגרירות
              </Link>
              <button
                type="button"
                onClick={handleBackToCalendar}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-gt-brand text-gt-brand text-xs font-medium hover:bg-gt-brand-subtle transition-colors"
              >
                <Calendar className="w-3.5 h-3.5" />
                חזרה ליומן
              </button>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <div className="min-w-0">
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                  <h1 className="font-bold text-gray-800 text-base sm:text-lg font-mono">
                  {tow.order_number ? `#${tow.order_number}${tow.customer_order_number ? ` (${tow.customer_order_number})` : ''}` : tow.id.slice(0, 8)}                  </h1>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${statusConfig[tow.status]?.color}`}>
                    {statusConfig[tow.status]?.label}
                  </span>
                  {tow.manually_closed_at && (
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full border bg-violet-50 text-violet-700 border-violet-200">
                      נסגרה ידנית
                    </span>
                  )}
                  {tow.tow_type && (
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full border bg-gray-100 text-gray-700 border-gray-200">
                      {getTowTypeLabel(tow.tow_type)}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 hidden sm:block">נוצר ב-{new Date(tow.created_at).toLocaleString('he-IL')}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {isEditing ? (
                <>
                  <button 
                    onClick={handleCancelEdit}
                    disabled={saving}
                    className="p-2 sm:px-3 sm:py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm flex items-center gap-2"
                  >
                    <X size={18} />
                    <span className="hidden sm:inline">ביטול</span>
                  </button>
                  <button 
                    onClick={handleSaveChanges}
                    disabled={saving}
                    className="p-2 sm:px-3 sm:py-2 bg-[#33d4ff] text-white hover:bg-[#21b8e6] rounded-lg text-sm flex items-center gap-2 disabled:bg-gray-300"
                  >
                    <Save size={18} />
                    <span className="hidden sm:inline">{saving ? 'שומר...' : 'שמור'}</span>
                  </button>
                </>
              ) : (
                <>
                  {canManualClose && (
                    <button
                      onClick={openManualCloseModal}
                      className="p-2 sm:px-3 sm:py-2 text-violet-700 hover:bg-violet-50 rounded-lg text-sm flex items-center gap-2"
                    >
                      <CheckCircle size={18} />
                      <span className="hidden sm:inline">סגור גרירה ידנית</span>
                    </button>
                  )}
                  {canApproveQuoteTow && (
                    <button
                      type="button"
                      onClick={handleApproveQuote}
                      disabled={approvingQuote}
                      className="p-2 sm:px-3 sm:py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg text-sm flex items-center gap-2 disabled:opacity-50"
                    >
                      <CheckCircle size={18} />
                      <span className="hidden sm:inline">
                        {approvingQuote ? 'מאשר...' : 'אשר הצעה'}
                      </span>
                    </button>
                  )}
                  {canEdit && (
                  <button 
                    onClick={() => router.push(`/dashboard/tows/create?edit=${tow.id}`)}
                    className="p-2 sm:px-3 sm:py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm flex items-center gap-2"
                  >
                    <Edit2 size={18} />
                    <span className="hidden sm:inline">ערוך</span>
                  </button>
                  )}
                  <button
                    type="button"
                    onClick={() => router.push(`/dashboard/tows/create?duplicate=${tow.id}`)}
                    className="p-2 sm:px-3 sm:py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm flex items-center gap-2"
                  >
                    <RefreshCw size={18} />
                    <span className="hidden sm:inline">שכפל גרירה</span>
                  </button>
                  <button 
                    onClick={handleCancelClick}
                    className="p-2 sm:px-3 sm:py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm flex items-center gap-2"
                  >
                    <X size={18} />
                    <span className="hidden sm:inline">בטל גרירה</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {tow.status === 'cancelled' && (
        <div className="max-w-6xl mx-auto px-4 mt-4">
          <div className="flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 border-r-4 border-r-red-500 rounded-xl">
            <span className="text-red-500 text-lg shrink-0">✕</span>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-red-700 text-sm">גרירה זו בוטלה</p>
              {(tow as { cancellation_reason?: string | null }).cancellation_reason && (
                <p className="text-red-500 text-xs mt-0.5">
                  {(tow as { cancellation_reason?: string | null }).cancellation_reason}
                </p>
              )}
              {(tow as { cancellation_details?: string | null }).cancellation_details && (
                <p className="text-gray-500 text-xs mt-0.5">
                  {(tow as { cancellation_details?: string | null }).cancellation_details}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {tow.status === 'cancelled_charged' && (
        <div className="max-w-6xl mx-auto px-4 mt-4">
          <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 border-r-4 border-r-amber-500 rounded-xl text-amber-900">
            <span className="text-amber-700 text-lg shrink-0">₪</span>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-amber-900 text-sm">גרירה זו בוטלה בחיוב</p>
              {(tow as { cancellation_reason?: string | null }).cancellation_reason && (
                <p className="text-amber-800 text-sm mt-0.5">
                  {(tow as { cancellation_reason?: string | null }).cancellation_reason}
                </p>
              )}
              {(tow as { cancellation_details?: string | null }).cancellation_details && (
                <p className="text-gray-500 text-xs mt-0.5">
                  {(tow as { cancellation_details?: string | null }).cancellation_details}
                </p>
              )}
              {storedCancellationFeeDisplay && storedCancellationFeeDisplay.feeTotal > 0 && (
                <div className="mt-3 pt-3 border-t border-amber-200/80">
                  <CancellationFeeBreakdownDisplay
                    feeBeforeVat={storedCancellationFeeDisplay.feeBeforeVat}
                    vatAmount={storedCancellationFeeDisplay.vatAmount}
                    feeTotal={storedCancellationFeeDisplay.feeTotal}
                    vatPercentLabel={vatPercentLabel}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 py-4 sm:py-6">
        {tow.linked_tow_id && (
          <div className="mb-4 bg-gradient-to-l from-purple-50 to-white border border-purple-200 rounded-xl p-4 flex items-center gap-3">
            <div className="shrink-0 w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <Link2 size={20} className="text-purple-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-gray-800">גרירה מקושרת</div>
              <div className="text-xs text-gray-600 mt-0.5">גרירה זו נוצרה כהמשך לגרירה קודמת</div>
            </div>
            <Link
              href={`/dashboard/tows/${tow.linked_tow_id}`}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 transition-colors flex items-center gap-1"
            >
              צפה בגרירה
              <ChevronLeft size={14} />
            </Link>
          </div>
        )}

        {childTows.map((child) => (
          <div
            key={child.id}
            className="mb-4 bg-gradient-to-l from-cyan-50 to-white border border-cyan-200 rounded-xl p-4 flex items-center gap-3"
          >
            <div className="shrink-0 w-10 h-10 rounded-lg bg-cyan-100 flex items-center justify-center">
              <ArrowRight size={20} className="text-cyan-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-gray-800">
                גרירת המשך
                {child.order_number && (
                  <span className="text-gray-400 font-normal mr-2">#{child.order_number}</span>
                )}
              </div>
              <div className="text-xs text-gray-600 mt-0.5">נוצרה גרירה נוספת כהמשך לגרירה זו</div>
            </div>
            <Link
              href={`/dashboard/tows/${child.id}`}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-cyan-600 text-white text-sm font-medium hover:bg-cyan-700 transition-colors flex items-center gap-1"
            >
              צפה בגרירה
              <ChevronLeft size={14} />
            </Link>
          </div>
        ))}

        <div className="flex gap-1 mb-4 sm:mb-6 bg-gray-100 p-1 rounded-xl w-fit overflow-x-auto">
          <button
            onClick={() => handleTabChange('details')}
            className={`px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'details' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <FileText size={16} />
            פרטים
          </button>
          <button
            onClick={() => handleTabChange('history')}
            className={`px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'history' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <Clock size={16} />
            היסטוריה
          </button>
          <button
            onClick={() => handleTabChange('images')}
            className={`px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'images' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <Image size={16} />
            תמונות
          </button>
          <button
            onClick={() => handleTabChange('portal')}
            className={`px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'portal' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <Eye size={16} />
            פורטל לקוח
          </button>
        </div>

        {activeTab === 'details' && (
          <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
            <div className="flex-1 space-y-4 sm:space-y-6">
              {/* בקשת דחייה פעילה */}
              {rejectionRequests.some(r => r.status === 'pending') && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl overflow-hidden">
                  <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-amber-200">
                    <h2 className="font-bold text-amber-800">בקשת דחייה ממתינה לטיפול</h2>
                  </div>
                  <div className="p-4 sm:p-5 space-y-3">
                    {rejectionRequests.filter(r => r.status === 'pending').map((req) => {
                      const reasonInfo = REJECTION_REASONS.find(r => r.key === req.reason)
                      return (
                        <div key={req.id} className="space-y-2">
                          <div className="text-sm font-medium text-amber-900">
                            {req.driverName || 'נהג'} ביקש לדחות את הגרירה
                          </div>
                          <div className="text-sm text-amber-700">
                            סיבה: {req.reason === 'other' ? (req.reason_note || 'אחר') : (reasonInfo?.label || req.reason)}
                          </div>
                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={async () => {
                                setProcessingRejection(true)
                                await approveRejectionRequest(req.id, user?.id || '')
                                await refreshTow()
                                setProcessingRejection(false)
                              }}
                              disabled={processingRejection}
                              className="px-4 py-2 bg-green-500 text-white text-sm rounded-xl font-medium hover:bg-green-600 disabled:opacity-50"
                            >
                              אשר דחייה
                            </button>
                            <button
                              onClick={async () => {
                                setProcessingRejection(true)
                                await denyRejectionRequest(req.id, user?.id || '')
                                await refreshTow()
                                setProcessingRejection(false)
                              }}
                              disabled={processingRejection}
                              className="px-4 py-2 bg-red-500 text-white text-sm rounded-xl font-medium hover:bg-red-600 disabled:opacity-50"
                            >
                              דחה בקשה
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              {/* פרטי לקוח */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 sm:px-5 py-3 sm:py-4 bg-gray-50 border-b border-gray-200">
                  <h2 className="font-bold text-gray-800 flex items-center gap-2">
                    <User size={18} />
                    פרטי לקוח
                  </h2>
                </div>
                <div className="p-4 sm:p-5">
                  {isEditing ? (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">חיפוש לקוח</label>
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="שם או טלפון..."
                            value={editCustomerSearch}
                            onChange={(e) => {
                              setEditCustomerSearch(e.target.value)
                              setShowCustomerResults(e.target.value.length > 0)
                              if (!customersLoaded) void loadCustomers()
                            }}
                            onFocus={() => {
                              if (!customersLoaded) void loadCustomers()
                            }}
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                          />
                          {customersLoading && (
                            <p className="text-xs text-gray-400 mt-1">טוען לקוחות...</p>
                          )}
                          {showCustomerResults && filteredCustomers.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 overflow-hidden max-h-48 overflow-y-auto">
                              {filteredCustomers.map((customer) => (
                                <div
                                  key={customer.id}
                                  onClick={() => {
                                    setEditCustomerId(customer.id)
                                    setEditCustomerSearch(customer.name)
                                    setShowCustomerResults(false)
                                  }}
                                  className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                                >
                                  <p className="font-medium text-gray-800">{customer.name}</p>
                                  <p className="text-sm text-gray-500">{customer.phone}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-800">{tow.customer?.name || 'לא צוין'}</p>
                        {tow.customer?.phone && (
                          <a href={`tel:${tow.customer.phone}`} className="text-[#33d4ff] text-sm flex items-center gap-1 mt-1">
                            <Phone size={14} />
                            {tow.customer.phone}
                          </a>
                        )}
                        {tow.customer?.email && (
                          <a href={`mailto:${tow.customer.email}`} className="text-[#33d4ff] text-sm flex items-center gap-1 mt-1">
                            <Mail size={14} />
                            {tow.customer.email}
                          </a>
                        )}
                        {tow.customer?.address && (
                          <p className="text-gray-500 text-sm flex items-center gap-1 mt-1">
                            <MapPin size={14} />
                            {tow.customer.address}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* תאריך ושעה */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 sm:px-5 py-3 sm:py-4 bg-gray-50 border-b border-gray-200">
                  <h2 className="font-bold text-gray-800 flex items-center gap-2">
                    <Clock size={18} />
                    תאריך ושעה
                  </h2>
                </div>
                <div className="p-4 sm:p-5">
                  {isEditing ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">תאריך</label>
                          <DateInput
                            value={editScheduledDate}
                            onChange={setEditScheduledDate}
                            className="w-full"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">שעה</label>
                          <TimeInput
                            value={editScheduledTime}
                            onChange={setEditScheduledTime}
                            className="w-full px-3 py-2.5 rounded-xl text-sm focus:ring-2 focus:ring-[#33d4ff]"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">שעת סיום (אופציונלי)</label>
                        <div className="grid grid-cols-2 gap-4">
                          <TimeInput
                            value={editScheduledEndTime}
                            onChange={(v) => {
                              setEditScheduledEndTime(v)
                              if (v && !editScheduledEndDate && editScheduledDate) {
                                setEditScheduledEndDate(editScheduledDate)
                              }
                            }}
                            className="w-full px-3 py-2.5 rounded-xl text-sm focus:ring-2 focus:ring-[#33d4ff]"
                          />
                          <DateInput
                            value={editScheduledEndDate}
                            onChange={setEditScheduledEndDate}
                            className="w-full"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#33d4ff]/10 rounded-lg flex items-center justify-center">
                        <Clock size={20} className="text-[#33d4ff]" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">
                          {new Date(tow.scheduled_at || tow.created_at).toLocaleDateString('he-IL', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </p>
                        <p className="text-sm text-gray-500">
                          {new Date(tow.scheduled_at || tow.created_at).toLocaleTimeString('he-IL', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                        {tow.scheduled_end_at && (
                          <p className="text-sm text-gray-500 mt-1">
                            סיום מתוכנן:{' '}
                            {new Date(tow.scheduled_end_at).toLocaleDateString('he-IL', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                            })}{' '}
                            {new Date(tow.scheduled_end_at).toLocaleTimeString('he-IL', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {showEndTimeEditor && (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="px-4 sm:px-5 py-3 sm:py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between gap-2">
                    <h2 className="font-bold text-gray-800 flex items-center gap-2">
                      <Clock size={18} />
                      שעת סיום
                    </h2>
                    {!endEditOpen && (
                      <button
                        type="button"
                        onClick={openEndTimeEditor}
                        className="text-sm text-[#33d4ff] hover:text-[#21b8e6] font-medium"
                      >
                        ערוך שעת סיום
                      </button>
                    )}
                  </div>
                  <div className="p-4 sm:p-5">
                    {endEditOpen ? (
                      <div className="space-y-4">
                        <p className="text-xs text-gray-500">
                          {tow.status === 'completed'
                            ? 'מעדכן את זמן הסיום בפועל (completed_at) — משפיע על תצוגת היומן'
                            : 'מעדכן את שעת הסיום המתוכננת (scheduled_end_at)'}
                        </p>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm text-gray-600 mb-1">תאריך</label>
                            <DateInput
                              value={endEditDate}
                              onChange={setEndEditDate}
                              className="w-full"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-gray-600 mb-1">שעה</label>
                            <TimeInput
                              value={endEditTime}
                              onChange={(v) => {
                                setEndEditTime(v)
                                if (v && !endEditDate) {
                                  const startSource = tow.scheduled_at || tow.created_at
                                  if (startSource) {
                                    setEndEditDate(dateToYyyyMmDd(new Date(startSource)))
                                  }
                                }
                              }}
                              className="w-full px-3 py-2.5 rounded-xl text-sm focus:ring-2 focus:ring-[#33d4ff]"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => void handleSaveEndTime()}
                            disabled={endEditSaving}
                            className="px-4 py-2 bg-[#33d4ff] text-white rounded-xl text-sm font-medium hover:bg-[#21b8e6] disabled:bg-gray-300"
                          >
                            {endEditSaving ? 'שומר...' : 'שמור שעת סיום'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEndEditOpen(false)}
                            disabled={endEditSaving}
                            className="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                          >
                            ביטול
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        {getEndTimeDisplaySource() ? (
                          <p className="text-sm text-gray-800">
                            {new Date(getEndTimeDisplaySource()!).toLocaleDateString('he-IL', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}{' '}
                            {new Date(getEndTimeDisplaySource()!).toLocaleTimeString('he-IL', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        ) : (
                          <p className="text-sm text-gray-400">לא הוגדרה שעת סיום</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {tow.tow_type === 'exchange' && !tow.linked_tow_id && (
                <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-sm font-medium text-amber-800 mb-2">
                    גרירת תקין ↔ תקול — נהג שני לרכב התקול
                  </p>
                  <p className="text-xs text-amber-600 mb-3">
                    ניתן לשבץ נהג נוסף שיטפל בהובלת הרכב התקול ליעד
                  </p>
                  <button
                    onClick={() => {
                      setShowLinkedTowModal(true)
                      void loadDriversAndTrucks()
                    }}
                    className="px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-medium"
                  >
                    הוסף נהג לרכב התקול
                  </button>
                </div>
              )}

              {/* רכבים */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 sm:px-5 py-3 sm:py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                  <h2 className="font-bold text-gray-800 flex items-center gap-2">
                    <Truck size={18} />
                    רכבים ({isEditing ? editVehicles.length : tow.vehicles?.length || 0})
                  </h2>
                  {isEditing && (
                    <button 
                      onClick={addVehicle}
                      className="flex items-center gap-1 text-[#33d4ff] text-sm font-medium hover:text-[#21b8e6]"
                    >
                      <Plus size={16} />
                      הוסף רכב
                    </button>
                  )}
                </div>
                <div className="p-4 sm:p-5">
                  {isEditing ? (
                    <div className="space-y-4">
                      {editVehicles.map((vehicle, idx) => (
                        <div key={vehicle.id} className="p-4 border border-gray-200 rounded-xl">
                          <div className="flex items-center justify-between mb-3">
                            <span className="font-medium text-gray-800">רכב {idx + 1}</span>
                            {editVehicles.length > 1 && (
                              <button 
                                onClick={() => removeVehicle(vehicle.id)}
                                className="text-red-500 hover:text-red-600"
                              >
                                <Trash2 size={18} />
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">מספר רישוי</label>
                              <input
                                type="text"
                                value={vehicle.plateNumber}
                                onChange={(e) => updateVehicle(vehicle.id, 'plateNumber', normalizePlate(e.target.value))}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">יצרן</label>
                              <input
                                type="text"
                                value={vehicle.manufacturer}
                                onChange={(e) => updateVehicle(vehicle.id, 'manufacturer', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">דגם</label>
                              <input
                                type="text"
                                value={vehicle.model}
                                onChange={(e) => updateVehicle(vehicle.id, 'model', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">צבע</label>
                              <input
                                type="text"
                                value={vehicle.color}
                                onChange={(e) => updateVehicle(vehicle.id, 'color', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                              />
                            </div>
                          </div>
                          <div className="mt-3">
                            <label className="block text-xs text-gray-500 mb-1">תקלה</label>
                            <input
                              type="text"
                              value={vehicle.towReason}
                              onChange={(e) => updateVehicle(vehicle.id, 'towReason', e.target.value)}
                              placeholder="למשל: מנוע, תקר, סוללה..."
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {tow.vehicles && tow.vehicles.length > 0 ? tow.vehicles.map((vehicle: any, idx: number) => {
                        const core = toTowVehicleCoreInfo(vehicle)
                        return (
                        <div key={vehicle.id} className={idx > 0 ? 'pt-4 border-t border-gray-100' : ''}>
                          <div className="flex items-center gap-4 mb-3">
                            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                              <Truck size={24} className="text-gray-400" />
                            </div>
                            <div>
                              <p className="font-mono text-lg font-bold text-gray-800">{core.plate}</p>
                              {core.isWorking === true && (
                                <span className="inline-block px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full mr-2">תקין</span>
                              )}
                              {core.isWorking === false && (
                                <span className="inline-block px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded-full mr-2">תקול</span>
                              )}
                              <p className="text-sm text-gray-500">
                                {core.manufacturer} {core.model}{core.year ? `, ${core.year}` : ''}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {core.vehicleTypeLabel && (
                              <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-sm">
                                {core.vehicleTypeLabel}
                              </span>
                            )}
                            {core.color && (
                              <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-sm">{core.color}</span>
                            )}
                            {core.vehicleCode && (
                              <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-sm">#{core.vehicleCode}</span>
                            )}
                            {core.machineryType && (
                              <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-sm">
                                סוג צמ&quot;ה: {core.machineryType}
                              </span>
                            )}
                            {core.chassis && (
                              <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-sm">
                                מספר שלדה: {core.chassis}
                              </span>
                            )}
                            {core.fuelType && (
                              <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-sm">
                                סוג דלק: {core.fuelType}
                              </span>
                            )}
                            {core.importType && (
                              <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-sm">
                                סוג ייבוא: {core.importType}
                              </span>
                            )}
                            {core.weightLines.map((line) => (
                              <span
                                key={line.label}
                                className="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-sm"
                              >
                                {line.label}: {line.value}
                              </span>
                            ))}
                            {vehicle.tow_reason && (
                              <span className="px-3 py-1 bg-red-50 text-red-600 rounded-lg text-sm">{vehicle.tow_reason}</span>
                            )}
                          </div>
                        </div>
                        )
                      }) : (
                        <p className="text-gray-500">אין רכבים</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* סוג גרר נדרש */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 sm:px-5 py-3 sm:py-4 bg-gray-50 border-b border-gray-200">
                  <h2 className="font-bold text-gray-800 flex items-center gap-2">
                    <Truck size={18} />
                    סוג גרר נדרש
                  </h2>
                </div>
                <div className="p-4 sm:p-5">
                  {isEditing ? (
                    <TowTruckTypeSelector
                      selectedTypes={editRequiredTruckTypes}
                      onChange={setEditRequiredTruckTypes}
                    />
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {(tow.required_truck_types as string[])?.length > 0 ? (
                        (tow.required_truck_types as string[]).map((type) => (
                          <span key={type} className="px-3 py-1.5 bg-[#33d4ff]/10 text-[#33d4ff] rounded-lg text-sm font-medium">
                            {getTruckTypeLabel(type)}
                          </span>
                        ))
                      ) : (
                        <span className="text-gray-500">לא הוגדר</span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* מסלול */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 sm:px-5 py-3 sm:py-4 bg-gray-50 border-b border-gray-200">
                  <h2 className="font-bold text-gray-800 flex items-center gap-2">
                    <MapPin size={18} />
                    מסלול
                    {tow.points && tow.points.length > 0 && (
                      <span className="text-sm font-normal text-gray-500">({tow.points.length} נקודות)</span>
                    )}
                    {tow.start_from_base && (
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700 border border-blue-200">יציאה מבסיס</span>
                    )}
                    {tow.dropoff_to_storage && (
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-orange-100 text-orange-700 border border-orange-200">פריקה למגרש</span>
                    )}
                  </h2>
                </div>
                <div className="p-4 sm:p-5">
                  {isEditing ? (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">כתובת מוצא</label>
                        <input
                          type="text"
                          value={editFromAddress}
                          onChange={(e) => setEditFromAddress(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">כתובת יעד</label>
                        <input
                          type="text"
                          value={editToAddress}
                          onChange={(e) => setEditToAddress(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                        />
                      </div>
                    </div>
                  ) : tow.points && tow.points.length > 0 ? (
                    /* תצוגת נקודות חדשה */
                    <div className="space-y-3">
                      {tow.points.map((point: any, idx: number) => (
                        <div 
                          key={point.id}
                          className={`p-4 rounded-2xl ${
                            point.point_type === 'pickup' ? 'bg-green-50' 
                            : point.point_type === 'exchange' ? 'bg-purple-50'
                            : point.point_type === 'stop' ? 'bg-gray-50'
                            : 'bg-red-50'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex flex-col items-center">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                                point.point_type === 'pickup' ? 'bg-green-500'
                                : point.point_type === 'exchange' ? 'bg-purple-500'
                                : point.point_type === 'stop' ? 'bg-gray-400'
                                : 'bg-red-500'
                              }`}>
                                {idx + 1}
                              </div>
                              {idx < (tow.points?.length || 0) - 1 && (
                                <div className="w-0.5 h-6 bg-gray-300 mt-1" />
                              )}
                            </div>
                            <div className="flex-1">
                              <div className={`text-sm font-medium ${
                                point.point_type === 'pickup' ? 'text-green-700'
                                : point.point_type === 'exchange' ? 'text-purple-700'
                                : point.point_type === 'stop' ? 'text-gray-600'
                                : 'text-red-700'
                              }`}>
                                {getRoutePointLabel(point, tow.tow_type, tow.points ?? [])}
                              </div>
                              <div className="text-gray-800 font-medium">{point.address || 'לא צוין'}</div>
                              {point.notes && (
                                <div className="text-xs text-gray-500 italic mt-1">{point.notes}</div>
                              )}
                              {point.order_notes && (
                                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 mt-2">
                                  הערות לעצירה: {point.order_notes}
                                </div>
                              )}
                              {(point.recipient_name || point.recipient_phone) && (
                                <div className="text-xs text-gray-600 mt-1">
                                  נמסר ל: {point.recipient_name || '—'}
                                  {point.recipient_phone ? ` ${point.recipient_phone}` : ''}
                                </div>
                              )}
                              {(point.driver_visited_at || point.driver_notes) && (
                                <div className="text-xs text-slate-600 mt-2 space-y-1">
                                  {point.driver_visited_at && (
                                    <div>
                                      ביקור נהג: {new Date(point.driver_visited_at).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                  )}
                                  {point.driver_notes && <div>הערת נהג: {point.driver_notes}</div>}
                                </div>
                              )}
                              {(point.arrived_at || point.completed_at) && (
                                <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                                  {point.arrived_at && (
                                    <span>הגעה: {new Date(point.arrived_at).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                                  )}
                                  {point.completed_at && (
                                    <span>סיום: {new Date(point.completed_at).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                                  )}
                                </div>
                              )}

                              {/* רכבים בנקודה */}
                              {point.vehicles && point.vehicles.length > 0 && (
                                <div className="text-sm text-gray-500 mt-1">
                                  {point.vehicles.map((v: any) => 
                                    v.vehicle?.plate_number || v.vehicle?.manufacturer
                                  ).filter(Boolean).join(', ') || `${point.vehicles.length} רכבים`}
                                </div>
                              )}
                              
                              {/* איש קשר */}
                              {(point.contact_name || point.contact_phone) && (
                                <div className="flex items-center gap-2 text-sm text-gray-400 mt-1">
                                  <User size={12} />
                                  <span>{point.contact_name}</span>
                                  {point.contact_phone && (
                                    <a href={`tel:${point.contact_phone}`} className="text-[#33d4ff] flex items-center gap-1">
                                      <Phone size={12} />
                                      {point.contact_phone}
                                    </a>
                                  )}
                                </div>
                              )}

                              {/* סטטוס נקודה */}
                              {point.status && point.status !== 'pending' && (
                                <div className="mt-2 pt-2 border-t border-gray-200/50">
                                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                                    point.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                                    point.status === 'arrived' ? 'bg-blue-100 text-blue-700' :
                                    'bg-gray-100 text-gray-600'
                                  }`}>
                                    {point.status === 'completed' ? 'הושלם' : point.status === 'arrived' ? 'הנהג הגיע' : point.status}
                                  </span>
                                </div>
                              )}

                              {/* תמונות נקודה */}
                              {point.images && point.images.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-gray-200/50">
                                  <div className="text-xs text-gray-400 mb-1">{point.images.length} תמונות</div>
                                  <div className="flex gap-2 overflow-x-auto">
                                    {point.images.map((img: any) => {
                                      const plate = img.tow_vehicle_id
                                        ? vehiclePlateById[img.tow_vehicle_id]
                                        : undefined
                                      return (
                                        <div key={img.id} className="flex flex-col items-center shrink-0">
                                          <a href={img.image_url} target="_blank" rel="noopener noreferrer">
                                            <img src={img.image_url} alt={img.image_type} className="w-16 h-16 object-cover rounded-lg border border-gray-200" />
                                          </a>
                                          {plate && (
                                            <span className="text-xs text-gray-500 mt-0.5">{plate}</span>
                                          )}
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    /* Fallback לתצוגה ישנה */
                    <div className="flex gap-3 sm:gap-4">
                      <div className="flex flex-col items-center pt-1">
                        <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                        <div className="w-0.5 flex-1 bg-gray-200 my-1"></div>
                        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                      </div>
                      <div className="flex-1 space-y-4">
                        <div>
                          <p className="text-sm text-gray-500">מוצא</p>
                          <p className="font-medium text-gray-800">{getFromAddress()}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">יעד</p>
                          <p className="font-medium text-gray-800">{getToAddress()}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

               {/* תוספות שירות */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 sm:px-5 py-3 sm:py-4 bg-gray-50 border-b border-gray-200">
                  <h2 className="font-bold text-gray-800 flex items-center gap-2">
                    🔧 תוספות שירות
                  </h2>
                </div>
                <div className="p-4 sm:p-5">
                  {isEditing ? (
                    <div className="space-y-4">
                      <ServiceSurchargeSelector
                        services={serviceSurchargesData}
                        selectedServices={editSelectedServices}
                        onChange={setEditSelectedServices}
                      />
                      <ManualSurchargeSection
                        manualSurcharges={editManualSurcharges}
                        onChange={setEditManualSurcharges}
                      />
                    </div>
                  ) : (
                    <div>
                      {tow.price_breakdown?.service_surcharges && tow.price_breakdown.service_surcharges.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {tow.price_breakdown.service_surcharges.map((s: any, idx: number) => (
                            <span 
                              key={s.id || idx} 
                              className="px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-sm"
                            >
                              {s.label}
                              {s.units && s.units > 1 && ` (×${s.units})`}
                              {' - '}₪{s.amount}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-400 text-sm">אין תוספות שירות</p>
                      )}
                    </div>
                  )}
                </div>
              </div>     

              {/* הערות */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 sm:px-5 py-3 sm:py-4 bg-gray-50 border-b border-gray-200">
                  <h2 className="font-bold text-gray-800">הערות</h2>
                </div>
                <div className="p-4 sm:p-5">
                  {isEditing ? (
                    <textarea
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      rows={3}
                      placeholder="הערות לגרירה..."
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                    />
                  ) : (
                    <p className="text-gray-600">{tow.notes || 'אין הערות'}</p>
                  )}
                </div>
              </div>
            </div>

            {/* סיידבר */}
            <div className="lg:w-80 space-y-4 sm:space-y-6">
              {/* נהג */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 sm:px-5 py-3 sm:py-4 bg-[#33d4ff] text-white">
                  <h2 className="font-bold">נהג</h2>
                </div>
                <div className="p-4 sm:p-5">
                  {tow.driver ? (
                    <div>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                          <User size={24} className="text-gray-400" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">{tow.driver.user?.full_name}</p>
                          {tow.driver.user?.phone && (
                            <a href={`tel:${tow.driver.user.phone}`} className="text-[#33d4ff] text-sm">{tow.driver.user.phone}</a>
                          )}
                          {tow.truck && (
                            <p className="text-xs text-gray-500 mt-1">{tow.truck.plate_number}</p>
                          )}
                        </div>
                      </div>
                      {canEdit && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => openDriverModal('change')}
                            className="flex-1 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50"
                          >
                            שנה נהג
                          </button>
                          <button
                            onClick={() => setShowRemoveDriverConfirm(true)}
                            className="flex-1 py-2 border border-red-200 text-red-600 rounded-xl text-sm hover:bg-red-50"
                          >
                            הסר נהג
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <User size={32} className="text-gray-300" />
                      </div>
                      <p className="text-gray-500 mb-4">לא שובץ נהג</p>
                      <button
                        onClick={() => openDriverModal('assign')}
                        className="w-full py-3 bg-[#33d4ff] text-white rounded-xl font-medium hover:bg-[#21b8e6] transition-colors"
                      >
                        שבץ נהג
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {/* מחיר */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 sm:px-5 py-3 sm:py-4 bg-gray-800 text-white">
                  <h2 className="font-bold">סיכום מחיר</h2>
                </div>
                <div className="p-4 sm:p-5">
                  {isEditing ? (
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">מחיר סופי</label>
                      <input
                        type="number"
                        value={editFinalPrice}
                        onChange={(e) => setEditFinalPrice(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-left focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                      />
                    </div>
                  ) : tow.price_breakdown && tow.price_mode !== 'custom' ? (
                    (() => {
                      const bd = tow.price_breakdown
                      const priceTotals = computeStoredPriceBreakdownTotals(bd, vatRate)
                      const { manualAdjustment } = priceTotals
                      return (
                    <div className="space-y-2 text-sm">
                      {/* מחיר בסיס */}
                      <div className="flex justify-between">
                        <span className="text-gray-600">מחיר בסיס ({isKnownVehicleType(bd.vehicle_type) ? getVehicleTypeLabel(bd.vehicle_type) : '—'})</span>
                        <span className="font-medium text-gray-800">₪{bd.base_price.toFixed(2)}</span>
                      </div>
                      
                      {/* מרחק */}
                      {bd.distance_km > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">מרחק ({bd.distance_km.toFixed(1)} ק״מ)</span>
                          <span className="font-medium text-gray-800">₪{bd.distance_price.toFixed(2)}</span>
                        </div>
                      )}

                      {(bd.deadhead_km ?? 0) > 0 && (bd.deadhead_price ?? 0) > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">מרחק סרק ({bd.deadhead_km!.toFixed(1)} ק״מ)</span>
                          <span className="font-medium text-gray-800">₪{bd.deadhead_price!.toFixed(2)}</span>
                        </div>
                      )}
                      
                      {/* תוספות זמן */}
                      {bd.time_surcharges?.filter((s: any) => s.amount > 0).map((surcharge: any, idx: number) => (
                        <div key={surcharge.id || idx} className="flex justify-between text-amber-600">
                          <span>{surcharge.label} (+{surcharge.percent}%)</span>
                          <span className="font-medium">₪{surcharge.amount.toFixed(2)}</span>
                        </div>
                      ))}
                      
                      {/* תוספות מיקום */}
                      {bd.location_surcharges?.map((surcharge: any, idx: number) => (
                        <div key={surcharge.id || idx} className="flex justify-between text-blue-600">
                          <span>{surcharge.label} (+{surcharge.percent}%)</span>
                          <span className="font-medium">₪{surcharge.amount.toFixed(2)}</span>
                        </div>
                      ))}
                      
                      {/* תוספות שירותים */}
                      {bd.service_surcharges?.map((surcharge: any, idx: number) => (
                        <div key={surcharge.id || idx} className="flex justify-between text-purple-600">
                          <span>{surcharge.label}{surcharge.units ? ` (×${surcharge.units})` : ''}</span>
                          <span className="font-medium">₪{surcharge.amount.toFixed(2)}</span>
                        </div>
                      ))}
                      
                      {/* הנחת לקוח */}
                      {bd.discount_amount > 0 && (
                        <div className="flex justify-between text-green-600">
                          <span>הנחה ({bd.discount_percent}%)</span>
                          <span className="font-medium">-₪{bd.discount_amount.toFixed(2)}</span>
                        </div>
                      )}

                      <div className="flex justify-between text-gray-600">
                        <span>סה״כ לפני מע״מ</span>
                        <span className="font-medium text-gray-800">₪{priceTotals.beforeVat.toFixed(2)}</span>
                      </div>

                      <div className="flex justify-between text-gray-500">
                        <span>מע״מ ({vatPercentLabel}%)</span>
                        <span className="font-medium">₪{priceTotals.preManualVat.toFixed(2)}</span>
                      </div>

                      <div className="flex justify-between font-semibold text-gray-800">
                        <span>סה״כ</span>
                        <span>₪{priceTotals.totalBeforeManual.toFixed(2)}</span>
                      </div>

                      {manualAdjustment && (
                        <>
                          <div
                            className={`flex justify-between ${
                              manualAdjustment.type === 'discount' ? 'text-green-600' : 'text-gray-800'
                            }`}
                          >
                            <span>
                              {manualAdjustment.type === 'discount'
                                ? `הנחה ידנית (${manualAdjustment.percent}%)`
                                : `תוספת ידנית (${manualAdjustment.percent}%)`}
                            </span>
                            <span className="font-medium">
                              {manualAdjustment.type === 'discount' ? '-' : '+'}
                              ₪{manualAdjustment.amount.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between text-gray-600">
                            <span>לפני מע״מ</span>
                            <span className="font-medium text-gray-800">
                              ₪{priceTotals.postManualBeforeVat.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between text-gray-500">
                            <span>מע״מ ({vatPercentLabel}%)</span>
                            <span className="font-medium">₪{priceTotals.postManualVat.toFixed(2)}</span>
                          </div>
                        </>
                      )}
                      
                      <div className="flex justify-between font-bold text-lg pt-2 border-t border-gray-200 mt-2">
                        <span>
                          {manualAdjustment ? 'סך הכל אחרי הנחה' : 'סה״כ כולל מע״מ'}
                        </span>
                        <span className="text-gray-800">₪{priceTotals.finalTotal.toFixed(2)}</span>
                      </div>
                      {storedCancellationFeeDisplay && storedCancellationFeeDisplay.feeTotal > 0 && (
                        <div className="pt-2 border-t border-amber-200 mt-2 bg-amber-50 -mx-4 px-4 py-2 rounded-lg">
                          <CancellationFeeBreakdownDisplay
                            feeBeforeVat={storedCancellationFeeDisplay.feeBeforeVat}
                            vatAmount={storedCancellationFeeDisplay.vatAmount}
                            feeTotal={storedCancellationFeeDisplay.feeTotal}
                            vatPercentLabel={vatPercentLabel}
                          />
                        </div>
                      )}
                    </div>
                      )
                    })()
                  ) : tow.price_mode === 'custom' ? (
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between text-gray-600">
                        <span>מחיר לפני מע"מ</span>
                        <span>₪{Math.round((tow.final_price ?? 0) / 1.18)}</span>
                      </div>
                      <div className="flex justify-between text-gray-600">
                        <span>מע"מ (18%)</span>
                        <span>₪{Math.round((tow.final_price ?? 0) - (tow.final_price ?? 0) / 1.18)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-lg pt-2 border-t border-gray-200 mt-2">
                        <span>סה"כ כולל מע"מ</span>
                        <span className="text-gray-800">₪{tow.final_price ?? 0}</span>
                      </div>
                      {storedCancellationFeeDisplay && storedCancellationFeeDisplay.feeTotal > 0 && (
                        <div className="pt-2 border-t border-amber-200 mt-2 bg-amber-50 -mx-4 px-4 py-2 rounded-lg">
                          <CancellationFeeBreakdownDisplay
                            feeBeforeVat={storedCancellationFeeDisplay.feeBeforeVat}
                            vatAmount={storedCancellationFeeDisplay.vatAmount}
                            feeTotal={storedCancellationFeeDisplay.feeTotal}
                            vatPercentLabel={vatPercentLabel}
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-sm text-gray-500">
                      <span>מע"מ (18%)</span>
                      <span>{Math.round((tow.final_price || 0) * 18 / 118)} ש״ח</span>
                    </div>
                    <div className="flex justify-between items-center border-t pt-2">
                      <span className="font-bold text-gray-800">סה״כ כולל מע"מ</span>
                      <span className="text-2xl font-bold text-gray-800">{tow.final_price || 0} ש״ח</span>
                    </div>
                    {storedCancellationFeeDisplay && storedCancellationFeeDisplay.feeTotal > 0 && (
                      <div className="pt-2 border-t border-amber-200 bg-amber-50 -mx-4 px-4 py-2 mt-2 rounded-lg">
                        <CancellationFeeBreakdownDisplay
                          feeBeforeVat={storedCancellationFeeDisplay.feeBeforeVat}
                          vatAmount={storedCancellationFeeDisplay.vatAmount}
                          feeTotal={storedCancellationFeeDisplay.feeTotal}
                          vatPercentLabel={vatPercentLabel}
                        />
                      </div>
                    )}
                  </div>
                )}
                </div>
              </div>

              {/* תשלום */}
              {(tow.payment_method || tow.invoice_name) && (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="px-4 sm:px-5 py-3 sm:py-4 bg-gray-50 border-b border-gray-200">
                    <h2 className="font-bold text-gray-800">פרטי תשלום</h2>
                  </div>
                  <div className="p-4 sm:p-5 space-y-3">
                    {tow.payment_method && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">אמצעי תשלום</span>
                        <span className="font-medium text-gray-800">
                          {tow.payment_method === 'cash' ? 'מזומן' : tow.payment_method === 'credit' ? 'אשראי' : tow.payment_method === 'invoice' ? 'חשבונית' : tow.payment_method}
                        </span>
                      </div>
                    )}
                    {Number((tow as { cash_collected?: number | null }).cash_collected) > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">מזומן שנגבה</span>
                        <span className="font-medium text-green-700">
                          ₪{(tow as { cash_collected?: number | null }).cash_collected}
                        </span>
                      </div>
                    )}
                    {tow.invoice_name && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">שם לחשבונית</span>
                        <span className="font-medium text-gray-800">{tow.invoice_name}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* חשבונית */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 sm:px-5 py-3 sm:py-4 bg-emerald-500 text-white">
                  <h2 className="font-bold flex items-center gap-2">
                    <Receipt size={18} />
                    חשבונית
                  </h2>
                </div>
                <div className="p-4 sm:p-5">
                  {hasInvoice ? (
                    <div className="text-center">
                      <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <CheckCircle size={24} className="text-emerald-600" />
                      </div>
                      <p className="text-gray-700 mb-3">חשבונית הופקה</p>
                      <Link
                        href={`/dashboard/invoices?tow=${tow.id}`}
                        className="w-full py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                      >
                        <FileText size={18} />
                        צפה בחשבונית
                      </Link>
                    </div>
                  ) : tow.status === 'completed' ? (
                    <div className="text-center">
                      <p className="text-gray-500 mb-4">לא הופקה חשבונית</p>
                      <button
                        onClick={openInvoiceModal}
                        className="w-full py-3 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2"
                      >
                        <Receipt size={18} />
                        הפק חשבונית
                      </button>
                    </div>
                  ) : (
                    <div className="text-center py-2">
                      <p className="text-gray-400 text-sm">
                        ניתן להפיק חשבונית לאחר השלמת הגרירה
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 sm:px-5 py-3 sm:py-4 bg-gray-50 border-b border-gray-200">
                <h2 className="font-bold text-gray-800">היסטוריית סטטוסים</h2>
              </div>
              <div className="p-4 sm:p-5">
                {(() => {
                  type TimelineEvent = {
                    time: string
                    label: string
                    color: string
                    isManualClose?: boolean
                  }

                  const events: TimelineEvent[] = []
                  const manualCloseLog = changeLogs.find((log) => log.field_name === 'סגירה ידנית')
                  
                  events.push({ time: tow.created_at, label: 'גרירה נוצרה', color: 'bg-gray-400' })
                  
                  if (tow.driver) {
                    events.push({ time: tow.created_at, label: `שובצה לנהג ${tow.driver.user?.full_name || ''}`, color: 'bg-blue-500' })
                  }
                  
                  if (tow.started_at) {
                    events.push({ time: tow.started_at, label: 'גרירה החלה', color: 'bg-indigo-500' })
                  }
                  
                  tow.points?.forEach((point: any) => {
                    const pointLabel = `${getRoutePointLabel(point, tow.tow_type, tow.points ?? [])} — ${point.address?.split(',')[0] || 'נקודה ' + point.point_order}`
                    
                    if (point.arrived_at) {
                      events.push({ time: point.arrived_at, label: `הנהג הגיע: ${pointLabel}`, color: 'bg-cyan-500' })
                    }
                    if (point.completed_at) {
                      events.push({ time: point.completed_at, label: `הושלם: ${pointLabel}`, color: 'bg-emerald-500' })
                    }
                  })
                  
                  if (tow.completed_at) {
                    events.push({ time: tow.completed_at, label: 'גרירה הושלמה', color: 'bg-emerald-600' })
                  }

                  if (tow.manually_closed_at) {
                    const adminName =
                      tow.manually_closed_by_user?.full_name ||
                      manualCloseLog?.user?.full_name ||
                      'מנהל'
                    events.push({
                      time: manualCloseLog?.changed_at || tow.manually_closed_at,
                      label: `🔒 הגרירה נסגרה ידנית ע״י ${adminName}`,
                      color: 'bg-orange-500',
                      isManualClose: true,
                    })
                  }
                  
                  rejectionRequests.forEach(req => {
                    const reasonInfo = REJECTION_REASONS.find(r => r.key === req.reason)
                    const reasonLabel = req.reason === 'other' ? (req.reason_note || 'אחר') : (reasonInfo?.label || req.reason)
                    events.push({
                      time: req.created_at,
                      label: `${req.driverName || 'נהג'} ביקש דחייה — ${reasonLabel}`,
                      color: 'bg-amber-400'
                    })
                    if (req.reviewed_at) {
                      events.push({
                        time: req.reviewed_at,
                        label: req.status === 'approved'
                          ? `בקשת הדחייה אושרה${req.reviewerName ? ` על ידי ${req.reviewerName}` : ''}`
                          : `בקשת הדחייה נדחתה${req.reviewerName ? ` על ידי ${req.reviewerName}` : ''}`,
                        color: req.status === 'approved' ? 'bg-green-500' : 'bg-red-400'
                      })
                    }
                  })

                  events.sort((a, b) => {
                    const timeDiff = new Date(a.time).getTime() - new Date(b.time).getTime()
                    if (timeDiff !== 0) return timeDiff
                    if (a.isManualClose) return 1
                    if (b.isManualClose) return -1
                    return 0
                  })

                  return (
                    <div className="space-y-0">
                      {events.map((event, idx) => (
                        <div key={idx} className="flex gap-4 pb-6 relative">
                          <div className="flex flex-col items-center">
                            <div className={`w-3 h-3 rounded-full ${event.color} z-10`}></div>
                            {idx < events.length - 1 && <div className="w-0.5 flex-1 bg-gray-200 mt-1"></div>}
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-medium text-gray-800">{event.label}</div>
                            <div className="text-xs text-gray-400 mt-0.5">
                              {new Date(event.time).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>
            </div>

            {changeLogsLoading && !changeLogsLoaded ? (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden p-8 flex justify-center">
                <div className="w-8 h-8 border-4 border-[#33d4ff] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : changeLogs.length > 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 sm:px-5 py-3 sm:py-4 bg-gray-50 border-b border-gray-200">
                  <h2 className="font-bold text-gray-800">שינויים</h2>
                </div>
                <div className="p-4 sm:p-5 space-y-3">
                  {changeLogs.map((log) => (
                    <div key={log.id} className="border border-gray-100 rounded-xl p-3 text-sm" dir="rtl">
                      {log.field_name === 'סגירה ידנית' ? (
                        <div className="flex justify-between items-start gap-3">
                          <span className="font-medium text-orange-700">
                            🔒 הגרירה נסגרה ידנית ע״י {log.user?.full_name || 'מנהל'}
                          </span>
                          <span className="text-xs text-gray-400 shrink-0">
                            {new Date(log.changed_at).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ) : (
                        <>
                          <div className="flex justify-between items-start">
                            <span className="font-medium text-gray-800">{log.field_name}</span>
                            <span className="text-xs text-gray-400">
                              {new Date(log.changed_at).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className="mt-1 text-gray-500">
                            <span className="line-through">{log.old_value || '—'}</span>
                            <span className="mx-2">→</span>
                            <span className="text-gray-800">{log.new_value || '—'}</span>
                          </div>
                          {log.user?.full_name && (
                            <div className="mt-1 text-xs text-gray-400">על ידי {log.user.full_name}</div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : changeLogsLoaded ? (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden p-6 text-center text-gray-400 text-sm">
                אין רשומות שינוי
              </div>
            ) : null}

          </div>
        )}

        {activeTab === 'images' && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 sm:px-5 py-3 sm:py-4 bg-gray-50 border-b border-gray-200">
              <h2 className="font-bold text-gray-800">תמונות</h2>
            </div>
            <div className="p-4 sm:p-5">
              {(() => {
                const allImages = tow.points?.flatMap((point: any) => 
                  (point.images || []).map((img: any) => ({ ...img, point }))
                ) || []
                
                if (allImages.length === 0) {
                  return (
                    <div className="text-center py-12 text-gray-400">
                      <Image size={48} className="mx-auto mb-4 opacity-50" />
                      <p>אין תמונות עדיין</p>
                    </div>
                  )
                }

                const imageTypeLabels: Record<string, string> = {
                  before_pickup: 'לפני איסוף',
                  after_pickup: 'אחרי איסוף',
                  before_dropoff: 'לפני פריקה',
                  after_dropoff: 'אחרי פריקה',
                  damage: 'נזק',
                  other: 'אחר'
                }

                // קיבוץ לפי נקודה
                const grouped: Record<string, any[]> = {}
                allImages.forEach((img: any) => {
                  const key = img.point.id
                  if (!grouped[key]) grouped[key] = []
                  grouped[key].push(img)
                })

                return (
                  <div className="space-y-6">
                    {Object.entries(grouped).map(([pointId, images]) => {
                      const point = images[0].point
                      return (
                        <div key={pointId}>
                          <div className="flex items-center gap-2 mb-3">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold ${point.point_type === 'pickup' ? 'bg-green-500' : 'bg-red-500'}`}>
                              {point.point_order}
                            </div>
                            <span className="text-sm font-medium text-gray-700">
                              {point.point_type === 'pickup' ? 'איסוף' : 'פריקה'} — {point.address?.split(',')[0] || 'לא צוין'}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {images.map((img: any) => {
                              const typeLabel = imageTypeLabels[img.image_type] || img.image_type
                              const plate = img.tow_vehicle_id
                                ? vehiclePlateById[img.tow_vehicle_id]
                                : undefined
                              return (
                                <a key={img.id} href={img.image_url} target="_blank" rel="noopener noreferrer" className="group">
                                  <div className="aspect-square rounded-xl overflow-hidden border border-gray-200 group-hover:border-[#33d4ff] transition-colors">
                                    <img src={img.image_url} alt={img.image_type} className="w-full h-full object-cover" />
                                  </div>
                                  <p className="text-xs text-gray-400 mt-1 text-center">
                                    {plate ? `${typeLabel} · ${plate}` : typeLabel}
                                  </p>
                                </a>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                    <p className="text-sm text-gray-400 text-center">{allImages.length} תמונות סה"כ</p>
                  </div>
                )
              })()}
            </div>
          </div>
        )}

        {activeTab === 'portal' && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 sm:px-5 py-3 sm:py-4 bg-gray-50 border-b border-gray-200">
              <h2 className="font-bold text-gray-800 flex items-center gap-2">
                <Eye size={18} />
                הרשאות תצוגה ללקוח (לגרירה זו)
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                דריסה לגרירה זו בלבד — ברירת מחדל נלקחת מהגדרות הפורטל של הלקוח
              </p>
            </div>
            <div className="p-4 sm:p-5 space-y-3">
              {PORTAL_VISIBILITY_FLAGS.map((flag) => {
                const { label, description } = PORTAL_VISIBILITY_LABELS[flag]
                const customerPortalSettings =
                  (tow.customer?.portal_settings as Record<string, boolean> | null | undefined) ?? {}
                const overrideState = getPortalVisibilityOverrideState(flag, tow)
                const effectiveVisible = resolvePortalVisibilityFlag(
                  flag,
                  customerPortalSettings,
                  tow,
                )

                const stateButtonClass = (state: PortalVisibilityOverrideState) => {
                  const active = overrideState === state
                  if (state === 'default') {
                    return active
                      ? 'bg-gray-700 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }
                  if (state === 'show') {
                    return active
                      ? 'bg-emerald-500 text-white'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }
                  return active
                    ? 'bg-red-500 text-white'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }

                return (
                  <div
                    key={flag}
                    className="flex flex-col gap-3 rounded-xl border border-gray-100 p-3 sm:flex-row sm:items-center sm:justify-between hover:bg-gray-50"
                  >
                    <div>
                      <p className="font-medium text-gray-800 text-sm">{label}</p>
                      <p className="text-xs text-gray-400">{description}</p>
                      <p className="text-xs mt-1 text-gray-500">
                        מוצג ללקוח כעת:{' '}
                        <span className={effectiveVisible ? 'text-emerald-600 font-medium' : 'text-red-600 font-medium'}>
                          {effectiveVisible ? 'כן' : 'לא'}
                        </span>
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        onClick={() => handlePortalVisibilityOverrideChange(flag, 'default')}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${stateButtonClass('default')}`}
                      >
                        ברירת מחדל
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePortalVisibilityOverrideChange(flag, 'show')}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${stateButtonClass('show')}`}
                      >
                        הצג לגרירה זו
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePortalVisibilityOverrideChange(flag, 'hide')}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${stateButtonClass('hide')}`}
                      >
                        הסתר לגרירה זו
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* מודלים */}
      {(showAssignModal || showChangeDriverModal) && renderDriverModal()}

      {showCantEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle size={32} className="text-red-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-800 mb-2">לא ניתן לערוך</h2>
              <p className="text-gray-600">לא ניתן לערוך גרירה שהושלמה או בוטלה</p>
            </div>
            <div className="px-5 pb-5">
              <button
                onClick={() => setShowCantEditModal(false)}
                className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
              >
                הבנתי
              </button>
            </div>
          </div>
        </div>
      )}

      {showRemoveDriverConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={32} className="text-amber-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-800 mb-2">הסרת נהג</h2>
              <p className="text-gray-600">האם להסיר את הנהג מהגרירה?</p>
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <button
                onClick={() => setShowRemoveDriverConfirm(false)}
                className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-100 transition-colors"
              >
                ביטול
              </button>
              <button
                onClick={handleRemoveDriver}
                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors"
              >
                הסר נהג
              </button>
            </div>
          </div>
        </div>
      )}

      {showManualCloseModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden" dir="rtl">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-violet-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={32} className="text-violet-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-800 mb-2">סגירה ידנית של גרירה</h2>
              <p className="text-gray-600 text-sm leading-relaxed">
                האם לסגור את הגרירה ידנית? פעולה זו תסמן את כל הנקודות כהושלמו ולא ניתן יהיה לפתוח שוב.
              </p>
              <div className="mt-4 text-right">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  תאריך ושעת סיום בפועל
                </label>
                <p className="text-xs text-gray-500 mb-3">
                  בדוק/י שהתאריך והשעה משקפים מתי הגרירה הסתיימה בפועל — במיוחד אם הסגירה מתבצעת ימים אחרי הביצוע.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">תאריך</label>
                    <DateInput
                      value={closeEndDate}
                      onChange={setCloseEndDate}
                      disabled={manualClosing}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">שעה</label>
                    <TimeInput
                      value={closeEndTime}
                      onChange={setCloseEndTime}
                      disabled={manualClosing}
                      className="w-full px-3 py-2.5 rounded-xl text-sm focus:ring-2 focus:ring-violet-400"
                    />
                  </div>
                </div>
                {closeEndDateDiffersFromScheduled && (
                  <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-right">
                    <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-800 leading-relaxed">
                      התאריך שנבחר שונה מהתאריך שבו הגרירה משובצת — ודא/י שהתאריך והשעה נכונים לפני האישור.
                    </p>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <button
                type="button"
                onClick={() => {
                  setShowManualCloseModal(false)
                  setShowManualCloseDateConfirm(false)
                }}
                disabled={manualClosing}
                className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={() => void handleManualCloseSubmit()}
                disabled={manualClosing}
                className="flex-1 py-3 bg-violet-600 text-white rounded-xl font-medium hover:bg-violet-700 transition-colors disabled:opacity-50"
              >
                {manualClosing ? 'סוגר...' : 'אשר סגירה'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showManualCloseDateConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden" dir="rtl">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={32} className="text-amber-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-800 mb-2">אימות תאריך סיום</h2>
              <p className="text-gray-600 text-sm leading-relaxed text-right">
                התאריך שבחרת ({selectedCloseDisplay}) שונה מהתאריך שבו הגרירה משובצת ({scheduledCloseDisplay}).
                האם אתה בטוח שהתאריך והשעה נכונים?
              </p>
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <button
                type="button"
                onClick={() => setShowManualCloseDateConfirm(false)}
                disabled={manualClosing}
                className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                חזרה לעריכה
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmManualClose()}
                disabled={manualClosing}
                className="flex-1 py-3 bg-violet-600 text-white rounded-xl font-medium hover:bg-violet-700 transition-colors disabled:opacity-50"
              >
                {manualClosing ? 'סוגר...' : 'כן, התאריך נכון — סגור גרירה'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCantCancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle size={32} className="text-red-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-800 mb-2">לא ניתן לבטל</h2>
              <p className="text-gray-600">לא ניתן לבטל גרירה שהושלמה</p>
            </div>
            <div className="px-5 pb-5">
              <button
                onClick={() => setShowCantCancelModal(false)}
                className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
              >
                הבנתי
              </button>
            </div>
          </div>
        </div>
      )}

      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl overflow-hidden" style={{ width: '420px', maxWidth: '95vw' }}>
            {cancelStep === 'warning' && (
              <>
                <div className="p-6 text-center">
                  <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertTriangle size={32} className="text-amber-600" />
                  </div>
                  <h2 className="text-lg font-bold text-gray-800 mb-2">הגרירה בביצוע</h2>
                  <p className="text-gray-600">הגרירה כבר בביצוע. האם לבטל בכל זאת?</p>
                </div>
                <div className="flex gap-3 px-5 pb-5">
                  <button
                    onClick={closeCancelModal}
                    className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-100 transition-colors"
                  >
                    חזור
                  </button>
                  <button
                    onClick={() => setCancelStep('reason')}
                    className="flex-1 py-3 bg-amber-600 text-white rounded-xl font-medium hover:bg-amber-700 transition-colors"
                  >
                    כן, בטל
                  </button>
                </div>
              </>
            )}

            {cancelStep === 'reason' && (
              <>
                <div className="px-5 py-4 border-b border-gray-200 bg-red-600 text-white">
                  <h2 className="font-bold text-lg">ביטול גרירה</h2>
                </div>
                <div className="p-5 space-y-4">
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-500">מספר גרירה</span>
                      <span className="font-mono font-bold text-gray-800">{tow.id.slice(0, 8)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">לקוח</span>
                      <span className="text-gray-800">{tow.customer?.name || 'לא צוין'}</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">סיבת ביטול *</label>
                    <select
                      value={selectedCancellationReason}
                      onChange={(e) => setSelectedCancellationReason(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
                    >
                      <option value="">בחר סיבה...</option>
                      <option value="לקוח סירב להצעה">לקוח סירב להצעה</option>
                      <option value="לא קיבלתי תשובה">לא קיבלתי תשובה</option>
                      <option value="ביטול על ידי הלקוח">ביטול על ידי הלקוח</option>
                      <option value="סיבה אחרת">סיבה אחרת</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">פירוט נוסף (אופציונלי)</label>
                    <textarea
                      value={cancellationDetails}
                      onChange={(e) => setCancellationDetails(e.target.value)}
                      placeholder="נא לציין את סיבת הביטול..."
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>

                  <div className="border border-gray-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setChargeCancellationFee(!chargeCancellationFee)}
                        className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${
                          chargeCancellationFee ? 'bg-red-600 border-red-600' : 'border-gray-300'
                        }`}
                      >
                        {chargeCancellationFee && <CheckCircle size={14} className="text-white" />}
                      </button>
                      <span className="text-sm font-medium text-gray-700">חיוב דמי ביטול</span>
                    </div>

                    {chargeCancellationFee && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            אחוז דמי ביטול
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            value={cancellationPercent}
                            onChange={(e) => setCancellationPercent(e.target.value)}
                            placeholder="לדוגמה: 50"
                            className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
                          />
                        </div>
                        {previewCancellationFeeBreakdown && previewCancellationFeeBreakdown.feeTotal > 0 && (
                          <div className="text-sm bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                            <CancellationFeeBreakdownDisplay
                              feeBeforeVat={previewCancellationFeeBreakdown.feeBeforeVat}
                              vatAmount={previewCancellationFeeBreakdown.vatAmount}
                              feeTotal={previewCancellationFeeBreakdown.feeTotal}
                              vatPercentLabel={vatPercentLabel}
                            />
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setNotifyCustomer(!notifyCustomer)}
                      className={`w-5 h-5 rounded border flex items-center justify-center ${
                        notifyCustomer ? 'bg-[#33d4ff] border-[#33d4ff]' : 'border-gray-300'
                      }`}
                    >
                      {notifyCustomer && <CheckCircle size={14} className="text-white" />}
                    </button>
                    <span className="text-sm text-gray-700">שלח הודעה ללקוח על הביטול</span>
                  </div>
                </div>
                <div className="flex gap-3 px-5 pb-5">
                  <button
                    onClick={closeCancelModal}
                    className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-100 transition-colors"
                  >
                    חזור
                  </button>
                  <button
                    onClick={() => setCancelStep('confirm')}
                    disabled={!selectedCancellationReason}
                    className="flex-1 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  >
                    המשך
                  </button>
                </div>
              </>
            )}

            {cancelStep === 'confirm' && (
              <>
                <div className="p-6 text-center">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertTriangle size={32} className="text-red-600" />
                  </div>
                  <h2 className="text-lg font-bold text-gray-800 mb-2">אישור ביטול</h2>
                  <p className="text-gray-600">האם אתה בטוח שברצונך לבטל את הגרירה?</p>
                </div>
                <div className="flex gap-3 px-5 pb-5">
                  <button
                    type="button"
                    onClick={() => setCancelStep('reason')}
                    disabled={isCancelling}
                    className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-100 transition-colors disabled:opacity-50"
                  >
                    חזור
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmCancel}
                    disabled={isCancelling}
                    className="flex-1 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {isCancelling ? 'מבטל...' : 'בטל גרירה'}
                  </button>
                </div>
              </>
            )}

            {cancelStep === 'linked' && (
              <>
                <div className="px-5 py-4 border-b border-gray-200 bg-red-600 text-white">
                  <h2 className="font-bold text-lg">האם לבטל גם את הגרירה המקושרת?</h2>
                </div>
                <div className="p-5 space-y-3">
                  <p className="text-sm text-gray-600">
                    הגרירה בוטלה. קיימת גרירה מקושרת — ניתן לבטל גם אותה באותו הסטטוס.
                  </p>
                  {linkedCancelCandidates.map((candidate) => (
                    <div
                      key={candidate.id}
                      className="flex items-center justify-between gap-3 border border-gray-200 rounded-xl p-3"
                    >
                      <div className="min-w-0">
                        <div className="font-mono text-sm font-bold text-gray-800">
                          {candidate.order_number ? `#${candidate.order_number}` : candidate.id.slice(0, 8)}
                        </div>
                        <span
                          className={`inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded-full border ${
                            statusConfig[candidate.status]?.color || 'bg-gray-100 text-gray-700 border-gray-200'
                          }`}
                        >
                          {statusConfig[candidate.status]?.label || candidate.status}
                        </span>
                      </div>
                      <Link
                        href={`/dashboard/tows/${candidate.id}`}
                        className="shrink-0 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition-colors flex items-center gap-1"
                      >
                        צפה בגרירה
                        <ChevronLeft size={14} />
                      </Link>
                    </div>
                  ))}
                </div>
                <div className="flex gap-3 px-5 pb-5">
                  <button
                    type="button"
                    onClick={handleSkipLinkedCancel}
                    disabled={cancellingLinked}
                    className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-100 transition-colors disabled:opacity-50"
                  >
                    השאר אותה
                  </button>
                  <button
                    type="button"
                    onClick={handleCascadeCancelLinked}
                    disabled={cancellingLinked}
                    className="flex-1 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {cancellingLinked ? 'מבטל...' : 'בטל גם אותה'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* מודל הפקת חשבונית */}
      {showInvoiceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white w-full sm:rounded-2xl sm:max-w-md sm:mx-4 overflow-hidden rounded-t-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-emerald-500 text-white">
              <h2 className="font-bold text-lg">הפקת חשבונית</h2>
              <button
                onClick={() => setShowInvoiceModal(false)}
                className="p-2 hover:bg-white/20 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* פרטי לקוח */}
              <div className="p-3 bg-gray-50 rounded-xl">
                <p className="text-sm text-gray-500">לקוח</p>
                <p className="font-medium text-gray-800">
                  {tow.customer?.name || 'לקוח מזדמן'}
                </p>
              </div>

              {/* תיאור */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">תיאור</label>
                <input
                  type="text"
                  value={invoiceData.description}
                  onChange={(e) => setInvoiceData({ ...invoiceData, description: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* סכום */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  סכום (לפני מע״מ) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">₪</span>
                  <input
                    type="number"
                    value={invoiceData.amount}
                    onChange={(e) => setInvoiceData({ ...invoiceData, amount: e.target.value })}
                    className="w-full pr-8 pl-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* סיכום */}
              {invoiceData.amount && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">סכום לפני מע״מ</span>
                    <span>₪{parseFloat(invoiceData.amount).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">מע״מ (18%)</span>
                    <span>₪{(parseFloat(invoiceData.amount) * 0.18).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-bold border-t border-emerald-200 pt-2">
                    <span>סה״כ</span>
                    <span className="text-emerald-700">₪{(parseFloat(invoiceData.amount) * 1.18).toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 px-5 py-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setShowInvoiceModal(false)}
                className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-100 transition-colors font-medium"
              >
                ביטול
              </button>
              <button
                onClick={handleCreateInvoice}
                disabled={!invoiceData.amount || creatingInvoice}
                className="flex-1 py-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 disabled:bg-gray-300 transition-colors font-medium flex items-center justify-center gap-2"
              >
                {creatingInvoice ? (
                  'יוצר...'
                ) : (
                  <>
                    <Receipt size={18} />
                    צור חשבונית
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showLinkedTowModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end lg:items-center justify-center z-50">
          <div className="bg-white w-full lg:max-w-2xl lg:rounded-2xl lg:mx-4 overflow-hidden max-h-[90vh] flex flex-col rounded-t-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-purple-500 text-white flex-shrink-0">
              <h2 className="font-bold text-lg">שיבוץ נהג לרכב התקול</h2>
              <button onClick={() => setShowLinkedTowModal(false)} className="p-2 hover:bg-white/20 rounded-lg">
                <X size={20} />
              </button>
            </div>
            {driversTrucksLoading && drivers.length === 0 ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : !linkedTowDriverId ? (
              <DriverCalendarPicker
                companyId={companyId || ''}
                drivers={drivers}
                requiredTruckTypes={(tow?.required_truck_types as string[]) || []}
                onConfirm={(driverId, date, time) => {
                  setLinkedTowDriverId(driverId)
                  setLinkedTowScheduleDate(new Date(date + 'T' + time + ':00'))
                }}
                onClose={() => setShowLinkedTowModal(false)}
              />
            ) : (
              <div className="flex-1 overflow-y-auto p-4">
                <button
                  onClick={() => { setLinkedTowDriverId(null); setLinkedTowTruckId(null) }}
                  className="flex items-center gap-2 text-purple-500 text-sm font-medium mb-4"
                >
                  <ArrowRight size={18} />
                  חזור לרשימת נהגים
                </button>
                <div className="space-y-2">
                  {getDriverTrucks(linkedTowDriverId).map((truck) => (
                    <button
                      key={truck.id}
                      onClick={() => setLinkedTowTruckId(truck.id)}
                      className={`w-full p-4 rounded-xl border text-right ${
                        linkedTowTruckId === truck.id
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200'
                      }`}
                    >
                      {getTruckTypeLabel(truck.truck_type)} — {truck.plate_number}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {linkedTowDriverId && (
              <div className="flex gap-3 px-5 py-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                <button
                  onClick={() => setShowLinkedTowModal(false)}
                  className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-600"
                >
                  ביטול
                </button>
                <button
                  onClick={handleCreateLinkedTow}
                  disabled={!linkedTowTruckId || creatingLinkedTow}
                  className="flex-1 py-3 bg-purple-500 text-white rounded-xl font-medium disabled:opacity-50"
                >
                  {creatingLinkedTow ? 'יוצר...' : 'צור גרירה מקושרת'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {priceChangeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl overflow-hidden" style={{ width: '420px', maxWidth: '95vw' }}>
            <div className="px-5 py-4 bg-amber-500 text-white">
              <h3 className="font-bold text-lg">המחיר השתנה</h3>
              <p className="text-sm text-amber-100 mt-1">השעה החדשה משפיעה על המחיר</p>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                <span className="text-sm text-gray-500">מחיר ישן</span>
                <span className="font-bold text-gray-400 line-through">₪{priceChangeModal.oldPrice}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-amber-50 rounded-xl border border-amber-200">
                <span className="text-sm text-amber-700">מחיר חדש</span>
                <span className="font-bold text-amber-700 text-lg">₪{priceChangeModal.newPrice}</span>
              </div>
              <div className="text-sm space-y-1 text-gray-600">
                {priceChangeModal.newBreakdown.filter(i => i.amount !== 0).map((item, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span>{item.label}</span>
                    <span>₪{Math.round(item.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <button
                onClick={() => doAssign(false)}
                disabled={assigning}
                className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-50"
              >
                שמור מחיר ישן
              </button>
              <button
                onClick={() => doAssign(true)}
                disabled={assigning}
                className="flex-1 py-3 bg-amber-500 text-white rounded-xl font-medium hover:bg-amber-600"
              >
                עדכן למחיר חדש
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}