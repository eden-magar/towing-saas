'use client'

interface TowTruckTypeSelectorProps {
  selectedTypes: string[]
  onChange: (types: string[]) => void
  label?: string
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
  label = 'סוגי גרר מתאימים'
}: TowTruckTypeSelectorProps) {
  const [showModal, setShowModal] = useState(false)
  
  const toggleType = (typeId: string) => {
    if (selectedTypes.includes(typeId)) {
      onChange(selectedTypes.filter(t => t !== typeId))
    } else {
      onChange([...selectedTypes, typeId])
    }
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      
      {/* כפתור מובייל */}
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

      {/* מודל מובייל */}
      {showModal && (
        <div className="sm:hidden fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-2xl">
            <div className="border-b border-gray-200 p-4 flex items-center justify-between">
              <h3 className="font-bold text-gray-800">{label}</h3>
              <button type="button" onClick={() => setShowModal(false)} className="text-[#33d4ff] font-medium">סיום</button>
            </div>
            <div className="p-4 space-y-2">
              {TRUCK_TYPES.map((type) => (
                <button
                  key={`modal-${type.id}`}
                  type="button"
                  onClick={() => toggleType(type.id)}
                  className={`w-full p-4 rounded-xl text-sm font-medium transition-all border flex items-center gap-3 ${
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
      {selectedTypes.length > 0 && (
        <p className="text-xs text-gray-500 mt-2">
          נבחרו {selectedTypes.length} סוגים
        </p>
      )}
    </div>
  )
}