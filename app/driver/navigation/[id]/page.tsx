'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../../lib/AuthContext'
import { 
  getTaskDetail, 
  updateTaskStatusWithHistory,
  updateLegStatus,
  type TaskDetailFull 
} from '../../../lib/queries/driver-tasks'
import { 
  ArrowRight,
  MapPin, 
  Phone,
  Navigation,
  MessageCircle,
  Share2,
  CheckCircle2,
  AlertCircle,
  Locate,
  Plus,
  Minus,
  Loader2
} from 'lucide-react'

export default function DriverNavigationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { user } = useAuth()
  
  const [task, setTask] = useState<TaskDetailFull | null>(null)
  const [loading, setLoading] = useState(true)
  const [navigatingTo, setNavigatingTo] = useState<'source' | 'destination'>('source')
  const [isUpdating, setIsUpdating] = useState(false)

  // Load task data
  useEffect(() => {
    if (id) {
      loadTask()
    }
  }, [id])

  // Auto-determine navigation target based on task status
  useEffect(() => {
    if (task) {
      const pickupLeg = task.legs.find(l => l.leg_type === 'pickup')
      const deliveryLeg = task.legs.find(l => l.leg_type === 'delivery')
      
      // אם רגל האיסוף הושלמה, מנווטים ליעד
      if (pickupLeg?.status === 'completed' || deliveryLeg?.status === 'in_progress') {
        setNavigatingTo('destination')
      } else {
        setNavigatingTo('source')
      }
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

  // Get addresses and contacts
  const getNavigationData = () => {
    if (!task) return { address: '', contact: '', phone: '', notes: '' }
    
    const pickupLeg = task.legs.find(l => l.leg_type === 'pickup')
    const deliveryLeg = task.legs.find(l => l.leg_type === 'delivery')
    
    if (navigatingTo === 'source') {
      return {
        address: pickupLeg?.from_address || 'לא צוין',
        contact: task.customer?.name || 'לקוח',
        phone: task.customer?.phone || '',
        notes: task.notes || ''
      }
    } else {
      return {
        address: deliveryLeg?.to_address || pickupLeg?.to_address || 'לא צוין',
        contact: 'יעד',
        phone: task.customer?.phone || '',
        notes: ''
      }
    }
  }

  const navData = getNavigationData()

  // Calculate ETA and distance
  const getRouteInfo = () => {
    if (!task) return { eta: '-- דק\'', distance: '-- ק"מ' }
    
    const pickupLeg = task.legs.find(l => l.leg_type === 'pickup')
    const deliveryLeg = task.legs.find(l => l.leg_type === 'delivery')
    
    const leg = navigatingTo === 'source' ? pickupLeg : deliveryLeg
    const distanceKm = leg?.distance_km || 0
    
    // הערכת זמן: 2 דקות לק"מ בעיר
    const estimatedMinutes = Math.round(distanceKm * 2)
    
    return {
      eta: `${estimatedMinutes || 15} דק'`,
      distance: `${distanceKm.toFixed(1)} ק"מ`
    }
  }

  const routeInfo = getRouteInfo()

  // External navigation
  const openWaze = () => {
    const encoded = encodeURIComponent(navData.address)
    window.open(`https://waze.com/ul?q=${encoded}&navigate=yes`, '_blank')
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
    
    const phoneClean = navData.phone.replace(/^0/, '972').replace(/-/g, '')
    const vehicle = task.vehicles[0]?.plate_number || ''
    const message = navigatingTo === 'source' 
      ? `שלום, אני בדרך לאסוף את הרכב ${vehicle}. אגיע בעוד ${routeInfo.eta} בערך.`
      : `שלום, אני בדרך עם הרכב ${vehicle}. אגיע בעוד ${routeInfo.eta} בערך.`
    window.open(`https://wa.me/${phoneClean}?text=${encodeURIComponent(message)}`, '_blank')
  }

  const shareLocation = () => {
    if (navigator.share) {
      navigator.share({
        title: 'המיקום שלי',
        text: `אני בדרך ל${navigatingTo === 'source' ? 'איסוף' : 'יעד'}: ${navData.address}`,
        url: window.location.href
      })
    }
  }

  const handleArrived = async () => {
    if (!task || !user) return
    
    setIsUpdating(true)
    try {
      const pickupLeg = task.legs.find(l => l.leg_type === 'pickup')
      const deliveryLeg = task.legs.find(l => l.leg_type === 'delivery')
      
      if (navigatingTo === 'source') {
        // הגעתי לאיסוף
        if (pickupLeg) {
          await updateLegStatus(pickupLeg.id, 'in_progress')
        }
        await updateTaskStatusWithHistory(task.id, 'in_progress', user.id, pickupLeg?.id, 'הגיע לאיסוף')
        
        // עוברים לניווט ליעד
        setNavigatingTo('destination')
        await loadTask()
      } else {
        // הגעתי ליעד
        if (deliveryLeg) {
          await updateLegStatus(deliveryLeg.id, 'completed')
        }
        await updateTaskStatusWithHistory(task.id, 'in_progress', user.id, deliveryLeg?.id, 'הגיע ליעד')
        
        // חוזרים לדף פרטי המשימה
        router.push(`/driver/task/${id}`)
      }
    } catch (error) {
      console.error('Error updating status:', error)
      alert('שגיאה בעדכון הסטטוס')
    } finally {
      setIsUpdating(false)
    }
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
    <div dir="rtl" className="min-h-screen bg-slate-800 relative">
      {/* Map Placeholder */}
      <div className="absolute inset-0 bg-slate-700">
        <div className="w-full h-full relative overflow-hidden">
          <svg className="w-full h-full opacity-20" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
                <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#64748b" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>

          {/* Route Line Simulation */}
          <svg className="absolute inset-0" viewBox="0 0 400 800" preserveAspectRatio="none">
            <path
              d="M 200 650 Q 180 550 200 450 Q 220 350 200 280"
              stroke="#3b82f6"
              strokeWidth="6"
              fill="none"
              strokeLinecap="round"
            />
            <circle r="8" fill="#3b82f6">
              <animateMotion
                dur="3s"
                repeatCount="indefinite"
                path="M 200 650 Q 180 550 200 450 Q 220 350 200 280"
              />
            </circle>
          </svg>

          {/* Current Location Marker */}
          <div className="absolute bottom-52 left-1/2 -translate-x-1/2">
            <div className="relative">
              <div className="w-14 h-14 bg-blue-600 rounded-full flex items-center justify-center shadow-lg border-4 border-white">
                <Navigation size={24} className="text-white" />
              </div>
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-4 bg-blue-600 rotate-45 -z-10"></div>
            </div>
            <p className="text-center text-white text-xs mt-2 bg-slate-800/80 px-3 py-1 rounded-full">
              המיקום שלך
            </p>
          </div>

          {/* Destination Marker */}
          <div className="absolute top-52 left-1/2 -translate-x-1/2">
            <div className="relative">
              <div className={`w-14 h-14 ${navigatingTo === 'source' ? 'bg-emerald-500' : 'bg-red-500'} rounded-full flex items-center justify-center shadow-lg border-4 border-white`}>
                <MapPin size={24} className="text-white" />
              </div>
              <div className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-4 ${navigatingTo === 'source' ? 'bg-emerald-500' : 'bg-red-500'} rotate-45 -z-10`}></div>
            </div>
            <p className="text-center text-white text-xs mt-2 bg-slate-800/80 px-3 py-1 rounded-full">
              {navigatingTo === 'source' ? 'איסוף' : 'יעד'}
            </p>
          </div>
        </div>
      </div>

      {/* Top Bar */}
      <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between">
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

        <button className="w-12 h-12 bg-white rounded-2xl shadow-lg flex items-center justify-center">
          <Locate size={22} className="text-slate-700" />
        </button>
      </div>

      {/* ETA Card */}
      <div className="absolute top-20 left-4 right-4 z-10">
        <div className="bg-white rounded-2xl shadow-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">זמן הגעה משוער</p>
              <p className="text-3xl font-bold text-slate-800">{routeInfo.eta}</p>
            </div>
            <div className="text-left">
              <p className="text-sm text-slate-500">מרחק</p>
              <p className="text-xl font-bold text-slate-800">{routeInfo.distance}</p>
            </div>
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
              navigatingTo === 'source' ? 'bg-emerald-100' : 'bg-red-100'
            }`}>
              <MapPin size={28} className={navigatingTo === 'source' ? 'text-emerald-600' : 'text-red-600'} />
            </div>
          </div>
        </div>
      </div>

      {/* Toggle Source/Destination */}
      <div className="absolute top-44 left-4 right-4 z-10">
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

      {/* Zoom Buttons */}
      <div className="absolute bottom-80 left-4 z-10 flex flex-col gap-2">
        <button className="w-12 h-12 bg-white rounded-2xl shadow-lg flex items-center justify-center">
          <Plus size={22} className="text-slate-700" />
        </button>
        <button className="w-12 h-12 bg-white rounded-2xl shadow-lg flex items-center justify-center">
          <Minus size={22} className="text-slate-700" />
        </button>
      </div>

      {/* Bottom Sheet */}
      <div className="absolute bottom-0 left-0 right-0 z-10">
        <div className="bg-white rounded-t-3xl shadow-2xl">
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-12 h-1.5 bg-slate-300 rounded-full"></div>
          </div>

          {/* Destination Info */}
          <div className="px-5 pb-5">
            <div className="flex items-start gap-4 mb-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                navigatingTo === 'source' ? 'bg-emerald-100' : 'bg-red-100'
              }`}>
                <div className={`w-4 h-4 rounded-full ${
                  navigatingTo === 'source' ? 'bg-emerald-500' : 'bg-red-500'
                }`}></div>
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-bold ${
                  navigatingTo === 'source' ? 'text-emerald-600' : 'text-red-600'
                }`}>
                  {navigatingTo === 'source' ? 'איסוף' : 'יעד'}
                </p>
                <p className="font-bold text-slate-800 text-lg">{navData.address}</p>
                <p className="text-sm text-slate-500">
                  {navData.contact}
                  {navData.phone && ` • ${navData.phone}`}
                </p>
              </div>
            </div>

            {/* Notes Alert */}
            {navData.notes && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl mb-4">
                <div className="flex items-start gap-2">
                  <AlertCircle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-800">{navData.notes}</p>
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="grid grid-cols-4 gap-3 mb-4">
              <button 
                onClick={openPhone}
                disabled={!navData.phone}
                className="flex flex-col items-center gap-2 p-3 bg-slate-100 rounded-xl active:scale-95 disabled:opacity-50"
              >
                <div className="w-11 h-11 bg-emerald-100 rounded-full flex items-center justify-center">
                  <Phone size={20} className="text-emerald-600" />
                </div>
                <span className="text-xs text-slate-600 font-medium">התקשר</span>
              </button>
              <button 
                onClick={openWhatsApp}
                disabled={!navData.phone}
                className="flex flex-col items-center gap-2 p-3 bg-slate-100 rounded-xl active:scale-95 disabled:opacity-50"
              >
                <div className="w-11 h-11 bg-green-100 rounded-full flex items-center justify-center">
                  <MessageCircle size={20} className="text-green-600" />
                </div>
                <span className="text-xs text-slate-600 font-medium">וואטסאפ</span>
              </button>
              <button 
                onClick={shareLocation}
                className="flex flex-col items-center gap-2 p-3 bg-slate-100 rounded-xl active:scale-95"
              >
                <div className="w-11 h-11 bg-blue-100 rounded-full flex items-center justify-center">
                  <Share2 size={20} className="text-blue-600" />
                </div>
                <span className="text-xs text-slate-600 font-medium">שתף מיקום</span>
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

            {/* Open in External App */}
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

            {/* Status Update Button */}
            <button 
              onClick={handleArrived}
              disabled={isUpdating}
              className={`w-full py-4 rounded-2xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50 ${
                navigatingTo === 'source' 
                  ? 'bg-emerald-600 text-white'
                  : 'bg-blue-600 text-white'
              }`}
            >
              {isUpdating ? (
                <Loader2 size={22} className="animate-spin" />
              ) : (
                <>
                  <CheckCircle2 size={22} />
                  {navigatingTo === 'source' ? 'הגעתי לאיסוף' : 'הגעתי ליעד'}
                </>
              )}
            </button>
          </div>

          {/* Safe Area */}
          <div className="h-6 bg-white"></div>
        </div>
      </div>
    </div>
  )
}