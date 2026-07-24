import { normalizePlate } from '@/app/lib/utils/plate-number'

/**
 * Miniature Israeli-style license plate for portal list rows.
 * LTR digits inside RTL layouts; height aligned with status chips (~22px).
 *
 * Israeli plates are 7-8 digits. A value whose digit count falls outside a
 * tolerant 5-8 range is almost certainly junk data, so it is rendered as plain
 * text rather than styled as an oversized plate badge.
 */
const MIN_PLATE_DIGITS = 5
const MAX_PLATE_DIGITS = 8

export function PortalPlateBadge({ plate }: { plate: string }) {
  const digitCount = normalizePlate(plate).length
  const looksLikePlate = digitCount >= MIN_PLATE_DIGITS && digitCount <= MAX_PLATE_DIGITS

  if (!looksLikePlate) {
    return (
      <span
        dir="ltr"
        title={plate}
        className="inline-flex shrink-0 items-center max-w-[8.5rem] h-[22px] text-[12px] font-medium tabular-nums text-gray-600 truncate"
      >
        {plate}
      </span>
    )
  }

  return (
    <span
      dir="ltr"
      className="inline-flex shrink-0 items-stretch max-w-[8.5rem] h-[22px] rounded-[3px] overflow-hidden border-2 border-blue-700 bg-yellow-300"
      title={plate}
    >
      <span
        aria-hidden
        className="flex w-3 shrink-0 items-center justify-center bg-blue-700 text-[6px] font-bold leading-none text-white tracking-tight"
      >
        IL
      </span>
      <span className="flex min-w-0 flex-1 items-center justify-center px-1.5 text-[12px] font-extrabold tabular-nums tracking-wide text-black truncate">
        {plate}
      </span>
    </span>
  )
}
