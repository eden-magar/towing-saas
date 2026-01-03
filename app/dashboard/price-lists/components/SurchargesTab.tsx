'use client'

import { Plus, Trash2, Clock, MapPin, Wrench } from 'lucide-react'

// ==================== Types ====================

interface TimeSurcharge {
  id: string
  name: string
  label: string
  time_start: string
  time_end: string
  day_type: string
  surcharge_percent: number
  is_active: boolean
}

interface LocationSurcharge {
  id: string
  label: string
  surcharge_percent: number
  is_active: boolean
}

interface ServiceSurcharge {
  id: string
  label: string
  price: number
  price_type: 'fixed' | 'per_unit' | 'manual'
  unit_label?: string
  is_active: boolean
}

interface SurchargesTabProps {
  // תוספות זמן
  timeSurcharges: TimeSurcharge[]
  onTimeSurchargeUpdate: (id: string, updates: Partial<TimeSurcharge>) => void
  onTimeSurchargeAdd: () => void
  onTimeSurchargeRemove: (id: string) => void
  // תוספות אזור
  locationSurcharges: LocationSurcharge[]
  onLocationSurchargeUpdate: (id: string, updates: Partial<LocationSurcharge>) => void
  onLocationSurchargeAdd: () => void
  onLocationSurchargeRemove: (id: string) => void
  // שירותים נוספים
  serviceSurcharges: ServiceSurcharge[]
  onServiceSurchargeUpdate: (id: string, updates: Partial<ServiceSurcharge>) => void
  onServiceSurchargeAdd: () => void
  onServiceSurchargeRemove: (id: string) => void
}

// ==================== Component ====================

