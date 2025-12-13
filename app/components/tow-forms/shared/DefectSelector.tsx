'use client'

interface DefectSelectorProps {
  selectedDefects: string[]
  onChange: (defects: string[]) => void
  label?: string
}

const DEFAULT_DEFECTS = ['תקר', 'מנוע', 'סוללה', 'תאונה', 'נעילה', 'אחר']

export function DefectSelector({ 
  selectedDefects, 
  onChange, 
  label = 'תקלה' 
}: DefectSelectorProps) {
  
  const toggleDefect = (defect: string) => {
    if (selectedDefects.includes(defect)) {
      onChange(selectedDefects.filter(d => d !== defect))
    } else {
      onChange([...selectedDefects, defect])
    }
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="flex flex-wrap gap-2">
        {DEFAULT_DEFECTS.map((defect) => (
          <button
            key={defect}
            type="button"
            onClick={() => toggleDefect(defect)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              selectedDefects.includes(defect)
                ? 'bg-[#33d4ff] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {defect}
          </button>
        ))}
      </div>
    </div>
  )
}
