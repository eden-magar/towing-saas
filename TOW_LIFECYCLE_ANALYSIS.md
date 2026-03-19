# Tow Lifecycle — Full Analysis Across All Interfaces

**Read-only analysis. No code changes.**

This document maps the entire tow lifecycle across dashboard, driver app, and customer portal. It is the foundation for any redesign.

---

## 1. Full Tow Lifecycle — Status Flow

### 1.1 All Possible Tow Statuses

**Defined in `app/lib/types.ts` (TowStatus):**
- `quote`
- `pending`
- `assigned`
- `in_progress`
- `completed`
- `cancelled`

**Actual string usage in codebase:**

| Status       | Where used |
|-------------|------------|
| `quote`     | types.ts only — not used in UI or queries |
| `pending`   | createTow (when no driver), getTows, getDriverTasks, dashboard, calendar, customer portal |
| `assigned`  | createTow (when driver assigned), assignDriver, NewTaskModal (accept to queue), getDriverTasks filter |
| `in_progress` | NewTaskModal (accept & start), updateTaskStatus, StepDelivery (complete tow), getDriverTasks filter |
| `completed` | updateTaskStatus, dashboard, reports, invoices |
| `cancelled` | updateTowStatus (dashboard cancel), getTows filter, calendar filter |

**Dashboard `statusConfig` (tow detail page) also lists:**
- `driver_accepted`, `driver_on_way`, `arrived_pickup`, `loading` — **these are NOT stored in the DB**. They appear in the statusConfig object but are never written to `tows.status`. The actual tow status remains `assigned` or `in_progress`; granular progress is inferred from `tow_points.status`.

### 1.2 Point Statuses (tow_points)

**Defined in types.ts:** `pending` | `en_route` | `arrived` | `completed` | `skipped`

**Actually used in driver flow (`updatePointStatus`):** `pending` | `arrived` | `completed` | `skipped`

**`en_route`** — exists in PointStatus type and customer portal `pointStatusConfig`, but the driver app never writes `en_route`. Points go directly from `pending` → `arrived` → `completed`.

### 1.3 Full Status Flow Diagram

```
                    ┌─────────────────────────────────────────────────────────────────┐
                    │                         TOW STATUS FLOW                          │
                    └─────────────────────────────────────────────────────────────────┘

  [quote] ──────────────────────────────────────────────────────────────────────────── (unused)

  [pending] ◄── createTow (no driver)
       │
       │  assignDriver() ──────────────────────────────────────────────────────────────► [assigned]
       │       (dispatcher)
       │
       │  createTow(with driver) ──────────────────────────────────────────────────────► [assigned]
       │
       ▼
  [assigned]
       │
       │  NewTaskModal: handleAccept() ────────────────────────────────────────────────► [in_progress]
       │       (driver, no active task) — sets started_at
       │
       │  NewTaskModal: handleAccept() ────────────────────────────────────────────────► [assigned]
       │       (driver, has active task) — "קבל לתור" (add to queue)
       │
       ▼
  [in_progress]
       │
       │  StepDelivery: updateTaskStatus('completed') ──────────────────────────────────► [completed]
       │       (driver, when last point completed) — sets completed_at
       │
       │  approveRejectionRequest(unassign) ────────────────────────────────────────────► [pending]
       │       (dispatcher)
       │
       │  approveRejectionRequest(reassign) ───────────────────────────────────────────► [assigned]
       │       (dispatcher, new driver)
       │
       ▼
  [completed] — terminal

  [cancelled] ◄── updateTowStatus('cancelled') (dispatcher) — terminal
```

### 1.4 Who Triggers Each Transition

| Transition          | Triggered by   | Location / Function |
|---------------------|----------------|----------------------|
| → pending           | System         | createTow (no driver) |
| → assigned          | Dispatcher     | assignDriver (tows.ts) |
| → assigned          | System         | createTow (with driver) |
| assigned → in_progress | Driver     | NewTaskModal handleAccept |
| in_progress → completed | Driver   | StepDelivery, updateTaskStatus |
| in_progress → pending | Dispatcher | approveRejectionRequest (unassign) |
| in_progress → assigned | Dispatcher | approveRejectionRequest (reassign) |
| → cancelled         | Dispatcher     | updateTowStatus (tow detail page) |

