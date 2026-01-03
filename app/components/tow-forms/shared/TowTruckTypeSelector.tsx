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

export function TowTruckTypeSelector({ 
  selectedTypes, 
  onChange,
  label = 'סוגי גרר מתאימים'
}: TowTruckTypeSelectorProps) {
  
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
      <div className="flex flex-wrap gap-2">
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