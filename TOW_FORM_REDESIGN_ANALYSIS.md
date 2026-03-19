# Tow Form Redesign — Detailed Codebase Analysis

**Read-only analysis. No code changes.**

---

## 1. Driver Assignment

### Can a tow be saved without an assigned driver?

**Yes.** A tow can be saved without a driver.

- **DB:** `createTow` in `app/lib/queries/tows.ts` (lines 391–404) sets `status = input.driverId ? 'assigned' : 'pending'` and `driver_id: input.driverId || null`.
- **UI:** The tow creation form does not require a driver. `preSelectedDriverId` is optional and comes from URL params (`?driver=...`) when creating from the calendar.

### What status is saved when no driver is assigned?

**`pending`** — see `tows.ts` line 393: `const status = input.driverId ? 'assigned' : 'pending'`.

### Is there a "late assignment" flow?

**Yes.** Flow:

1. Create tow without driver → status `pending`, `driver_id` null.
2. After save, if `!preSelectedDriverId`, `setShowAssignNowModal(true)` — modal: "הגרירה נשמרה בהצלחה! האם לשבץ נהג עכשיו?"
3. User can choose "אחר כך" or "שבץ נהג" (navigates to `/dashboard/tows/[id]`).
4. On tow detail page (`app/dashboard/tows/[id]/page.tsx`), dispatcher can assign via `assignDriver(tow.id, selectedDriverId, selectedTruckId)`.
5. Dashboard shows "ממתינות לשיבוץ" for tows with `status === 'pending' && !t.driver_id`; each has a "שבץ" button that goes to the tow detail page.

### Where can a dispatcher assign or reassign a driver?

| Location | File | Behavior |
|----------|------|----------|
| Tow detail page | `app/dashboard/tows/[id]/page.tsx` | Driver selector + truck selector; "שבץ נהג" / "שנה נהג" calls `assignDriver`. |
| Dashboard "ממתינות לשיבוץ" | `app/dashboard/page.tsx` | "שבץ" button → `router.push(\`/dashboard/tows/${tow.id}\`)`. |
| Calendar | `app/dashboard/calendar/page.tsx` | Click on unassigned tow → `handleAssignDriver(tow)` → driver modal; or drag to slot → `handleDrop` with `driverId`. |

### Is driver assignment part of the tow creation form?

**No.** The creation form only supports optional pre-selection via URL (`?driver=...`). There is no driver selector in the form. Assignment happens on the tow detail page or from the calendar.

---

## 2. Price Modes — Usage in Code

### Occurrence counts (excluding type definitions)

**`recommended`** — 28 occurrences:
- `app/hooks/useTowForm.ts`: 74 (initial state), 101 (resetForm), 339 (edit fallback)
- `app/hooks/useTowPricing.ts`: 28, 68, 117, 137
- `app/components/tow-forms/sections/PriceSelector.tsx`: 20, 39, 57, 59, 77, 83, 88, 94
- `app/components/tow-forms/sections/PriceSummary.tsx`: 44, 73, 206, 308
- `app/hooks/useTowSave.ts`: 51, 110
- `app/lib/utils/tow-save-handler.ts`: 61, 114, 428, 529, 599, 652, 666, 695
- `app/lib/queries/tows.ts`: 116, 357, 412, 621, 661
- `app/dashboard/calendar/page.tsx`: 385, 387, 398, 403, 1220, 1222, 1228, 1304, 1317

**`recommended_customer`** — 14 occurrences:
- `app/hooks/useTowPricing.ts`: 28, 68, 109, 117, 137
- `app/components/tow-forms/sections/PriceSelector.tsx`: 20, 39, 106, 112, 117, 125
- `app/components/tow-forms/sections/PriceSummary.tsx`: 44, 73, 106, 206, 308
- `app/hooks/useTowSave.ts`: 51, 110
- `app/lib/utils/tow-save-handler.ts`: 61, 114, 428, 529

**`fixed`** — 22 occurrences (many in `price_type: 'fixed'` context):
- Price mode: `PriceSelector.tsx` (20, 39, 178, 181, 184, 188, 194), `PriceSummary.tsx` (44, 73, 282), `useTowPricing.ts` (28, 68, 256, 258), `useTowSave.ts` (51, 110), `tow-save-handler.ts` (61, 114, 599, 652, 666, 695), `tows.ts` (116, 357, 412, 621, 661)
- Service surcharge: `price-lists.ts` (52), `price-lists/page.tsx` (409, 894)

**`customer`** — 18 occurrences:
- `PriceSelector.tsx`: 20, 39, 59, 134, 137, 140, 144, 157
- `PriceSummary.tsx`: 44, 73, 289
- `useTowPricing.ts`: 28, 68, 256, 258
- `useTowSave.ts`: 51, 110
- `tow-save-handler.ts`: 61, 114, 599, 652, 666, 695
- `tows.ts`: 116, 357, 412, 621, 661

**`custom`** — 24 occurrences:
- `PriceSelector.tsx`: 20, 39, 217, 220, 223, 227, 233
- `PriceSummary.tsx`: 44, 73, 296, 308
- `useTowForm.ts`: 74, 339
- `useTowPricing.ts`: 28, 68, 252
- `useTowSave.ts`: 51, 110
- `tow-save-handler.ts`: 61, 114, 599, 652, 666, 695
- `tows.ts`: 116, 357, 412, 621, 661
- `dashboard/tows/[id]/page.tsx`: 1356, 1413, 1416

### Default `priceMode` when opening a new tow form

**`recommended`** — `useTowForm.ts` line 74: `useState<'recommended' | ...>('recommended')`.

### Does the default change if a customer with a custom price list is selected?

