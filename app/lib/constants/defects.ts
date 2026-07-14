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

export const OTHER_DEFECT_VALUE = 'אחר'
export const OTHER_DEFECT_PREFIX = 'אחר:'

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
  { value: OTHER_DEFECT_VALUE, label: 'אחר', icon: MoreHorizontal },
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

function splitDefectTokens(raw: string): string[] {
  return raw
    .split(/\s*,\s*/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/** Resolve a single token to a predefined DEFECT_OPTIONS value (excludes אחר). */
function resolvePredefinedDefectLabel(token: string): string | null {
  if (CANONICAL_DEFECT_VALUES.has(token) && token !== OTHER_DEFECT_VALUE) {
    return token
  }
  const aliased = DEFECT_LABEL_ALIASES[token]
  if (aliased && CANONICAL_DEFECT_VALUES.has(aliased)) {
    return aliased
  }
  return null
}

export function isOtherSelected(defects: readonly string[]): boolean {
  return defects.some(
    (d) => d === OTHER_DEFECT_VALUE || d.startsWith(OTHER_DEFECT_PREFIX)
  )
}

/** Free text from an `אחר: …` token in the chip array (empty for bare אחר). */
export function extractOtherText(defects: readonly string[]): string {
  for (const d of defects) {
    if (d.startsWith(OTHER_DEFECT_PREFIX)) {
      const rest = d.slice(OTHER_DEFECT_PREFIX.length)
      // Keep typing spaces — only strip the separator space after `אחר:`.
      return rest.startsWith(' ') ? rest.slice(1) : rest
    }
  }
  return ''
}

/** Toggle אחר on/off. When turning on, uses bare `אחר` (no free text yet). */
export function toggleOther(defects: readonly string[]): string[] {
  const withoutOther = defects.filter(
    (d) => d !== OTHER_DEFECT_VALUE && !d.startsWith(OTHER_DEFECT_PREFIX)
  )
  if (isOtherSelected(defects)) {
    return withoutOther
  }
  return [...withoutOther, OTHER_DEFECT_VALUE]
}

/**
 * Keep אחר selected and set/clear free text.
 * Empty text → bare `אחר`; non-empty → `אחר: <text>` (spaces preserved for live input).
 * Callers that persist to DB should trim via {@link serializeDefects}.
 */
export function applyOtherText(defects: readonly string[], text: string): string[] {
  const withoutOther = defects.filter(
    (d) => d !== OTHER_DEFECT_VALUE && !d.startsWith(OTHER_DEFECT_PREFIX)
  )
  return [
    ...withoutOther,
    text.length > 0 ? `${OTHER_DEFECT_PREFIX} ${text}` : OTHER_DEFECT_VALUE,
  ]
}

export type ParsedTowReasonDefects = {
  /**
   * Chip values: predefined DEFECT_OPTIONS values, plus `אחר` when other/custom
   * is present (never stores unlabeled custom tokens here).
   */
  defects: string[]
  /** Free-text custom defect(s), without the "אחר:" prefix. */
  otherText: string
}

/**
 * Parse tow_reason / stored defects into chip state + free text.
 * - Predefined + aliases → chip values
 * - bare `אחר` / `אחר: x` / unknown legacy tokens → chip `אחר` + otherText
 */
export function parseTowReasonToDefects(towReason: string): ParsedTowReasonDefects {
  if (!towReason.trim()) {
    return { defects: [], otherText: '' }
  }

  const predefined: string[] = []
  const otherParts: string[] = []
  let sawOtherToken = false

  for (const raw of splitDefectTokens(towReason)) {
    if (raw === OTHER_DEFECT_VALUE) {
      sawOtherToken = true
      continue
    }
    if (raw.startsWith(OTHER_DEFECT_PREFIX)) {
      sawOtherToken = true
      const text = raw.slice(OTHER_DEFECT_PREFIX.length).trim()
      if (text) otherParts.push(text)
      continue
    }

    const canonical = resolvePredefinedDefectLabel(raw)
    if (canonical) {
      if (!predefined.includes(canonical)) {
        predefined.push(canonical)
      }
    } else {
      // Backward compatible: unlabeled custom text → אחר + otherText
      sawOtherToken = true
      otherParts.push(raw)
    }
  }

  const otherText = otherParts.join(', ')
  if (sawOtherToken || otherText) {
    predefined.push(OTHER_DEFECT_VALUE)
  }

  return { defects: predefined, otherText }
}

/**
 * UI chip array: predefined + `אחר` or `אחר: text` (never unlabeled custom).
 */
export function toUiDefects(parsed: ParsedTowReasonDefects): string[] {
  const predefined = parsed.defects.filter((d) => d !== OTHER_DEFECT_VALUE)
  if (!parsed.defects.includes(OTHER_DEFECT_VALUE) && !parsed.otherText.trim()) {
    return predefined
  }
  const trimmed = parsed.otherText.trim()
  return [
    ...predefined,
    trimmed ? `${OTHER_DEFECT_PREFIX} ${trimmed}` : OTHER_DEFECT_VALUE,
  ]
}

/** Parse a tow_reason (or joined defects) straight into UI chip array. */
export function hydrateDefectsFromTowReason(towReason: string | null | undefined): string[] {
  return toUiDefects(parseTowReasonToDefects(towReason ?? ''))
}

/**
 * Serialize chip state for DB (`tow_reason` / `defects[]` join).
 * Optional `otherText` overrides free text extracted from the array.
 * Always emits `אחר` or `אחר: <text>` — never a raw unlabeled custom token.
 */
export function serializeDefects(
  defects: readonly string[],
  otherText?: string
): string {
  const predefined = defects.filter(
    (d) => d !== OTHER_DEFECT_VALUE && !d.startsWith(OTHER_DEFECT_PREFIX)
  )
  const text =
    otherText !== undefined ? otherText.trim() : extractOtherText(defects).trim()
  const parts = [...predefined]
  if (isOtherSelected(defects)) {
    parts.push(text ? `${OTHER_DEFECT_PREFIX} ${text}` : OTHER_DEFECT_VALUE)
  }
  return parts.join(', ')
}

/** Token for reports aggregation (aliases + אחר:… → אחר; unknown → אחר). */
export function normalizeDefectTokenForReport(token: string): string {
  const trimmed = token.trim()
  if (!trimmed) return OTHER_DEFECT_VALUE
  if (trimmed === OTHER_DEFECT_VALUE || trimmed.startsWith(OTHER_DEFECT_PREFIX)) {
    return OTHER_DEFECT_VALUE
  }
  return resolvePredefinedDefectLabel(trimmed) ?? OTHER_DEFECT_VALUE
}

/** Split a stored tow_reason into report buckets (one count per distinct token). */
export function defectTokensForReport(towReason: string | null | undefined): string[] {
  if (!towReason?.trim()) return [OTHER_DEFECT_VALUE]
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of splitDefectTokens(towReason)) {
    const key = normalizeDefectTokenForReport(raw)
    if (!seen.has(key)) {
      seen.add(key)
      out.push(key)
    }
  }
  return out.length > 0 ? out : [OTHER_DEFECT_VALUE]
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
    ? 'border-red-500 bg-red-50 text-red-800 ring-1 ring-red-400'
    : 'border-gray-200 bg-white text-gray-700 hover:border-[#33d4ff]/60'
}