### 1.5 Automatic Status Transitions

**None.** All tow status changes are triggered by user actions (dispatcher or driver). There are no timers, cron jobs, or automatic transitions.

### 1.6 Point Status Flow (tow_points)

```
[pending] ──► [arrived] ──► [completed]
    │              │
    └──────────────┴──────► [skipped]
```

- **Driver:** `StepOnTheWay` → "הגעתי" → `updatePointStatus(pointId, 'arrived')`
- **Driver:** `StepDelivery` → "סיימתי" → `updatePointStatus(pointId, 'completed', recipientName, recipientPhone, notes)`
- **skipped:** Supported in updatePointStatus but no UI button in driver app to skip a point.
- **en_route:** Never written by driver; only in types and customer portal display config.

---

## 2. Dashboard — Full Dispatcher Flow

### 2.1 From Tow Creation to Completion — Dispatcher Actions by Stage

| Tow Status   | Dispatcher can… |
|--------------|------------------|
| pending      | Assign driver, edit tow, cancel |
| assigned     | Reassign driver, edit tow, cancel, view rejection requests |
| in_progress  | Reassign driver (via rejection approval), edit tow, cancel, view rejection requests |
| completed    | View only — no edit, no cancel |
| cancelled    | View only |

### 2.2 Tow Detail Page (`/dashboard/tows/[id]`) — Available Actions

- **Assign / change driver** — Driver selector + truck selector; "שבץ נהג" / "שנה נהג" → `assignDriver()`
- **Edit tow** — "ערוך גרירה" → `/dashboard/tows/[id]/edit` (blocked if status is `completed` or `cancelled` — `showCantEditModal`)
- **Cancel tow** — "בטל גרירה" → `updateTowStatus(towId, 'cancelled')`
- **Edit final price** — Inline edit of `final_price` → `updateTow()`
- **Edit scheduled date/time** — Date/time inputs → `updateTow({ scheduledAt })`
- **Visibility overrides** — Per-tow toggles for customer portal: show_photos, show_price, show_driver_info, show_driver_phone, show_status_history, show_vehicles, show_notes
- **Rejection requests** — Approve (reassign or unassign) or deny pending `tow_rejection_requests`

### 2.3 Can Dispatcher Edit After Assignment? After In Progress?

**Yes.** Edit is blocked only when status is `completed` or `cancelled`. For `pending`, `assigned`, and `in_progress`, the dispatcher can edit (navigate to edit page).

### 2.4 How Does Dispatcher Know When a Tow Is Done?

- **Realtime:** Tow detail page subscribes to `tows` table changes. When `status` becomes `completed`, the UI updates.
- **completed_at** is set by `updateTaskStatus('completed')` when the driver completes the last point.

### 2.5 Cancellation Flow

- **Action:** "בטל גרירה" button on tow detail page.
- **Effect:** `updateTowStatus(towId, 'cancelled')` → `tows.status = 'cancelled'`, `completed_at` set.
- **No confirmation modal** — cancellation is immediate.
- **No refund/invoice logic** — cancellation does not trigger any automatic invoice or refund flow.

### 2.6 Tow Rejection Flow (tow_rejection_requests) — End to End

**Table:** `tow_rejection_requests` — `id`, `tow_id`, `driver_id`, `company_id`, `reason`, `reason_note`, `status` (pending/approved/rejected), `created_at`, etc.

**Flow:**

