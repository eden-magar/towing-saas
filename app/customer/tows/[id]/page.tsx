'use client'

import { supabase } from '@/app/lib/supabase'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/app/lib/AuthContext'
import { getCustomerForUser, getCustomerTowDetail } from '@/app/lib/queries/customer-portal'
import type { CustomerPortalTowDetail } from '@/app/lib/types'
import {
  ArrowRight,
  Truck,
  Clock,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Phone,
  User,
  Camera,
  Loader2,
  Car,
  Navigation,
  ChevronDown,
  ChevronUp
} from 'lucide-react'

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'ממתינה', color: 'text-yellow-700', bg: 'bg-yellow-50' },
  assigned: { label: 'שובצה לנהג', color: 'text-blue-700', bg: 'bg-blue-50' },
  in_progress: { label: 'בביצוע', color: 'text-purple-700', bg: 'bg-purple-50' },
  completed: { label: 'הושלמה', color: 'text-green-700', bg: 'bg-green-50' },
  cancelled: { label: 'בוטלה', color: 'text-red-700', bg: 'bg-red-50' },
}

const pointStatusConfig: Record<string, { label: string; icon: React.ComponentType<{ size?: number; className?: string }>; color: string }> = {
  pending: { label: 'ממתין', icon: Clock, color: 'text-gray-400' },
  en_route: { label: 'נהג בדרך', icon: Navigation, color: 'text-blue-500' },
  arrived: { label: 'הנהג הגיע', icon: MapPin, color: 'text-orange-500' },
  completed: { label: 'הושלם', icon: CheckCircle2, color: 'text-green-500' },
  skipped: { label: 'דולג', icon: AlertCircle, color: 'text-gray-400' },
}