**No.** In `useTowPricing.ts` (lines 93–105), when `selectedCustomerId` changes:
- `setSelectedCustomerPricing(customerPricing || null)` is called.
- If `!isEditMode`, `setPriceMode('recommended')` is called — so it stays or resets to `recommended`, never to `recommended_customer`.

### Logic that switches `priceMode` based on customer selection

**No automatic switch to `recommended_customer`.** The user must manually choose "מחיר מומלץ — מחירון [customer name]" in the PriceSelector. The `recommended_customer` option is only shown when `selectedCustomerPricing?.price_list` exists (PriceSelector lines 100–129).

### Which `priceMode` is used most often?

**`recommended`** — it is the default, the primary option, and the fallback when `showRecommended` is hidden. The UI and flow are built around it.

---

## 3. Tow Type — Current State

### Every place `tow_type` or `towType` is read or written

**Read:**
- `app/lib/types.ts`: 157, 471, 512 (type definitions)
- `app/lib/queries/tows.ts`: 103, 353, 406 (CreateTowInput, createTow)
- `app/lib/queries/customer-portal.ts`: 51, 115 (select)
- `app/lib/queries/driver-tasks.ts`: 53, 115, 198, 269, 292, 359, 380, 448
- `app/dashboard/tows/[id]/page.tsx`: 141 (towTypeLabels), 695, 697
- `app/hooks/useTowForm.ts`: 328–334 (load for edit: `towTypeMap[tow.tow_type]`), 405 (multi_vehicle check)
- `app/driver/stats/page.tsx`: 119, 136 (select)

**Written:**
- `app/lib/queries/tows.ts`: 406 (`tow_type: input.towType`)
- `app/lib/utils/tow-save-handler.ts`: 647 (`towType: 'simple'`), 690 (`towType: 'multi_vehicle'`)

### Value saved to DB for each UI tow type

| UI Type | DB Value | Source |
|---------|----------|--------|
| single | `simple` | `tow-save-handler.ts` line 647 |
| exchange | *(never saved)* | `useTowSave` returns early |
| custom | `multi_vehicle` | `tow-save-handler.ts` line 690 |

### What happens when user fills "exchange" and clicks save?

1. `useTowSave.handleSave` (line 134): `if (towType !== 'single' && towType !== 'custom') return` — function exits, no save.
2. No `prepareTowData` call, no `createTow`, no DB write.
3. User sees no error; the form simply does nothing on save.

### Are `with_base` and `transfer` ever written?

**No.** Only `simple` and `multi_vehicle` are written in `tow-save-handler.ts`. `with_base` and `transfer` are never used.

### Does the UI read `with_base` or `transfer` and do something with it?

**Yes, only when loading for edit.** In `useTowForm.ts` (lines 328–334):

```ts
const towTypeMap: Record<string, TowType> = {
  'simple': 'single',
  'with_base': 'single',
  'transfer': 'custom',
  'multi_vehicle': 'custom',
}
setTowType(towTypeMap[tow.tow_type] || 'single')
```

So `with_base` → `single`, `transfer` → `custom`. They are never written, only read for edit mapping.

---

## 4. The Form — UX Flow

### Exact order of sections

1. **Header** — Back, "גרירה חדשה"
2. **Pre-selected driver banner** (conditional: `preSelectedDriverId && drivers.length > 0`)
3. **Section 1 — Customer** (CustomerSection): customer, name, phone, email, address, date, time, order number
4. **Section 2 — Tow Type** (TowTypeSelector): single / exchange / custom
5. **Section 3+4 — Route** (depends on type):
   - `single`: SingleRoute (vehicle, defects, services, truck type, addresses, storage, base)
   - `exchange`: ExchangeRoute
   - `custom`: RouteBuilder
6. **Section 5 — Price** (PriceSelector) — shown when `towType` is set
7. **Section 6 — Additional Details** (single only): pickup/dropoff contacts, notes
8. **Section 7 — Payment** (PaymentSection)
9. **Price Summary** — total + "שמור גרירה"

### Always visible vs conditionally shown

| Section | Condition |
|---------|-----------|
| Customer | Always |
| Tow Type | Always |
| Route (SingleRoute) | `towType === 'single'` |
| Route (ExchangeRoute) | `towType === 'exchange'` |
| Route (RouteBuilder) | `towType === 'custom'` |
| Price | `towType` is set |
| Additional Details | `towType === 'single'` |
| Payment | `towType` is set |
| Price Summary | Always (content depends on `towType`) |
| Pre-selected driver banner | `preSelectedDriverId && drivers.length > 0` |

### First thing user must fill when opening a new tow form

**Nothing is strictly required first.** The form loads with:
- `towDate` = today, `towTime` = now
- `priceMode` = `recommended`
- Empty customer, vehicle, addresses

Validation runs only on save (truck type, vehicle plate for storage dropoff).

### Is customer selection truly the first step?

**Yes, by layout.** CustomerSection is first. But the user can fill other fields in any order; there is no enforced sequence.

### Fields that appear but are never saved to DB

- **Exchange route fields** — all exchange-specific fields (working vehicle, defective vehicle, exchange address, etc.) are never saved because exchange is not supported.
- **Credit card fields** — `creditCardNumber`, `creditCardExpiry`, `creditCardCvv`, `creditCardId` are in form state but not passed to `prepareTowData` or `createTow`; only `paymentMethod` and `invoiceName` are saved.
- **`isHoliday`** — used for time surcharges in UI; not stored on the tow (surcharges are in `price_breakdown`).

---

## 5. Storage Integration

### What triggers `addVehicleToStorage`? Full call path

