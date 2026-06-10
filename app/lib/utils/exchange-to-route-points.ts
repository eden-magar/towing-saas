import type { RoutePoint } from '../../components/tow-forms/routes/RouteBuilder'
import type { VehicleOnTruck } from '../../components/tow-forms/routes/VehicleCard'
import type { AddressData } from '../../components/tow-forms/routes/AddressInput'
import type { VehicleLookupResult, VehicleType } from '../types'

/** Exchange form snapshot for one-way conversion to custom route (create flow only). */
export interface ExchangeFormState {
  workingVehicleSource: 'storage' | 'address'
  selectedWorkingVehicleId: string | null
  workingVehiclePlate: string
  workingVehicleCode: string
  workingVehicleData: VehicleLookupResult | null
  workingVehicleType: VehicleType | ''
  workingVehicleAddress: AddressData
  workingVehicleContact: string
  workingVehicleContactPhone: string
  workingManualManufacturer: string
  workingManualColor: string
  workingManualWeight: string
  workingVehicleNotFound: boolean
  workingVehicleDestinationAddress: AddressData
  workingDestinationContact: string
  workingDestinationContactPhone: string
  workingVehicleDestinationIsStorage: boolean
  exchangeAddress: AddressData
  exchangeContactName: string
  exchangeContactPhone: string
  defectiveVehiclePlate: string
  defectiveVehicleCode: string
  defectiveVehicleData: VehicleLookupResult | null
  defectiveVehicleType: VehicleType | ''
  defectiveManualManufacturer: string
  defectiveManualColor: string
  defectiveManualWeight: string
  defectiveVehicleNotFound: boolean
  defectiveDestination: 'storage' | 'address'
  defectiveDestinationAddress: AddressData
  defectiveDestinationContact: string
  defectiveDestinationContactPhone: string
  selectedDefects: string[]
  defectiveFaultDescription: string
}

export type ExchangeToRoutePointsResult = {
  routePoints: RoutePoint[]
  /** Summary for customRouteData; RouteBuilder recomputes distance on mount. */
  vehicles: { type: string; isWorking: boolean }[]
}

function newPointId(): string {
  return `point_${crypto.randomUUID()}`
}

function newVehicleId(): string {
  return `vehicle_${crypto.randomUUID()}`
}

function hasAddress(addr?: AddressData): boolean {
  return !!addr?.address?.trim()
}

function addressFields(
  addr: AddressData,
  contactName: string,
  contactPhone: string,
): Pick<RoutePoint, 'address' | 'addressData' | 'contactName' | 'contactPhone'> {
  return {
    address: addr.address,
    addressData: {
      lat: addr.lat,
      lng: addr.lng,
      placeId: addr.placeId,
    },
    contactName: contactName || '',
    contactPhone: contactPhone || '',
  }
}

function createRoutePoint(
  fields: Pick<RoutePoint, 'address' | 'contactName' | 'contactPhone'> &
    Partial<
      Pick<
        RoutePoint,
        | 'addressData'
        | 'type'
        | 'isStopOnly'
        | 'notes'
        | 'vehiclesToPickup'
        | 'vehiclesToDropoff'
        | 'dropToStorage'
        | 'services'
      >
    >,
): RoutePoint {
  return {
    id: newPointId(),
    type: fields.type ?? 'stop',
    isStopOnly: fields.isStopOnly ?? false,
    notes: fields.notes ?? '',
    vehiclesToPickup: fields.vehiclesToPickup ?? [],
    vehiclesToDropoff: fields.vehiclesToDropoff ?? [],
    services: fields.services ?? [],
    ...fields,
  }
}

function registryVehicleData(data: VehicleLookupResult | null): VehicleOnTruck['vehicleData'] {
  if (!data?.data) return undefined
  const d = data.data
  return {
    manufacturer: d.manufacturer ?? undefined,
    model: d.model ?? undefined,
    year: d.year != null ? String(d.year) : undefined,
    color: d.color ?? undefined,
    driveType: d.driveType ?? undefined,
    fuelType: d.fuelType ?? undefined,
    totalWeight: d.totalWeight != null ? String(d.totalWeight) : undefined,
    gearType: d.gearType ?? undefined,
  }
}

function buildWorkingVehicle(state: ExchangeFormState): VehicleOnTruck | null {
  const plate = state.workingVehiclePlate.trim()
  if (!plate && !state.workingVehicleData) return null

  return {
    id: newVehicleId(),
    plateNumber: plate,
    isWorking: true,
    vehicleCode: state.workingVehicleCode || '',
    vehicleType: state.workingVehicleType || state.workingVehicleData?.source || 'private',
    registrySource: state.workingVehicleData?.source ?? null,
    vehicleData: registryVehicleData(state.workingVehicleData),
    vehicleNotFound: state.workingVehicleNotFound,
    manualManufacturer: state.workingManualManufacturer || undefined,
    manualColor: state.workingManualColor || undefined,
    manualWeight: state.workingManualWeight || undefined,
    fromStorage: state.workingVehicleSource === 'storage',
    storedVehicleId: state.selectedWorkingVehicleId ?? undefined,
    defects: [],
    isFound: !!state.workingVehicleData,
  }
}

