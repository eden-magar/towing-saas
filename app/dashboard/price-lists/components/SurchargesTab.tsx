'use client'
import { Plus, Trash2, Clock, MapPin, Wrench } from 'lucide-react'
import { TimeInput } from '../../../components/ui/TimeInput'

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
  timeSurcharges: TimeSurcharge[]
  onTimeSurchargeUpdate: (id: string, updates: Partial<TimeSurcharge>) => void
  onTimeSurchargeAdd: () => void
  onTimeSurchargeRemove: (id: string) => void
  locationSurcharges: LocationSurcharge[]
  onLocationSurchargeUpdate: (id: string, updates: Partial<LocationSurcharge>) => void
  onLocationSurchargeAdd: () => void
  onLocationSurchargeRemove: (id: string) => void
  serviceSurcharges: ServiceSurcharge[]
  onServiceSurchargeUpdate: (id: string, updates: Partial<ServiceSurcharge>) => void
  onServiceSurchargeAdd: () => void
  onServiceSurchargeRemove: (id: string) => void
}

function SectionHeader({ icon, title, subtitle, onAdd }: {
  icon: React.ReactNode
  title: string
  subtitle: string
  onAdd: () => void
}) {
  return (
    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
          {icon}
        </div>
        <div>
          <h3 className="font-semibold text-gray-800 text-sm">{title}</h3>
          <p className="text-xs text-gray-400">{subtitle}</p>
        </div>
      </div>
      <button
        onClick={onAdd}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#33d4ff] text-white rounded-xl text-xs font-medium hover:bg-[#21b8e6] transition-colors"
      >
        <Plus size={13} />
        הוסף
      </button>
    </div>
  )
}

function PercentInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="relative w-24">
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full pl-6 pr-3 py-2 border border-gray-200 rounded-xl text-sm text-left font-medium focus:outline-none focus:ring-2 focus:ring-[#33d4ff]/30 focus:border-[#33d4ff] transition-colors"
      />
      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span>
    </div>
  )
}

function PriceInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="relative w-28">
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₪</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full pr-8 pl-3 py-2 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#33d4ff]/30 focus:border-[#33d4ff] transition-colors"
      />
    </div>
  )
}

function TextInput({ value, onChange, placeholder, className }: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]/30 focus:border-[#33d4ff] transition-colors ${className || ''}`}
    />
  )
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="p-1.5 text-gray-300 hover:text-red-400 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0"
    >
      <Trash2 size={14} />
    </button>
  )
}