1. **UI:** SingleRoute checkbox "לאחסנה" (`dropoffToStorage`).
2. **State:** `dropoffToStorage` in `useTowForm`, passed to `useTowSave`.
3. **Save:** `useTowSave.handleSave` (lines 276–297): after `createTow(towData)` succeeds, if `dropoffToStorage && companyId`:
   ```ts
   await addVehicleToStorage({
     companyId,
     customerId: selectedCustomerId || undefined,
     plateNumber: vehiclePlate,
     vehicleData: vehicleData?.data ? {...} : undefined,
     location: undefined,
     towId: result.id,
     performedBy: user?.id,
     notes: 'נכנס מגרירה',
     vehicleCondition: selectedDefects.length > 0 ? 'faulty' : 'operational',
   })
   ```
4. **Storage:** `app/lib/queries/storage.ts` `addVehicleToStorage` (lines 131–163): checks for existing stored vehicle, then calls `supabase.rpc('add_vehicle_to_storage', {...})`.

### What triggers `releaseVehicleFromStorage`? Full call path

1. **UI:** SingleRoute — user selects a vehicle from `customerStoredVehicles` (`selectedStoredVehicleId`).
2. **State:** `selectedStoredVehicleId` in `useTowForm`, passed to `useTowSave`.
3. **Save:** `useTowSave.handleSave` (lines 267–274): after `createTow` succeeds, if `selectedStoredVehicleId && companyId`:
   ```ts
   await releaseVehicleFromStorage({
     storedVehicleId: selectedStoredVehicleId,
     towId: result.id,
     performedBy: user?.id,
     notes: 'שוחרר לגרירה'
   })
   ```
4. **Storage:** `app/lib/queries/storage.ts` `releaseVehicleFromStorage` (lines 176–190): calls `supabase.rpc('release_vehicle_from_storage', {...})`.

### If a tow is deleted after a vehicle was added to storage via that tow — what happens to the storage record?

**The storage record stays.** `deleteTow` in `app/lib/queries/tows.ts` (and driver-tasks) deletes `tows`, `tow_vehicles`, `tow_legs`, `tow_points`, etc. It does not touch `stored_vehicles` or storage history. The vehicle remains in storage.

### Validation that prevents adding a vehicle already in storage

**Yes.** `addVehicleToStorage` (storage.ts lines 132–142):

```ts
const { data: existing } = await supabase
  .from('stored_vehicles')
  .select('id')
  .eq('company_id', input.companyId)
  .eq('plate_number', input.plateNumber)
  .eq('current_status', 'stored')
  .maybeSingle()

if (existing) {
  throw new Error('הרכב כבר נמצא באחסנה')
}
```

### Can a single tow both release a vehicle from storage AND add a different vehicle to storage?

**Yes.** In `useTowSave.handleSave`:
1. If `selectedStoredVehicleId`: `releaseVehicleFromStorage` is called (outbound).
2. If `dropoffToStorage`: `addVehicleToStorage` is called (inbound).

They are independent and can both run for the same tow (e.g. exchange scenario: release working vehicle, add defective vehicle).

---

## 6. Price Calculation — Source of Truth

### Functions that calculate or contribute to the final tow price

| Function | File | Role |
|----------|------|------|
| `calculateRecommendedPrice` | `useTowPricing.ts` | UI live price for recommended modes |
| `calculateFinalPrice` | `useTowPricing.ts` | Final price for all modes |
| `buildSingleTowPriceBreakdown` | `tow-save-handler.ts` | Price breakdown for single tows on save |
| `buildCustomTowPriceBreakdown` | `tow-save-handler.ts` | Defined but never called |
| Price display logic | `PriceSummary.tsx` | Duplicate calculation for UI breakdown |
| `recalculateTowPrice` | `tows.ts` | Recalc when schedule changes (calendar drag) |

### Is the price shown in the form UI always identical to the price saved in DB?

**Not guaranteed.** There are three separate calculation paths:
1. `useTowPricing` (recommended/custom/fixed/customer)
2. `PriceSummary` (display)
3. `buildSingleTowPriceBreakdown` (save)

They use the same inputs but can diverge (e.g. rounding, order of operations). For custom routes, `prepareTowData` uses `buildSingleTowPriceBreakdown` even though `buildCustomTowPriceBreakdown` exists and has different logic (no location/service surcharges).

### What happens when the user changes the pickup address after having a calculated price?

1. `pickupAddress` changes → `useTowForm` effect (lines 219–245) runs.
2. `calculateDistance(pickupAddress, dropoffAddress)` is called (500ms debounce).
3. `setDistance(result)` updates `distance`.
4. `useTowPricing` receives new `distance` → `calculateRecommendedPrice` runs again.
5. `recommendedPrice` and `finalPrice` update.
6. PriceSummary re-renders with new values.

So the price recalculates when addresses change.

### Does changing tow date/time automatically recalculate time-based surcharges in the UI?

**Yes.** In `useTowPricing.ts`:
- Effect (lines 126–133): `getActiveTimeSurcharges(timeSurchargesData, towTime, towDate, isHoliday)` depends on `towDate`, `towTime`, `isHoliday`.
- Effect (lines 107–124): when `priceMode` or `selectedCustomerPricing` changes, time surcharges are refreshed.
- `calculateRecommendedPrice` uses `activeTimeSurchargesList`, so the displayed price updates when date/time change.

### VAT rate — hardcoded or configurable?

**Hardcoded as 0.18 (18%)** in:
- `useTowPricing.ts`: 182, 244
- `tow-save-handler.ts`: 503, 566
- `PriceSummary.tsx`: 185
- `tows.ts` (recalculateTowPrice): 938
- `dashboard/tows/[id]/page.tsx`: 377

`company_settings` has `default_vat_percent` and it is used in settings/invoices, but tow price calculation always uses `0.18`.

---

## 7. Known Bugs — Current Status

### 1. `exchange` tow type is not saved

**Still exists.** `useTowSave.ts` line 134: `if (towType !== 'single' && towType !== 'custom') return` — exchange is excluded. Save does nothing for exchange.

