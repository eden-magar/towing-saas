# סקירת פרויקט – Towing SaaS

## 1. ארכיטקטורה ומבנה תיקיות

**טכנולוגיות:** Next.js 16 (App Router), React 19, Supabase (Postgres, Auth, Storage), Tailwind CSS 4, Resend (אימייל), Lucide React.

**תיקיות עיקריות:**

| נתיב | תפקיד |
|------|--------|
| `app/dashboard/` | דשבורד חברה (מפעילים, מנהלים) |
| `app/driver/` | אפליקציית נהגים |
| `app/customer/` | פורטל לקוחות |
| `app/superadmin/` | פאנל סופר אדמין |
| `app/components/` | קומפוננטות משותפות (Sidebar, טפסי גרירה, מודלים) |
| `app/lib/` | Auth, Supabase client, queries, utils |
| `app/hooks/` | Tow form, pricing, save, location tracking |
| `app/api/` | API routes (drivers, customer-users, admin) |

**דפי דשבורד:** `/dashboard`, `/dashboard/tows`, `/dashboard/calendar`, `/dashboard/drivers`, `/dashboard/trucks`, `/dashboard/storage`, `/dashboard/cash`, `/dashboard/customers`, `/dashboard/price-lists`, `/dashboard/invoices`, `/dashboard/reports`, `/dashboard/users`, `/dashboard/settings`.

**דפי נהג:** `/driver`, `/driver/cash`, `/driver/history`, `/driver/stats`, `/driver/profile`, `/driver/task/[id]`, `/driver/navigation/[id]`.

**דפי לקוח:** `/customer`, `/customer/tows/[id]`, `/customer/users`.

**דפי סופר אדמין:** `/superadmin`, `/superadmin/companies`, `/superadmin/users`, `/superadmin/billing`, `/superadmin/reports`, `/superadmin/settings`.

---

## 2. סכמת מסד נתונים (מהשאילתות)

אין מיגרציות SQL ברפו; הסכמה הוסקה מהשאילתות ל-Supabase.

### ליבת המערכת

| טבלה | עמודות עיקריות |
|------|-----------------|
| `companies` | id, name, business_number, phone, email, address, logo_url, is_active |
| `users` | id (= auth id), email, phone, full_name, role, company_id, is_active, id_number, address |
| `drivers` | id, user_id, company_id, license_number, license_expiry, status, license_type, years_experience, notes, work_hours_start/end |
| `tow_trucks` | id, company_id, plate_number, truck_type, vehicle_capacity, max_weight_kg, manufacturer, model, year, color, license/insurance/test_expiry |
| `driver_truck_assignments` | id, driver_id, truck_id, assigned_at, unassigned_at, is_current |
| `customers` | id, user_id, customer_type, name, id_number, phone, email, address, notes, portal_settings |
| `customer_company` | id, customer_id, company_id, payment_terms, credit_limit, notes, is_active, discount_percent |
| `customer_users` | id, customer_id, user_id, role, is_active |

### גרירות

| טבלה | עמודות עיקריות |
|------|-----------------|
| `tows` | id, company_id, customer_id, driver_id, truck_id, created_by, tow_type, status, scheduled_at, notes, recommended_price, final_price, price_list_id, started_at, completed_at, order_number, customer_order_number, payment_method, cash_collected, visibility_overrides |
| `tow_vehicles` | id, tow_id, plate_number, manufacturer, model, year, vehicle_type, color, is_working, tow_reason, notes, order_index |
| `tow_legs` | id, tow_id, tow_vehicle_id, leg_type, leg_order, from/to address/lat/lng, distance_km, status, started_at, completed_at |
| `tow_points` | id, tow_id, point_order, point_type, address, lat, lng, contact_name/phone, status, arrived_at, completed_at, recipient_name/phone, notes |
| `tow_point_vehicles` | id, tow_point_id, tow_vehicle_id, action |
| `tow_images` | id, tow_id, tow_vehicle_id, tow_point_id, uploaded_by, image_url, image_type, notes |
| `tow_status_history` | id, tow_id, tow_leg_id, status, changed_by, notes |
| `tow_change_log` | id, tow_id, changed_by, changed_at, field_name, old_value, new_value |
| `tow_rejection_requests` | workflow דחיית גרירה |

### תמחור