1. **Driver receives assigned tow** → NewTaskModal opens.
2. **Driver clicks "בקש לדחות"** → Modal shows rejection reason list (REJECTION_REASONS from rejection-requests.ts).
3. **Driver selects reason + optional note** → `createRejectionRequest(towId, driverId, companyId, reason, note)`.
4. **Row inserted** with `status: 'pending'`. Driver sees "בקשת הדחייה נשלחה" / "ממתין לאישור המנהל".
5. **Dispatcher** sees rejection request on tow detail page (or rejection requests list).
6. **Dispatcher options:**
   - **Approve + unassign:** `approveRejectionRequest(id, { action: 'unassign' })` → tow `driver_id` = null, status → `pending`.
   - **Approve + reassign:** `approveRejectionRequest(id, { action: 'reassign', driverId, truckId })` → tow assigned to new driver.
   - **Deny:** `denyRejectionRequest(id)` → `status: 'rejected'`; driver keeps the tow.
7. **Driver** can `cancelRejectionRequest()` while status is still `pending` — cancels their own request.

**Important:** Until the request is approved or denied, the tow remains assigned to the driver. The driver cannot "unassign" themselves without dispatcher approval.

---

## 3. Driver App — Full Driver Flow

### 3.1 What Driver Sees When Tow Is Assigned

- **Home page** (`/driver`): List of tows with `status IN ('assigned', 'in_progress')` and `driver_id = current driver`.
- **NewTaskModal** opens when a new assigned tow appears (or when driver has no active task and a new one is assigned).
- **Modal content:** Scheduled time, pickup/dropoff addresses, vehicle info (plate, model, color), notes, Waze/phone buttons.
- **Actions:** "קבל והתחל עכשיו" (accept and start) or "קבל לתור" (add to queue) or "בקש לדחות" (request rejection).

### 3.2 Exact Sequence of Steps (Driver Task Flow)

1. **Home** → Sees assigned/in_progress tows. Clicks new task → NewTaskModal.
2. **Accept** → `handleAccept()`: status → `in_progress` (or `assigned` if has active task), `started_at` set if in_progress. Navigate to `/driver/task/[id]`.
3. **Task page** — Step-based UI:
   - **StepOnTheWay** — "בדרך לאיסוף" / "בדרך לפריקה". Button "הגעתי" → `updatePointStatus(pointId, 'arrived')` → advance to next step.
   - **StepCamera** — Photo capture. 4 photos per vehicle (before_pickup or before_dropoff). Upload → `uploadTowImage()`. "המשך" when all vehicles done.
   - **StepDelivery** — Recipient name/phone, notes. "סיימתי" → `updatePointStatus(pointId, 'completed', ...)`. If last point → `updateTaskStatus('completed')` → StepComplete.
   - **StepComplete** — Summary, "חזרה לדשבורד" / similar.

### 3.3 Buttons/Actions at Each Step

| Step           | Actions |
|----------------|---------|
| StepOnTheWay   | "הגעתי", Waze, Phone, WhatsApp |
| StepCamera     | Capture 4 photos per vehicle, "המשך" |
| StepDelivery   | Recipient name, phone, notes; "סיימתי" |
| StepComplete   | "חזרה לדשבורד" / navigation |

### 3.4 How Driver Updates Tow Status

- **Component:** `StepOnTheWay` → `onArrived` → `updatePointStatus(pointId, 'arrived')`
- **Component:** `StepDelivery` → `onComplete` → `updatePointStatus(pointId, 'completed', ...)` then, if last point, `updateTaskStatus('completed')`
- **DB calls:** `app/lib/queries/driver-tasks.ts` — `updatePointStatus()`, `updateTaskStatus()` — direct Supabase `tows` and `tow_points` updates.

### 3.5 Photo Capture

**Table:** `tow_images`

| Column        | Type   | Purpose |
|---------------|--------|---------|
| id            | uuid   | PK |
| tow_id        | uuid   | FK to tows |
| tow_point_id  | uuid   | FK to tow_points (nullable) |
| tow_vehicle_id| uuid   | FK to tow_vehicles (nullable) |
| uploaded_by   | uuid   | user_id (driver) |
| image_url     | text   | Storage URL |
| image_type    | text   | before_pickup, after_pickup, before_dropoff, after_dropoff, damage, other |
| notes         | text   | nullable |
| created_at    | timestamp | |