### 2. `buildCustomTowPriceBreakdown` exists but is never called

**Still exists.** It is defined in `tow-save-handler.ts` (lines 525–583) but never used. For custom tows, `prepareTowData` (lines 665–677) calls `buildSingleTowPriceBreakdown` instead.

### 3. `recommended_customer` priceMode may use wrong price list

**Partially.** In `buildSingleTowPriceBreakdown` and `buildCustomTowPriceBreakdown`, `activePriceList` is correctly chosen when `priceMode === 'recommended_customer'`. PROJECT_OVERVIEW mentions the tow save handler using `basePriceList` for `recommended_customer` — in the current code, `prepareTowData` passes `selectedCustomerPricing` and the breakdown functions use it. The potential bug is in `getCustomersWithPricing`: it may not load `customer_time_surcharges`, `customer_location_surcharges`, `customer_service_surcharges`, so customer-specific surcharges might be wrong or missing.

### 4. `break` status missing from DriverStatus type

**Still exists.** `app/lib/types.ts` line 5: `DriverStatus = 'available' | 'on_way' | 'busy' | 'unavailable'` — no `break`. But `app/driver/page.tsx` line 40, `app/driver/layout.tsx` line 106, `app/driver/profile/page.tsx` line 17 use `{ id: 'break', label: 'בהפסקה' }`, and `DriversMap.tsx` line 20 has `break: '#f97316'`. The DB may support `break`; the type does not.

### 5. `show_price` not implemented in customer portal

**Still exists.** The customer portal tow detail page (`app/customer/tows/[id]/page.tsx`) has `canShow('show_price')` but no section that displays price. `getCustomerTowDetail` does not select `final_price` or `price_breakdown`. The dashboard tow detail page has a visibility override for `show_price`, but the customer portal never renders price, so the override has no effect there.

---

## 8. Vehicle Data from Ministry of Transportation

### Exact fields returned from vehicle lookup

**Source:** `app/lib/vehicle-lookup.ts`, `app/lib/types.ts` (VehicleLookupResult)

**Data structure:**

```ts
{
  found: boolean
  source: 'private' | 'motorcycle' | 'heavy' | 'machinery' | null
  sourceLabel: string
  data: {
    plateNumber: string
    manufacturer: string | null    // tozeret_nm
    model: string | null           // kinuy_mishari / degem_nm
    year: number | null            // shnat_yitzur
    color: string | null           // tzeva_rechev
    fuelType: string | null        // sug_delek_nm
    totalWeight: number | null     // mishkal_kolel
    vehicleType: string | null     // sug_rechev_nm
    driveType: string | null       // hanaa_nm - הנעה
    driveTechnology: string | null  // technologiat_hanaa_nm
    gearType: string | null        // automatic_ind - סוג גיר
    // Machinery only:
    machineryType: string | null   // sug_tzama_nm
    selfWeight: number | null      // mishkal_ton
    totalWeightTon: number | null  // mishkal_kolel_ton
  } | null
  error?: string
}
```

### Where is the API called?

- **Function:** `lookupVehicle(licenseNumber)` in `app/lib/vehicle-lookup.ts`
- **Flow:** 1) Search Supabase `vehicles` table; 2) If not found, call data.gov.il API (resources: private, motorcycle, heavy, machinery)
- **API:** `https://data.gov.il/api/3/action/datastore_search?resource_id=...&filters={"mispar_rechev":"..."}` or `&q=...`
- **Response:** `{ success, result: { records: [...] } }` — raw API returns records with Hebrew field names (tozeret_nm, kinuy_mishari, etc.)

### Which fields are displayed in the form after lookup?

**VehicleLookup.tsx** (lines 130–164): manufacturer, model, year, color, gearType, driveType, driveTechnology, totalWeight, vehicleType (motorcycle), machineryType, selfWeight, totalWeightTon (machinery). Also sourceLabel (icon + type).

### Fields returned but NOT shown to user

- **fuelType** — returned from API but not displayed in VehicleLookup

---

## 9. Timing / "Right Now"

### Default value for tow date and time

- **Default:** Today's date + current time (HH:MM)
- **Source:** `useTowForm.ts` lines 275–299: `setTowDate(today)`, `setTowTime(currentTime)` when no URL params
- **URL params:** `?date=YYYY-MM-DD&time=HH:MM` override defaults

### Is there a "now" button or shortcut?

**Yes.** CustomerSection has an "עכשיו" button (lines 307–322) that sets:
- `towDate` = today
- `towTime` = current time
- `isToday` = true

---

## 10. Storage Address

### Where is the storage/base address stored?

- **Table:** `price_lists`
- **Fields:** `base_address`, `base_lat`, `base_lng`
- **Row:** Company base price list (`customer_company_id` IS NULL)

### Per-company? How loaded?

- **Per-company:** Yes. `getBasePriceList(companyId)` fetches the company's base price list.
- **Loaded in form:** `useTowForm` → `loadData` → `getBasePriceList` → `basePriceList`; passed to SingleRoute as `storageAddress={basePriceList?.base_address || ''}`.

### When "drop to storage" is checked — does destination auto-fill?

**Yes.** SingleRoute.tsx lines 317–325: when checkbox is checked and `storageAddress` exists, `onDropoffAddressChange({ address: storageAddress, isPinDropped: false })` is called.

### When "pick up from storage" — does origin auto-fill?

**No.** Selecting a stored vehicle (`handleSelectStoredVehicle`) only fills vehicle data (plate, manufacturer, model, etc.). The pickup address is not auto-filled. User must manually enter the storage address as pickup if they are picking up from storage.

### Is storage-to-pickup distance calculated and added to total?

