import { hydrateDefectsFromTowReason, serializeDefects } from '@/app/lib/constants/defects'

export type RequestFieldStatus = 'from-request' | 'edited' | null

export type RequestOriginalValues = {
  customerOrderNumber?: string
  department?: string
  orderedBy?: string
  towDate?: string
  towTime?: string
  towEndDate?: string
  towEndTime?: string
  vehiclePlate?: string
  pickupAddress?: string
  dropoffAddress?: string
  pickupContactName?: string
  pickupContactPhone?: string
  dropoffContactName?: string
  dropoffContactPhone?: string
  notes?: string
  manualManufacturer?: string
  manualColor?: string
  vehicleType?: string
  selectedDefects?: string[]
  fromRequestOtherDefectText?: string
}

export type RequestOriginalValuesKey = keyof RequestOriginalValues

export type GetRequestFieldStatus = (
  key: RequestOriginalValuesKey,
  currentValue: string | string[],
) => RequestFieldStatus

export function normalizeDefectsForCompare(defects: string[]): string {
  return serializeDefects(hydrateDefectsFromTowReason(serializeDefects(defects)))
}

export function combineRequestFieldStatuses(
  ...statuses: (RequestFieldStatus | undefined)[]
): RequestFieldStatus {
  const active = statuses.filter((s): s is Exclude<RequestFieldStatus, null> => s != null)
  if (active.length === 0) return null
  if (active.some((s) => s === 'edited')) return 'edited'
  return 'from-request'
}

/** Amber / blue field highlight classes for fromRequest flow. */
export function requestFieldStatusClass(
  status: RequestFieldStatus | null | undefined,
): string {
  if (status === 'from-request') return 'border-amber-300 bg-amber-50/40'
  if (status === 'edited') return 'border-blue-300 bg-blue-50/40'
  return ''
}

export function withRequestFieldClass(
  base: string,
  status: RequestFieldStatus | null | undefined,
): string {
  const highlight = requestFieldStatusClass(status)
  return highlight ? `${base} ${highlight}`.trim() : base
}

function nestedInputHighlightClasses(
  status: RequestFieldStatus | null | undefined,
): string {
  if (status === 'from-request') {
    return '[&_input]:border-amber-300 [&_input]:bg-amber-50/40'
  }
  if (status === 'edited') {
    return '[&_input]:border-blue-300 [&_input]:bg-blue-50/40'
  }
  return ''
}

/**
 * Highlight classes for a wrapper around Input, PhoneInput, TimeInput, or autocomplete
 * components — targets nested inputs so highlight wins over shared Input base styles.
 */
export function inputWrapperStatusClass(
  base: string,
  status: RequestFieldStatus | null | undefined,
): string {
  const highlight = nestedInputHighlightClasses(status)
  return highlight ? `${base} ${highlight}`.trim() : base
}

/** AddressInput applies className to a wrapper; target the inner input. */
export function addressInputStatusClass(
  base: string,
  status: RequestFieldStatus | null | undefined,
): string {
  return inputWrapperStatusClass(base, status)
}

/** DateInput applies className to a wrapper when showToday is false; target the inner input. */
export function dateInputStatusClass(
  base: string,
  status: RequestFieldStatus | null | undefined,
): string {
  return inputWrapperStatusClass(base, status)
}

export function FromRequestFieldLegend() {
  return (
    <div
      className="mb-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-lg border border-gray-200 bg-gray-50/80 px-3 py-2 text-xs text-gray-600"
      dir="rtl"
    >
      <span className="inline-flex items-center gap-1.5">
        <span
          className="w-2.5 h-2.5 rounded-sm border border-amber-300 bg-amber-50/80 shrink-0"
          aria-hidden
        />
        כתום — מולא על ידי הלקוח
      </span>
      <span className="text-gray-300 hidden sm:inline" aria-hidden>
        |
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          className="w-2.5 h-2.5 rounded-sm border border-blue-300 bg-blue-50/80 shrink-0"
          aria-hidden
        />
        כחול — נערך על ידיך
      </span>
    </div>
  )
}
