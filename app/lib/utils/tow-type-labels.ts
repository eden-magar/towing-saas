/**
 * Returns a Hebrew display label for a tow type value.
 *
 * Handles both value spaces used in the app:
 * - DB `tows.tow_type`: simple, with_base, transfer, multi_vehicle, exchange
 * - Create-form UI state: single, custom, exchange (exchange overlaps with DB)
 *
 * Returns an empty string for null, undefined, empty string, or unknown values.
 */
export function getTowTypeLabel(towType: string | null | undefined): string {
  if (!towType) return ''

  const labels: Record<string, string> = {
    simple: 'גרירה פשוטה',
    with_base: 'יציאה מבסיס',
    transfer: 'העברה',
    multi_vehicle: 'מרובת רכבים',
    exchange: 'תקין תקול',
    single: 'גרירה פשוטה',
    custom: 'מסלול מותאם',
  }

  return labels[towType] ?? ''
}
