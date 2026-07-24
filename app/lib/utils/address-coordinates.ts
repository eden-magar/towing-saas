/**
 * Address coordinate presence — shared by portal submit + staff tow save.
 * A non-empty address string without lat/lng must not be persisted (pricing
 * falls back to ambiguous Distance Matrix string match).
 */

export type AddressLike = {
  address?: string | null
  lat?: number | null
  lng?: number | null
}

export type MissingCoordsHit = {
  /** Hebrew label for the blocked field (shown in the modal). */
  label: string
  /** PinDropModal field id for the escape-hatch CTA. */
  pinField: string
}

export function hasAddressCoordinates(
  a: AddressLike | null | undefined,
): boolean {
  if (!a) return false
  const lat = a.lat
  const lng = a.lng
  return (
    lat != null &&
    lng != null &&
    Number.isFinite(Number(lat)) &&
    Number.isFinite(Number(lng))
  )
}

/** Non-empty address text without usable coords — the bug case. */
export function isCoordinateLessAddress(
  a: AddressLike | null | undefined,
): boolean {
  return !!a?.address?.trim() && !hasAddressCoordinates(a)
}

export function checkAddressCoordinates(
  a: AddressLike | null | undefined,
  label: string,
  pinField: string,
): MissingCoordsHit | null {
  if (!isCoordinateLessAddress(a)) return null
  return { label, pinField }
}

type RouteStopLike = {
  id: string
  role: string
  address?: AddressLike | null
}

type RoutePointLike = {
  id: string
  address?: string | null
  addressData?: AddressLike | null
}

type ExchangeStopLike = {
  id: string
  address?: AddressLike | null
}

/**
 * First staff tow point that would be written without coordinates.
 * pinField values match create/page + ColumnLayout PinDropModal handlers.
 */
export function findStaffTowMissingCoordinates(input: {
  towType: 'single' | 'custom' | 'exchange' | '' | string
  routeStops?: RouteStopLike[]
  routePoints?: RoutePointLike[]
  workingVehicleAddress?: AddressLike | null
  workingVehicleDestinationAddress?: AddressLike | null
  exchangeAddress?: AddressLike | null
  exchangePointSplit?: boolean
  defectiveDestinationAddress?: AddressLike | null
  stopsBeforeExchange?: ExchangeStopLike[]
  stopsAfterExchange?: ExchangeStopLike[]
  hasStorageFollowUp?: boolean
  followUpAddress?: AddressLike | null
}): MissingCoordsHit | null {
  const { towType } = input

  if (towType === 'single') {
    const roleLabel = (role: string) => {
      if (role === 'pickup') return 'מוצא'
      if (role === 'dropoff') return 'יעד'
      return 'עצירה'
    }
    for (const stop of input.routeStops ?? []) {
      const hit = checkAddressCoordinates(
        stop.address,
        roleLabel(stop.role),
        `routestop:${stop.id}`,
      )
      if (hit) return hit
    }
  }

  if (towType === 'custom') {
    for (const point of input.routePoints ?? []) {
      const addr = {
        address: point.address,
        lat: point.addressData?.lat,
        lng: point.addressData?.lng,
      }
      const hit = checkAddressCoordinates(addr, 'נקודת מסלול', point.id)
      if (hit) return hit
    }
  }

  if (towType === 'exchange') {
    const workingDest = input.exchangePointSplit
      ? input.workingVehicleDestinationAddress
      : input.exchangeAddress
    const checks: Array<[AddressLike | null | undefined, string, string]> = [
      [input.workingVehicleAddress, 'מוצא התקין', 'workingVehicle'],
      [
        workingDest,
        input.exchangePointSplit ? 'יעד התקין' : 'נקודת החלפה',
        input.exchangePointSplit ? 'workingDestination' : 'exchange',
      ],
    ]
    if (input.exchangePointSplit) {
      checks.push([input.exchangeAddress, 'נקודת החלפה', 'exchange'])
    }
    checks.push([
      input.defectiveDestinationAddress,
      'יעד התקול',
      'defectiveDestination',
    ])
    for (const [addr, label, pin] of checks) {
      const hit = checkAddressCoordinates(addr, label, pin)
      if (hit) return hit
    }
    for (const stop of input.stopsBeforeExchange ?? []) {
      const hit = checkAddressCoordinates(
        stop.address,
        'עצירה לפני החלפה',
        `stop-before-${stop.id}`,
      )
      if (hit) return hit
    }
    for (const stop of input.stopsAfterExchange ?? []) {
      const hit = checkAddressCoordinates(
        stop.address,
        'עצירה אחרי החלפה',
        `stop-after-${stop.id}`,
      )
      if (hit) return hit
    }
  }

  if (input.hasStorageFollowUp) {
    const hit = checkAddressCoordinates(
      input.followUpAddress,
      'יעד המשך מאחסנה',
      'followUp',
    )
    if (hit) return hit
  }

  return null
}