| טבלה | עמודות עיקריות |
|------|-----------------|
| `price_lists` | id, company_id, customer_company_id, name, base_price_*, price_per_km, minimum_price, night/weekend_surcharge_percent, base_address, base_lat, base_lng, is_active |
| `distance_tiers` | id, company_id, from_km, to_km, price_per_km |
| `truck_type_surcharges` | id, company_id, truck_type, surcharge |
| `time_surcharges` | id, company_id, price_list_id, name, label, time_start/end, surcharge_percent, day_type, sort_order, is_active |
| `location_surcharges` | id, company_id, price_list_id, label, surcharge_percent, is_active |
| `service_surcharges` | id, company_id, price_list_id, label, price, price_type, unit_label, is_active |
| `customer_price_items` | id, customer_company_id, label, price |
| `fixed_price_items` | id, company_id, label, price |

### אחר

| טבלה | עמודות עיקריות |
|------|-----------------|
| `invoices` | id, company_id, customer_id, tow_id, invoice_number, amount, vat_amount, total_amount, status, issued_at, due_date, paid_at |
| `invoice_items` | id, invoice_id, tow_id, description, amount |
| `stored_vehicles` | אחסנת רכבים |
| `driver_cash_transactions` | id, driver_id, tow_id, amount, type, notes, created_by |
| `driver_shifts` | מעקב משמרות |
| `driver_locations` | מיקום GPS נהגים |
| `company_settings` | kapaset_api_key, sms_*, default_vat_percent, שעות עבודה/לילה |
| `company_subscriptions`, `subscription_plans`, `billing_history` | חיוב |
| `notifications` | id, user_id, title, body, type, is_read, data |
| `audit_log` | user_id, action, table_name, record_id, old/new_values |
| `system_settings` | key, value |
| `impersonation_sessions` | התחזות סופר אדמין |

### קשרים

- `users` ↔ `drivers` (1:1 דרך user_id)
- `users` ↔ `customers` (דרך customer_users)
- `companies` → `drivers`, `tow_trucks`, `customers` (דרך customer_company), `tows`, `price_lists`
- `tows` → `tow_vehicles`, `tow_legs`, `tow_points`, `tow_images`
- `tow_points` → `tow_point_vehicles`, `tow_point_images` (אם קיים)
- `price_lists` → `time/location/service_surcharges` (price_list_id; null = ברירת מחדל חברה)

---

## 3. פיצ'רים וזרימה

### דשבורד (חברה)

- **דשבורד:** סטטיסטיקות (גרירות היום, בתהליך, נהגים זמינים), גרירות אחרונות
- **גרירות:** רשימה, יצירה, עריכה, צפייה; סוגים: simple, with_base, transfer, multi_vehicle
- **יומן:** תצוגת לוח שנה
- **נהגים:** רשימה, יצירה (דרך API), שיוך גררים, סטטוס
- **גררים:** רשימה, יצירה, מסמכים ב-storage
- **אחסנה:** רכבים מאוחסנים
- **קופות:** תנועות קופה של נהגים
- **לקוחות:** רשימה, יצירה, תמחור, משתמשי לקוח
- **מחירונים:** מחיר בסיס, דרגות מרחק, תוספות סוג גרר, תוספות זמן/מיקום/שירות, תמחור לקוח, מחירים קבועים, סימולטור
- **חשבוניות:** יצירה, שליחה, מעקב
- **דוחות:** שעות נהגים, דוחות לקוחות
- **משתמשים:** משתמשי החברה
- **הגדרות:** הגדרות חברה, לוגו

### אפליקציית נהג

- **בית:** משימות (ממתין/מוקצה/בתהליך), קבלה/דחייה, סטטוס (זמין, עסוק, בהפסקה, לא זמין)
- **משימה:** שלבים (בדרך, איסוף, מסירה, סיום), צילומים, ניווט (Waze)
- **קופה:** תנועות קופה
- **היסטוריה:** גרירות קודמות
- **סטטיסטיקות:** סטטיסטיקות אישיות
- **פרופיל:** פרטי נהג
- **התראות:** התראות באפליקציה

### פורטל לקוח

- **גרירות:** רשימה ופרטי גרירות
- **משתמשים:** ניהול משתמשי לקוח (admin בלבד)
- גישה דרך `customer_users`; תפקידים: admin, manager, viewer

### סופר אדמין