**Scope:** Per-tow, per-point, per-vehicle. StepCamera uses `tow_point_id` and `tow_vehicle_id` to associate each image with a specific point and vehicle.

**Pickup vs dropoff:** Yes. `image_type` distinguishes `before_pickup` / `after_pickup` / `before_dropoff` / `after_dropoff`. StepCamera uses `before_pickup` for pickup points and `before_dropoff` for dropoff points. **after_pickup** and **after_dropoff** exist as types but are NOT captured in the current StepCamera flow — only before_* are used.

**Per-vehicle:** Yes. StepCamera iterates over vehicles and requires 4 photos per vehicle at each point.

**Component:** `app/driver/task/[id]/components/StepCamera.tsx`

**Upload flow:**
1. Driver captures photo (camera or file input).
2. `uploadTowImage(towId, userId, imageType, imageFile, pointId, vehicleId)` in driver-tasks.ts.
3. File uploaded to Supabase Storage bucket `tow-images`, path `{towId}/{imageType}_{timestamp}.jpg`.
4. Public URL obtained via `getPublicUrl`.
5. Row inserted into `tow_images` with `image_url`, `image_type`, `tow_point_id`, `tow_vehicle_id`, `uploaded_by`.

**Photos outside driver app:** Customer portal shows images when `canShow('show_photos')`; dashboard tow detail can show images (if wired). Images are stored in `tow_images` and loaded via `getCustomerTowDetail` and tow detail queries.

### 3.6 Driver Sees Customer Info? Vehicle Info? Navigation?

- **Customer:** Yes — name, phone (from `task.customer`). Shown in StepOnTheWay, StepDelivery. Phone/WhatsApp buttons available.
- **Vehicle:** Yes — plate, manufacturer, model, color, tow_reason. Shown in NewTaskModal and task steps.
- **Navigation:** Waze via `openWaze(address)` — opens Waze app/URL with address.

### 3.7 Can Driver Reject a Tow?

Yes, via **rejection request** (see §2.6). Driver cannot unassign directly; must request, dispatcher approves or denies.

### 3.8 Offline Support

**No.** The driver app has no offline storage, service worker, or queue for offline actions. All updates require network.

---

## 4. Customer Portal — Full Customer Flow

### 4.1 What Customer Sees Today

- **List:** `/customer` — List of tows for their customer (via `customer_users` → `customer_id`).
- **Detail:** `/customer/tows/[id]` — Tow detail with: order number, status, dates, driver (if allowed), vehicles (if allowed), route/timeline (if allowed), photos (if allowed), notes (if allowed).

### 4.2 Visibility Control — Permission Flags

**Per-customer (default):** `customers.portal_settings` — JSONB, keys:

| Key                 | Description |
|---------------------|-------------|
| show_photos         | תמונות שצולמו במהלך הגרירה |
| show_price          | מחיר הגרירה ופירוט עלויות |
| show_driver_info    | שם הנהג |
| show_driver_phone   | טלפון נהג |
| show_status_history | ציר זמן שלבי הגרירה |
| show_vehicles       | פרטי רכבים |
| show_notes          | הערות פנימיות |

**Per-tow override:** `tows.visibility_overrides` — JSONB, same keys. When present for a tow, overrides `portal_settings` for that tow only.

**Logic:** `canShow(key)` in customer tow detail: if `visibility_overrides[key]` is defined, use it; else use `portalSettings[key] !== false`.

### 4.3 Tow Detail Page — What It Shows

- Order number, status badge, created/scheduled/started/completed dates.
- Progress bar when `in_progress`.
- Driver card (if `show_driver_info`), phone (if `show_driver_phone`).
- Vehicles (if `show_vehicles`).
- Timeline of points with status (if `show_status_history`) — point type, address, arrived_at, completed_at, contact, recipient, notes, point images.
- All images (if `show_photos`).
- Notes (if `show_notes`).

### 4.4 Can Customer Approve, Reject, Communicate?

