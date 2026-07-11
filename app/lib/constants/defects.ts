import type { LucideIcon } from 'lucide-react'
import {
  AlertTriangle,
  BatteryWarning,
  CircleDot,
  Cog,
  Gauge,
  LifeBuoy,
  MoreHorizontal,
  OctagonAlert,
  PowerOff,
  Thermometer,
  Truck,
} from 'lucide-react'

export type DefectOption = {
  readonly value: string
  readonly label: string
  readonly icon: LucideIcon
  readonly highlight?: boolean
}

export const DEFECT_OPTIONS: readonly DefectOption[] = [
  {
    value: 'חום מנוע/נזילת שמן/מים',
    label: 'חום מנוע/נזילת שמן/מים',
    icon: Thermometer,
  },
  { value: 'תאונה', label: 'תאונה', icon: AlertTriangle },
  {
    value: 'לא נדלק/לא מניע',
    label: 'לא נדלק/לא מניע',
    icon: PowerOff,
  },
  {
    value: 'אין חשמל/אין טעינה',
    label: 'אין חשמל/אין טעינה',
    icon: BatteryWarning,
  },
  { value: "תקר/פאנצ'ר", label: "תקר/פאנצ'ר", icon: CircleDot },
  { value: 'מוגבל מהירות', label: 'מוגבל מהירות', icon: Gauge },
  { value: 'חילוץ', label: 'חילוץ', icon: LifeBuoy },
  {
    value: 'מערכות הנעה/גיר/גלגל שבור',
    label: 'מערכות הנעה/גיר/גלגל שבור',
    icon: Cog,
  },
  { value: 'הובלה', label: 'הובלה', icon: Truck },
  {
    value: 'בלמים/ברקסים לא עוצר',
    label: 'בלמים/ברקסים לא עוצר',
    icon: OctagonAlert,
    highlight: true,
  },
  { value: 'אחר', label: 'אחר', icon: MoreHorizontal },
]

const CANONICAL_DEFECT_VALUES = new Set<string>(DEFECT_OPTIONS.map((o) => o.value))

/**
 * Old tow_reason tokens → new canonical values (best-effort).
 * Unmapped legacy labels fall through to free-text in parseTowReasonToDefects.
 */
const DEFECT_LABEL_ALIASES: Record<string, string> = {
  // Legacy portal / dashboard spellings
  'אין חשמל': 'אין חשמל/אין טעינה',
  תקר: "תקר/פאנצ'ר",
  גיר: 'מערכות הנעה/גיר/גלגל שבור',
  'גלגל עקום או שבור': 'מערכות הנעה/גיר/גלגל שבור',
  'נילת מים/שמן': 'חום מנוע/נזילת שמן/מים',
  'נזילת מים/שמן': 'חום מנוע/נזילת שמן/מים',
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
 * Unknown / legacy tokens that cannot be aliased become otherText (safe display).
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

/** Shared selected/unselected classes; highlight (brakes) always uses red. */
export function defectOptionClassName(
  selected: boolean,
  highlight: boolean | undefined,
  kind: 'chip' | 'grid'
): string {
  if (highlight) {
    if (kind === 'chip') {
      return selected
        ? 'bg-red-600 text-white'
        : 'bg-red-50 text-red-700 ring-1 ring-red-300 hover:bg-red-100'
    }
    return selected
      ? 'border-red-600 bg-red-100 text-red-800'
      : 'border-red-300 bg-red-50 text-red-700 hover:border-red-400'
  }

  if (kind === 'chip') {
    return selected
      ? 'bg-[#33d4ff] text-white'
      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
  }

  return selected
    ? 'border-blue-500 bg-blue-50 text-blue-700'
    : 'border-gray-100 bg-gray-50 text-gray-700 hover:border-gray-300'
}