**Yes.** When "מהבסיס" (startFromBase) is checked:
- `baseToPickupDistance` = distance from base (base_address) to pickup address
- `useTowForm` effect (lines 219–272) calculates this via `calculateDistance(baseAddress, pickupAddress)`
- In price: `distanceKm = pickupToDropoffKm + baseToPickupKm` — both are added and charged at `price_per_km`

---

## 11. Surcharges — Full List

### Location surcharges

- **Table:** `location_surcharges`
- **Fields:** id, company_id, price_list_id (null = company default), label, surcharge_percent, is_active
- **Applied:** User selects manually; percent applied to subtotal (base + distance). Multiple can be stacked (sum of percents).
- **UI:** SingleRoute — buttons (desktop) or modal (mobile). "📍 תוספות מיקום" — each shows label + percent.

### Time/holiday surcharges

- **Table:** `time_surcharges`
- **Fields:** id, company_id, price_list_id, name, label, time_start, time_end, day_type, surcharge_percent, sort_order, is_active
- **Triggers:** `getActiveTimeSurcharges(time, date, isHoliday)`:
  - **holiday:** day_type === 'holiday' (when isHoliday is true)
  - **saturday:** day_type === 'saturday' (all day)
  - **friday:** day_type === 'friday'; if time_start set, only when time >= time_start
  - **weekday:** day_type = 'weekday'/'all' + time in range [time_start, time_end] (e.g. evening/night)
- **UI:** SingleRoute — "חג" checkbox (isHoliday); active surcharges shown as badges (e.g. "לילה +15%"). Time surcharges are automatic based on tow date/time.

### Service surcharges

- **Table:** `service_surcharges`
- **Fields:** id, company_id, price_list_id, label, price, price_type, unit_label, is_active
- **price_type values:** `'fixed'` | `'per_unit'` | `'manual'`
  - **fixed:** Single price per selection
  - **per_unit:** price × quantity (user selects quantity)
  - **manual:** User enters amount manually
- **UI:** ServiceSurchargeSelector in SingleRoute — buttons for each service; per_unit shows quantity selector; manual shows price input.

### Other surcharge types?

- **Truck type surcharges** (`truck_type_surcharges`): Exist in DB, loaded in price-lists page — **NOT used** in tow form price calculation.
- **Distance tiers** (`distance_tiers`): Exist in DB — **NOT used**; flat `price_per_km` is used instead.
- **night_surcharge_percent, weekend_surcharge_percent** (price_lists): Exist — **NOT used**; time_surcharges table is used instead.

### How each appears in form UI

| Type | UI |
|------|-----|
| Location | Buttons in SingleRoute — "תוספות מיקום" (e.g. "מרכז +10%") |
| Time | Auto from date/time; "חג" checkbox; badges when active (e.g. "לילה +15%") |
| Service | ServiceSurchargeSelector — list of services with add/remove; per_unit shows quantity; manual shows input |

---

## 12. Driver Assignment Flow (Confirmed)

### Is driver assignment part of the tow creation form?

**No.** The creation form has no driver selector. Only `preSelectedDriverId` from URL (`?driver=...`) when coming from calendar.

### Where does driver assignment happen?

- **Page:** `/dashboard/tows/[id]` (tow detail page)
- **Component:** `DriverSchedulePicker` (first step) + inline truck selector (second step)
- **Flow:** Click "שבץ נהג" → modal opens → DriverSchedulePicker shows drivers by date → select driver → select truck → "שבץ נהג" / "שנה נהג"

### What data is shown when assigning?

- **Driver name, phone**
- **Truck types** (e.g. "מוביל", "רמסע") — from assigned trucks
- **Schedule:** Timeline (06:00–20:00) with existing tows for that driver
- **Availability:** "פנוי" or "X גרירות" badge
- **Required truck:** Banner if `required_truck_types` — "נדרש גרר מסוג: ..."
- **Not shown:** Distance to pickup, driver status (available/busy), truck plate in list (only after selecting driver)

---

## 13. Payment Options

### All payment method options

| Value | Label | Source |
|-------|-------|--------|
| `cash` | מזומן | PaymentSection, useTowForm |
| `credit` | אשראי | PaymentSection |
| `invoice` | חשבונית | PaymentSection |

**DB:** `tows.payment_method` stores the string value (no enum constraint in types).

### Separate "invoice" option for registered customers?

**Yes.** "חשבונית" is a separate option. It is not restricted to registered customers — any tow can use it.

### Fields collected per payment method

| Method | Fields |
|--------|--------|
| **All** | invoiceName (שם לחשבונית) — always shown |
| **cash** | None |
| **credit** | creditCardNumber, creditCardExpiry, creditCardCvv, creditCardId — **shown in form but NOT saved to DB** |
| **invoice** | invoiceName — only `payment_method` and `invoice_name` are saved |

---

## 14. Price Calculation — Missing Pieces

### Surcharge types in DB but not in form UI

- **distance_tiers:** Tiered price_per_km by km range — not used; flat price_per_km used.
- **truck_type_surcharges:** Surcharge by truck type — not used.
- **night_surcharge_percent, weekend_surcharge_percent** (price_lists): Not used; `time_surcharges` table used instead.

### Is default_vat_percent used?

**No.** Tow price calculation uses hardcoded `0.18` (18%) everywhere. `company_settings.default_vat_percent` exists and is used in settings/invoices but not in tow pricing.

### Minimum price per tow?

**Yes.** `price_lists.minimum_price` — used in `useTowPricing` (lines 147, 201): `minimumPrice = activePriceList?.minimum_price || 250`. If `total < minimumPrice`, returns `minimumPrice`. Default 250 when not set.

### "Base departure" (יציאה מבסיס) charge — how calculated?

**Not a separate charge.** When "מהבסיס" is checked:
1. `baseToPickupDistance` = distance from base to pickup (Google Maps).
2. `distanceKm = pickupToDropoffKm + baseToPickupKm`.
3. `distancePrice = distanceKm × price_per_km`.

