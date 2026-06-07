'use client'

import { Home, Info, MapPin, Plus, Scale, Trash2 } from 'lucide-react'
import AddressInput from '../../../components/address/AddressInput'

interface BaseLocationData {
  address: string
  placeId?: string
  lat?: number
  lng?: number
}

interface VehiclePrice {
  id: string
  label: string
  field: string
  price: number
}

interface BasePriceTabProps {
  baseLocation: BaseLocationData
  vehiclePrices: VehiclePrice[]
  pricePerKm: number
  minimumPrice: number
  onBaseLocationChange: (location: BaseLocationData) => void
  onVehiclePriceChange: (id: string, value: number) => void
  onPricePerKmChange: (value: number) => void
  onMinimumPriceChange: (value: number) => void
  weightBrackets: { id: string; min_kg: number; max_kg: number | null; base_price: number }[]
  onWeightBracketAdd: () => void
  onWeightBracketUpdate: (id: string, updates: Partial<{ min_kg: number; max_kg: number | null; base_price: number }>) => void
  onWeightBracketRemove: (id: string) => void
}

function PriceInput({ label, value, onChange, hint }: { label: string; value: number; onChange: (v: number) => void; hint?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1.5">{label}</label>
      <div className="relative">
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₪</span>
        <input
          type="number"
          value={value || ''}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full pr-8 pl-3 py-2.5 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#33d4ff]/30 focus:border-[#33d4ff] transition-colors"
        />
      </div>
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
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

export function BasePriceTab({
  baseLocation,
  vehiclePrices,
  pricePerKm,
  minimumPrice,
  onBaseLocationChange,
  onVehiclePriceChange,
  onPricePerKmChange,
  onMinimumPriceChange,
  weightBrackets,
  onWeightBracketAdd,
  onWeightBracketUpdate,
  onWeightBracketRemove,
}: BasePriceTabProps) {
  return (
    <div className="space-y-4">

      {/* נקודת בסיס */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
            <Home size={16} className="text-emerald-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800 text-sm">נקודת בסיס</h3>
            <p className="text-xs text-gray-400">כתובת המוצא של הגררים</p>
          </div>
        </div>
        <AddressInput
          value={baseLocation}
          onChange={onBaseLocationChange}
          placeholder="כתובת הבסיס..."
        />
        {baseLocation.lat && baseLocation.lng && (
          <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-2">
            <MapPin size={12} className="text-emerald-500" />
            <span>{baseLocation.lat.toFixed(5)}, {baseLocation.lng.toFixed(5)}</span>
          </div>
        )}
      </div>

      {/* מחירי רכב + מרחק */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-semibold text-gray-800 text-sm mb-4">מחיר בסיס לפי סוג רכב</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {vehiclePrices.map((item) => (
            <PriceInput
              key={item.id}
              label={item.label}
              value={item.price}
              onChange={(v) => onVehiclePriceChange(item.id, v)}
            />
          ))}
        </div>

        <div className="border-t border-gray-100 pt-4">
          <h3 className="font-semibold text-gray-800 text-sm mb-3">תעריף מרחק</h3>
          <div className="grid grid-cols-2 gap-3">
            <PriceInput
              label='מחיר לקילומטר'
              value={pricePerKm}
              onChange={onPricePerKmChange}
            />
            <PriceInput
              label="מחיר מינימום"
              value={minimumPrice}
              onChange={onMinimumPriceChange}
            />
          </div>
        </div>

        <div className="flex items-start gap-2 mt-4 p-3 bg-blue-50 rounded-xl">
          <Info size={14} className="text-blue-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-blue-600">
            <span className="font-medium">נוסחה:</span> מחיר בסיס + (מרחק × מחיר לק"מ). אם התוצאה נמוכה ממינימום — ייגבה מחיר מינימום.
          </p>
        </div>
      </div>

      {/* מדרגות משקל (רכב מסחרי) */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
              <Scale size={16} className="text-amber-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800 text-sm">מדרגות משקל (רכב מסחרי)</h3>
              <p className="text-xs text-gray-400">מחיר בסיס לגרירה לפי משקל הרכב המסחרי</p>
            </div>
          </div>
          <button
            onClick={onWeightBracketAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#33d4ff] text-white rounded-xl text-xs font-medium hover:bg-[#21b8e6] transition-colors"
          >
            <Plus size={13} />
            הוסף
          </button>
        </div>
        {weightBrackets.length === 0 ? (
          <p className="text-center py-8 text-gray-400 text-sm">אין מדרגות משקל</p>
        ) : (
          <>
            <div className="grid grid-cols-[1fr_1fr_120px_auto] gap-0 text-xs font-medium text-gray-400 px-5 py-2.5 bg-gray-50/50 border-b border-gray-100">
              <div>מ-(ק״ג)</div>
              <div>עד (ק״ג)</div>
              <div className="text-center">מחיר בסיס ₪</div>
              <div className="w-8" />
            </div>
            <div className="divide-y divide-gray-50">
              {weightBrackets.map((item) => (
                <div key={item.id} className="grid grid-cols-[1fr_1fr_120px_auto] gap-3 items-center px-5 py-3 hover:bg-gray-50/30 transition-colors">
                  <input
                    type="number"
                    value={item.min_kg || ''}
                    onChange={(e) => onWeightBracketUpdate(item.id, { min_kg: Number(e.target.value) })}
                    className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]/30 focus:border-[#33d4ff] transition-colors"
                  />
                  <input
                    type="number"
                    value={item.max_kg ?? ''}
                    onChange={(e) => onWeightBracketUpdate(item.id, {
                      max_kg: e.target.value === '' ? null : Number(e.target.value),
                    })}
                    placeholder="ללא הגבלה"
                    className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]/30 focus:border-[#33d4ff] transition-colors"
                  />
                  <div className="relative">
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₪</span>
                    <input
                      type="number"
                      value={item.base_price || ''}
                      onChange={(e) => onWeightBracketUpdate(item.id, { base_price: Number(e.target.value) })}
                      className="w-full pr-8 pl-3 py-2 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#33d4ff]/30 focus:border-[#33d4ff] transition-colors"
                    />
                  </div>
                  <RemoveButton onClick={() => onWeightBracketRemove(item.id)} />
                </div>
              ))}
            </div>
          </>
        )}
      </div>

    </div>
  )
}
