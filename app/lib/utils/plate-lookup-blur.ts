import { normalizePlate } from './plate-number'

export type PlateLookupBlurOptions = {
  /**
   * Digits plate from the last successful registry hit.
   * When set, blur skips if it matches the current plate (no redundant re-lookup).
   */
  lastSuccessfulPlate?: string | null
  /**
   * Legacy: skip when true if `lastSuccessfulPlate` was not provided.
   * Prefer `lastSuccessfulPlate` so a plate change after a prior hit still looks up.
   */
  hasFoundData?: boolean
  /** Skip when a previous lookup for this entry already failed (manual re-check still allowed). */
  lookupAlreadyFailed?: boolean
  /** Skip when a lookup for this field is already running. */
  isLookupInFlight?: boolean
}

/** Whether onBlur should trigger a registry lookup for this plate. */
export function shouldTriggerPlateLookupOnBlur(
  plate: string,
  options: PlateLookupBlurOptions = {},
): boolean {
  const clean = normalizePlate(plate)
  if (clean.length < 5) return false
  if (options.isLookupInFlight) return false

  if (options.lastSuccessfulPlate != null && options.lastSuccessfulPlate !== '') {
    if (normalizePlate(options.lastSuccessfulPlate) === clean) return false
  } else if (options.hasFoundData) {
    return false
  }

  if (options.lookupAlreadyFailed) return false
  return true
}
