'use client'
import { useState, useEffect } from 'react'
import { SelectorModalShell } from './SelectorModalShell'

interface DefectSelectorProps {
  selectedDefects: string[]
  onChange: (defects: string[]) => void
  label?: string
  /** Chip grid + אחר field only (for embedding in a parent modal). */
  variant?: 'default' | 'chipsOnly' | 'triggerOnly'
  /** Label on the compact trigger button (triggerOnly variant). */
  triggerLabel?: string
  isMobile?: boolean
}

const DEFAULT_DEFECTS = [
  'תקר',
  'תאונה', 
  'אין חשמל',
  'לא נדלק/לא מניע',
  'גלגל עקום או שבור',
  'נזילת מים/שמן',
  'גיר',
  'מוגבל מהירות',
  'אחר'
]

export function DefectSelector({ 
  selectedDefects, 
  onChange, 
  label = 'תקלה',
  variant = 'default',
  triggerLabel = 'תקלות',
  isMobile = false,
}: DefectSelectorProps) {
  
  const [otherText, setOtherText] = useState('')
  const [showModal, setShowModal] = useState(false)
// סנכרון state עם הערכים הקיימים
  useEffect(() => {

      const otherDefect = selectedDefects.find(d => d.startsWith('אחר:'))
    if (otherDefect) {
      setOtherText(otherDefect.replace('אחר: ', ''))
    }
  }, [])


  const toggleDefect = (defect: string) => {
    // הסרה
    if (defect === 'אחר') {
      const hasOther = selectedDefects.some(d => d === 'אחר' || d.startsWith('אחר:'))
      if (hasOther) {
        onChange(selectedDefects.filter(d => d !== 'אחר' && !d.startsWith('אחר:')))
        setOtherText('')
        return
      }
    }
    
    if (selectedDefects.includes(defect)) {
      onChange(selectedDefects.filter(d => d !== defect))
    } else {
      onChange([...selectedDefects, defect])
    }
  }

  const updateOtherText = (text: string) => {
    setOtherText(text)
    const filtered = selectedDefects.filter(d => d !== 'אחר' && !d.startsWith('אחר:'))
    if (text.trim()) {
      onChange([...filtered, `אחר: ${text}`])
    } else {
      onChange([...filtered, 'אחר'])
    }
  }

  const isSelected = (defect: string) => {
    if (defect === 'אחר') return selectedDefects.some(d => d === 'אחר' || d.startsWith('אחר:'))
    return selectedDefects.includes(defect)
  }

  if (variant === 'chipsOnly') {
    return (
      <div>
        <div className="flex flex-wrap gap-2">
          {DEFAULT_DEFECTS.map((defect) => (
            <button
              key={defect}
              type="button"
              onClick={() => toggleDefect(defect)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                isSelected(defect)
                  ? 'bg-[#33d4ff] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {defect}
            </button>
          ))}
        </div>
        {isSelected('אחר') && (
          <div className="mt-3">
            <input
              type="text"
              value={otherText}
              onChange={(e) => updateOtherText(e.target.value)}
              placeholder="פרט את התקלה..."
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
            />
          </div>
        )}
      </div>
    )
  }

  if (variant === 'triggerOnly') {
    return (
      <div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className={`relative flex w-full min-h-[36px] items-center justify-center rounded-lg border text-xs font-medium transition-colors ${
            selectedDefects.length > 0
              ? 'border-gt-brand bg-gt-brand-subtle text-gt-brand-text'
              : 'border-gray-200 text-gt-text-secondary hover:border-gt-border-strong hover:bg-gt-surface-hover'
          }`}
        >
          <span>{triggerLabel}</span>
          {selectedDefects.length > 0 && (
            <span className="absolute top-1 left-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-gt-brand px-1 text-[11px] font-bold text-white">
              {selectedDefects.length}
            </span>
          )}
        </button>
        <SelectorModalShell
          open={showModal}
          onClose={() => setShowModal(false)}
          title={label}
        >
          <div className="flex flex-wrap gap-2 p-4">
            {DEFAULT_DEFECTS.map((defect) => (
              <button
                key={`modal-${defect}`}
                type="button"
                onClick={() => toggleDefect(defect)}
                className={`min-h-[44px] rounded-xl px-4 py-2.5 text-sm transition-colors ${
                  isSelected(defect)
                    ? 'bg-gt-brand text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {defect}
              </button>
            ))}
          </div>
          {isSelected('אחר') && (
            <div className="px-4 pb-4">
              <input
                type="text"
                value={otherText}
                onChange={(e) => updateOtherText(e.target.value)}
                placeholder="פרט את התקלה..."
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gt-brand"
              />
            </div>
          )}
        </SelectorModalShell>
      </div>
    )
  }

  return (
    <div>
      {!isMobile && (
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      )}
      {/* כפתור מובייל */}
      {isMobile ? (
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className={`sm:hidden relative flex items-center justify-center w-full min-h-[48px] rounded-xl border text-sm font-medium transition-colors ${
            selectedDefects.length > 0
              ? 'border-[#33d4ff] bg-[#33d4ff]/5 text-gray-800'
              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <span>תקלות</span>
          {selectedDefects.length > 0 && (
            <span className="absolute top-1.5 left-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#33d4ff] text-white text-[11px] font-bold flex items-center justify-center">
              {selectedDefects.length}
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
            {selectedDefects.length > 0 ? selectedDefects.join(', ') : 'בחר תקלות...'}
          </span>
          <span className="text-gray-400">▼</span>
        </button>
      )}

      {/* מודל מובייל */}
      <SelectorModalShell
        open={showModal}
        onClose={() => setShowModal(false)}
        title={label}
        overlayClassName="sm:hidden"
      >
        <div className="flex flex-wrap gap-2 p-4">
          {DEFAULT_DEFECTS.map((defect) => (
            <button
              key={`modal-${defect}`}
              type="button"
              onClick={() => toggleDefect(defect)}
              className={`min-h-[44px] px-4 py-2.5 rounded-xl text-sm transition-colors ${
                isSelected(defect) ? 'bg-[#33d4ff] text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {defect}
            </button>
          ))}
        </div>
        {isSelected('אחר') && (
          <div className="px-4 pb-4">
            <input
              type="text"
              value={otherText}
              onChange={(e) => updateOtherText(e.target.value)}
              placeholder="פרט את התקלה..."
              className={
                isMobile
                  ? 'w-full px-4 h-12 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]'
                  : 'w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]'
              }
            />
          </div>
        )}
      </SelectorModalShell>

      {/* דסקטופ - כפתורים inline */}
      <div className="hidden sm:flex flex-wrap gap-2">
        {DEFAULT_DEFECTS.map((defect) => (
          <button
            key={defect}
            type="button"
            onClick={() => toggleDefect(defect)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              isSelected(defect)
                ? 'bg-[#33d4ff] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {defect}
          </button>
        ))}
      </div>
      
      {/* שדה טקסט לאחר */}
      {!isMobile && isSelected('אחר') && (
        <div className="mt-3">
          <input
            type="text"
            value={otherText}
            onChange={(e) => updateOtherText(e.target.value)}
            placeholder="פרט את התקלה..."
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
            autoFocus
          />
        </div>
      )}
    </div>
  )
}
