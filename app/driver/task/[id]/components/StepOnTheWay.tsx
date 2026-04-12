'use client'

import { openWaze } from '@/app/lib/utils/navigation'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { 
  MapPin, 
  Phone, 
  Navigation, 
  MessageCircle, 
  Car,
  Loader2,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { DriverTaskPoint, DriverTaskVehicle, getTaskDetail, type TaskDetailFull } from '@/app/lib/queries/driver-tasks'

interface StepOnTheWayProps {
  point: DriverTaskPoint
  vehicles: DriverTaskVehicle[]
  customer: { name: string; phone: string | null } | null
  totalPoints: number
  currentIndex: number
  onArrived: (notes?: string) => Promise<void>
  taskId: string
}

export default function StepOnTheWay({
  point,
  vehicles,
  customer,
  totalPoints,
  currentIndex,
  onArrived,
  taskId
}: StepOnTheWayProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showRoute, setShowRoute] = useState(false)
  const [arrivalNotes, setArrivalNotes] = useState('')
  const [priceBreakdown, setPriceBreakdown] = useState<any>(null)

  useEffect(() => {
    let cancelled = false
    getTaskDetail(taskId).then((detail: TaskDetailFull | null) => {
      if (!cancelled && detail?.price_breakdown) {
        setPriceBreakdown(detail.price_breakdown)
      }
    })
    return () => {
      cancelled = true
    }
  }, [taskId])

  const isPickup = point.point_type === 'pickup'
  const isExchange = point.point_type === 'exchange'
  const isStop = point.point_type === 'stop'
  const title = isPickup ? 'בדרך לאיסוף' 
    : isExchange ? 'בדרך לנקודת החלפה'
    : isStop ? 'בדרך לעצירה'
    : 'בדרך לפריקה'
  const subtitle = point.address || 'כתובת לא צוינה'

  // פתיחת טלפון
  const openPhone = (phone: string) => {
    window.open(`tel:${phone}`, '_self')
  }

  // פתיחת WhatsApp
  const openWhatsApp = (phone: string) => {
    const phoneClean = phone.replace(/^0/, '972').replace(/-/g, '')
    const vehicleInfo = vehicles.length > 0 ? vehicles.map(v => v.plate_number).join(', ') : ''
    const message = isPickup 
      ? `שלום, אני הגררסיט בדרך לאסוף את הרכב ${vehicleInfo}`
      : `שלום, אני הגררסיט בדרך למסור את הרכב ${vehicleInfo}`
    window.open(`https://wa.me/${phoneClean}?text=${encodeURIComponent(message)}`, '_blank')
  }

  // הגעתי
  const handleArrived = async () => {
    setLoading(true)
    try {
      await onArrived(arrivalNotes.trim() || undefined)
    } finally {
      setLoading(false)
    }
  }

  // איש קשר לתצוגה
  const contactName = point.contact_name || customer?.name || 'איש קשר'
  const contactPhone = point.contact_phone || customer?.phone || ''

  return (
    <div className="flex flex-col min-h-[calc(100vh-70px)]">
      {/* Header Info */}
      <div className="px-5 pt-2 pb-6 text-white">
        <h1 className="text-2xl font-bold mb-1">{title}</h1>
        <p className="text-white/80">{subtitle}</p>
      </div>

      {(() => {
        const surcharges = priceBreakdown?.service_surcharges ?? []
        const hasVehicleRoles = surcharges.some(
          (s: { vehicle_role?: string }) =>
            s.vehicle_role === 'working' || s.vehicle_role === 'defective'
        )
        const workingServices = surcharges.filter(
          (s: { vehicle_role?: string }) => s.vehicle_role === 'working'
        )
        const defectiveServices = surcharges.filter(
          (s: { vehicle_role?: string }) => s.vehicle_role === 'defective'
        )
        if (hasVehicleRoles) {
          return (
            <>
              {workingServices.length > 0 && (
                <div className="mx-4 mb-2 p-2 bg-blue-50 rounded-xl">
                  <p className="text-xs text-green-600 font-medium mb-1">שירותים — תקין</p>
                  <div className="flex flex-wrap gap-1">
                    {workingServices.map((s: any) => (
                      <span
                        key={`${s.id}-working`}
                        className="text-xs bg-white border border-green-200 text-green-700 px-2 py-0.5 rounded-md"
                      >
                        {s.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {defectiveServices.length > 0 && (
                <div className="mx-4 mb-3 p-2 bg-blue-50 rounded-xl">
                  <p className="text-xs text-orange-600 font-medium mb-1">שירותים — תקול</p>
                  <div className="flex flex-wrap gap-1">
                    {defectiveServices.map((s: any) => (
                      <span
                        key={`${s.id}-defective`}
                        className="text-xs bg-white border border-orange-200 text-orange-700 px-2 py-0.5 rounded-md"
                      >
                        {s.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )
        }
        if (surcharges.length > 0) {
          return (
            <div className="mx-4 mb-3 p-2 bg-blue-50 rounded-xl flex flex-wrap gap-1">
              {surcharges.map((s: any) => (
                <span
                  key={s.id}
                  className="text-xs bg-white border border-blue-200 text-blue-600 px-2 py-0.5 rounded-md"
                >
                  {s.label}
                </span>
              ))}
            </div>
          )
        }
        return null
      })()}

      {/* Content Card */}
      <div className="flex-1 bg-gray-50 rounded-t-3xl px-5 pt-6 pb-4">
        {vehicles.length > 0 && (
          <div className="space-y-2 mb-3">
            {vehicles.map((v, idx) => (
              <div key={v.id || idx} className="bg-white rounded-xl p-3 shadow-sm flex items-start gap-2">
                <Car size={16} className="text-gray-400 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-medium text-gray-700 font-mono">{v.plate_number}</span>
                    {v.vehicle_code && <span className="text-xs text-gray-400"> #{v.vehicle_code}</span>}
                    {v.is_working === true && (
                      <span className="text-xs bg-green-100 text-green-700 border border-green-200 px-1.5 py-0.5 rounded-md font-medium">
                        תקין
                      </span>
                    )}
                    {v.is_working === false && (
                      <span className="text-xs bg-orange-100 text-orange-700 border border-orange-200 px-1.5 py-0.5 rounded-md font-medium">
                        תקול
                      </span>
                    )}
                  </div>
                  {v.tow_reason && !v.is_working && (
                    <div className="text-xs text-orange-600 mt-1">
                      {'\uD83D\uDD27'} תקלות: {v.tow_reason}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {(contactName || contactPhone) && (
          <div className="bg-white rounded-xl p-3 mb-3 shadow-sm flex items-center justify-between">
            <div className="flex gap-2">
              {contactPhone && (
                <>
                  <button onClick={() => openPhone(contactPhone)} className="w-9 h-9 bg-emerald-500 rounded-xl flex items-center justify-center">
                    <Phone size={16} className="text-white" />
                  </button>
                  <button onClick={() => openWhatsApp(contactPhone)} className="w-9 h-9 bg-green-500 rounded-xl flex items-center justify-center">
                    <MessageCircle size={16} className="text-white" />
                  </button>
                </>
              )}
            </div>
            <div className="text-right">
              <p className="font-medium text-gray-800 text-sm">{contactName}</p>
              <p className="text-xs text-gray-500">{contactPhone || 'אין מספר'}</p>
            </div>
          </div>
        )}

        {/* Route */}
        <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
          <button 
            onClick={() => setShowRoute(!showRoute)}
            className="w-full flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${isPickup ? 'bg-emerald-500' : isExchange ? 'bg-purple-500' : isStop ? 'bg-gray-400' : 'bg-orange-500'}`} />
              <span className="text-sm text-gray-500">{isPickup ? 'איסוף' : isExchange ? 'החלפה' : isStop ? 'עצירה' : 'פריקה'}</span>
            </div>
            {showRoute ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          
          {showRoute && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-gray-800">{point.address}</p>
              {point.notes && (
                <p className="text-sm text-amber-600 mt-2 bg-amber-50 p-2 rounded-lg">
                  📝 {point.notes}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
          <label className="block text-sm text-gray-500 mb-2 text-right">הערות הגעה (אופציונלי)</label>
          <textarea
            value={arrivalNotes}
            onChange={(e) => setArrivalNotes(e.target.value)}
            placeholder="הערות לגבי הנקודה..."
            rows={2}
            className="w-full p-2 border border-gray-200 rounded-xl text-right focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none text-sm"
          />
        </div>
      </div>

      {/* Bottom Actions - Fixed */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 pb-8">
        <div className="flex gap-3">
          <button
            onClick={handleArrived}
            disabled={loading}
            className={`flex-1 py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 ${
              isPickup 
                ? 'bg-blue-500 text-white' 
                : isExchange ? 'bg-purple-500 text-white' : isStop ? 'bg-gray-500 text-white' : 'bg-orange-500 text-white'
            }`}
          >
            {loading ? (
              <Loader2 size={22} className="animate-spin" />
            ) : (
              <>
                <MapPin size={22} />
                הגעתי
              </>
            )}
          </button>
          
          <button
            onClick={() => router.push(`/driver/navigation/${taskId}`)}
            className="py-4 px-6 bg-blue-100 text-blue-600 rounded-2xl font-bold flex items-center gap-2"
          >
            <Navigation size={20} />
            נווט
          </button>
        </div>
        
        {/* עוד גרירות בהמשך */}
        {totalPoints > 1 && (
          <p className="text-center text-gray-400 text-sm mt-3">
            📅 עוד {totalPoints - currentIndex - 1} נקודות בהמשך
          </p>
        )}
      </div>
    </div>
  )
}