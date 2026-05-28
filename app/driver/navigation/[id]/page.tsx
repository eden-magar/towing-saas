'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { 
  getTaskDetail,
  getCurrentPointIndex,
  type TaskDetailFull,
  type DriverTaskPoint,
} from '../../../lib/queries/driver-tasks'
import { resolveDriverContact } from '../../../lib/utils/driver-contact'
import { toWhatsApp } from '../../../lib/utils/phone'
import { 
  ArrowRight,
  MapPin, 
  Phone,
  MessageCircle,
  AlertCircle,
  Loader2
} from 'lucide-react'

export default function DriverNavigationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  
  const [task, setTask] = useState<TaskDetailFull | null>(null)
  const [loading, setLoading] = useState(true)
  const [navigatingTo, setNavigatingTo] = useState<'source' | 'destination'>('source')

  // Load task data
  useEffect(() => {
    if (id) {
      loadTask()
    }
  }, [id])

  // Auto-determine navigation target from tow_points (not legs)
  useEffect(() => {
    if (!task?.points?.length) return

    const points = [...task.points].sort((a, b) => a.point_order - b.point_order)
    const pickup = points.find((p) => p.point_type === 'pickup')

    if (pickup && pickup.status !== 'arrived' && pickup.status !== 'completed') {
      setNavigatingTo('source')
      return
    }

    const idx = getCurrentPointIndex(points)
    const current = points[idx]

    if (!current) {
      setNavigatingTo('destination')
      return
    }

    if (current.point_type === 'pickup') {
      setNavigatingTo('source')
      return
    }

    if (current.point_type === 'dropoff') {
      setNavigatingTo('destination')
      return
    }

    // stop / exchange / other: pickup done → heading to dropoff
    if (pickup && (pickup.status === 'arrived' || pickup.status === 'completed')) {
      setNavigatingTo('destination')
    } else {
      setNavigatingTo('source')
    }
  }, [task])

  const loadTask = async () => {
    setLoading(true)
    try {
      const data = await getTaskDetail(id)
      setTask(data)
    } catch (error) {
      console.error('Error loading task:', error)
    } finally {
      setLoading(false)
    }
  }

  const sortedPoints = task
    ? [...task.points].sort((a, b) => a.point_order - b.point_order)
    : []

  const pickupPoint =
    sortedPoints.find((p) => p.point_type === 'pickup') ?? sortedPoints[0]
  const dropoffPoint =
    sortedPoints.find((p) => p.point_type === 'dropoff') ??
    sortedPoints[sortedPoints.length - 1]

  const navPoint: DriverTaskPoint | null =
    navigatingTo === 'source' ? pickupPoint ?? null : dropoffPoint ?? null

  const navContact = resolveDriverContact(navPoint, task?.customer ?? null)

  const getNavigationData = () => {
    if (!task) {
      return {
        address: '',
        contact: '',
        phone: '',
        notes: '',
        canCall: false,
      }
    }

    const pickupLeg = task.legs.find((l) => l.leg_type === 'pickup')
    const deliveryLeg = task.legs.find((l) => l.leg_type === 'delivery')

    if (navigatingTo === 'source') {
      return {
        address:
          navPoint?.address || pickupLeg?.from_address || 'לא צוין',
        contact: navContact.displayName,
        phone: navContact.phone || '',
        notes: task.notes || '',
        canCall: navContact.canCall,
      }
    }

    return {
      address:
        navPoint?.address ||
        deliveryLeg?.to_address ||
        pickupLeg?.to_address ||
        'לא צוין',
      contact: navContact.displayName,
      phone: navContact.phone || '',
      notes: '',
      canCall: navContact.canCall,
    }
  }

  const navData = getNavigationData()

  // External navigation
  const openWaze = () => {
  const encoded = encodeURIComponent(navData.address)
  // ניסיון לפתוח באפליקציה, אם לא מותקנת - פותח בדפדפן
  const wazeAppUrl = `waze://?q=${encoded}&navigate=yes`
  const wazeWebUrl = `https://waze.com/ul?q=${encoded}&navigate=yes`
  
  // בודק אם זה מובייל
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
  
  if (isMobile) {
    window.location.href = wazeAppUrl
    // fallback אם האפליקציה לא נפתחה תוך 2 שניות
    setTimeout(() => {
      window.open(wazeWebUrl, '_blank')
    }, 2000)
  } else {
    window.open(wazeWebUrl, '_blank')
  }
}

  const openGoogleMaps = () => {
    const encoded = encodeURIComponent(navData.address)
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encoded}`, '_blank')
  }

  const openPhone = () => {
    if (navData.phone) {
      window.open(`tel:${navData.phone}`, '_self')
    }
  }

  const openWhatsApp = () => {
    if (!navData.phone || !task) return
    
    const waNumber = toWhatsApp(navData.phone).replace(/^\+/, '')
    if (!waNumber) return
    const vehicle = task.vehicles[0]?.plate_number || ''
    const message = navigatingTo === 'source' 
      ? `שלום, אני בדרך לאסוף את הרכב ${vehicle}.`
      : `שלום, אני בדרך עם הרכב ${vehicle}.`
    window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`, '_blank')
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-800 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    )
  }

  // Not found
  if (!task) {
    return (
      <div className="min-h-screen bg-slate-800 flex flex-col items-center justify-center p-4">
        <AlertCircle size={48} className="text-gray-400 mb-4" />
        <p className="text-gray-300">המשימה לא נמצאה</p>
        <button 
          onClick={() => router.back()}
          className="mt-4 text-[#33d4ff] font-medium"
        >
          חזרה
        </button>
      </div>
    )
  }

  const vehicle = task.vehicles[0]

  return (
    <div dir="rtl" className="min-h-screen bg-slate-800 flex flex-col">
      {/* Top Bar */}
      <div className="px-4 pt-4 flex items-center justify-between">
        <button 
          onClick={() => router.back()}
          className="w-12 h-12 bg-white rounded-2xl shadow-lg flex items-center justify-center"
        >
          <ArrowRight size={22} className="text-slate-700" />
        </button>

        <div className="bg-white rounded-2xl shadow-lg px-4 py-2.5 flex items-center gap-2">
          <span className="font-mono font-bold text-slate-800">#{id.slice(0, 8)}</span>
          {vehicle && (
            <>
              <span className="text-slate-300">•</span>
              <span className="font-mono text-[#33d4ff] font-bold">{vehicle.plate_number}</span>
            </>
          )}
        </div>

        <div className="w-12" aria-hidden="true" />
      </div>

      {/* Toggle Source/Destination */}
      <div className="px-4 pt-3">
        <div className="bg-white/95 backdrop-blur rounded-2xl shadow-lg p-1.5 flex gap-1">
          <button
            onClick={() => setNavigatingTo('source')}
            className={`flex-1 py-3.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              navigatingTo === 'source'
                ? 'bg-emerald-500 text-white shadow-md'
                : 'text-slate-600'
            }`}
          >
            <div className={`w-2.5 h-2.5 rounded-full ${navigatingTo === 'source' ? 'bg-white' : 'bg-emerald-500'}`}></div>
            נווט לאיסוף
          </button>
          <button
            onClick={() => setNavigatingTo('destination')}
            className={`flex-1 py-3.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              navigatingTo === 'destination'
                ? 'bg-red-500 text-white shadow-md'
                : 'text-slate-600'
            }`}
          >
            <div className={`w-2.5 h-2.5 rounded-full ${navigatingTo === 'destination' ? 'bg-white' : 'bg-red-500'}`}></div>
            נווט ליעד
          </button>
        </div>
      </div>

      {/* Destination address */}
      <div className="flex-1 px-5 py-6 flex flex-col justify-center min-h-0">
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
            navigatingTo === 'source' ? 'bg-emerald-500/20' : 'bg-red-500/20'
          }`}>
            <MapPin
              size={24}
              className={navigatingTo === 'source' ? 'text-emerald-400' : 'text-red-400'}
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-bold mb-1 ${
              navigatingTo === 'source' ? 'text-emerald-400' : 'text-red-400'
            }`}>
              {navigatingTo === 'source' ? 'איסוף' : 'יעד'}
            </p>
            <p className="font-bold text-white text-xl leading-snug">{navData.address}</p>
            <p className="text-sm text-slate-400 mt-2">
              {navData.canCall && navData.phone
                ? `${navData.contact} • ${navData.phone}`
                : navData.contact}
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-auto">
        <div className="bg-white rounded-t-3xl shadow-2xl">
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-12 h-1.5 bg-slate-300 rounded-full"></div>
          </div>

          <div className="px-5 pb-5">
            {navData.notes && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl mb-4">
                <div className="flex items-start gap-2">
                  <AlertCircle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-800">{navData.notes}</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3 mb-4">
              <button 
                onClick={openPhone}
                disabled={!navData.canCall || !navData.phone}
                className="flex flex-col items-center gap-2 p-3 bg-slate-100 rounded-xl active:scale-95 disabled:opacity-50"
              >
                <div className="w-11 h-11 bg-emerald-100 rounded-full flex items-center justify-center">
                  <Phone size={20} className="text-emerald-600" />
                </div>
                <span className="text-xs text-slate-600 font-medium">התקשר</span>
              </button>
              <button 
                onClick={openWhatsApp}
                disabled={!navData.canCall || !navData.phone}
                className="flex flex-col items-center gap-2 p-3 bg-slate-100 rounded-xl active:scale-95 disabled:opacity-50"
              >
                <div className="w-11 h-11 bg-green-100 rounded-full flex items-center justify-center">
                  <MessageCircle size={20} className="text-green-600" />
                </div>
                <span className="text-xs text-slate-600 font-medium">וואטסאפ</span>
              </button>
              <button 
                onClick={() => router.push(`/driver/task/${id}`)}
                className="flex flex-col items-center gap-2 p-3 bg-slate-100 rounded-xl active:scale-95"
              >
                <div className="w-11 h-11 bg-purple-100 rounded-full flex items-center justify-center">
                  <AlertCircle size={20} className="text-purple-600" />
                </div>
                <span className="text-xs text-slate-600 font-medium">פרטים</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <button 
                onClick={openWaze}
                className="flex items-center justify-center gap-3 py-4 bg-[#33CCFF] rounded-2xl text-white font-bold shadow-lg active:scale-98"
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h-2v-2h2v2zm0-4h-2V7h2v6zm4 4h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                </svg>
                Waze
              </button>
              <button 
                onClick={openGoogleMaps}
                className="flex items-center justify-center gap-3 py-4 bg-[#4285F4] rounded-2xl text-white font-bold shadow-lg active:scale-98"
              >
                <MapPin size={22} />
                Google Maps
              </button>
            </div>

            <button
              onClick={() => router.push(`/driver/task/${id}`)}
              className="w-full py-4 rounded-2xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 active:scale-98 bg-blue-600 text-white"
            >
              <ArrowRight size={22} />
              חזור למשימה
            </button>
          </div>

          <div className="h-6 bg-white"></div>
        </div>
      </div>
    </div>
  )
}