**No.** The customer portal is read-only. No approve/reject buttons, no in-app messaging. Customer can call driver if `show_driver_phone` is true (external action).

### 4.5 show_price — Implementation Status

**Partially implemented, not working end-to-end:**

- `canShow('show_price')` exists and is checked.
- **But:** `getCustomerTowDetail` does NOT select `final_price` or `price_breakdown` from the database.
- **And:** There is NO UI block in the customer tow detail page that renders price when `canShow('show_price')` is true.
- **Conclusion:** show_price is defined in settings and overrides but has no data loading and no UI. Effectively not implemented.

### 4.6 Customer Notifications

**No SMS or email** are sent on tow status changes. `company_settings` has `sms_provider`, `sms_api_key` but they are not wired to the tow flow. No Resend or other email integration on status change.

---

## 5. Tow Images / Photos — Complete Picture

### 5.1 Tables Storing Images

**`tow_images`** — only table used for tow-related images.

| Column         | Type      | Purpose |
|----------------|-----------|---------|
| id             | uuid      | PK |
| tow_id         | uuid      | FK |
| tow_point_id   | uuid      | nullable — which point |
| tow_vehicle_id | uuid     | nullable — which vehicle |
| uploaded_by    | uuid      | user_id |
| image_url      | text      | Storage URL |
| image_type     | text      | before_pickup, after_pickup, before_dropoff, after_dropoff, damage, other |
| notes          | text      | nullable |
| created_at     | timestamp | |

**`tow_point_images`** — defined in types.ts (TowPointImage) but **not used** in queries or UI. The app uses `tow_images` with `tow_point_id` instead.

### 5.2 Image Stage (Pickup vs Dropoff)

- **Concept exists:** `image_type` includes `before_pickup`, `after_pickup`, `before_dropoff`, `after_dropoff`.
- **Used in driver app:** StepCamera uses `before_pickup` for pickup points, `before_dropoff` for dropoff points. `after_*` are not captured.

### 5.3 Per-Vehicle Images (Multi-Vehicle Tow)

- **Yes.** StepCamera loops over `vehicles` and requires 4 photos per vehicle per point. Each image has `tow_vehicle_id`.

### 5.4 Storage Bucket and URL Pattern

- **Bucket:** `tow-images`
- **Path:** `{towId}/{imageType}_{timestamp}.jpg`
- **URL:** Supabase Storage `getPublicUrl('tow-images', fileName)`

### 5.5 Who Writes / Who Reads

| App        | Writes | Reads |
|------------|--------|-------|
| Driver    | StepCamera → uploadTowImage | — |
| Dashboard | — | Tow detail (if images displayed) |
| Customer  | — | getCustomerTowDetail → images |

---

## 6. Notifications and Real-Time

### 6.1 SMS / Email on Tow Status

**None.** No SMS or email sent on status transitions. `company_settings.sms_*` exists but is not used in tow flow.

### 6.2 Realtime Subscriptions

| App        | Channel / Table | Purpose |
|------------|-----------------|---------|
| Dashboard (tows list) | tows, tow_rejection_requests, drivers, driver_shifts, driver_tasks | List updates |
| Dashboard (tow detail) | tow_points, tow_images, tows | Detail updates |
| Customer (tow detail) | tows, tow_points, tow_images | Detail updates |
| Driver (home) | tows (filtered by driver_id) | New/updated tasks |

### 6.3 Push Notifications (Driver App)

**No.** Driver layout reads from `notifications` table (in-app notifications). No push (FCM, APNs) integration. Notifications are polled/loaded on mount, not pushed to device.

---

## 7. DB vs UI Gaps — Not Fully Implemented

