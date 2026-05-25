export type DefectOption = {
  readonly value: string
  readonly label: string
  readonly icon: string
}

export const DEFECT_OPTIONS: readonly DefectOption[] = [
  { value: 'אין חשמל', label: 'אין חשמל', icon: '🔋' },
  { value: 'גיר', label: 'גיר', icon: '⚙️' },
  { value: 'גלגל עקום או שבור', label: 'גלגל עקום או שבור', icon: '⚙️' },
  { value: 'לא נדלק/לא מניע', label: 'לא נדלק/לא מניע', icon: '🔧' },
  { value: 'מוגבל מהירות', label: 'מוגבל מהירות', icon: '🚗' },
  { value: 'מניע/נדלק ונוסע', label: 'מניע/נדלק ונוסע', icon: '✓' },
  { value: 'נילת מים/שמן', label: 'נילת מים/שמן', icon: '💧' },
  { value: "פנצ'ר", label: "פנצ'ר", icon: '⚫' },
  { value: 'תאונה', label: 'תאונה', icon: '🚨' },
  { value: 'תקר', label: 'תקר', icon: '🚗' },
  { value: 'אחר', label: 'אחר', icon: '✏️' },
] as const
