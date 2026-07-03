'use client'

import { useState } from 'react'
import { LocationSurcharge } from '../../../lib/queries/price-lists'

interface LocationSurchargeSelectorProps {
  locationSurcharges: LocationSurcharge[]
  selectedLocationSurcharges: string[]
  onChange: (ids: string[]) => void
  label?: string
  isMobile?: boolean
}

export function LocationSurchargeSelector({
  locationSurcharges,
  selectedLocationSurcharges,
  onChange,
  label = 'תוספות מיקום',
  isMobile = false,
}: LocationSurchargeSelectorProps) {
  const [showModal, setShowModal] = useState(false)
  const activeSurcharges = locationSurcharges.filter((s) => s.is_active)

  if (activeSurcharges.length === 0) return null

  const toggleSurcharge = (id: string) => {
    if (selectedLocationSurcharges.includes(id)) {
      onChange(selectedLocationSurcharges.filter((item) => item !== id))
    } else {
      onChange([...selectedLocationSurcharges, id])
    }
  }

  if (isMobile) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className={`sm:hidden relative flex items-center justify-center w-full min-h-[48px] rounded-xl border text-sm font-medium transition-colors ${
            selectedLocationSurcharges.length > 0
              ? 'border-[#33d4ff] bg-[#33d4ff]/5 text-gray-800'
              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <span>מיקום</span>
          {selectedLocationSurcharges.length > 0 && (
            <span className="absolute top-1.5 left-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#33d4ff] text-white text-[11px] font-bold flex items-center justify-center">
              {selectedLocationSurcharges.length}
            </span>
          )}
        </button>

        {showModal && (
          <div
            className="sm:hidden fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            onClick={() => setShowModal(false)}
          >
            <div
              className="bg-white w-full max-w-md max-h-[80vh] overflow-auto rounded-2xl shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
                <h3 className="font-bold text-gray-800">{label}</h3>
                <button type="button" onClick={() => setShowModal(false)} className="text-[#33d4ff] font-medium">סיום</button>
              </div>
              <div className="p-4 space-y-2">
                {activeSurcharges.map((s) => (
                  <button
                    key={`modal-${s.id}`}
                    type="button"
                    onClick={() => toggleSurcharge(s.id)}
                    className={`w-full rounded-xl text-sm transition-colors flex items-center justify-between min-h-[48px] p-3 ${
                      selectedLocationSurcharges.includes(s.id) ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    <span>{s.label} (+{s.surcharge_percent}%)</span>
                    {selectedLocationSurcharges.includes(s.id) && <span>✓</span>}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <p className="text-sm font-medium text-gray-700 mb-2">{label}</p>
      <div className="flex flex-wrap gap-2">
        {activeSurcharges.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => toggleSurcharge(s.id)}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${
              selectedLocationSurcharges.includes(s.id)
                ? 'bg-amber-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s.label} (+{s.surcharge_percent}%)
          </button>
        ))}
      </div>
    </div>
  )
}
