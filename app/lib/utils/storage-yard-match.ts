/** Match an entered address against the company storage/yard (price_lists base). */

export type YardAddressRef = {
  address?: string | null
  placeId?: string | null
  lat?: number | null
  lng?: number | null
}

/** ~80m in degrees at mid-latitudes — secondary signal only. */
const COORD_MATCH_DEG = 0.0007

export function normalizeAddressText(address: string | null | undefined): string {
  return (address ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const R = 6371000
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

/**
 * True when `entered` looks like the company yard.
 * Prefer placeId; else normalized text; else coords within ~80m.
 */
export function matchesStorageYard(
  entered: YardAddressRef | null | undefined,
  yard: YardAddressRef | null | undefined,
): boolean {
  if (!entered || !yard) return false
  const enteredText = normalizeAddressText(entered.address)
  const yardText = normalizeAddressText(yard.address)
  if (!enteredText || !yardText) {
    // Coord-only match still possible
  } else if (
    entered.placeId &&
    yard.placeId &&
    entered.placeId === yard.placeId
  ) {
    return true
  } else if (enteredText === yardText) {
    return true
  }

  const elat = entered.lat
  const elng = entered.lng
  const ylat = yard.lat
  const ylng = yard.lng
  if (
    elat != null &&
    elng != null &&
    ylat != null &&
    ylng != null &&
    Number.isFinite(elat) &&
    Number.isFinite(elng) &&
    Number.isFinite(ylat) &&
    Number.isFinite(ylng)
  ) {
    // Fast reject then precise distance
    if (
      Math.abs(elat - ylat) <= COORD_MATCH_DEG &&
      Math.abs(elng - ylng) <= COORD_MATCH_DEG
    ) {
      return haversineMeters(elat, elng, ylat, ylng) <= 80
    }
  }

  return enteredText.length > 0 && yardText.length > 0 && enteredText === yardText
}

export function storageYardDismissKey(fieldKey: string, address: string): string {
  return `${fieldKey}::${normalizeAddressText(address)}`
}

/** Build yard ref from company price-list base fields. */
export function yardFromBasePriceList(
  base:
    | {
        base_address?: string | null
        base_lat?: number | null
        base_lng?: number | null
      }
    | null
    | undefined,
): YardAddressRef | null {
  if (!base?.base_address?.trim()) return null
  return {
    address: base.base_address,
    lat: base.base_lat,
    lng: base.base_lng,
  }
}
