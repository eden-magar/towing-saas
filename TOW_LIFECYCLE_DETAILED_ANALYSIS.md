# Tow Lifecycle — Detailed Code Analysis

**Read-only analysis. No code changes.**

This document reports actual code findings from reading every relevant file.

---

## 1. Driver App — Every File

### 1.1 `app/driver/page.tsx`

**What it does:** Driver home page. Shows active shift banner, driver status, truck info, stats (today/week), active task banner, schedule of assigned/in_progress tows, driver_tasks (separate system), approved rejection notifications, NewTaskModal.

**DB queries:**
- `getDriverByUserId(user.id)` — drivers
- `getDriverTasksForDriver(driver.id)` — driver_tasks
- `getActiveShift(driver.id)` — driver_shifts
- `getDriverTasks(driver.id)` — tows + tow_vehicles + tow_legs + tow_points
- `getApprovedRejectionRequestsForDriver(driver.id)` — tow_rejection_requests
- `getDriverStats(driver.id)` — tows
- `supabase.from('drivers').update({ status })` — on status change
- `supabase.from('tows')` — realtime filter `driver_id=eq.${driverInfo.id}`

**State:** driverInfo, tasks, stats, loading, error, showStatusModal, showNewTaskModal, selectedTask, isProcessing, activeShift, driverTasks, approvedRejectionNotifications

**User actions:** Start shift, end shift, change status, refresh, click task (open modal or navigate), acknowledge rejection

---

### 1.2 `app/driver/layout.tsx`

**What it does:** Wrapper for driver app. Auth guard, driver info, notifications dropdown, status picker, bottom nav (Home, Tasks, Cash, History, Profile). Hides bottom nav on task pages.

**DB queries:**
- `getDriverByUserId(user.id)` — drivers
- `supabase.from('notifications').select('*').eq('user_id', user.id)` — notifications
- `supabase.from('drivers').update({ status })` — status change

**State:** driverInfo, notifications, showNotifications, loading, showStatusPicker

**User actions:** Change status, mark notification read, navigate

---

### 1.3 `app/driver/task/[id]/page.tsx`

**What it does:** Main tow task flow. Step-based: StepOnTheWay → StepCamera → StepDelivery → StepComplete. Handles rejection modal.

**DB queries:**
- `getTaskDetail(id)` — tows + tow_vehicles + tow_legs + tow_points + customer + truck
- `getDriverByUserId(user.id)` — drivers
- `getPendingRejectionRequest(id, driver.id)` — tow_rejection_requests
- `updatePointStatus(pointId, 'arrived')` — tow_points
- `updatePointStatus(pointId, 'completed', recipientName, recipientPhone, notes)` — tow_points
- `updateTaskStatus(task.id, 'completed')` — tows
- `updateTowCashPayment`, `createCashCollection` — driver_cash_transactions, tows
- `rejectTask(task.id, driver.id, companyId, rejectReason, rejectNote)` → creates tow_rejection_requests
- `cancelRejectionRequest(pendingRejectionRequestId)` — tow_rejection_requests

**State:** task, loading, currentPointIndex, pointStep, isCompleted, showRejectModal, rejectReason, rejectNote, rejecting, rejectionPending, pendingRejectionRequestId

**User actions:** Arrived, camera complete, delivery complete, reject tow, cancel rejection, go home

---

### 1.4 `app/driver/task/[id]/components/StepOnTheWay.tsx`