export function SurchargesTab({
  timeSurcharges, onTimeSurchargeUpdate, onTimeSurchargeAdd, onTimeSurchargeRemove,
  locationSurcharges, onLocationSurchargeUpdate, onLocationSurchargeAdd, onLocationSurchargeRemove,
  serviceSurcharges, onServiceSurchargeUpdate, onServiceSurchargeAdd, onServiceSurchargeRemove
}: SurchargesTabProps) {
  return (
    <div className="space-y-4">

      {/* תוספות זמן */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <SectionHeader
          icon={<Clock size={16} className="text-orange-500" />}
          title="תוספות זמן"
          subtitle="מופעלות אוטומטית לפי שעה ויום"
          onAdd={onTimeSurchargeAdd}
        />
        {timeSurcharges.length === 0 ? (
          <p className="text-center py-8 text-gray-400 text-sm">אין תוספות זמן</p>
        ) : (
          <>
            <div className="grid grid-cols-[1fr_140px_100px_100px_auto] gap-0 text-xs font-medium text-gray-400 px-5 py-2.5 bg-gray-50/50 border-b border-gray-100">
              <div>שם</div>
              <div>סוג יום</div>
              <div>שעת התחלה</div>
              <div>שעת סיום</div>
              <div className="w-16 text-center">%</div>
            </div>
            <div className="divide-y divide-gray-50">
              {timeSurcharges.map((item) => (
                <div key={item.id} className="grid grid-cols-[1fr_140px_100px_100px_auto] gap-3 items-center px-5 py-3 hover:bg-gray-50/30 transition-colors">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={item.is_active}
                      onChange={(e) => onTimeSurchargeUpdate(item.id, { is_active: e.target.checked })}
                      className="rounded accent-[#33d4ff]"
                    />
                    <TextInput
                      value={item.label}
                      onChange={(v) => onTimeSurchargeUpdate(item.id, { label: v, name: v })}
                      placeholder="שם התוספת"
                      className="flex-1"
                    />
                  </div>
                  <select
                    value={item.day_type}
                    onChange={(e) => onTimeSurchargeUpdate(item.id, { day_type: e.target.value })}
                    className="px-2 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]/30 focus:border-[#33d4ff] transition-colors"
                  >
                    <option value="all">כל הימים</option>
                    <option value="weekday">ימי חול</option>
                    <option value="friday">שישי</option>
                    <option value="saturday">שבת</option>
                    <option value="holiday">חג</option>
                  </select>
                  <TimeInput
                    value={item.time_start}
                    onChange={(v) => onTimeSurchargeUpdate(item.id, { time_start: v })}
                    className="px-2 py-2 rounded-xl text-sm focus:ring-2 focus:ring-[#33d4ff]/30 focus:border-[#33d4ff]"
                  />
                  <TimeInput
                    value={item.time_end}
                    onChange={(v) => onTimeSurchargeUpdate(item.id, { time_end: v })}
                    className="px-2 py-2 rounded-xl text-sm focus:ring-2 focus:ring-[#33d4ff]/30 focus:border-[#33d4ff]"
                  />
                  <div className="flex items-center gap-2 w-16">
                    <PercentInput
                      value={item.surcharge_percent}
                      onChange={(v) => onTimeSurchargeUpdate(item.id, { surcharge_percent: v })}
                    />
                    <RemoveButton onClick={() => onTimeSurchargeRemove(item.id)} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* תוספות מיקום */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <SectionHeader
          icon={<MapPin size={16} className="text-blue-500" />}
          title="תוספות מיקום"
          subtitle="תוספת לפי אזור גיאוגרפי"
          onAdd={onLocationSurchargeAdd}
        />
        {locationSurcharges.length === 0 ? (
          <p className="text-center py-8 text-gray-400 text-sm">אין תוספות מיקום</p>
        ) : (
          <>
            <div className="grid grid-cols-[1fr_120px_auto] gap-0 text-xs font-medium text-gray-400 px-5 py-2.5 bg-gray-50/50 border-b border-gray-100">
              <div>שם האזור</div>
              <div className="text-center">תוספת</div>
              <div className="w-8" />
            </div>
            <div className="divide-y divide-gray-50">
              {locationSurcharges.map((item) => (
                <div key={item.id} className="grid grid-cols-[1fr_120px_auto] gap-3 items-center px-5 py-3 hover:bg-gray-50/30 transition-colors">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={item.is_active}
                      onChange={(e) => onLocationSurchargeUpdate(item.id, { is_active: e.target.checked })}
                      className="rounded accent-[#33d4ff]"
                    />
                    <TextInput
                      value={item.label}
                      onChange={(v) => onLocationSurchargeUpdate(item.id, { label: v })}
                      placeholder="שם האזור"
                      className="flex-1"
                    />
                  </div>
                  <div className="flex justify-center">
                    <PercentInput
                      value={item.surcharge_percent}
                      onChange={(v) => onLocationSurchargeUpdate(item.id, { surcharge_percent: v })}
                    />
                  </div>
                  <RemoveButton onClick={() => onLocationSurchargeRemove(item.id)} />
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* שירותים נוספים */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <SectionHeader
          icon={<Wrench size={16} className="text-purple-500" />}
          title="שירותים נוספים"
          subtitle="שירותים שניתן להוסיף לגרירה"
          onAdd={onServiceSurchargeAdd}
        />
        {serviceSurcharges.length === 0 ? (
          <p className="text-center py-8 text-gray-400 text-sm">אין שירותים נוספים</p>
        ) : (
          <>
            <div className="grid grid-cols-[1fr_140px_120px_auto] gap-0 text-xs font-medium text-gray-400 px-5 py-2.5 bg-gray-50/50 border-b border-gray-100">
              <div>שם השירות</div>
              <div>סוג תמחור</div>
              <div className="text-center">מחיר</div>
              <div className="w-8" />
            </div>
            <div className="divide-y divide-gray-50">
              {serviceSurcharges.map((item) => (
                <div key={item.id} className="grid grid-cols-[1fr_140px_120px_auto] gap-3 items-center px-5 py-3 hover:bg-gray-50/30 transition-colors">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={item.is_active}
                      onChange={(e) => onServiceSurchargeUpdate(item.id, { is_active: e.target.checked })}
                      className="rounded accent-[#33d4ff]"
                    />
                    <TextInput
                      value={item.label}
                      onChange={(v) => onServiceSurchargeUpdate(item.id, { label: v })}
                      placeholder="שם השירות"
                      className="flex-1"
                    />
                  </div>
                  <select
                    value={item.price_type}
                    onChange={(e) => onServiceSurchargeUpdate(item.id, { price_type: e.target.value as any })}
                    className="px-2 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]/30 focus:border-[#33d4ff] transition-colors"
                  >
                    <option value="fixed">קבוע</option>
                    <option value="per_unit">ליחידה</option>
                    <option value="manual">ידני</option>
                  </select>
                  <div className="flex justify-center">
                    <PriceInput
                      value={item.price}
                      onChange={(v) => onServiceSurchargeUpdate(item.id, { price: v })}
                    />
                  </div>
                  <RemoveButton onClick={() => onServiceSurchargeRemove(item.id)} />
                </div>
              ))}
            </div>
          </>
        )}
      </div>

    </div>
  )
}