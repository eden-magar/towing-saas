'use client'

import { FileText, Plus, Trash2, ChevronUp, ChevronDown, GripVertical } from 'lucide-react'

interface FixedPriceItem {
  id: string
  label: string
  description: string
  price: number
  sort_order: number
}

interface FixedPriceTabProps {
  items: FixedPriceItem[]
  onAdd: () => void
  onUpdate: (id: string, updates: Partial<FixedPriceItem>) => void
  onRemove: (id: string) => void
  onMove: (id: string, direction: 'up' | 'down') => void
}

export function FixedPriceTab({ items, onAdd, onUpdate, onRemove, onMove }: FixedPriceTabProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div>
          <h3 className="font-semibold text-gray-800 text-sm">מחירון כללי</h3>
          <p className="text-xs text-gray-400 mt-0.5">תעריפים קבועים למסלולים נפוצים</p>
        </div>
        <button
          onClick={onAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#33d4ff] text-white rounded-xl text-xs font-medium hover:bg-[#21b8e6] transition-colors"
        >
          <Plus size={14} />
          הוסף תעריף
        </button>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <FileText size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">אין תעריפים קבועים</p>
          <p className="text-xs mt-1">לחץ "הוסף תעריף" כדי להתחיל</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-[auto_1fr_1fr_120px_auto] gap-0 text-xs font-medium text-gray-400 px-5 py-2.5 border-b border-gray-50">
            <div className="w-8" />
            <div>שם התעריף</div>
            <div>תיאור</div>
            <div className="text-center">מחיר</div>
            <div className="w-16" />
          </div>
          <div className="divide-y divide-gray-50">
            {items.map((item, index) => (
              <div key={item.id} className="grid grid-cols-[auto_1fr_1fr_120px_auto] gap-3 items-center px-5 py-3 hover:bg-gray-50/50 transition-colors">
                {/* סדר */}
                <div className="flex flex-col gap-0.5 w-8">
                  <button
                    onClick={() => onMove(item.id, 'up')}
                    disabled={index === 0}
                    className="p-0.5 text-gray-300 hover:text-gray-500 disabled:opacity-0 transition-colors"
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    onClick={() => onMove(item.id, 'down')}
                    disabled={index === items.length - 1}
                    className="p-0.5 text-gray-300 hover:text-gray-500 disabled:opacity-0 transition-colors"
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>

                {/* שם */}
                <input
                  type="text"
                  value={item.label}
                  onChange={(e) => onUpdate(item.id, { label: e.target.value })}
                  placeholder="שם התעריף"
                  className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]/30 focus:border-[#33d4ff] transition-colors"
                />

                {/* תיאור */}
                <input
                  type="text"
                  value={item.description}
                  onChange={(e) => onUpdate(item.id, { description: e.target.value })}
                  placeholder="תיאור (אופציונלי)"
                  className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]/30 focus:border-[#33d4ff] transition-colors text-gray-500"
                />

                {/* מחיר */}
                <div className="relative">
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₪</span>
                  <input
                    type="number"
                    value={item.price}
                    onChange={(e) => onUpdate(item.id, { price: Number(e.target.value) })}
                    className="w-full pr-8 pl-3 py-2 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#33d4ff]/30 focus:border-[#33d4ff] transition-colors"
                  />
                </div>

                {/* מחיקה */}
                <div className="flex justify-end w-16">
                  <button
                    onClick={() => onRemove(item.id)}
                    className="p-1.5 text-gray-300 hover:text-red-400 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}