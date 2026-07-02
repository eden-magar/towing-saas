import { normalizePlate } from './plate-number'

/** Whether onBlur should trigger a registry lookup for this plate. */
export function shouldTriggerPlateLookupOnBlur(
  plate: string,
  options: {
    hasFoundData?: boolean
    lookupAlreadyFailed?: boolean
  },
): boolean {
  const clean = normalizePlate(plate)
  if (clean.length < 5) return false
  if (options.hasFoundData) return false
  if (options.lookupAlreadyFailed) return false
  return true
}
