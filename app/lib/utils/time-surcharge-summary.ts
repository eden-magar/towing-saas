import type { TimeSurcharge } from '../queries/price-lists'

/** Visible label for a time surcharge chip/summary — trimmed label, then name, then time range. */
export function getTimeSurchargeLabel(s: TimeSurcharge): string {
  return (
    s.label?.trim() ||
    s.name?.trim() ||
    (s.time_start && s.time_end ? `${s.time_start}-${s.time_end}` : 'תוספת זמן')
  )
}

export interface ActiveTimeSurchargeSummary {
  label: string
  percent: number
}

/**
 * Compute the single effective time surcharge for a collapsed summary — only the
 * highest-percent active surcharge applies (matching the pricing rule "מופעלת תוספת
 * אחת בלבד — הגבוהה מביניהן"). Considers both the manually-activated non-holiday
 * surcharges and the holiday flag. Returns null when nothing is active.
 *
 * Shared by the desktop create form (TimeSurchargesSection) and the mobile wizard
 * (SectionPricing) so both derive the summary identically.
 */
export function getActiveTimeSurchargeSummary(
  timeSurchargesData: TimeSurcharge[],
  activeTimeSurchargesList: TimeSurcharge[],
  isHoliday: boolean,
): ActiveTimeSurchargeSummary | null {
  const holidaySurcharge = timeSurchargesData.find(
    (s) => s.day_type === 'holiday' && s.is_active
  )
  const isActive = (s: TimeSurcharge) =>
    activeTimeSurchargesList.some((a) => a.id === s.id)
  const nonHolidaySurcharges = timeSurchargesData.filter(
    (s) => s.is_active && s.day_type !== 'holiday'
  )

  const activeItems: ActiveTimeSurchargeSummary[] = [
    ...nonHolidaySurcharges
      .filter((s) => isActive(s))
      .map((s) => ({ label: getTimeSurchargeLabel(s), percent: s.surcharge_percent })),
    ...(isHoliday && holidaySurcharge
      ? [{ label: 'חג', percent: holidaySurcharge.surcharge_percent }]
      : []),
  ]

  return activeItems.reduce<ActiveTimeSurchargeSummary | null>(
    (max, cur) => (!max || cur.percent > max.percent ? cur : max),
    null
  )
}
