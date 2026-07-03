'use client'

import { useTowForm } from '../../../hooks/useTowForm'
import { SingleRoute } from '../../tow-forms/routes/SingleRoute'
import { PinDropModal } from '../../tow-forms/shared'
import type { AddressData } from '../../tow-forms/routes/AddressInput'

type Form = ReturnType<typeof useTowForm>

/**
 * Vehicle + route section for single tows on the mobile scroll page.
 * Mirrors new/page.tsx SingleRoute prop wiring and PinDropModal host logic.
 */
export function SectionSingleRoute({ form }: { form: Form }) {
  const handlePinDropConfirm = (data: AddressData) => {
    const field = form.pinDropModal.field
    if (field === 'pickup') {
      form.setPickupAddress(data)
    } else if (field === 'dropoff') {
      form.setDropoffAddress(data)
    } else {
      form.handlePinDropConfirm(data)
    }
  }

  return (
    <>
      <SingleRoute
        isMobile
        truckTypeSectionRef={form.truckTypeSectionRef}
        truckTypeError={form.truckTypeError}
        vehiclePlate={form.vehiclePlate}
        onVehiclePlateChange={form.setVehiclePlate}
        vehicleData={form.vehicleData}
        onVehicleDataChange={form.setVehicleData}
        vehicleType={form.vehicleType}
        onVehicleTypeChange={form.setVehicleType}
        vehicleCode={form.vehicleCode}
        onVehicleCodeChange={form.setVehicleCode}
        vehicleLookupNotFound={form.vehicleLookupNotFound}
        onVehicleLookupNotFoundChange={form.setVehicleLookupNotFound}
        manualManufacturer={form.manualManufacturer}
        onManualManufacturerChange={form.setManualManufacturer}
        manualColor={form.manualColor}
        onManualColorChange={form.setManualColor}
        manualWeight={form.manualWeight}
        onManualWeightChange={form.setManualWeight}
        manualChassis={form.manualChassis}
        onManualChassisChange={form.setManualChassis}
        selectedDefects={form.selectedDefects}
        onDefectsChange={form.setSelectedDefects}
        pickupAddress={form.pickupAddress}
        onPickupAddressChange={form.setPickupAddress}
        dropoffAddress={form.dropoffAddress}
        onDropoffAddressChange={form.setDropoffAddress}
        onPinDropClick={(field) => form.setPinDropModal({ isOpen: true, field })}
        routeStops={form.routeStops}
        addStop={form.addStop}
        removeStop={form.removeStop}
        moveStopUp={form.moveStopUp}
        moveStopDown={form.moveStopDown}
        updateStop={form.updateStop}
        distance={form.distance}
        distanceLoading={form.distanceLoading}
        basePriceList={form.basePriceList}
        startFromBase={form.startFromBase}
        onStartFromBaseChange={form.setStartFromBase}
        baseToPickupDistance={form.baseToPickupDistance}
        baseToPickupLoading={form.baseToPickupLoading}
        activeTimeSurcharges={form.activeTimeSurchargesList}
        isHoliday={form.isHoliday}
        onIsHolidayChange={form.setIsHoliday}
        locationSurchargesData={form.locationSurchargesData}
        selectedLocationSurcharges={form.selectedLocationSurcharges}
        onLocationSurchargesChange={form.setSelectedLocationSurcharges}
        manualSurcharges={form.manualSurcharges}
        onManualSurchargesChange={form.setManualSurcharges}
        serviceSurchargesData={form.serviceSurchargesData}
        selectedServices={form.selectedServices}
        onSelectedServicesChange={form.setSelectedServices}
        requiredTruckTypes={form.requiredTruckTypes}
        onRequiredTruckTypesChange={form.setRequiredTruckTypes}
        customerStoredVehicles={form.customerStoredVehicles}
        selectedStoredVehicleId={form.selectedStoredVehicleId}
        onSelectStoredVehicle={form.handleSelectStoredVehicle}
        onClearStoredVehicle={form.handleClearStoredVehicle}
        storageLoading={form.storageLoading}
        dropoffToStorage={form.dropoffToStorage}
        onDropoffToStorageChange={form.setDropoffToStorage}
        storageAddress={form.basePriceList?.base_address || ''}
      />

      <PinDropModal
        isOpen={form.pinDropModal.isOpen}
        onClose={() => form.setPinDropModal({ isOpen: false, field: null })}
        onConfirm={handlePinDropConfirm}
        initialAddress={
          form.pinDropModal.field?.startsWith('routestop:')
            ? form.routeStops.find((s) => `routestop:${s.id}` === form.pinDropModal.field)?.address
            : form.pinDropModal.field === 'pickup'
              ? form.pickupAddress
              : form.pinDropModal.field === 'dropoff'
                ? form.dropoffAddress
                : undefined
        }
        title={
          form.pinDropModal.field?.startsWith('routestop:')
            ? 'בחר מיקום עצירה'
            : form.pinDropModal.field === 'pickup'
              ? 'בחר מיקום מוצא'
              : form.pinDropModal.field === 'dropoff'
                ? 'בחר מיקום יעד'
                : 'בחר מיקום'
        }
      />
    </>
  )
}
