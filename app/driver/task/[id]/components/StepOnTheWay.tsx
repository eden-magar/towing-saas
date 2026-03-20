'use client'

import { openWaze } from '@/app/lib/utils/navigation'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
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
import { DriverTaskPoint, DriverTaskVehicle } from '@/app/lib/queries/driver-tasks'

interface StepOnTheWayProps {
  point: DriverTaskPoint
  vehicles: DriverTaskVehicle[]
  customer: { name: string; phone: string | null } | null
  totalPoints: number
  currentIndex: number
  onArrived: () => Promise<void>
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
      await onArrived()
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

      {/* Content Card */}
      <div className="flex-1 bg-gray-50 rounded-t-3xl px-5 pt-6 pb-24">
        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {['קבלה', 'לאיסוף', 'צילום', 'ליעד', 'מסירה'].map((tab, idx) => (
            <div 
              key={tab}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                idx === (isPickup ? 1 : 3) 
                  ? 'bg-white text-gray-800 shadow-sm' 
                  : 'text-gray-400'
              }`}
            >
              {tab}
            </div>
          ))}
        </div>

        {/* Vehicles Info - תמיכה בריבוי רכבים */}
        {vehicles.length > 0 && (
          <div className="space-y-3 mb-4">
            <p className="text-sm text-gray-500 font-medium">
              {vehicles.length > 1 ? `${vehicles.length} רכבים` : 'רכב'}
            </p>
            {vehicles.map((vehicle, idx) => (
              <div key={vehicle.id || idx} className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                    <Car size={24} className="text-gray-500" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-gray-800">
                      {vehicle.manufacturer} {vehicle.model}
                    </p>
                    <p className="text-gray-500 font-mono">{vehicle.plate_number}</p>
                    {vehicle.color && (
                      <p className="text-sm text-gray-400">{vehicle.color}</p>
                    )}
                  </div>
                  {vehicles.length > 1 && (
                    <div className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-full">
                      {idx + 1}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Contact */}
        <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
          <p className="text-sm text-gray-500 mb-2">
            {isPickup ? 'איש קשר באיסוף' : 'איש קשר'}
          </p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                <Phone size={18} className="text-emerald-600" />
              </div>
              <div>
                <p className="font-medium text-gray-800">{contactName}</p>
                <p className="text-sm text-gray-500">{contactPhone || 'אין מספר'}</p>
              </div>
            </div>
            {contactPhone && (
              <div className="flex gap-2">
                <button 
                  onClick={() => openPhone(contactPhone)}
                  className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center"
                >
                  <Phone size={18} className="text-white" />
                </button>
                <button 
                  onClick={() => openWhatsApp(contactPhone)}
                  className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center"
                >
                  <MessageCircle size={18} className="text-white" />
                </button>
              </div>
            )}
          </div>
        </div>

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
      </div>

      {/* Bottom Actions - Fixed */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 pb-32">
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