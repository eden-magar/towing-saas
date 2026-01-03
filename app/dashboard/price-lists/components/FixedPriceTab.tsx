'use client'

import { Plus, Trash2, ChevronUp, ChevronDown, FileText } from 'lucide-react'

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

export function FixedPriceTab({
  items,
  onAdd,
  onUpdate,
  onRemove,
  onMove
}: FixedPriceTabProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-gray-800">מחירון כללי</h3>
          <p className="text-sm text-gray-500">תעריפים קבועים למסלולים נפוצים</p>
        </div>
        <button
          onClick={onAdd}
          className="flex items-center gap-1 px-3 py-2 bg-[#33d4ff] text-white rounded-lg hover:bg-[#21b8e6] transition-colors text-sm"
        >
          <Plus size={16} />
          הוסף
        </button>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <FileText size={40} className="mx-auto mb-2 text-gray-300" />
          <p>אין תעריפים קבועים</p>
          <p className="text-sm">לחץ "הוסף" כדי ליצור תעריף חדש</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={item.id} className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200">
              {/* כפתורי הזזה */}
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => onMove(item.id, 'up')}
                  disabled={index === 0}
                  className={`p-0.5 rounded ${index === 0 ? 'text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  <ChevronUp size={14} />
                </button>
                <button
                  onClick={() => onMove(item.id, 'down')}
                  disabled={index === items.length - 1}
                  className={`p-0.5 rounded ${index === items.length - 1 ? 'text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}
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
                className="flex-1 min-w-0 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
              />

              {/* תיאור */}
              <input
                type="text"
                value={item.description}
                onChange={(e) => onUpdate(item.id, { description: e.target.value })}
                placeholder="תיאור (אופציונלי)"
                className="flex-1 min-w-0 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#33d4ff] hidden md:block"
              />

              {/* מחיר */}
              <div className="relative w-24">
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₪</span>
                <input
                  type="number"
                  value={item.price}
                  onChange={(e) => onUpdate(item.id, { price: Number(e.target.value) })}
                  className="w-full pr-7 pl-2 py-2 border border-gray-200 rounded-lg text-sm text-left font-medium focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                />
              </div>

              {/* מחיקה */}
              <button
                onClick={() => onRemove(item.id)}
                className="p-2 text-gray-400 hover:text-red-500 rounded-lg"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}