'use client'
import { useState, useEffect } from 'react'

interface DefectSelectorProps {
  selectedDefects: string[]
  onChange: (defects: string[]) => void
  label?: string
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
  label = 'תקלה' 
}: DefectSelectorProps) {
  
  const [otherText, setOtherText] = useState('')
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
      {isSelected('אחר') && (
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