- **חברות:** יצירה, עריכה, מחיקה
- **משתמשים:** ניהול משתמשים
- **חיוב:** מנויים
- **דוחות:** דוחות מערכת
- **הגדרות:** הגדרות מערכת

---

## 4. קומפוננטות ודפים עיקריים

### דשבורד

- `Sidebar` – ניווט (עברית, RTL)
- `layout.tsx` – שמירה על התחברות, הפניה ל-`/login` אם לא מחובר
- טפסי גרירה ב-`app/components/tow-forms/` וב-`app/dashboard/tows/new/`, `[id]/edit/`
- טאבים במחירונים: `BasePriceTab`, `SurchargesTab`, `CustomerPricingTab`, `FixedPriceTab`, `PriceSimulator`

### אפליקציית נהג

- `layout.tsx` – אימות נהג, בחירת סטטוס, התראות, ניווט תחתון
- `page.tsx` – רשימת משימות, קבלה/דחייה, `NewTaskModal`
- `task/[id]/page.tsx` – זרימת שלבים: `StepOnTheWay`, `StepDelivery`, `StepComplete`, `StepCamera`
- `navigation/[id]/page.tsx` – ניווט Waze

### פורטל לקוח

- `layout.tsx` – אימות לקוח, בדיקת תפקיד, כותרת
- `page.tsx` – רשימת גרירות
- `tows/[id]/page.tsx` – פרטי גרירה
- `users/page.tsx` – ניהול משתמשים (admin בלבד)

---

## 5. שאילתות ו-API

### מודולי שאילתות (`app/lib/queries/`)

| קובץ | תפקיד |
|------|--------|
| `tows.ts` | CRUD גרירות, רכבים, legs, points, היסטוריית סטטוס, change log |
| `price-lists.ts` | מחירון בסיס, דרגות מרחק, תוספות, תמחור לקוח, מחירים קבועים |
| `drivers.ts` | נהגים, שיוכי גרר, סטטיסטיקות |
| `driver-tasks.ts` | משימות נהג, קבלה/דחייה, עדכוני סטטוס, תמונות |
| `driver-cash.ts` | תנועות קופה נהג |
| `driver-shifts.ts` | משמרות, מיקומים |
| `customers.ts` | לקוחות, קשרי חברה |
| `customer-portal.ts` | גרירות לקוח, משתמשים, סטטיסטיקות, יצירה/עדכון/מחיקה משתמשי לקוח |
| `invoices.ts` | חשבוניות, פריטים, מספור |
| `trucks.ts` | גררים, שיוכים, מסמכים |
| `storage.ts` | רכבים מאוחסנים |
| `dashboard.ts` | סטטיסטיקות דשבורד |
| `calendar.ts` | גרירות ללוח שנה |
| `reports.ts` | דוחות |
| `alerts.ts` | התראות גרר/נהג |
| `rejection-requests.ts` | workflow דחיית גרירה |
| `settings.ts` | הגדרות חברה, לוגואים |
| `users.ts` | משתמשים |

### API Routes (`app/api/`)

| Route | Methods | תפקיד |
|-------|---------|--------|
| `/api/drivers` | POST | יצירת נהג (משתמש auth + רשומת driver + מייל הזמנה) |
| `/api/customer-users` | POST, PATCH, DELETE | יצירה/עדכון/מחיקה משתמשי לקוח |
| `/api/admin/create-company` | POST | יצירת חברה |
| `/api/admin/delete-company` | POST | מחיקת חברה |
| `/api/admin/reset-password` | POST | איפוס סיסמה |

---

## 6. טיפוסים וממשקים

### טיפוסים עיקריים (`app/lib/types.ts`)

- **Enums:** `UserRole`, `DriverStatus`, `TruckType`, `CustomerType`, `PaymentTerms`, `TowType`, `TowStatus`, `VehicleType`, `LegType`, `LegStatus`, `ImageType`, `InvoiceStatus`, `NotificationType`, `PointType`, `PointStatus`, `PointVehicleAction`, `PointImageType`, `CustomerUserRole`, `CashTransactionType`
- **Base:** `Company`, `User`, `Driver`, `TowTruck`, `DriverTruckAssignment`, `Customer`, `CustomerCompany`, `PriceList`, `Tow`, `TowVehicle`, `TowLeg`, `TowStatusHistory`, `TowImage`, `Invoice`, `InvoiceItem`, `Notification`, `AuditLog`, `SystemSettings`, `CompanySettings`
- **Composite:** `DriverWithDetails`, `TowWithDetails`, `CustomerWithCompanyDetails`, `TruckWithDetails`, `TowPoint`, `TowPointVehicle`, `TowPointImage`, `TowPointWithDetails`, `TowWithPoints`, `DriverTowPoint`, `DriverActiveTow`, `CustomerUser`, `CustomerUserWithDetails`, `CustomerPortalTow`, `CustomerPortalTowDetail`, `DriverCashTransaction`, `TowChangeLog`
- **Vehicle lookup:** `VehicleLookupResult` (data.gov.il)

