/**
 * Follow-up tows inherit the parent's pricing *mode*, not the parent's total.
 * Price stays empty at creation; live calc runs when the child is opened.
 */
export type FollowUpAutoPriceMode = 'recommended' | 'recommended_customer'

export function inheritFollowUpPriceMode(
  parentMode: string | null | undefined,
  hasCustomerId: boolean,
): FollowUpAutoPriceMode {
  const mode = String(parentMode ?? '')

  if (mode === 'recommended') {
    return 'recommended'
  }

  if (mode === 'recommended_customer') {
    return hasCustomerId ? 'recommended_customer' : 'recommended'
  }

  // custom / fixed / customer / unknown — do not copy a manual total (different route)
  return hasCustomerId ? 'recommended_customer' : 'recommended'
}
