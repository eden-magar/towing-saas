// Main components
export { RouteBuilder, createEmptyPoint, createEmptyVehicle } from './RouteBuilder'
export type { RoutePoint, RouteBuilderProps, VehicleOnTruck, AddressData } from './RouteBuilder'

// Sub-components (for direct use if needed)
export { AddressInput, loadGoogleMaps } from './AddressInput'
export { VehicleCard } from './VehicleCard'
export { VehicleInfoCard } from './VehicleInfoCard'
export type { VehicleData } from './VehicleInfoCard'
export { StorageVehicleSelector, StorageNotification } from './StorageVehicleSelector'

// Keep old components for backward compatibility
export { SingleRoute } from './SingleRoute'
export { ExchangeRoute } from './ExchangeRoute'