### טיפוסי תמחור (`app/lib/queries/price-lists.ts`)

- `BasePriceList`, `DistanceTier`, `TruckTypeSurcharge`, `TimeSurcharge`, `LocationSurcharge`, `ServiceSurcharge`, `CustomerPriceItem`, `CustomerWithPricing`, `FixedPriceItem`

---

## 7. Auth ומערכת תפקידים

### זרימת Auth

- `AuthContext` טוען שורת `users` לפי auth user id
- חושף: `user`, `companyId`, `loading`, `signOut`
- התחברות (`/login`): אימייל/סיסמה → Supabase Auth → קריאת `users.role` → הפניה:
  - `driver` → `/driver`
  - `super_admin` → `/superadmin`
  - `customer` → `/customer`
  - אחרת → `/dashboard`

### תפקידים

| תפקיד | גישה |
|-------|------|
| `super_admin` | פאנל סופר אדמין, כל החברות |
| `company_admin` | דשבורד, ניהול חברה |
| `dispatcher` | דשבורד (גרירות, נהגים וכו') |
| `driver` | אפליקציית נהג בלבד |
| `customer` | פורטל לקוח בלבד |

### Guards

- **דשבורד:** נדרש `user`; הפניה ל-`/login` אם חסר
- **נהג:** נדרש `user`; הפניה ל-`/login` אם חסר
- **לקוח:** נדרש `user` ו-`role === 'customer'`; אחרת הפניה ל-`/login` או `/dashboard`
- **סופר אדמין:** נדרש `role === 'super_admin'`

### API Auth (`app/lib/auth.ts`)

- `getAuthUser(req)` – Bearer token → Supabase Auth → שורת `users`
- `unauthorizedResponse()`, `forbiddenResponse()` – עזרים ל-401/403

---

## 8. בעיות ו-TODOs ידועים

1. **סטטוס נהג `break`** – בשימוש ב-UI נהג (`statusOptions` ב-layout, `driverStatuses` בדף הבית) אך לא ב-type `DriverStatus` (`available`, `on_way`, `busy`, `unavailable`). ה-DB כנראה תומך ב-`break`; הטיפוס לא מסונכרן.
2. **TODO** – `app/dashboard/customers/[id]/page.tsx:156`: "אפשר להוסיף toast notification"
3. **Debug log** – `app/lib/queries/calendar.ts:11`: `console.log('=== getCalendarTows DEBUG ===')` נשאר בקוד
4. **הערת Debug** – `app/hooks/useTowForm.ts:470`: "Debug: log loaded data"
5. **תמחור לקוח** – `CustomerWithPricing` כולל `customer_time_surcharges`, `customer_location_surcharges`, `customer_service_surcharges`, אך `getCustomersWithPricing` מחזיר רק `price_items` ו-`price_list`; תוספות לקוח לא נטענות.
6. **Tow save handler** – משתמש ב-`basePriceList` לפירוק גם כש-`priceMode === 'recommended_customer'`; ייתכן באג בתמחור.
7. **PriceSummary** – אין פירוק ל-mode `recommended_customer`.
8. **נתיבים כפולים** – חלק מהנתיבים מופיעים פעמיים (למשל `app\dashboard\` מול `app/dashboard/`), כנראה בגלל Windows.

---

## 9. Hooks

| Hook | תפקיד |
|------|--------|
| `useTowForm` | state טופס גרירה, ולידציה, טעינה |
| `useTowPricing` | חישוב מחיר |
| `useTowSave` | שמירת גרירה (create/update) |
| `useLocationTracking` | עדכוני GPS נהג |

---

## 10. Storage Buckets

- `company-logos` – לוגואים חברות
- `truck-documents` – מסמכי גררים
- `tow-images` – תמונות גרירה (גם `tow-images` ב-driver-tasks)