**Exact code logic:**
- Renders title "בדרך לאיסוף" or "בדרך לפריקה" based on `point.point_type`
- Shows vehicles list, contact (name, phone), address, notes
- Buttons: "הגעתי" → calls `onArrived()` (parent's `handleArrived`), "נווט" → `openWaze(point.address)`
- **DB call:** None directly. Parent's `handleArrived` calls `updatePointStatus(currentPoint.id, 'arrived')` in `app/lib/queries/driver-tasks.ts`:

```ts
// driver-tasks.ts updatePointStatus
await supabase.from('tow_points').update({
  status: 'arrived',
  arrived_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
}).eq('id', pointId)
```

---

### 1.5 `app/driver/task/[id]/components/StepCamera.tsx`

**Exact code logic:**

**Photos per vehicle:** `minPhotosPerVehicle = 4` (line 101)

**image_type values written:** Only `before_pickup` or `before_dropoff`:
```ts
const getImageType = (): TowImageType => {
  return isPickup ? 'before_pickup' : 'before_dropoff'
}
```
`isPickup = point.point_type === 'pickup'`

**Upload flow step by step:**
1. Driver captures via camera or file input. Images stored in `imagesByVehicle` state: `Record<string, { file: File; url: string }[]>` keyed by `plate_number`.
2. On "אישור והמשך", `handleSaveAll()` runs.
3. For each vehicle and each image: `compressImage(img.file)` then `uploadTowImage(towId, userId, imageType, compressed, point.id, vehicles.find(v => v.plate_number === vehicleKey)?.id)`.
4. `uploadTowImage` in driver-tasks.ts:
   - `fileName = ${towId}/${imageType}_${Date.now()}.jpg`
   - `supabase.storage.from('tow-images').upload(fileName, imageFile)`
   - `getPublicUrl('tow-images', fileName)`
   - `supabase.from('tow_images').insert({ tow_id, tow_point_id, tow_vehicle_id, uploaded_by, image_url, image_type, notes })`
5. After all uploads, `onComplete()` → parent sets `pointStep = 'delivery'`

**Per-vehicle:** Yes. Loops over `vehicles`, 4 photos per vehicle. `tow_vehicle_id` passed to insert.

---

### 1.6 `app/driver/task/[id]/components/StepDelivery.tsx`

**Exact code logic:**
- Renders "סיום העמסה" (pickup) or "פרטי מסירה" (dropoff)
- If `isLastPoint`: shows cash received toggle + amount input
- If dropoff: recipient name (required), phone, "זהה למזמין" checkbox
- Notes textarea always
- Button: "המשך לנקודה הבאה" (pickup) or "סיים גרירה" (dropoff)
- **DB call:** None directly. Calls `onComplete(recipientName, recipientPhone, notes, cashCollected)`. Parent's `handleDeliveryComplete` → `completeCurrentPoint` → `updatePointStatus(pointId, 'completed', recipientName, recipientPhone, notes)` and if last point `updateTaskStatus(task.id, 'completed')`.

---

### 1.7 `app/driver/task/[id]/components/StepComplete.tsx`

**Exact code logic:**
- Renders success message "הגרירה הושלמה!" and "חזור לדף הבית" button
- **DB call:** None. Tow was already marked complete in parent's `completeCurrentPoint` when last point was completed:
```ts
await updateTaskStatus(task.id, 'completed')
// driver-tasks.ts:
await supabase.from('tows').update({
  status: 'completed',
  completed_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
}).eq('id', towId)
```

---

### 1.8 `app/components/NewTaskModal.tsx` (assigned tow display)

**What it does:** Modal showing new assigned tow. Time, points count, vehicles count, vehicle card, pickup/dropoff addresses, Waze/phone buttons, notes. Actions: "קבל והתחל עכשיו" / "קבל לתור" / "בקש לדחות".

**DB calls:**
- `getPendingRejectionRequest(task.id, driverId)` — tow_rejection_requests
- `createRejectionRequest(task.id, driverId, companyId, selectedReason, rejectNote)` — tow_rejection_requests
- **Accept:** Direct `supabase.from('tows').update({ status: hasActiveTask ? 'assigned' : 'in_progress', ...(started_at if in_progress) }).eq('id', task.id)` — NOT acceptTask()

**State:** modalState ('new_task'|'reject_reason'|'pending_approval'), selectedReason, rejectNote, isProcessing, hasPendingRequest

---

### 1.9 Other driver files

| File | Purpose | DB |
|------|---------|-----|
| `app/driver/cash/page.tsx` | Cash balance, transactions, transfer | getDriverByUserId, getDriverCashBalance, getDriverCashTransactions, createCashTransfer |
| `app/driver/history/page.tsx` | Completed/cancelled tows last 30 days | tows, tow_vehicles, tow_points, tow_legs |
| `app/driver/profile/page.tsx` | Profile, status, truck, stats | getDriverByUserId, getDriverStats, tows count |
| `app/driver/stats/page.tsx` | Stats charts | tows |
| `app/driver/tasks/page.tsx` | driver_tasks list (NOT tows) | getDriverTasksForDriver |
| `app/driver/task-item/[id]/page.tsx` | Single driver_task (NOT tow) | getDriverTasksForDriver, updateDriverTaskStatus |
| `app/driver/navigation/[id]/page.tsx` | Waze-style nav for tow | getTaskDetail, updateLegStatus, updateTaskStatusWithHistory — uses tow_legs |

---

## 2. tow_images Table

**No migration files in repo.** Schema inferred from code.

**Insert (driver-tasks.ts lines 706-718):**
```ts
await supabase.from('tow_images').insert({
  tow_id: towId,
  tow_point_id: pointId || null,
  tow_vehicle_id: vehicleId || null,
  uploaded_by: userId,
  image_url: urlData.publicUrl,
  image_type: imageType,
  notes: notes || null
})
```

**Types (driver-tasks.ts TowImage, types.ts TowImage):**
- id, tow_id, tow_point_id (driver-tasks; types.ts TowImage lacks it), tow_vehicle_id, uploaded_by, image_url, image_type, notes, created_at

**image_type values (TowImageType):** `'before_pickup' | 'after_pickup' | 'before_dropoff' | 'after_dropoff' | 'damage' | 'other'`

**StepCamera writes only:** `before_pickup`, `before_dropoff`

**tow_point_id:** References `tow_points.id`. Which point (pickup/dropoff) the photo was taken at.

**tow_vehicle_id:** References `tow_vehicles.id`. Which vehicle the photo is for.

---

## 3. tow_points Table

**Insert (tows.ts lines 506-520):**
```ts
await supabase.from('tow_points').insert({
  id: pointId,
  tow_id: towId,
  point_order: point.point_order,
  point_type: point.point_type,
  address: point.address,
  lat: point.lat,
  lng: point.lng,
  contact_name: point.contact_name,
  contact_phone: point.contact_phone,
  notes: point.notes,
  status: 'pending'
})
```

**Types (TowPoint, types.ts):** id, tow_id, point_order, point_type, address, lat, lng, contact_name, contact_phone, status, arrived_at, completed_at, recipient_name, recipient_phone, notes, created_at, updated_at

**point_type:** `'pickup' | 'dropoff'` (PointType)

**point_order:** Order of the point in the route.

**Simple tow:** Typically 2 rows: point_order 0 pickup, point_order 1 dropoff.

**Multi-vehicle tow:** Same structure. `tow_point_vehicles` links points to vehicles: `tow_point_id`, `tow_vehicle_id`, `action` (pickup/dropoff).

---

## 4. tow_vehicles Table

**Per-tow.** One row per vehicle. `tow_id`, `order_index`.

**Types (TowVehicle):** id, tow_id, plate_number, manufacturer, model, year, vehicle_type, color, is_working, tow_reason, notes, order_index, created_at

**Multi-vehicle:** Multiple rows per tow_id with different order_index.

**Simple tow:** One row.

---

## 5. Customer Portal Permissions

**portal_settings:** Column on `customers` table. JSONB. Loaded via:
```ts
.from('customers').select('..., portal_settings')
```
Updated in dashboard customers/[id]: `supabase.from('customers').update({ portal_settings: newSettings })`

**visibility_overrides:** Column on `tows` table. JSONB. Per-tow override. Updated in dashboard tows/[id] via `updateTow({ visibilityOverrides })`.

**Keys used in dashboard customers settings and tow detail overrides:**
- show_photos, show_price, show_driver_info, show_driver_phone, show_status_history, show_vehicles, show_notes

**getCustomerTowDetail SELECT:**
```
id, order_number, status, tow_type, scheduled_at, created_at, started_at, completed_at, notes, visibility_overrides,
driver:drivers(user:users(full_name, phone)),
vehicles:tow_vehicles(plate_number, manufacturer, model, color),
points:tow_points(id, point_order, point_type, address, status, arrived_at, completed_at, contact_name, contact_phone, recipient_name, recipient_phone, notes),
images:tow_images(id, image_url, image_type, tow_point_id, tow_vehicle_id, created_at)
```
**Does NOT select:** final_price, price_breakdown

**Customer tow detail page renders (with canShow):**
- Header: order_number, status, dates, progress bar
- Driver card: if canShow('show_driver_info')
- Driver phone: if canShow('show_driver_phone')
- Vehicles: if canShow('show_vehicles')
- Timeline: if canShow('show_status_history')
- All images: if canShow('show_photos')
- Notes: if canShow('show_notes')

**Flags checked in UI:** show_driver_info, show_driver_phone, show_vehicles, show_status_history, show_photos, show_notes

**show_price:** Defined in settings, canShow checks it, but **no UI block** renders price. getCustomerTowDetail does not load final_price. **Never shown.**

---

## 6. Rejection Flow

**tow_rejection_requests columns (from insert/update):** tow_id, driver_id, company_id, reason, reason_note, status, reviewed_by, reviewed_at, reassigned_to, created_at

**Driver submits:**
- NewTaskModal: `createRejectionRequest(task.id, driverId, companyId, selectedReason, rejectNote)` — selectedReason is RejectionReason (break, vehicle_issue, too_far, personal, other)
- Task flow: `rejectTask(task.id, driver.id, companyId, rejectReason, rejectNote)` — calls createRejectionRequest with **reason always 'other'** and note `${reason} - ${note}` (rejectReason is the REJECTION_REASONS key the driver selected). So task-flow rejection loses the specific reason.

**Dispatcher approves (dashboard/page.tsx):**
- `approveRejectionRequest(selectedRequest.id, user?.id, approvalAction === 'reassign' ? selectedNewDriver : undefined)`
- If reassign: `tows` update `driver_id: reassignToDriverId`, `status: 'assigned'`
- If unassign: `tows` update `driver_id: null`, `status: 'pending'`
- tow_rejection_requests update `status: 'approved'`, reviewed_by, reviewed_at, reassigned_to

**Dispatcher denies:**
- `denyRejectionRequest(req.id, user?.id)` — tow_rejection_requests update `status: 'rejected'`, reviewed_by, reviewed_at
- **Tow unchanged.** Driver keeps the tow.

**Gaps:** cancelRejectionRequest sets status to 'cancelled' but approval flow expects pending/approved/rejected. cancelRejectionRequest exists for driver to cancel their own pending request.

---

## 7. Realtime Subscriptions

| File | Channel | Table | Event | Handler |
|------|---------|-------|-------|---------|
| app/driver/page.tsx | driver-realtime-${driverId} | tows | * | loadData() |
| app/dashboard/page.tsx | dashboard-realtime-${companyId} | tows | * | loadData(); loadCalendar() |
| app/dashboard/page.tsx | (same) | tow_rejection_requests | * | loadData() |
| app/dashboard/page.tsx | (same) | drivers | * | loadData() |
| app/dashboard/page.tsx | (same) | driver_shifts | * | loadData() |
| app/dashboard/page.tsx | (same) | driver_tasks | * | loadData() |
| app/dashboard/tows/[id]/page.tsx | tow-realtime-${towId} | tow_points | * | loadData() |
| app/dashboard/tows/[id]/page.tsx | (same) | tow_images | * | loadData() |
| app/dashboard/tows/[id]/page.tsx | (same) | tows | UPDATE | loadData() |
| app/customer/page.tsx | customer-tows-realtime | tows | * | getCustomerTows + getCustomerStats |
| app/customer/tows/[id]/page.tsx | customer-tow-${towId}-realtime | tows | * | getCustomerTowDetail |
| app/customer/tows/[id]/page.tsx | (same) | tow_points | * | getCustomerTowDetail |
| app/customer/tows/[id]/page.tsx | (same) | tow_images | * | getCustomerTowDetail |
| app/dashboard/drivers/page.tsx | drivers-location-${companyId} | (driver_locations?) | * | — |
| app/components/DriverHoursTab.tsx | driver-shifts-${companyId} | driver_shifts | * | — |

---

## 8. Storage Integration with Tow Lifecycle

**releaseVehicleFromStorage:**
- **When:** `useTowSave.handleSave` after `createTow(towData)` when `selectedStoredVehicleId && companyId`
- **Only on tow creation.** Not on edit, not on completion.
- Calls `supabase.rpc('release_vehicle_from_storage', { p_stored_vehicle_id, p_tow_id, p_performed_by, p_notes })`

**addVehicleToStorage:**
- **When:** `useTowSave.handleSave` after `createTow` when `dropoffToStorage && companyId`
- **Only on tow creation** (form option "dropoff to storage").
- Calls `supabase.rpc('add_vehicle_to_storage', { ... })`

**Tow marked complete:** Nothing happens to storage. No release, no add.

**Tow cancelled:** `updateTowStatus(tow.id, 'cancelled')` only. No storage logic.

**Supabase triggers/functions:** Storage uses RPCs `add_vehicle_to_storage`, `release_vehicle_from_storage`. No triggers on tow status change found in app code.

---

*End of detailed analysis.*