So the base-to-pickup segment is treated as extra km and charged at the same price_per_km. The base address is the same as the storage address (`base_address` from price_lists).

---

## 15. Data Loading — What Gets Fetched When the Form Opens

### loadData (useTowForm.ts lines 326–363)

Called in `useEffect` when `companyId` is set. Runs **upfront** on form mount.

| Query | Table(s) | Fields | Result used for |
|-------|----------|--------|-----------------|
| `getCustomers(companyId)` | `customer_company` + `customers` + `tows` + `invoices` | id, payment_terms, credit_limit, is_active, customer(id, customer_type, name, id_number, phone, email, address, notes, created_at, updated_at) | Customer dropdown; tow counts, open balance |
| `getDrivers(companyId)` | `drivers` + `users` + `driver_truck_assignments` + `tow_trucks` + `tows` | drivers.*, user(id, email, phone, full_name, id_number, address, is_active), current_truck, today_tows_count | Pre-selected driver banner |
| `getTrucks(companyId)` | `tow_trucks` + `driver_truck_assignments` + `tows` | tow_trucks.*, assigned_driver, today_tows_count | Not used in form (drivers page, driver assignment) |
| `getBasePriceList(companyId)` | `price_lists` | * (all) | base_price_*, price_per_km, minimum_price, base_address, base_lat, base_lng; storage address; base-to-pickup distance |
| `getFixedPriceItems(companyId)` | `fixed_price_items` | * | PriceSelector fixed-price options |
| `getCustomersWithPricing(companyId)` | `customer_company` + `customers` + `customer_price_items` + `price_lists` + `time_surcharges` + `location_surcharges` + `service_surcharges` | Full customer pricing structure | selectedCustomerPricing when customer selected; price_mode recommended_customer |
| `getTimeSurcharges(companyId)` | `time_surcharges` | * where price_list_id IS NULL | Auto time surcharges (night, friday, saturday, holiday) |
| `getLocationSurcharges(companyId)` | `location_surcharges` | * where price_list_id IS NULL | Location surcharge buttons |
| `getServiceSurcharges(companyId)` | `service_surcharges` | * where price_list_id IS NULL | Service surcharge selector |

### Lazy loading (depends on selection)

| Trigger | Query | Table | Result |
|---------|-------|-------|--------|
| `selectedCustomerId` changes | `getCustomerStoredVehicles(companyId, selectedCustomerId)` | `stored_vehicles` | customerStoredVehicles for "pick from storage" |
| `editTowId` set | `getTowWithPoints(editTowId)` | `tows` + `tow_points` + `vehicles` + `customers` | Populate form for edit |

### Dependencies

- **companyId:** All loadData queries.
- **selectedCustomerId:** getCustomerStoredVehicles; also drives selectedCustomerPricing from customersWithPricing (in-memory).

---

## 16. Truck Types — Exact Values

### TowTruckTypeSelector (form) — hardcoded

**File:** `app/components/tow-forms/shared/TowTruckTypeSelector.tsx`

| id | label |
|----|-------|
| `wheel_lift_cradle` | משקפיים |
| `flatbed` | רמסע |
| `carrier` | מובילית |

Only these 3 types are selectable in the tow form.

### DriverSchedulePicker — extended labels

**File:** `app/components/DriverSchedulePicker.tsx`

| id | label |
|----|-------|
| carrier | מוביל |
| carrier_large | מוביל גדול |
| crane_tow | מנוף |
| dolly | דולי |
| flatbed | רמסע |
| heavy_equipment | ציוד כבד |
| heavy_rescue | חילוץ כבד |
| wheel_lift_cradle | משקפיים |

### lib/types.ts TruckType

```ts
'TruckType' = 'carrier' | 'carrier_large' | 'crane_tow' | 'dolly' | 'flatbed' | 'heavy_equipment' | 'heavy_rescue' | 'wheel_lift_cradle'
```

### Required truck type on tow

- **Field:** `tows.required_truck_types` (string[] | null)
- **Table:** `tows`
- **Set by:** TowTruckTypeSelector → `requiredTruckTypes` → `prepareTowData` → `createTow`/`updateTow`

### tow_trucks table

**Table:** `tow_trucks`  
**Fields:** id, company_id, plate_number, truck_type, vehicle_capacity, max_weight_kg, manufacturer, model, year, color, license_expiry, insurance_expiry, license_photo_url, tachograph_expiry, tachograph_photo_url, engineer_report_expiry, engineer_report_photo_url, last_winter_inspection, notes, is_active, created_at, updated_at

`truck_type` is a string; no DB enum. Drivers are matched to tows by `required_truck_types` ∩ driver's assigned trucks' `truck_type`.

### Form handling

TowTruckTypeSelector: multi-select buttons (desktop) or modal (mobile). Selected IDs stored in `requiredTruckTypes`. Validation: at least one required before save.

---

## 17. Address Input — Full Implementation

### AddressInput component

**File:** `app/components/tow-forms/routes/AddressInput.tsx`

- **Google Places Autocomplete:** Yes. `new google.maps.places.Autocomplete(inputRef.current, { componentRestrictions: { country: 'il' }, fields: ['formatted_address', 'name', 'place_id', 'geometry'], types: ['establishment', 'geocode'] })`
- **Initialization:** In `useEffect` after `loadGoogleMaps()`; runs when `inputRef.current` exists and `!readOnly`.
- **Place change:** On `place_changed`, builds `AddressData` with address, placeId, lat, lng and calls `onChange`.

### Pin drop ("הנח סיכה")

**Component:** `PinDropModal` (`app/components/tow-forms/shared/PinDropModal.tsx`)