function buildDefectiveVehicle(state: ExchangeFormState): VehicleOnTruck | null {
  const plate = state.defectiveVehiclePlate.trim()
  if (!plate && !state.defectiveVehicleData) return null

  const defects = state.selectedDefects.length
    ? [...state.selectedDefects]
    : state.defectiveFaultDescription.trim()
      ? [state.defectiveFaultDescription.trim()]
      : []

  return {
    id: newVehicleId(),
    plateNumber: plate,
    isWorking: false,
    vehicleCode: state.defectiveVehicleCode || '',
    vehicleType: state.defectiveVehicleType || state.defectiveVehicleData?.source || 'private',
    registrySource: state.defectiveVehicleData?.source ?? null,
    vehicleData: registryVehicleData(state.defectiveVehicleData),
    vehicleNotFound: state.defectiveVehicleNotFound,
    manualManufacturer: state.defectiveManualManufacturer || undefined,
    manualColor: state.defectiveManualColor || undefined,
    manualWeight: state.defectiveManualWeight || undefined,
    defects,
    isFound: !!state.defectiveVehicleData,
    fromStorage: false,
  }
}

function summarizeVehicles(
  working: VehicleOnTruck | null,
  defective: VehicleOnTruck | null,
): { type: string; isWorking: boolean }[] {
  const out: { type: string; isWorking: boolean }[] = []
  if (working) {
    out.push({ type: working.vehicleType ?? 'private', isWorking: true })
  }
  if (defective) {
    out.push({ type: defective.vehicleType ?? 'private', isWorking: false })
  }
  return out
}

/**
 * Convert exchange form state into custom-route RoutePoints (create-time type switch).
 * Does NOT map stopsBeforeExchange/stopsAfterExchange (user adds stops in RouteBuilder).
 * Does NOT map per-side service surcharges (v1).
 */
export function buildRoutePointsFromExchangeState(
  state: ExchangeFormState,
): ExchangeToRoutePointsResult {
  const workingVehicle = buildWorkingVehicle(state)
  const defectiveVehicle = buildDefectiveVehicle(state)
  const vehicles = summarizeVehicles(workingVehicle, defectiveVehicle)

  const isFourPointFlow = !!(
    hasAddress(state.workingVehicleDestinationAddress) &&
    state.workingVehicleDestinationAddress.address !== state.exchangeAddress?.address
  )

  const routePoints: RoutePoint[] = []

  if (isFourPointFlow) {
    if (hasAddress(state.workingVehicleAddress)) {
      routePoints.push(
        createRoutePoint({
          ...addressFields(
            state.workingVehicleAddress,
            state.workingVehicleContact,
            state.workingVehicleContactPhone,
          ),
          type: state.workingVehicleSource === 'storage' ? 'storage' : 'stop',
          vehiclesToPickup: workingVehicle ? [workingVehicle] : [],
        }),
      )
    }

    if (hasAddress(state.workingVehicleDestinationAddress)) {
      routePoints.push(
        createRoutePoint({
          ...addressFields(
            state.workingVehicleDestinationAddress,
            state.workingDestinationContact,
            state.workingDestinationContactPhone,
          ),
          vehiclesToDropoff: workingVehicle ? [workingVehicle.id] : [],
          dropToStorage: state.workingVehicleDestinationIsStorage,
        }),
      )
    }

    if (hasAddress(state.exchangeAddress)) {
      routePoints.push(
        createRoutePoint({
          ...addressFields(
            state.exchangeAddress,
            state.exchangeContactName,
            state.exchangeContactPhone,
          ),
          vehiclesToPickup: defectiveVehicle ? [defectiveVehicle] : [],
        }),
      )
    }

    if (hasAddress(state.defectiveDestinationAddress)) {
      routePoints.push(
        createRoutePoint({
          ...addressFields(
            state.defectiveDestinationAddress,
            state.defectiveDestinationContact,
            state.defectiveDestinationContactPhone,
          ),
          vehiclesToDropoff: defectiveVehicle ? [defectiveVehicle.id] : [],
          dropToStorage: state.defectiveDestination === 'storage',
        }),
      )
    }
  } else {
    if (hasAddress(state.workingVehicleAddress)) {
      routePoints.push(
        createRoutePoint({
          ...addressFields(
            state.workingVehicleAddress,
            state.workingVehicleContact,
            state.workingVehicleContactPhone,
          ),
          type: state.workingVehicleSource === 'storage' ? 'storage' : 'stop',
          vehiclesToPickup: workingVehicle ? [workingVehicle] : [],
        }),
      )
    }

    if (hasAddress(state.exchangeAddress)) {
      routePoints.push(
        createRoutePoint({
          ...addressFields(
            state.exchangeAddress,
            state.exchangeContactName,
            state.exchangeContactPhone,
          ),
          vehiclesToPickup: defectiveVehicle ? [defectiveVehicle] : [],
          vehiclesToDropoff: workingVehicle ? [workingVehicle.id] : [],
        }),
      )
    }

    if (hasAddress(state.defectiveDestinationAddress)) {
      routePoints.push(
        createRoutePoint({
          ...addressFields(
            state.defectiveDestinationAddress,
            state.defectiveDestinationContact,
            state.defectiveDestinationContactPhone,
          ),
          vehiclesToDropoff: defectiveVehicle ? [defectiveVehicle.id] : [],
          dropToStorage: state.defectiveDestination === 'storage',
        }),
      )
    }

    if (
      hasAddress(state.workingVehicleDestinationAddress) &&
      state.workingVehicleDestinationAddress.address !== state.exchangeAddress?.address
    ) {
      routePoints.push(
        createRoutePoint({
          ...addressFields(
            state.workingVehicleDestinationAddress,
            state.workingDestinationContact,
            state.workingDestinationContactPhone,
          ),
          vehiclesToDropoff: workingVehicle ? [workingVehicle.id] : [],
          dropToStorage: state.workingVehicleDestinationIsStorage,
        }),
      )
    }
  }

  return { routePoints, vehicles }
}
