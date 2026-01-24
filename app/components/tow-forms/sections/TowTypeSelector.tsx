'use client'

import { ArrowRight, Settings } from 'lucide-react'

export type TowType = 'single' | 'exchange' | 'custom' | ''

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
      <div className="p-3 sm:p-5">
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => onChange('single')}
            className={`p-2 sm:p-4 rounded-xl border-2 text-center transition-all ${
              selectedType === 'single'
                ? 'border-[#33d4ff] bg-[#33d4ff]/5'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className={`w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-1 sm:mb-2 rounded-lg sm:rounded-xl flex items-center justify-center ${
              selectedType === 'single' ? 'bg-[#33d4ff] text-white' : 'bg-gray-100 text-gray-500'
            }`}>
              <ArrowRight size={18} className="rotate-180 sm:w-5 sm:h-5" />
            </div>
            <p className={`font-medium text-xs sm:text-sm ${selectedType === 'single' ? 'text-[#33d4ff]' : 'text-gray-700'}`}>
              רגיל
            </p>
            <p className="hidden sm:block text-xs text-gray-500 mt-1">רכב אחד מ-A ל-B</p>
          </button>

          <button
            onClick={() => onChange('exchange')}
            className={`p-2 sm:p-4 rounded-xl border-2 text-center transition-all ${
              selectedType === 'exchange'
                ? 'border-[#33d4ff] bg-[#33d4ff]/5'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className={`w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-1 sm:mb-2 rounded-lg sm:rounded-xl flex items-center justify-center text-base sm:text-lg ${
              selectedType === 'exchange' ? 'bg-[#33d4ff] text-white' : 'bg-gray-100 text-gray-500'
            }`}>
              🔄
            </div>
            <p className={`font-medium text-xs sm:text-sm ${selectedType === 'exchange' ? 'text-[#33d4ff]' : 'text-gray-700'}`}>
              תקין↔תקול
            </p>
            <p className="hidden sm:block text-xs text-gray-500 mt-1">החלפת רכבים</p>
          </button>

          <button
            onClick={() => onChange('custom')}
            className={`p-2 sm:p-4 rounded-xl border-2 text-center transition-all ${
              selectedType === 'custom'
                ? 'border-[#33d4ff] bg-[#33d4ff]/5'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className={`w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-1 sm:mb-2 rounded-lg sm:rounded-xl flex items-center justify-center ${
              selectedType === 'custom' ? 'bg-[#33d4ff] text-white' : 'bg-gray-100 text-gray-500'
            }`}>
              <Settings size={18} className="sm:w-5 sm:h-5" />
            </div>
            <p className={`font-medium text-xs sm:text-sm ${selectedType === 'custom' ? 'text-[#33d4ff]' : 'text-gray-700'}`}>
              מותאם
            </p>
            <p className="hidden sm:block text-xs text-gray-500 mt-1">מסלול חופשי</p>
          </button>
        </div>
      </div>
    </div>
  )
}