- **Usage:** AddressInput has `onPinDropClick`; SingleRoute passes `onPinDropClick={(field) => setPinDropModal({ isOpen: true, field })}` for pickup/dropoff.
- **Flow:** User clicks MapPin → PinDropModal opens → Google Map with draggable marker → user drags or clicks → reverse geocode → onConfirm returns `{ address, lat, lng, isPinDropped: true }`.
- **Default:** Tel Aviv (32.0853, 34.7818); optional geolocation.

### Stored data

**Form state:** `pickupAddress`, `dropoffAddress` as `AddressData { address, placeId?, lat?, lng?, isPinDropped? }`  
**DB:** `tow_points.address`, `tow_points.lat`, `tow_points.lng` (no placeId or isPinDropped)

### Same component for pickup, dropoff, base?

- **Pickup/dropoff:** Same `AddressInput` with `value={pickupAddress}` / `value={dropoffAddress}`.
- **Base:** Not an input. Base address comes from `basePriceList.base_address` (price_lists). The price-lists page uses a separate address input for base location.

---

## 18. Location Surcharges — Full Details

### Table structure

**Table:** `location_surcharges`  
**Fields:** id, company_id, price_list_id (null = company default), label, surcharge_percent, is_active

**Query:** `getLocationSurcharges(companyId)` — `price_list_id IS NULL` (company-level only in form).

### Per price_list or per company?

- Company default: `price_list_id IS NULL`.
- Customer price lists: `price_list_id` = customer's price_list.id (from getCustomersWithPricing).

### Form display

**SingleRoute.tsx** (lines 356–416):

- **Desktop:** Buttons — "📍 תוספות מיקום:" with label + percent per surcharge.
- **Mobile:** Button opens modal; same options as list.

### Multiple selection

Yes. `toggleLocationSurcharge` adds/removes by id; `selectedLocationSurcharges` is string[]. Percents are summed in price calculation.

---

## 19. Time Surcharges — Full Details

### Table structure

**Table:** `time_surcharges`  
**Fields:** id, company_id, price_list_id, name, label, time_description, time_start, time_end, day_type, surcharge_percent, sort_order, is_active

### day_type values

From SurchargesTab and getActiveTimeSurcharges:

| Value | Meaning |
|-------|---------|
| `all` | כל הימים — weekday with time range |
| `weekday` | ימי חול — weekday with time range |
| `friday` | שישי |
| `saturday` | שבת |
| `holiday` | חג |

### getActiveTimeSurcharges logic (price-lists.ts 563–628)

1. **holiday:** If `isHoliday`, return surcharges with `day_type === 'holiday'`.
2. **saturday:** If day is Saturday, return surcharges with `day_type === 'saturday'` (no time check).
3. **friday:** If day is Friday:
   - If surcharge has `time_start`: apply only when `time >= time_start`.
   - Else: apply all day.
4. **weekday (Sun–Thu):** Return surcharges with `day_type` not saturday/friday/holiday and `time` in [time_start, time_end] (supports overnight ranges).

### Multiple time surcharges — "max"

`calculateTimeSurchargePercent` uses `Math.max(...activeSurcharges.map(s => s.surcharge_percent))` — only the highest percent is applied, not summed.

### User override

Time surcharges are automatic. User can only set `isHoliday`. There is no UI to remove or override an active time surcharge.

### Form display

**SingleRoute.tsx** (lines 371–378): Badges showing active surcharges, e.g. "לילה (+15%)". Plus holiday checkbox.

---

## 20. Service Surcharges — Full Details

### Table structure

**Table:** `service_surcharges`  
**Fields:** id, company_id, price_list_id, label, price, price_type, unit_label, is_active

### price_type values

| Value | Behavior |
|-------|----------|
| `fixed` | Single price per selection |
| `per_unit` | price × quantity (user sets quantity) |
| `manual` | User enters amount |

### ServiceSurchargeSelector (app/components/tow-forms/shared/ServiceSurchargeSelector.tsx)

- **fixed:** Toggle button; price = `service.price`.
- **per_unit:** Toggle + quantity stepper; price = `service.price * (quantity || 1)`.
- **manual:** Toggle + number input; price = `selected.manualPrice || 0`.

### Price contribution

- **fixed:** `surcharge.price`
- **per_unit:** `surcharge.price * (selected.quantity || 1)`
- **manual:** `selected.manualPrice || 0`

---

## 21. Price Lists Page — Full Read

### Sections (tabs)

1. **מחירון בסיס (Base)** — BasePriceTab  
2. **מחירון כללי (Fixed)** — FixedPriceTab  
3. **תוספות (Surcharges)** — SurchargesTab  
4. **מחירוני לקוחות (Customers)** — CustomerPricingTab + PriceSimulator

### price_list fields (BasePriceList)

| Field | Purpose |
|-------|---------|
| base_price_private | רכב פרטי |
| base_price_motorcycle | דו גלגלי |
| base_price_heavy | רכב כבד |
| base_price_machinery | צמ"ה |
| price_per_km | Per km |
| minimum_price | Floor price |
| base_address, base_lat, base_lng | Base/storage location |
| night_surcharge_percent, weekend_surcharge_percent | In DB but not used in tow pricing |

### Per-vehicle-type base prices

Yes. Four base prices: private, motorcycle, heavy, machinery. No per-truck-type base price.

### Customer vs company price list

- **Company:** `price_lists` where `customer_company_id IS NULL`.
- **Customer:** `price_lists` where `customer_company_id` = customer_company.id. Can override base prices, price_per_km, minimum_price, and have own time/location/service surcharges.

---

## 22. Customer Data — What Is Loaded When a Customer Is Selected

### getCustomersWithPricing

**Returns:** `CustomerWithPricing[]` with:

- customer_company: id, customer_id, company_id, discount_percent
- customer: id, name, customer_type
- price_items: CustomerPriceItem[] (customer_price_items)
- price_list: BasePriceList | null (customer's price_lists row)
- customer_time_surcharges, customer_location_surcharges, customer_service_surcharges (by price_list_id)

### Customer-specific pricing

- price_list (base prices, price_per_km, minimum_price)
- price_items (fixed price items)
- customer_time_surcharges, customer_location_surcharges, customer_service_surcharges

### Known issue

When `priceMode === 'recommended_customer'`, useTowPricing swaps in customer surcharges. getCustomersWithPricing does load customer surcharges via price_list_id. Potential gap: customers without a full price_list (only discount + price_items) may not get customer surcharges, but that is by design.

### Stored vehicles

`getCustomerStoredVehicles(companyId, customerId)` → `stored_vehicles` filtered by customer_id and current_status = 'stored'. Returns plate_number, vehicle_data, vehicle_condition, vehicle_code, etc.

---

## 23. Contact Fields

### Pickup and dropoff contacts

**Pickup:** pickupContactName, pickupContactPhone  
**Dropoff:** dropoffContactName, dropoffContactPhone

### "Same as customer" button

Yes. `copyFromCustomer('pickup')` / `copyFromCustomer('dropoff')` copies customerName → contactName and customerPhone → contactPhone.

### DB storage

`tow_points.contact_name`, `tow_points.contact_phone` for each point.

---

## 24. Form State — Complete List (useTowForm.ts)

### State variables (type and purpose)

| State | Type | Saved to DB? | Purpose |
|-------|------|--------------|---------|
| showAssignNowModal | boolean | No | Post-save modal |
| savedTowId | string | No | ID of saved tow |
| saving, error | boolean, string | No | UI |
| customers | CustomerWithDetails[] | No | Dropdown |
| drivers, trucks | … | No | Banner, assignment |
| selectedCustomerId | string \| null | Yes (customer_id) | Selected customer |
| preSelectedDriverId | string \| null | Yes (driver_id) | From URL |
| basePriceList | BasePriceList \| null | No | Pricing, base address |
| fixedPriceItems | FixedPriceItem[] | No | Fixed options |
| customersWithPricing | CustomerWithPricing[] | No | Customer pricing |
| selectedCustomerPricing | CustomerWithPricing \| null | No | Active pricing |
| timeSurchargesData, locationSurchargesData, serviceSurchargesData | …[] | No | Surcharge options |
| selectedLocationSurcharges | string[] | Yes (price_breakdown) | Selected location surcharges |
| selectedServices | SelectedService[] | Yes (price_breakdown) | Selected services |
| isHoliday | boolean | Yes (price_breakdown) | Holiday flag |
| activeTimeSurchargesList | TimeSurcharge[] | Yes (price_breakdown) | Active time surcharges |
| priceMode | string | Yes | recommended/custom/etc |
| selectedPriceItem | PriceItem \| null | Yes | Fixed option |
| customPrice | string | Yes | Manual price |
| customPriceIncludesVat | boolean | No | VAT handling |
| customerOrderNumber | string | Yes | Order # |
| customerName, customerPhone, customerEmail, customerAddress | string | Yes | Customer |
| towDate, towTime | string | Yes | scheduled_at |
| isToday | boolean | No | UI |
| towType | TowType | Yes (tow_type) | single/custom/exchange |
| routePoints, customRouteData | … | Yes | Custom route |
| vehiclePlate, vehicleCode, vehicleData, vehicleType | … | Yes | Vehicle |
| selectedDefects | string[] | Yes (tow_reason) | Defects |
| requiredTruckTypes | string[] | Yes | Truck types |
| truckTypeError | boolean | No | Validation |
| customerStoredVehicles | …[] | No | Storage options |
| selectedStoredVehicleId | string \| null | Yes | Release on save |
| dropoffToStorage | boolean | Yes | Add to storage |
| storageLoading | boolean | No | UI |
| pickupAddress, dropoffAddress | AddressData | Yes | tow_points |
| distance, baseToPickupDistance | DistanceResult \| null | Yes (price_breakdown) | Distance |
| startFromBase | boolean | Yes | Base departure |
| pickupContactName, pickupContactPhone | string | Yes | tow_points |
| dropoffContactName, dropoffContactPhone | string | Yes | tow_points |
| notes | string | Yes | tows.notes |
| invoiceName, paymentMethod | string | Yes | tows |
| creditCard* | string | No | Not persisted |
| pinDropModal, pinDropResult | … | No | Pin drop UI |

### Validation on save (useTowSave)

- `requiredTruckTypes.length > 0` — must select truck type
- `dropoffToStorage && !vehiclePlate` — plate required for storage
- `towType === 'single' \|\| 'custom'` — exchange not supported for save

---

## 25. Anything You Might Be Missing

### Hidden / edge-case behavior

1. **Exchange tow type:** UI exists but save is blocked (`towType !== 'single' && towType !== 'custom'`).
2. **customRouteData.vehicles:** RouteBuilder fills `{ type, isWorking }`; type drives base price; isWorking not used in pricing.
3. **priceMode recommended_customer:** Swaps to customer price list and surcharges; clears selected location/service surcharges.
4. **customer_company.id vs customer_id:** getCustomersWithPricing uses `customer_company.id` for price_list mapping; matching to form uses `customer_id`.

### Fetched but unused in form

- **trucks:** Loaded in loadData but not used in tow form (used on drivers page, driver assignment).
- **distance_tiers, truck_type_surcharges:** Loaded on price-lists page only; not used in tow pricing.
- **night_surcharge_percent, weekend_surcharge_percent:** On price_lists, not used.

### Data not shown

- **fuelType** from vehicle lookup.
- **placeId** from address (not stored in DB).
