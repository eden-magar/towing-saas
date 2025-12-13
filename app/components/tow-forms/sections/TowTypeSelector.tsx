'use client'

import { ArrowRight, Plus } from 'lucide-react'

export type TowType = 'single' | 'exchange' | 'multiple' | ''

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
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <button
            onClick={() => onChange('single')}
            className={`p-3 sm:p-4 rounded-xl border-2 text-center transition-all ${
              selectedType === 'single'
                ? 'border-[#33d4ff] bg-[#33d4ff]/5'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className={`w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-2 rounded-xl flex items-center justify-center ${
              selectedType === 'single' ? 'bg-[#33d4ff] text-white' : 'bg-gray-100 text-gray-500'
            }`}>
              <ArrowRight size={18} className="rotate-180" />
            </div>
            <p className={`font-medium text-xs sm:text-sm ${selectedType === 'single' ? 'text-[#33d4ff]' : 'text-gray-700'}`}>
              רכב תקול
            </p>
            <p className="text-xs text-gray-500 mt-1 hidden sm:block">גרירה רגילה</p>
          </button>

          <button
            onClick={() => onChange('exchange')}
            className={`p-3 sm:p-4 rounded-xl border-2 text-center transition-all ${
              selectedType === 'exchange'
                ? 'border-[#33d4ff] bg-[#33d4ff]/5'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className={`w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-2 rounded-xl flex items-center justify-center ${
              selectedType === 'exchange' ? 'bg-[#33d4ff] text-white' : 'bg-gray-100 text-gray-500'
            }`}>
              <ArrowRight size={18} />
            </div>
            <p className={`font-medium text-xs sm:text-sm ${selectedType === 'exchange' ? 'text-[#33d4ff]' : 'text-gray-700'}`}>
              תקין-תקול
            </p>
            <p className="text-xs text-gray-500 mt-1 hidden sm:block">מסירה + איסוף</p>
          </button>

          <button
            onClick={() => onChange('multiple')}
            className={`p-3 sm:p-4 rounded-xl border-2 text-center transition-all ${
              selectedType === 'multiple'
                ? 'border-[#33d4ff] bg-[#33d4ff]/5'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className={`w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-2 rounded-xl flex items-center justify-center ${
              selectedType === 'multiple' ? 'bg-[#33d4ff] text-white' : 'bg-gray-100 text-gray-500'
            }`}>
              <Plus size={18} />
            </div>
            <p className={`font-medium text-xs sm:text-sm ${selectedType === 'multiple' ? 'text-[#33d4ff]' : 'text-gray-700'}`}>
              מרובה
            </p>
            <p className="text-xs text-gray-500 mt-1 hidden sm:block">כמה רכבים</p>
          </button>
        </div>
      </div>
    </div>
  )
}
