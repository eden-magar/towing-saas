'use client'

interface TowTruckTypeSelectorProps {
  selectedTypes: string[]
  onChange: (types: string[]) => void
  label?: string
  /** Compact trigger + modal only (no inline chip grid). */
  variant?: 'default' | 'triggerOnly'
  /** Label on the compact trigger button (triggerOnly variant). */
  triggerLabel?: string
  isMobile?: boolean
}

const TRUCK_TYPES = [
  { id: 'wheel_lift_cradle', label: 'משקפיים', icon: '🔧' },
  { id: 'flatbed', label: 'רמסע', icon: '🚛' },
  { id: 'carrier', label: 'מובילית', icon: '🚚' },
]

import { useState } from 'react'

export function TowTruckTypeSelector({ 
  selectedTypes, 
  onChange,
  label = 'סוגי גרר מתאימים',
  variant = 'default',
  triggerLabel = 'סוג גרר',
  isMobile = false,
}: TowTruckTypeSelectorProps) {
  const [showModal, setShowModal] = useState(false)
  
  const toggleType = (typeId: string) => {
    if (selectedTypes.includes(typeId)) {
      onChange(selectedTypes.filter(t => t !== typeId))
    } else {
      onChange([...selectedTypes, typeId])
    }
  }

  if (variant === 'triggerOnly') {
    return (
      <div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className={`relative flex w-full min-h-[40px] items-center justify-center rounded-lg border text-xs font-medium transition-colors ${
            selectedTypes.length > 0
              ? 'border-gt-brand bg-gt-brand-subtle text-gt-brand-text'
              : 'border-gt-border text-gt-text-secondary hover:border-gt-border-strong hover:bg-gt-surface-hover'
          }`}
        >
          <span>{triggerLabel}</span>
          {selectedTypes.length > 0 && (
            <span className="absolute top-1 left-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-gt-brand px-1 text-[11px] font-bold text-white">
              {selectedTypes.length}
            </span>
          )}
        </button>
        {showModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setShowModal(false)}
          >
            <div
              className="max-h-[80vh] w-full max-w-md overflow-auto rounded-2xl bg-white shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 flex items-center justify-between border-b border-gray-200 bg-white p-4">
                <h3 className="font-bold text-gray-800">{label}</h3>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="font-medium text-gt-brand"
                >
                  סיום
                </button>
              </div>
              <div className="space-y-2 p-4">
                {TRUCK_TYPES.map((type) => (
                  <button
                    key={`modal-${type.id}`}
                    type="button"
                    onClick={() => toggleType(type.id)}
                    className={`flex min-h-[48px] w-full items-center gap-3 rounded-xl border p-4 text-sm font-medium transition-all ${
                      selectedTypes.includes(type.id)
                        ? 'border-gt-brand bg-gt-brand text-white'
                        : 'border-gray-200 bg-white text-gray-600'
                    }`}
                  >
                    <span className="text-xl">{type.icon}</span>
                    {type.label}
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
      {!isMobile && (
        <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      )}
      
      {/* כפתור מובייל */}
      {isMobile ? (
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className={`sm:hidden relative flex items-center justify-center w-full min-h-[48px] rounded-xl border text-sm font-medium transition-colors ${
            selectedTypes.length > 0
              ? 'border-[#33d4ff] bg-[#33d4ff]/5 text-gray-800'
              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <span>גררים</span>
          {selectedTypes.length > 0 && (
            <span className="absolute top-1.5 left-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#33d4ff] text-white text-[11px] font-bold flex items-center justify-center">
              {selectedTypes.length}
            </span>
          )}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="sm:hidden w-full p-3 border border-gray-200 rounded-xl text-sm text-right flex items-center justify-between hover:bg-gray-50"
        >
          <span className="text-gray-600">
            {selectedTypes.length > 0 
              ? TRUCK_TYPES.filter(t => selectedTypes.includes(t.id)).map(t => `${t.icon} ${t.label}`).join(', ')
              : 'בחר סוגי גרר...'}
          </span>
          <span className="text-gray-400">▼</span>
        </button>
      )}

      {/* מודל מובייל */}
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
              {TRUCK_TYPES.map((type) => (
                <button
                  key={`modal-${type.id}`}
                  type="button"
                  onClick={() => toggleType(type.id)}
                  className={`w-full min-h-[48px] p-4 rounded-xl text-sm font-medium transition-all border flex items-center gap-3 ${
                    selectedTypes.includes(type.id)
                      ? 'bg-[#33d4ff] text-white border-[#33d4ff]'
                      : 'bg-white text-gray-600 border-gray-200'
                  }`}
                >
                  <span className="text-xl">{type.icon}</span>
                  {type.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* דסקטופ */}
      <div className="hidden sm:flex flex-wrap gap-2">
        {TRUCK_TYPES.map((type) => (
          <button
            key={type.id}
            type="button"
            onClick={() => toggleType(type.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
              selectedTypes.includes(type.id)
                ? 'bg-[#33d4ff] text-white border-[#33d4ff]'
                : 'bg-white text-gray-600 border-gray-200 hover:border-[#33d4ff]'
            }`}
          >
            <span className="ml-1">{type.icon}</span>
            {type.label}
          </button>
        ))}
      </div>
      {!isMobile && selectedTypes.length > 0 && (
        <p className="text-xs text-gray-500 mt-2">
          נבחרו {selectedTypes.length} סוגים
        </p>
      )}
    </div>
  )
}