export function SurchargesTab({
  timeSurcharges,
  onTimeSurchargeUpdate,
  onTimeSurchargeAdd,
  onTimeSurchargeRemove,
  locationSurcharges,
  onLocationSurchargeUpdate,
  onLocationSurchargeAdd,
  onLocationSurchargeRemove,
  serviceSurcharges,
  onServiceSurchargeUpdate,
  onServiceSurchargeAdd,
  onServiceSurchargeRemove
}: SurchargesTabProps) {
  return (
    <div className="space-y-6">
      {/* תוספות זמן */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock size={20} className="text-orange-500" />
            <div>
              <h3 className="font-bold text-gray-800">תוספות זמן</h3>
              <p className="text-sm text-gray-500">מופעלות אוטומטית לפי שעה ויום</p>
            </div>
          </div>
          <button
            onClick={onTimeSurchargeAdd}
            className="flex items-center gap-1 px-3 py-2 bg-[#33d4ff] text-white rounded-lg hover:bg-[#21b8e6] transition-colors text-sm"
          >
            <Plus size={16} />
            הוסף
          </button>
        </div>

        {timeSurcharges.length === 0 ? (
          <p className="text-center py-4 text-gray-500 text-sm">אין תוספות זמן</p>
        ) : (
          <div className="space-y-2">
            {timeSurcharges.map((item) => (
              <div key={item.id} className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200">
                <input
                  type="checkbox"
                  checked={item.is_active}
                  onChange={(e) => onTimeSurchargeUpdate(item.id, { is_active: e.target.checked })}
                  className="w-4 h-4 text-[#33d4ff] rounded flex-shrink-0"
                />
                
                <input
                  type="text"
                  value={item.label}
                  onChange={(e) => onTimeSurchargeUpdate(item.id, { label: e.target.value })}
                  placeholder="שם"
                  className="w-24 px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                />

                <select
                  value={item.day_type}
                  onChange={(e) => onTimeSurchargeUpdate(item.id, { day_type: e.target.value })}
                  className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                >
                  <option value="all">כל הימים</option>
                  <option value="saturday">שבת</option>
                  <option value="friday">שישי</option>
                  <option value="holiday">חג</option>
                </select>

                {item.day_type === 'all' && (
                  <>
                    <input
                      type="time"
                      value={item.time_start}
                      onChange={(e) => onTimeSurchargeUpdate(item.id, { time_start: e.target.value })}
                      className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                    />
                    <span className="text-gray-400">-</span>
                    <input
                      type="time"
                      value={item.time_end}
                      onChange={(e) => onTimeSurchargeUpdate(item.id, { time_end: e.target.value })}
                      className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                    />
                  </>
                )}

                <div className="flex items-center gap-1 mr-auto">
                  <span className="text-gray-400 text-sm">+</span>
                  <input
                    type="number"
                    value={item.surcharge_percent}
                    onChange={(e) => onTimeSurchargeUpdate(item.id, { surcharge_percent: Number(e.target.value) })}
                    className="w-16 px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-left focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                  />
                  <span className="text-gray-400 text-sm">%</span>
                </div>

                <button
                  onClick={() => onTimeSurchargeRemove(item.id)}
                  className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* תוספות אזור */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MapPin size={20} className="text-blue-500" />
            <div>
              <h3 className="font-bold text-gray-800">תוספות אזור</h3>
              <p className="text-sm text-gray-500">לפי אזור גיאוגרפי</p>
            </div>
          </div>
          <button
            onClick={onLocationSurchargeAdd}
            className="flex items-center gap-1 px-3 py-2 bg-[#33d4ff] text-white rounded-lg hover:bg-[#21b8e6] transition-colors text-sm"
          >
            <Plus size={16} />
            הוסף
          </button>
        </div>

        {locationSurcharges.length === 0 ? (
          <p className="text-center py-4 text-gray-500 text-sm">אין תוספות אזור</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {locationSurcharges.map((item) => (
              <div key={item.id} className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200">
                <input
                  type="checkbox"
                  checked={item.is_active}
                  onChange={(e) => onLocationSurchargeUpdate(item.id, { is_active: e.target.checked })}
                  className="w-4 h-4 text-[#33d4ff] rounded flex-shrink-0"
                />
                
                <input
                  type="text"
                  value={item.label}
                  onChange={(e) => onLocationSurchargeUpdate(item.id, { label: e.target.value })}
                  placeholder="שם האזור"
                  className="flex-1 min-w-0 px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                />

                <div className="flex items-center gap-1">
                  <span className="text-gray-400 text-sm">+</span>
                  <input
                    type="number"
                    value={item.surcharge_percent}
                    onChange={(e) => onLocationSurchargeUpdate(item.id, { surcharge_percent: Number(e.target.value) })}
                    className="w-14 px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-left focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                  />
                  <span className="text-gray-400 text-sm">%</span>
                </div>

                <button
                  onClick={() => onLocationSurchargeRemove(item.id)}
                  className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* שירותים נוספים */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Wrench size={20} className="text-purple-500" />
            <div>
              <h3 className="font-bold text-gray-800">שירותים נוספים</h3>
              <p className="text-sm text-gray-500">תוספות ידניות בטופס גרירה</p>
            </div>
          </div>
          <button
            onClick={onServiceSurchargeAdd}
            className="flex items-center gap-1 px-3 py-2 bg-[#33d4ff] text-white rounded-lg hover:bg-[#21b8e6] transition-colors text-sm"
          >
            <Plus size={16} />
            הוסף
          </button>
        </div>

        {serviceSurcharges.length === 0 ? (
          <p className="text-center py-4 text-gray-500 text-sm">אין שירותים נוספים. הוסף שירותים כמו: חניון תת קרקעי, דולי, חילוץ, המתנה...</p>
        ) : (
          <div className="space-y-2">
            {serviceSurcharges.map((item) => (
              <div key={item.id} className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200">
                <input
                  type="checkbox"
                  checked={item.is_active}
                  onChange={(e) => onServiceSurchargeUpdate(item.id, { is_active: e.target.checked })}
                  className="w-4 h-4 text-[#33d4ff] rounded flex-shrink-0"
                />
                
                <input
                  type="text"
                  value={item.label}
                  onChange={(e) => onServiceSurchargeUpdate(item.id, { label: e.target.value })}
                  placeholder="שם השירות"
                  className="flex-1 min-w-0 px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                />

                <select
                  value={item.price_type}
                  onChange={(e) => onServiceSurchargeUpdate(item.id, { price_type: e.target.value as any })}
                  className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                >
                  <option value="fixed">מחיר קבוע</option>
                  <option value="per_unit">לפי יחידה</option>
                  <option value="manual">הזנה ידנית</option>
                </select>

                {item.price_type === 'per_unit' && (
                  <input
                    type="text"
                    value={item.unit_label || ''}
                    onChange={(e) => onServiceSurchargeUpdate(item.id, { unit_label: e.target.value })}
                    placeholder="יחידה (קומה, רבע שעה...)"
                    className="w-28 px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                  />
                )}

                {item.price_type !== 'manual' && (
                  <div className="relative w-20">
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₪</span>
                    <input
                      type="number"
                      value={item.price}
                      onChange={(e) => onServiceSurchargeUpdate(item.id, { price: Number(e.target.value) })}
                      className="w-full pr-6 pl-2 py-1.5 border border-gray-200 rounded-lg text-sm text-left focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                    />
                  </div>
                )}

                {item.price_type === 'manual' && (
                  <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded">יוזן בטופס</span>
                )}

                <button
                  onClick={() => onServiceSurchargeRemove(item.id)}
                  className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}