export default function CustomerTowDetail() {
  const params = useParams()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [tow, setTow] = useState<CustomerPortalTowDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedPoint, setExpandedPoint] = useState<string | null>(null)
  const [showImages, setShowImages] = useState(false)
  const [customerId, setCustomerId] = useState<string | null>(null)


  useEffect(() => {
    if (authLoading || !user) return

    const load = async () => {
      const info = await getCustomerForUser(user.id)
      if (!info) return
       setCustomerId(info.customerId)

      const data = await getCustomerTowDetail(params.id as string, info.customerId)
      setTow(data)
      setLoading(false)
    }

    load()
  }, [user, authLoading, params.id])

  // Realtime — עדכון חי של פרטי הגרירה
  useEffect(() => {
    if (!customerId) return
    const towId = params.id as string

    const channel = supabase
      .channel(`customer-tow-${towId}-realtime`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tows', filter: `id=eq.${towId}` }, () => {
        getCustomerTowDetail(towId, customerId).then(setTow)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tow_points' }, () => {
        getCustomerTowDetail(towId, customerId).then(setTow)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tow_images' }, () => {
        getCustomerTowDetail(towId, customerId).then(setTow)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [customerId, params.id])

  const formatDate = (date: string | null) => {
    if (!date) return '—'
    return new Date(date).toLocaleDateString('he-IL', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatTime = (date: string | null) => {
    if (!date) return ''
    return new Date(date).toLocaleTimeString('he-IL', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getPointImages = (pointId: string) => {
    return tow?.images.filter(img => img.tow_point_id === pointId) || []
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (!tow) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">הגרירה לא נמצאה</p>
        <button
          onClick={() => router.push('/customer')}
          className="mt-4 text-blue-600 hover:underline"
        >
          חזרה לרשימה
        </button>
      </div>
    )
  }

  const config = statusConfig[tow.status] || statusConfig.pending
  const progress = tow.points.length
    ? Math.round((tow.points.filter(p => p.status === 'completed').length / tow.points.length) * 100)
    : 0

  return (
    <div className="space-y-6 pb-10">
      {/* Back Button */}
      <button
        onClick={() => router.push('/customer')}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowRight size={16} />
        חזרה לרשימה
      </button>

      {/* Header Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {tow.order_number && (
              <h1 className="text-xl font-bold text-gray-900">#{tow.order_number}</h1>
            )}
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${config.bg} ${config.color}`}>
              {config.label}
            </span>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-gray-500 mb-1">תאריך יצירה</p>
            <p className="font-medium">{formatDate(tow.created_at)}</p>
          </div>
          <div>
            <p className="text-gray-500 mb-1">מועד מתוכנן</p>
            <p className="font-medium">{formatDate(tow.scheduled_at)}</p>
          </div>
          <div>
            <p className="text-gray-500 mb-1">התחלה</p>
            <p className="font-medium">{formatDate(tow.started_at)}</p>
          </div>
          <div>
            <p className="text-gray-500 mb-1">סיום</p>
            <p className="font-medium">{formatDate(tow.completed_at)}</p>
          </div>
        </div>

        {/* Progress Bar */}
        {tow.status === 'in_progress' && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>התקדמות</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-500 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Driver Card */}
      {tow.driver && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Truck size={16} />
            פרטי נהג
          </h2>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <User size={20} className="text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">{tow.driver.full_name}</p>
                {tow.driver.phone && (
                  <p className="text-sm text-gray-500">{tow.driver.phone}</p>
                )}
              </div>
            </div>
            {tow.driver.phone && (
              <a
                href={`tel:${tow.driver.phone}`}
                className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center hover:bg-green-200 transition-colors"
              >
                <Phone size={18} className="text-green-600" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* Vehicles */}
      {tow.vehicles.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Car size={16} />
            רכבים ({tow.vehicles.length})
          </h2>
          <div className="space-y-2">
            {tow.vehicles.map((vehicle, idx) => (
              <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-8 h-8 bg-gray-200 rounded-lg flex items-center justify-center">
                  <Car size={16} className="text-gray-500" />
                </div>
                <div>
                  <p className="font-medium text-sm text-gray-900">{vehicle.plate_number}</p>
                  <p className="text-xs text-gray-500">
                    {[vehicle.manufacturer, vehicle.model, vehicle.color].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
          <MapPin size={16} />
          מסלול ({tow.points.length} נקודות)
        </h2>

        <div className="relative">
          {tow.points.map((point, idx) => {
            const pointConfig = pointStatusConfig[point.status] || pointStatusConfig.pending
            const PointIcon = pointConfig.icon
            const isLast = idx === tow.points.length - 1
            const isExpanded = expandedPoint === point.id
            const pointImages = getPointImages(point.id)

            return (
              <div key={point.id} className="relative flex gap-4">
                {/* Timeline Line */}
                {!isLast && (
                  <div className="absolute right-[15px] top-8 bottom-0 w-0.5 bg-gray-200" />
                )}

                {/* Icon */}
                <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  point.status === 'completed' ? 'bg-green-100' :
                  point.status === 'arrived' ? 'bg-orange-100' :
                  point.status === 'en_route' ? 'bg-blue-100' :
                  'bg-gray-100'
                }`}>
                  <PointIcon size={16} className={pointConfig.color} />
                </div>

                {/* Content */}
                <div className={`flex-1 ${isLast ? 'pb-0' : 'pb-6'}`}>
                  <button
                    onClick={() => setExpandedPoint(isExpanded ? null : point.id)}
                    className="w-full text-right"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                            {point.point_type === 'pickup' ? 'איסוף' : 'פריקה'}
                          </span>
                          <span className={`text-xs font-medium ${pointConfig.color}`}>
                            {pointConfig.label}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-gray-900 mt-1">
                          {point.address || 'כתובת לא צוינה'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {point.arrived_at && (
                          <span className="text-xs text-gray-400">{formatTime(point.arrived_at)}</span>
                        )}
                        {isExpanded ? (
                          <ChevronUp size={16} className="text-gray-400" />
                        ) : (
                          <ChevronDown size={16} className="text-gray-400" />
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="mt-3 space-y-3 bg-gray-50 rounded-lg p-3">
                      {/* Times */}
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        {point.arrived_at && (
                          <div>
                            <span className="text-gray-500">הגעה: </span>
                            <span className="font-medium">{formatDate(point.arrived_at)}</span>
                          </div>
                        )}
                        {point.completed_at && (
                          <div>
                            <span className="text-gray-500">סיום: </span>
                            <span className="font-medium">{formatDate(point.completed_at)}</span>
                          </div>
                        )}
                      </div>

                      {/* Contact */}
                      {point.contact_name && (
                        <div className="flex items-center gap-2 text-sm">
                          <User size={14} className="text-gray-400" />
                          <span>{point.contact_name}</span>
                          {point.contact_phone && (
                            <a
                              href={`tel:${point.contact_phone}`}
                              className="text-blue-600 hover:underline"
                            >
                              {point.contact_phone}
                            </a>
                          )}
                        </div>
                      )}

                      {/* Recipient */}
                      {point.recipient_name && (
                        <div className="text-sm">
                          <span className="text-gray-500">מקבל: </span>
                          <span className="font-medium">{point.recipient_name}</span>
                          {point.recipient_phone && (
                            <span className="text-gray-500"> · {point.recipient_phone}</span>
                          )}
                        </div>
                      )}

                      {/* Notes */}
                      {point.notes && (
                        <p className="text-sm text-gray-600 bg-white rounded p-2">{point.notes}</p>
                      )}

                      {/* Point Images */}
                      {pointImages.length > 0 && (
                        <div>
                          <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                            <Camera size={12} />
                            תמונות ({pointImages.length})
                          </p>
                          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                            {pointImages.map((img) => (
                              <a
                                key={img.id}
                                href={img.image_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="aspect-square rounded-lg overflow-hidden bg-gray-200"
                              >
                                <img
                                  src={img.image_url}
                                  alt=""
                                  className="w-full h-full object-cover hover:opacity-90 transition-opacity"
                                />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* All Images */}
      {tow.images.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <button
            onClick={() => setShowImages(!showImages)}
            className="w-full flex items-center justify-between"
          >
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Camera size={16} />
              כל התמונות ({tow.images.length})
            </h2>
            {showImages ? (
              <ChevronUp size={16} className="text-gray-400" />
            ) : (
              <ChevronDown size={16} className="text-gray-400" />
            )}
          </button>

          {showImages && (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 mt-4">
              {tow.images.map((img) => (
                <a
                  key={img.id}
                  href={img.image_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="aspect-square rounded-lg overflow-hidden bg-gray-200"
                >
                  <img
                    src={img.image_url}
                    alt=""
                    className="w-full h-full object-cover hover:opacity-90 transition-opacity"
                  />
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Notes */}
      {tow.notes && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-sm font-bold text-gray-900 mb-2">הערות</h2>
          <p className="text-sm text-gray-600">{tow.notes}</p>
        </div>
      )}
    </div>
  )
}