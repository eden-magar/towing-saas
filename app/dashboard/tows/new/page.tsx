'use client'

/// <reference types="google.maps" />
declare global {
  interface Window {
    google: typeof google
  }
}
import { Suspense } from 'react'
import { ArrowRight, Check, Truck, X } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { CustomerSection, TowTypeSelector, PaymentSection, PriceSummary, PriceSelector } from '../../../components/tow-forms/sections'
import { PinDropModal } from '../../../components/tow-forms/shared'
import { SingleRoute, RouteBuilder, ExchangeRoute } from '../../../components/tow-forms/routes'
import { useTowForm } from '../../../hooks/useTowForm'

// ==================== Main Form Component ====================
function NewTowForm({ editTowId }: { editTowId?: string }) {
  const {
    // Auth/routing
    router,
    companyId,
    // UI State
    showAssignNowModal,
    savedTowId,
    saving,
    error,
    // Data
    customers,
    drivers,
    customersWithPricing,
    selectedCustomerId,
    preSelectedDriverId, setPreSelectedDriverId,
    // Price list
    basePriceList,
    fixedPriceItems,
    selectedCustomerPricing,
    // Surcharges
    locationSurchargesData,
    serviceSurchargesData,
    selectedLocationSurcharges, setSelectedLocationSurcharges,
    selectedServices, setSelectedServices,
    isHoliday, setIsHoliday,
    activeTimeSurchargesList,
    // Price selection
    priceMode, setPriceMode,
    selectedPriceItem, setSelectedPriceItem,
    customPrice, setCustomPrice,
    customPriceIncludesVat, setCustomPriceIncludesVat,
    // Customer
    customerOrderNumber, setCustomerOrderNumber,
    customerName, setCustomerName,
    customerPhone, setCustomerPhone,
    customerEmail, setCustomerEmail,
    customerAddress, setCustomerAddress,
    // Date/Time
    towDate, setTowDate,
    towTime, setTowTime,
    isToday, setIsToday,
    // Tow type
    towType, setTowType,
    routePoints, setRoutePoints,
    customRouteData, setCustomRouteData,
    // Vehicle
    vehiclePlate, setVehiclePlate,
    vehicleCode, setVehicleCode,
    vehicleData, setVehicleData,
    vehicleType, setVehicleType,
    selectedDefects, setSelectedDefects,
    requiredTruckTypes, setRequiredTruckTypes,
    truckTypeError,
    truckTypeSectionRef,
    // Storage
    customerStoredVehicles,
    selectedStoredVehicleId,
    dropoffToStorage, setDropoffToStorage,
    storageLoading,
    // Exchange
    workingVehicleSource, setWorkingVehicleSource,
    selectedWorkingVehicleId,
    workingVehiclePlate, setWorkingVehiclePlate,
    workingVehicleData, setWorkingVehicleData,
    workingVehicleType, setWorkingVehicleType,
    workingVehicleCode, setWorkingVehicleCode,
    workingVehicleAddress, setWorkingVehicleAddress,
    workingVehicleContact, setWorkingVehicleContact,
    workingVehicleContactPhone, setWorkingVehicleContactPhone,
    exchangeAddress, setExchangeAddress,
    exchangeContactName, setExchangeContactName,
    exchangeContactPhone, setExchangeContactPhone,
    defectiveVehiclePlate, setDefectiveVehiclePlate,
    defectiveVehicleData, setDefectiveVehicleData,
    defectiveVehicleType, setDefectiveVehicleType,
    defectiveVehicleCode, setDefectiveVehicleCode,
    defectiveDestination, setDefectiveDestination,
    defectiveDestinationAddress, setDefectiveDestinationAddress,
    defectiveDestinationContact, setDefectiveDestinationContact,
    defectiveDestinationContactPhone, setDefectiveDestinationContactPhone,
    stopsBeforeExchange, setStopsBeforeExchange,
    stopsAfterExchange, setStopsAfterExchange,
    exchangeTotalDistance,
    exchangeDistanceLoading,
    // Addresses
    pickupAddress, setPickupAddress,
    dropoffAddress, setDropoffAddress,
    distance,
    distanceLoading,
    startFromBase, setStartFromBase,
    baseToPickupDistance,
    baseToPickupLoading,
    // Contacts
    pickupContactName, setPickupContactName,
    pickupContactPhone, setPickupContactPhone,
    dropoffContactName, setDropoffContactName,
    dropoffContactPhone, setDropoffContactPhone,
    notes, setNotes,
    // Payment
    invoiceName, setInvoiceName,
    paymentMethod, setPaymentMethod,
    creditCardNumber, setCreditCardNumber,
    creditCardExpiry, setCreditCardExpiry,
    creditCardCvv, setCreditCardCvv,
    creditCardId, setCreditCardId,
    // Pin drop
    pinDropModal, setPinDropModal,
    pinDropResult, setPinDropResult,
    // Computed
    recommendedPrice,
    finalPrice,
    // Handlers
    handleCustomerSelect,
    handleSelectWorkingVehicle,
    handleClearWorkingVehicle,
    handleSelectStoredVehicle,
    handleClearStoredVehicle,
    handlePinDropConfirm,
    copyFromCustomer,
    handleSave,
  } = useTowForm(editTowId)

  // ==================== Render ====================
  
  return (
    <div className="min-h-screen bg-gray-50">
      {error && (
        <div className="fixed top-4 left-4 right-4 z-50 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl">
          {error}
        </div>
      )}
      
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex justify-between items-center h-14 sm:h-16">
            <div className="flex items-center gap-3">
              <Link href="/dashboard/tows" className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
                <ArrowRight size={20} />
              </Link>
              <div>
                <h1 className="font-bold text-gray-800 text-base sm:text-lg">גרירה חדשה</h1>
                <p className="text-xs text-gray-500 hidden sm:block">מילוי פרטי הגרירה</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-4 sm:py-6 overflow-x-hidden">
        {/* Driver Pre-Selected Banner */}
        {preSelectedDriverId && drivers.length > 0 && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white font-bold">
                {drivers.find(d => d.id === preSelectedDriverId)?.user?.full_name?.charAt(0) || '?'}
              </div>
              <div>
                <p className="text-sm text-green-700">נהג משובץ:</p>
                <p className="font-medium text-green-800">
                  {drivers.find(d => d.id === preSelectedDriverId)?.user?.full_name || 'נהג לא נמצא'}
                </p>
              </div>
            </div>
            <button onClick={() => setPreSelectedDriverId(null)} className="p-2 text-green-600 hover:bg-green-100 rounded-lg" title="הסר נהג">
              <X size={18} />
            </button>
          </div>
        )}

        <div className="flex flex-col gap-4 sm:gap-6">
          {/* Main Form */}
          <div className="flex-1 space-y-4 sm:space-y-6">
            
            {/* Section 1 - Customer */}
            <CustomerSection
              customers={customers}
              customersWithPricing={customersWithPricing}
              selectedCustomerId={selectedCustomerId}
              onCustomerSelect={handleCustomerSelect}
              customerName={customerName}
              customerPhone={customerPhone}
              onCustomerNameChange={setCustomerName}
              onCustomerPhoneChange={setCustomerPhone}
              customerEmail={customerEmail}
              customerAddress={customerAddress}
              onCustomerEmailChange={setCustomerEmail}
              onCustomerAddressChange={setCustomerAddress}
              towDate={towDate}
              towTime={towTime}
              isToday={isToday}
              onTowDateChange={setTowDate}
              onTowTimeChange={setTowTime}
              onIsTodayChange={setIsToday}
              customerOrderNumber={customerOrderNumber}
              onCustomerOrderNumberChange={setCustomerOrderNumber}
            />

            {/* Section 2 - Tow Type */}
            <TowTypeSelector selectedType={towType} onChange={setTowType} />

            {/* Section 3+4 - Route based on type */}
            {towType === 'single' && (
              <SingleRoute
                truckTypeSectionRef={truckTypeSectionRef}
                truckTypeError={truckTypeError}
                vehiclePlate={vehiclePlate}
                onVehiclePlateChange={setVehiclePlate}
                vehicleData={vehicleData}
                onVehicleDataChange={setVehicleData}
                vehicleType={vehicleType}
                onVehicleTypeChange={setVehicleType}
                vehicleCode={vehicleCode}
                onVehicleCodeChange={setVehicleCode}
                selectedDefects={selectedDefects}
                onDefectsChange={setSelectedDefects}
                pickupAddress={pickupAddress}
                onPickupAddressChange={setPickupAddress}
                dropoffAddress={dropoffAddress}
                onDropoffAddressChange={setDropoffAddress}
                onPinDropClick={(field) => setPinDropModal({ isOpen: true, field })}
                distance={distance}
                distanceLoading={distanceLoading}
                basePriceList={basePriceList}
                startFromBase={startFromBase}
                onStartFromBaseChange={setStartFromBase}
                baseToPickupDistance={baseToPickupDistance}
                baseToPickupLoading={baseToPickupLoading}
                activeTimeSurcharges={activeTimeSurchargesList}
                isHoliday={isHoliday}
                onIsHolidayChange={setIsHoliday}
                locationSurchargesData={locationSurchargesData}
                selectedLocationSurcharges={selectedLocationSurcharges}
                onLocationSurchargesChange={setSelectedLocationSurcharges}
                serviceSurchargesData={serviceSurchargesData}
                selectedServices={selectedServices}
                onSelectedServicesChange={setSelectedServices}
                requiredTruckTypes={requiredTruckTypes}
                onRequiredTruckTypesChange={setRequiredTruckTypes}

                customerStoredVehicles={customerStoredVehicles}
                selectedStoredVehicleId={selectedStoredVehicleId}
                onSelectStoredVehicle={handleSelectStoredVehicle}
                onClearStoredVehicle={handleClearStoredVehicle}
                storageLoading={storageLoading}
                dropoffToStorage={dropoffToStorage}
                onDropoffToStorageChange={setDropoffToStorage}
                storageAddress={basePriceList?.base_address || ''}
              />
            )}

            {towType === 'exchange' && (
              <ExchangeRoute
                customerName={customerName}
                customerPhone={customerPhone}
                workingVehicleSource={workingVehicleSource}
                onWorkingVehicleSourceChange={setWorkingVehicleSource}
                customerStoredVehicles={customerStoredVehicles}
                selectedWorkingVehicleId={selectedWorkingVehicleId}
                onSelectWorkingVehicle={handleSelectWorkingVehicle}
                onClearWorkingVehicle={handleClearWorkingVehicle}
                workingVehicleAddress={workingVehicleAddress}
                onWorkingVehicleAddressChange={setWorkingVehicleAddress}
                workingVehicleContact={workingVehicleContact}
                onWorkingVehicleContactChange={setWorkingVehicleContact}
                workingVehicleContactPhone={workingVehicleContactPhone}
                onWorkingVehicleContactPhoneChange={setWorkingVehicleContactPhone}
                workingVehiclePlate={workingVehiclePlate}
                onWorkingVehiclePlateChange={setWorkingVehiclePlate}
                workingVehicleData={workingVehicleData}
                onWorkingVehicleDataChange={setWorkingVehicleData}
                workingVehicleType={workingVehicleType}
                onWorkingVehicleTypeChange={setWorkingVehicleType}
                workingVehicleCode={workingVehicleCode}
                onWorkingVehicleCodeChange={setWorkingVehicleCode}
                storageLoading={storageLoading}
                exchangeAddress={exchangeAddress}
                onExchangeAddressChange={setExchangeAddress}
                exchangeContactName={exchangeContactName}
                onExchangeContactNameChange={setExchangeContactName}
                exchangeContactPhone={exchangeContactPhone}
                onExchangeContactPhoneChange={setExchangeContactPhone}
                defectiveVehiclePlate={defectiveVehiclePlate}
                onDefectiveVehiclePlateChange={setDefectiveVehiclePlate}
                defectiveVehicleData={defectiveVehicleData}
                onDefectiveVehicleDataChange={setDefectiveVehicleData}
                defectiveVehicleType={defectiveVehicleType}
                onDefectiveVehicleTypeChange={setDefectiveVehicleType}
                defectiveVehicleCode={defectiveVehicleCode}
                onDefectiveVehicleCodeChange={setDefectiveVehicleCode}
                selectedDefects={selectedDefects}
                onDefectsChange={setSelectedDefects}
                defectiveDestination={defectiveDestination}
                onDefectiveDestinationChange={setDefectiveDestination}
                defectiveDestinationAddress={defectiveDestinationAddress}
                onDefectiveDestinationAddressChange={setDefectiveDestinationAddress}
                defectiveDestinationContact={defectiveDestinationContact}
                onDefectiveDestinationContactChange={setDefectiveDestinationContact}
                defectiveDestinationContactPhone={defectiveDestinationContactPhone}
                onDefectiveDestinationContactPhoneChange={setDefectiveDestinationContactPhone}
                stopsBeforeExchange={stopsBeforeExchange}
                onStopsBeforeExchangeChange={setStopsBeforeExchange}
                stopsAfterExchange={stopsAfterExchange}
                onStopsAfterExchangeChange={setStopsAfterExchange}
                serviceSurchargesData={serviceSurchargesData}
                selectedServices={selectedServices}
                onSelectedServicesChange={setSelectedServices}
                requiredTruckTypes={requiredTruckTypes}
                onRequiredTruckTypesChange={setRequiredTruckTypes}
                truckTypeSectionRef={truckTypeSectionRef}
                truckTypeError={truckTypeError}
                basePriceList={basePriceList}
                startFromBase={startFromBase}
                onStartFromBaseChange={setStartFromBase}
                totalDistance={exchangeTotalDistance}
                distanceLoading={exchangeDistanceLoading}
                activeTimeSurcharges={activeTimeSurchargesList}
                isHoliday={isHoliday}
                onIsHolidayChange={setIsHoliday}
                locationSurchargesData={locationSurchargesData}
                selectedLocationSurcharges={selectedLocationSurcharges}
                onLocationSurchargesChange={setSelectedLocationSurcharges}
                onPinDropClick={(field) => setPinDropModal({ isOpen: true, field })}
                storageAddress={basePriceList?.base_address || ''}
              />
            )}

            {towType === 'custom' && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 sm:px-5 py-3 sm:py-4 bg-gray-50 border-b border-gray-200">
                  <h2 className="font-bold text-gray-800 flex items-center gap-2 text-sm sm:text-base">
                    <span className="w-6 h-6 bg-[#33d4ff] text-white rounded-full flex items-center justify-center text-sm">3</span>
                    בניית מסלול
                  </h2>
                </div>
                <div className="p-4 sm:p-5">
                  <RouteBuilder
                    companyId={companyId || ''}
                    customerId={selectedCustomerId}
                    customerName={customerName}
                    customerPhone={customerPhone}
                    baseAddress={basePriceList?.base_address}
                    baseLat={basePriceList?.base_lat}        
                    baseLng={basePriceList?.base_lng}        
                    onPointsChange={setRoutePoints}
                    onPinDropClick={(pointId) => setPinDropModal({ isOpen: true, field: pointId })}
                    onRouteDataChange={setCustomRouteData}
                    pinDropResult={pinDropResult}
                    onPinDropHandled={() => setPinDropResult(null)}
                    requiredTruckTypes={requiredTruckTypes}
                    onRequiredTruckTypesChange={setRequiredTruckTypes}
                    truckTypeSectionRef={truckTypeSectionRef}
                    truckTypeError={truckTypeError}
                  />
                </div>
              </div>
            )}

            {/* Section 5 - Price */}
            {towType && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 sm:px-5 py-3 sm:py-4 bg-gray-50 border-b border-gray-200">
                  <h2 className="font-bold text-gray-800 flex items-center gap-2 text-sm sm:text-base">
                    <span className="w-6 h-6 bg-[#33d4ff] text-white rounded-full flex items-center justify-center text-sm">
                      {towType === 'single' ? '5' : '4'}
                    </span>
                    מחיר
                  </h2>
                </div>
                <div className="p-4 sm:p-5">
                  <PriceSelector
                    priceMode={priceMode}
                    setPriceMode={setPriceMode}
                    selectedPriceItem={selectedPriceItem}
                    setSelectedPriceItem={setSelectedPriceItem}
                    customPrice={customPrice}
                    setCustomPrice={setCustomPrice}
                    recommendedPrice={recommendedPrice}
                    distance={distance}
                    basePriceList={basePriceList}
                    fixedPriceItems={fixedPriceItems}
                    selectedCustomerPricing={selectedCustomerPricing}
                    customPriceIncludesVat={customPriceIncludesVat}
                    setCustomPriceIncludesVat={setCustomPriceIncludesVat}
                  />
                </div>
              </div>
            )}

            {/* Section 6 - Additional Details */}
            {towType === 'single' && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 sm:px-5 py-3 sm:py-4 bg-gray-50 border-b border-gray-200">
                  <h2 className="font-bold text-gray-800 flex items-center gap-2 text-sm sm:text-base">
                    <span className="w-6 h-6 bg-[#33d4ff] text-white rounded-full flex items-center justify-center text-sm">
                      {towType === 'single' ? '6' : '5'}
                    </span>
                    פרטים נוספים
                  </h2>
                </div>
                <div className="p-4 sm:p-5 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <h4 className="font-medium text-gray-700 mb-3 text-sm">איש קשר במוצא</h4>
                      <div className="space-y-3">
                        <input type="text" value={pickupContactName} onChange={(e) => setPickupContactName(e.target.value)} placeholder="שם" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white" />
                        <div className="flex gap-2">
                          <input type="tel" value={pickupContactPhone} onChange={(e) => setPickupContactPhone(e.target.value)} placeholder="טלפון" className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white" />
                          <button onClick={() => copyFromCustomer('pickup')} className="px-2 py-2 bg-cyan-50 border border-cyan-200 text-cyan-600 rounded-lg text-xs hover:bg-cyan-100">👤</button>
                        </div>
                      </div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <h4 className="font-medium text-gray-700 mb-3 text-sm">איש קשר ביעד</h4>
                      <div className="space-y-3">
                        <input type="text" value={dropoffContactName} onChange={(e) => setDropoffContactName(e.target.value)} placeholder="שם" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white" />
                        <div className="flex gap-2">
                          <input type="tel" value={dropoffContactPhone} onChange={(e) => setDropoffContactPhone(e.target.value)} placeholder="טלפון" className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white" />
                          <button onClick={() => copyFromCustomer('dropoff')} className="px-2 py-2 bg-cyan-50 border border-cyan-200 text-cyan-600 rounded-lg text-xs hover:bg-cyan-100">👤</button>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">הערות</label>
                    <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="הערות נוספות לגרירה..." className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] resize-none"></textarea>
                  </div>
                </div>
              </div>
            )}

            {/* Section 7 - Payment */}
            {towType && (
              <PaymentSection
                sectionNumber={towType === 'single' ? 7 : 6}
                invoiceName={invoiceName}
                onInvoiceNameChange={setInvoiceName}
                customerName={customerName}
                paymentMethod={paymentMethod}
                onPaymentMethodChange={setPaymentMethod}
                creditCardNumber={creditCardNumber}
                creditCardExpiry={creditCardExpiry}
                creditCardCvv={creditCardCvv}
                creditCardId={creditCardId}
                onCreditCardNumberChange={setCreditCardNumber}
                onCreditCardExpiryChange={setCreditCardExpiry}
                onCreditCardCvvChange={setCreditCardCvv}
                onCreditCardIdChange={setCreditCardId}
              />
            )}

            {/* Price Summary */}
            <div>
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 sm:px-5 py-3 sm:py-4 bg-gray-800 text-white">
                  <h3 className="font-bold text-sm sm:text-base">סיכום מחיר</h3>
                </div>
                <div className="p-4">
                  <PriceSummary
                    isMobile
                    hasTowType={!!towType}
                    hasVehicleType={towType === 'custom' ? customRouteData.vehicles.length > 0 : !!vehicleType}
                    vehicleType={vehicleType}
                    basePriceList={basePriceList}
                    distance={towType === 'custom' ? { distanceKm: customRouteData.totalDistanceKm, durationMinutes: 0 } : distance}
                    baseToPickupDistance={baseToPickupDistance}
                    startFromBase={startFromBase}
                    activeTimeSurcharges={activeTimeSurchargesList}
                    selectedLocationSurcharges={selectedLocationSurcharges}
                    locationSurchargesData={locationSurchargesData}
                    selectedServices={selectedServices}
                    serviceSurchargesData={serviceSurchargesData}
            
                    selectedCustomerPricing={selectedCustomerPricing}
                    priceMode={priceMode}
                    selectedPriceItem={selectedPriceItem}
                    customPrice={customPrice}
                    finalPrice={finalPrice}
                    onSave={handleSave}
                    saving={saving}
                    towType={towType}
                    customRouteVehicleCount={customRouteData.vehicles.length}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pin Drop Modal */}
      <PinDropModal
        isOpen={pinDropModal.isOpen}
        onClose={() => setPinDropModal({ isOpen: false, field: null })}
        onConfirm={handlePinDropConfirm}
        initialAddress={
          pinDropModal.field === 'pickup' ? pickupAddress : 
          pinDropModal.field === 'dropoff' ? dropoffAddress : 
          routePoints.find(p => p.id === pinDropModal.field)?.address 
            ? { address: routePoints.find(p => p.id === pinDropModal.field)?.address || '', lat: routePoints.find(p => p.id === pinDropModal.field)?.addressData?.lat, lng: routePoints.find(p => p.id === pinDropModal.field)?.addressData?.lng }
            : undefined
        }
        title={pinDropModal.field === 'pickup' ? 'בחר מיקום מוצא' : pinDropModal.field === 'dropoff' ? 'בחר מיקום יעד' : 'בחר מיקום'}
      />

      {/* Success Modal */}
      {showAssignNowModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check size={32} className="text-emerald-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">הגרירה נשמרה בהצלחה!</h2>
              <p className="text-gray-500 mb-2">מחיר: <span className="font-bold">₪{finalPrice}</span></p>
              <p className="text-gray-600">האם לשבץ נהג עכשיו?</p>
            </div>
            
            <div className="flex gap-3 p-5 bg-gray-50 border-t border-gray-200">
              <button onClick={() => router.push('/dashboard/tows')} className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-100 transition-colors font-medium">
                אחר כך
              </button>
              <button onClick={() => router.push(`/dashboard/tows/${savedTowId}`)} className="flex-1 py-3 bg-[#33d4ff] text-white rounded-xl hover:bg-[#21b8e6] transition-colors font-medium flex items-center justify-center gap-2">
                <Truck size={18} />
                שבץ נהג
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Wrapper with Suspense
export default function NewTowPage() {
  const searchParams = useSearchParams()
  const editTowId = searchParams.get('edit') || undefined
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">טוען...</div>
      </div>
    }>
      <NewTowForm editTowId={editTowId} />
    </Suspense>
  )
}
