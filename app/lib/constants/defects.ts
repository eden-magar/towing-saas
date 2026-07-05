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
  { value: 'תאונה', label: 'תאונה', icon: '🚨' },
  { value: 'תקר', label: 'תקר', icon: '🚗' },
  { value: 'אחר', label: 'אחר', icon: '✏️' },
] as const

/** Portal / DefectSelector chip labels (mirrors DefectSelector DEFAULT_DEFECTS). */
export const PORTAL_DEFECT_LABELS: readonly string[] = [
  'תקר',
  'תאונה',
  'אין חשמל',
  'לא נדלק/לא מניע',
  'גלגל עקום או שבור',
  'נזילת מים/שמן',
  'גיר',
  'מוגבל מהירות',
  'אחר',
]

const CANONICAL_DEFECT_VALUES = new Set<string>(DEFECT_OPTIONS.map((o) => o.value))

/** Portal spelling → dashboard DEFECT_OPTIONS spelling (constants typo kept intentionally). */
const DEFECT_LABEL_ALIASES: Record<string, string> = {
  'נזילת מים/שמן': 'נילת מים/שמן',
}

function resolvePredefinedDefectLabel(token: string): string | null {
  if (CANONICAL_DEFECT_VALUES.has(token) && token !== 'אחר') {
    return token
  }
  const aliased = DEFECT_LABEL_ALIASES[token]
  if (aliased && CANONICAL_DEFECT_VALUES.has(aliased)) {
    return aliased
  }
  return null
}

export type ParsedTowReasonDefects = {
  /** Predefined defect labels (canonical DEFECT_OPTIONS values). */
  defects: string[]
  /** Free-text custom defect(s), without the "אחר:" prefix. */
  otherText: string
}

/**
 * Parse tow_reason / towReason into dashboard-compatible selectedDefects pieces.
 * Matches post-modal create/page convention: predefined labels + raw custom text token(s).
 */
export function parseTowReasonToDefects(towReason: string): ParsedTowReasonDefects {
  if (!towReason.trim()) {
    return { defects: [], otherText: '' }
  }

  const predefined: string[] = []
  const otherParts: string[] = []

  for (const raw of towReason.split(',').map((s) => s.trim()).filter(Boolean)) {
    if (raw.startsWith('אחר:')) {
      const text = raw.replace(/^אחר:\s*/, '').trim()
      if (text) otherParts.push(text)
      continue
    }

    const canonical = resolvePredefinedDefectLabel(raw)
    if (canonical) {
      if (!predefined.includes(canonical)) {
        predefined.push(canonical)
      }
    } else {
      otherParts.push(raw)
    }
  }

  return {
    defects: predefined,
    otherText: otherParts.join(', '),
  }
}