| Item | Status |
|------|--------|
| **show_price** | canShow exists, portal_settings + visibility_overrides; no `final_price` in getCustomerTowDetail, no price UI in customer portal |
| **Per-tow visibility overrides** | Implemented in dashboard; customer portal respects them via canShow |
| **truck_type_surcharges** | Table exists; used in price-lists; need to verify full pricing integration |
| **distance_tiers** | Table exists; used in price calculation |
| **Exchange tow type** | UI option exists; useTowSave returns early — never saved |
| **tow_legs** | Used for legacy tows; driver app prefers tow_points; both loaded, points take precedence when present |
| **tow_vehicles** | Fully used |
| **driver_tasks table** | Separate from tows; `/driver/tasks` and `/driver/task-item/[id]` use `driver_tasks` (status: pending/accepted/in_progress/done/rejected). Tows are the main tow entity; driver_tasks is a parallel task system (e.g. non-tow tasks) |
| **Point status en_route** | In types and customer portal config; driver never writes it |
| **after_pickup / after_dropoff** | Image types exist; StepCamera only uses before_pickup, before_dropoff |
| **quote status** | In TowStatus type; never used |
| **with_base, transfer tow types** | In types; never written; only read for edit mapping |

---

## 8. Edge Cases and Business Rules

### 8.1 Driver Starts Tow Then Rejects Mid-Way

- Driver can "בקש לדחות" from NewTaskModal **before** accepting. Once accepted (in_progress), there is no reject button in the task flow.
- If driver has already accepted and started, they would need to contact dispatcher or use a different flow. The rejection request flow is designed for **assigned** tows (before or right after accept). Mid-tow rejection is not explicitly supported in the UI.

### 8.2 Multi-Vehicle Tow — Individual Vehicle Tracking

- **tow_vehicles** — one row per vehicle; `order_index` for ordering.
- **Photos:** Per-vehicle via `tow_vehicle_id` in `tow_images`.
- **Points:** `tow_point_vehicles` links points to vehicles with `action` (pickup/dropoff). StepCamera iterates vehicles per point.
- **No per-vehicle status** — point status is per-point, not per-vehicle. All vehicles at a point are treated together for arrived/completed.

### 8.3 Storage Release Flow and Tow Completion

- **releaseVehicleFromStorage:** Called from `useTowSave` when creating a tow that uses a `selectedStoredVehicleId` — releases that stored vehicle and links it to the tow.
- **addVehicleToStorage:** Called when `dropoffToStorage` is true on tow creation — adds vehicle to storage at dropoff.
- **Tow completion** does NOT automatically trigger storage release. Storage operations are tied to tow **creation** (form options), not completion.

### 8.4 tow_legs vs tow_points vs tow_vehicles

| Concept | Table | Purpose |
|---------|-------|---------|
| **tow_vehicles** | tow_vehicles | Vehicles being towed; one per vehicle |
| **tow_legs** | tow_legs | Legacy route representation: leg_type (pickup/delivery), from_address, to_address, per tow_vehicle_id. Used for older tows and fallback when no points |
| **tow_points** | tow_points | New route representation: point_type (pickup/dropoff), point_order, address, contact, status. Used for new tows |

**When each is used:**
- **tow_points:** Primary for new tows. Created by tow-save-handler. Driver app uses points for step flow.
- **tow_legs:** Fallback when points are empty. NewTaskModal and getTaskDetail use legs when `!points?.length`.
- **tow_vehicles:** Always used for vehicle list.

### 8.5 Scheduled Jobs / Background Functions

**None found.** No Supabase Edge Functions folder, no cron references in app code. All logic is request-driven.

---

## Summary Table — Status Transitions

| From       | To         | Who       | Action |
|------------|------------|-----------|--------|
| (new)      | pending    | System    | createTow, no driver |
| (new)      | assigned   | System    | createTow, with driver |
| pending    | assigned   | Dispatcher| assignDriver |
| assigned   | in_progress| Driver    | Accept (no active task) |
| assigned   | assigned   | Driver    | Accept (add to queue) |
| in_progress| completed  | Driver    | Complete last point |
| in_progress| pending    | Dispatcher| Approve rejection (unassign) |
| in_progress| assigned   | Dispatcher| Approve rejection (reassign) |
| *          | cancelled  | Dispatcher| Cancel tow |

---

*End of analysis. Use this document as the foundation for redesign decisions.*
