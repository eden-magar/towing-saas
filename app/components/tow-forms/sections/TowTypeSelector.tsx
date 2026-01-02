'use client'

import { ArrowRight, Settings } from 'lucide-react'

export type TowType = 'single' | 'custom' | ''

interface TowTypeSelectorProps {
  selectedType: TowType
  onChange: (type: TowType) => void
}

export function TowTypeSelector({ selectedType, onChange }: TowTypeSelectorProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-4 sm:px-5 py-3 sm:py-4 bg-gray-50 border-b border-gray-200">
        <h2 className="font-bold text-gray-800 flex items-center gap-2 text-sm sm:text-base">
          <span className="w-6 h-6 bg-[#33d4ff] text-white rounded-full flex items-center justify-center text-sm">2</span>
          סוג גרירה
        </h2>
      </div>
      <div className="p-4 sm:p-5">
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => onChange('single')}
            className={`p-4 rounded-xl border-2 text-center transition-all ${
              selectedType === 'single'
                ? 'border-[#33d4ff] bg-[#33d4ff]/5'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className={`w-10 h-10 mx-auto mb-2 rounded-xl flex items-center justify-center ${
              selectedType === 'single' ? 'bg-[#33d4ff] text-white' : 'bg-gray-100 text-gray-500'
            }`}>
              <ArrowRight size={20} className="rotate-180" />
            </div>
            <p className={`font-medium text-sm ${selectedType === 'single' ? 'text-[#33d4ff]' : 'text-gray-700'}`}>
              רגיל
            </p>
            <p className="text-xs text-gray-500 mt-1">רכב אחד מ-A ל-B</p>
          </button>

          <button
            onClick={() => onChange('custom')}
            className={`p-4 rounded-xl border-2 text-center transition-all ${
              selectedType === 'custom'
                ? 'border-[#33d4ff] bg-[#33d4ff]/5'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className={`w-10 h-10 mx-auto mb-2 rounded-xl flex items-center justify-center ${
              selectedType === 'custom' ? 'bg-[#33d4ff] text-white' : 'bg-gray-100 text-gray-500'
            }`}>
              <Settings size={20} />
            </div>
            <p className={`font-medium text-sm ${selectedType === 'custom' ? 'text-[#33d4ff]' : 'text-gray-700'}`}>
              מותאם אישית
            </p>
            <p className="text-xs text-gray-500 mt-1">בניית מסלול חופשי</p>
          </button>
        </div>
      </div>
    </div>
  )
}