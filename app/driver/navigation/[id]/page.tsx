'use client'

import { useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { 
  ArrowRight,
  MapPin, 
  Clock, 
  Phone,
  Navigation,
  MessageCircle,
  Share2,
  CheckCircle2,
  AlertCircle,
  Locate,
  Plus,
  Minus
} from 'lucide-react'

interface TaskLocation {
  address: string
  contact: string
  phone: string
  notes?: string
}

interface Task {
  id: number
  status: string
  vehicle: string
  source: TaskLocation
  destination: TaskLocation
  eta: string
  distance: string
  isUrgent?: boolean
}

export default function DriverNavigationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [navigatingTo, setNavigatingTo] = useState<'source' | 'destination'>('source')
  const [isUpdating, setIsUpdating] = useState(false)

  // Mock task data
  const task: Task = {
    id: parseInt(id),
    status: 'on_way',
    vehicle: '12-345-67',
    source: {
      address: 'רחוב הרצל 50, תל אביב',
      contact: 'יוסי כהן',
      phone: '050-1234567',
      notes: 'חניון תת קרקעי, קומה -2'
    },
    destination: {
      address: 'רחוב ויצמן 12, רמת גן',
      contact: 'מוסך רמט - קבלה',
      phone: '03-5551234',
    },
    eta: '12 דקות',
    distance: '8.5 ק"מ',
    isUrgent: true
  }

  const currentTarget = navigatingTo === 'source' ? task.source : task.destination

  const openWaze = () => {
    const encoded = encodeURIComponent(currentTarget.address)
    window.open(`https://waze.com/ul?q=${encoded}&navigate=yes`, '_blank')
  }

  const openGoogleMaps = () => {
    const encoded = encodeURIComponent(currentTarget.address)
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encoded}`, '_blank')
  }

  const openPhone = () => {
    window.open(`tel:${currentTarget.phone}`, '_self')
  }

  const openWhatsApp = () => {
    const phoneClean = currentTarget.phone.replace(/^0/, '972').replace(/-/g, '')
    const message = navigatingTo === 'source' 
      ? `שלום, אני בדרך לאסוף את הרכב ${task.vehicle}. אגיע בעוד ${task.eta} בערך.`
      : `שלום, אני בדרך עם הרכב ${task.vehicle}. אגיע בעוד ${task.eta} בערך.`
    window.open(`https://wa.me/${phoneClean}?text=${encodeURIComponent(message)}`, '_blank')
  }

  const shareLocation = () => {
    if (navigator.share) {
      navigator.share({
        title: 'המיקום שלי',
        text: `אני בדרך ל${navigatingTo === 'source' ? 'איסוף' : 'יעד'}: ${currentTarget.address}`,
        url: window.location.href
      })
    }
  }

  const handleArrived = async () => {
    setIsUpdating(true)
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    if (navigatingTo === 'source') {
      // Switch to destination navigation
      setNavigatingTo('destination')
      setIsUpdating(false)
    } else {
      // Go back to task details
      router.push(`/driver/task/${id}`)
    }
  }

  return (
    <div dir="rtl" className="min-h-screen bg-slate-800 relative">
      {/* Map Placeholder */}
      <div className="absolute inset-0 bg-slate-700">
        {/* Simulated Map Grid */}
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
          <span className="font-mono font-bold text-slate-800">#{id}</span>
          <span className="text-slate-300">•</span>
          <span className="font-mono text-[#33d4ff] font-bold">{task.vehicle}</span>
          {task.isUrgent && (
            <>
              <span className="text-slate-300">•</span>
              <span className="text-red-500 text-xs font-bold">דחוף</span>
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
              <p className="text-3xl font-bold text-slate-800">{task.eta}</p>
            </div>
            <div className="text-left">
              <p className="text-sm text-slate-500">מרחק</p>
              <p className="text-xl font-bold text-slate-800">{task.distance}</p>
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
                <p className="font-bold text-slate-800 text-lg">{currentTarget.address}</p>
                <p className="text-sm text-slate-500">{currentTarget.contact} • {currentTarget.phone}</p>
              </div>
            </div>

            {/* Notes Alert */}
            {currentTarget.notes && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl mb-4">
                <div className="flex items-start gap-2">
                  <AlertCircle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-800">{currentTarget.notes}</p>
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="grid grid-cols-4 gap-3 mb-4">
              <button 
                onClick={openPhone}
                className="flex flex-col items-center gap-2 p-3 bg-slate-100 rounded-xl active:scale-95"
              >
                <div className="w-11 h-11 bg-emerald-100 rounded-full flex items-center justify-center">
                  <Phone size={20} className="text-emerald-600" />
                </div>
                <span className="text-xs text-slate-600 font-medium">התקשר</span>
              </button>
              <button 
                onClick={openWhatsApp}
                className="flex flex-col items-center gap-2 p-3 bg-slate-100 rounded-xl active:scale-95"
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
                  <Clock size={20} className="text-purple-600" />
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
              className={`w-full py-4 rounded-2xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 active:scale-98 ${
                navigatingTo === 'source' 
                  ? 'bg-emerald-600 text-white'
                  : 'bg-blue-600 text-white'
              }`}
            >
              {isUpdating ? (
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
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
