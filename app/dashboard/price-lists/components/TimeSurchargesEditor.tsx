'use client'

import { Plus, Trash2, Clock } from 'lucide-react'
import { TimeInput } from '../../../components/ui/TimeInput'

export interface TimeSurchargeEditorRow {
  id: string
  name: string
  label: string
  time_start: string
  time_end: string
  day_type: string
  surcharge_percent: number
  is_active: boolean
}

function isTechnicalSurchargeName(name: string | null | undefined): boolean {
  return !!name && /^new_\d+$/.test(name)
}

/** Display value for the name input — hides auto-generated new_* ids. */
export function getTimeSurchargeEditorLabel(row: Pick<TimeSurchargeEditorRow, 'label' | 'name'>): string {
  const label = row.label
  if (label?.trim()) return label
  const name = row.name
  if (name?.trim() && !isTechnicalSurchargeName(name.trim())) return name
  return ''
}

/** Resolve label for save/display when empty — time range or fallback. */
export function resolveTimeSurchargeLabel(row: {
  label?: string | null
  name?: string | null
  time_start?: string | null
  time_end?: string | null
}): string {
  const label = row.label?.trim()
  if (label) return label
  const name = row.name?.trim()
  if (name && !isTechnicalSurchargeName(name)) return name
  const start = row.time_start?.trim()
  const end = row.time_end?.trim()
  if (start && end) return `${start}-${end}`
  if (start || end) return start || end || 'תוספת זמן'
  return 'תוספת זמן'
}

export function createDefaultTimeSurchargeRow(id?: string): TimeSurchargeEditorRow {
  return {
    id: id ?? `new_${Date.now()}`,
    name: '',
    label: '',
    time_start: '18:00',
    time_end: '22:00',
    day_type: 'all',
    surcharge_percent: 0,
    is_active: true,
  }
}

export interface TimeSurchargesEditorProps {
  rows: TimeSurchargeEditorRow[]
  onUpdate: (id: string, updates: Partial<TimeSurchargeEditorRow>) => void
  onAdd: () => void
  onRemove: (id: string) => void
}

function SectionHeader({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
          <Clock size={16} className="text-orange-500" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-800 text-sm">תוספות זמן</h3>
          <p className="text-xs text-gray-400">מופעלות אוטומטית לפי שעה ויום</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#33d4ff] text-white rounded-xl text-xs font-medium hover:bg-[#21b8e6] transition-colors"
      >
        <Plus size={13} />
        הוסף
      </button>
    </div>
  )
}

function PercentInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="relative w-24 shrink-0 min-w-[6rem]">
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full pl-6 pr-3 py-2 border border-gray-200 rounded-xl text-sm text-left font-medium bg-white focus:outline-none focus:ring-2 focus:ring-[#33d4ff]/30 focus:border-[#33d4ff] transition-colors"
      />
      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span>
    </div>
  )
}

function TextInput({ value, onChange, placeholder, className }: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#33d4ff]/30 focus:border-[#33d4ff] transition-colors ${className || ''}`}
    />
  )
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="p-1.5 text-gray-300 hover:text-red-400 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0"
    >
      <Trash2 size={14} />
    </button>
  )
}

const GRID_COLS = 'grid-cols-[56px_minmax(120px,1fr)_120px_5.5rem_5.5rem_8.5rem]'

export function TimeSurchargesEditor({ rows, onUpdate, onAdd, onRemove }: TimeSurchargesEditorProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <SectionHeader onAdd={onAdd} />
      {rows.length === 0 ? (
        <p className="text-center py-8 text-gray-400 text-sm">אין תוספות זמן</p>
      ) : (
        <div className="overflow-x-auto">
          <div className={`grid ${GRID_COLS} gap-x-3 px-5 min-w-[680px]`}>
          {/* Header — contents so cells share column tracks with data rows */}
          <div className="contents text-xs font-medium text-gray-400">
            <div className="py-2.5 bg-gray-50/50 border-b border-gray-100 text-center">פעיל</div>
            <div className="py-2.5 bg-gray-50/50 border-b border-gray-100">שם</div>
            <div className="py-2.5 bg-gray-50/50 border-b border-gray-100">סוג יום</div>
            <div className="py-2.5 bg-gray-50/50 border-b border-gray-100">שעת התחלה</div>
            <div className="py-2.5 bg-gray-50/50 border-b border-gray-100">שעת סיום</div>
            <div className="py-2.5 bg-gray-50/50 border-b border-gray-100 text-center">%</div>
          </div>
          {rows.map((item) => (
            <div key={item.id} className="contents group">
              <div className="py-3 min-w-0 flex items-center justify-center gap-1 border-b border-gray-50 group-hover:bg-gray-50/30 transition-colors">
                <label className="flex items-center gap-1 cursor-pointer" title="פעיל">
                  <input
                    type="checkbox"
                    checked={item.is_active}
                    onChange={(e) => onUpdate(item.id, { is_active: e.target.checked })}
                    className="rounded accent-[#33d4ff] shrink-0"
                  />
                  <span className="text-xs text-gray-500 select-none">פעיל</span>
                </label>
              </div>
              <div className="py-3 border-b border-gray-50 group-hover:bg-gray-50/30 transition-colors">
                <TextInput
                  value={getTimeSurchargeEditorLabel(item)}
                  onChange={(v) => onUpdate(item.id, { label: v, name: v })}
                  placeholder="שם התוספת (לדוגמה: ערב, לילה)"
                />
              </div>
              <div className="py-3 min-w-0 border-b border-gray-50 group-hover:bg-gray-50/30 transition-colors">
                <select
                  value={item.day_type}
                  onChange={(e) => onUpdate(item.id, { day_type: e.target.value })}
                  className="w-full px-2 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#33d4ff]/30 focus:border-[#33d4ff] transition-colors"
                >
                  <option value="all">כל הימים</option>
                  <option value="weekday">ימי חול</option>
                  <option value="friday">שישי</option>
                  <option value="saturday">שבת</option>
                  <option value="holiday">חג</option>
                </select>
              </div>
              <div className="py-3 min-w-0 border-b border-gray-50 group-hover:bg-gray-50/30 transition-colors">
                <TimeInput
                  value={item.time_start}
                  onChange={(v) => onUpdate(item.id, { time_start: v })}
                  className="w-full px-2 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-[#33d4ff]/30 focus:border-[#33d4ff]"
                />
              </div>
              <div className="py-3 min-w-0 border-b border-gray-50 group-hover:bg-gray-50/30 transition-colors">
                <TimeInput
                  value={item.time_end}
                  onChange={(v) => onUpdate(item.id, { time_end: v })}
                  className="w-full px-2 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-[#33d4ff]/30 focus:border-[#33d4ff]"
                />
              </div>
              <div className="py-3 flex items-center gap-2 border-b border-gray-50 group-hover:bg-gray-50/30 transition-colors">
                <PercentInput
                  value={item.surcharge_percent}
                  onChange={(v) => onUpdate(item.id, { surcharge_percent: v })}
                />
                <RemoveButton onClick={() => onRemove(item.id)} />
              </div>
            </div>
          ))}
          </div>
        </div>
      )}
    </div>
  )
}
