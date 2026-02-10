# סיכום פרויקט — Towing SaaS

מסמך זה מסכם את מבנה הפרויקט, מודל הנתונים, אינטגרציית Supabase, אימות, פורטל ודשבורד, realtime, סביבה, וממצאי סריקת באגים/בעיות. **לא בוצעו שינויים בקוד.**

---

## 1. מבנה הפרויקט

### הערה: אין תיקיית `src/`
הפרויקט משתמש ב-**App Router** של Next.js; הקבצים הראשיים נמצאים תחת **`app/`**.

### עץ תיקיות (2 רמות עומק) — מקביל ל-`app/`

```
app/
├── api/                    # API routes
│   ├── admin/
│   │   ├── create-company/
│   │   ├── delete-company/
│   │   └── reset-password/
│   ├── customer-users/
│   └── drivers/
├── components/              # קומפוננטות משותפות
│   ├── address/
│   ├── tow-forms/
│   └── ...
├── customer/               # פורטל לקוח
│   ├── tows/
│   │   └── [id]/
│   ├── layout.tsx
│   └── page.tsx
├── dashboard/              # דשבורד ניהול (חברת גרירה)
│   ├── calendar/
│   ├── customers/
│   │   ├── [id]/
│   │   └── users/
│   ├── drivers/
│   ├── invoices/
│   ├── price-lists/
│   ├── reports/
│   ├── settings/
│   ├── storage/
│   ├── tows/
│   │   ├── [id]/
│   │   └── new/
│   ├── trucks/
│   ├── users/
│   ├── layout.tsx
│   └── page.tsx
├── driver/                 # אפליקציית נהג
│   ├── history/
│   ├── login/
│   ├── navigation/
│   │   └── [id]/
│   ├── profile/
│   ├── stats/
│   ├── task/
│   │   └── [id]/
│   ├── layout.tsx
│   └── page.tsx
├── forgot-password/
├── login/
├── reset-password/
├── superadmin/             # דשבורד סופר-אדמין
│   ├── billing/
│   ├── companies/
│   │   ├── [id]/
│   │   │   └── edit/
│   │   └── new/
│   ├── reports/
│   ├── settings/
│   ├── users/
│   ├── layout.tsx
│   └── page.tsx
├── lib/                    # לוגיקה, Supabase, types
│   ├── queries/
│   ├── utils/
│   ├── AuthContext.tsx
│   ├── supabase.ts
│   ├── superadmin.ts
│   └── types.ts
├── favicon.ico
├── globals.css
├── layout.tsx
└── page.tsx
```

### Routes ב-`app/` (כולל nested)

| נתיב | קובץ |
|------|------|
| `/` | `app/page.tsx` |
| `/login` | `app/login/page.tsx` |
| `/forgot-password` | `app/forgot-password/page.tsx` |
| `/reset-password` | `app/reset-password/page.tsx` |
| **פורטל לקוח** | |
| `/customer` | `app/customer/page.tsx` |
| `/customer/tows/[id]` | `app/customer/tows/[id]/page.tsx` |
| **דשבורד** | |
| `/dashboard` | `app/dashboard/page.tsx` |
| `/dashboard/calendar` | `app/dashboard/calendar/page.tsx` |
| `/dashboard/customers` | `app/dashboard/customers/page.tsx` |
| `/dashboard/customers/[id]` | `app/dashboard/customers/[id]/page.tsx` |
| `/dashboard/customers/users` | `app/dashboard/customers/users/page.tsx` |
| `/dashboard/drivers` | `app/dashboard/drivers/page.tsx` |
| `/dashboard/invoices` | `app/dashboard/invoices/page.tsx` |
| `/dashboard/price-lists` | `app/dashboard/price-lists/page.tsx` |
| `/dashboard/reports` | `app/dashboard/reports/page.tsx` |
| `/dashboard/reports/customer/[id]` | `app/dashboard/reports/customer/[id]/page.tsx` |
| `/dashboard/reports/driver/[id]` | `app/dashboard/reports/driver/[id]/page.tsx` |
| `/dashboard/settings` | `app/dashboard/settings/page.tsx` |
| `/dashboard/storage` | `app/dashboard/storage/page.tsx` |
| `/dashboard/tows` | `app/dashboard/tows/page.tsx` |
| `/dashboard/tows/[id]` | `app/dashboard/tows/[id]/page.tsx` |
| `/dashboard/tows/new` | `app/dashboard/tows/new/page.tsx` |
| `/dashboard/trucks` | `app/dashboard/trucks/page.tsx` |
| `/dashboard/users` | `app/dashboard/users/page.tsx` |
| **נהג** | |
| `/driver` | `app/driver/page.tsx` |
| `/driver/login` | `app/driver/login/page.tsx` |
| `/driver/history` | `app/driver/history/page.tsx` |
| `/driver/navigation/[id]` | `app/driver/navigation/[id]/page.tsx` |
| `/driver/profile` | `app/driver/profile/page.tsx` |
| `/driver/stats` | `app/driver/stats/page.tsx` |
| `/driver/task/[id]` | `app/driver/task/[id]/page.tsx` |
| **סופר-אדמין** | |
| `/superadmin` | `app/superadmin/page.tsx` |
| `/superadmin/billing` | `app/superadmin/billing/page.tsx` |
| `/superadmin/companies` | `app/superadmin/companies/page.tsx` |
| `/superadmin/companies/[id]` | `app/superadmin/companies/[id]/page.tsx` |
| `/superadmin/companies/[id]/edit` | `app/superadmin/companies/[id]/edit/page.tsx` |
| `/superadmin/companies/new` | `app/superadmin/companies/new/page.tsx` |
| `/superadmin/reports` | `app/superadmin/reports/page.tsx` |
| `/superadmin/settings` | `app/superadmin/settings/page.tsx` |
| `/superadmin/users` | `app/superadmin/users/page.tsx` |

**חסר:** אין דף `app/customer/users/page.tsx` — בתפריט הפורטל יש קישור ל־`/customer/users` שמפנה לנתיב שלא קיים (404).

### Middleware
**אין קבצי middleware בפרויקט.** חיפוש אחר `middleware.*` או `middleware` בתיקיית השורש לא מצא קבצים. הגנת נתיבים מתבססת על לוגיקה בתוך layouts ודפים (AuthContext, redirect לפי role).

---

## 2. מודל הנתונים (Types / Interfaces)

ההגדרות המרכזיות נמצאות ב־**`app/lib/types.ts`**. נוסף על כך יש טייפים ב־`app/lib/superadmin.ts` (סופר-אדמין).

### קבצים עיקריים
- **`app/lib/types.ts`** — כל הטייפים העסקיים והמשניים.
- **`app/lib/superadmin.ts`** — `SubscriptionPlan`, `CompanyWithSubscription`, `CompanyDetails`, `CompanyUser`, `BillingRecord`, `ActivityLogEntry`, `DashboardStats`, `ImpersonationSession`.

### מתוך `app/lib/types.ts`

**Enums / סוגים:**
- `UserRole`, `DriverStatus`, `TruckType`, `CustomerType`, `PaymentTerms`, `TowType`, `TowStatus`, `VehicleType`, `LegType`, `LegStatus`, `ImageType`, `InvoiceStatus`, `NotificationType`
- `PointType`, `PointStatus`, `PointVehicleAction`, `PointImageType`
- `CustomerUserRole`

**טבלאות בסיס:**
- **Tow:** `Tow` — id, company_id, customer_id, driver_id, truck_id, created_by, tow_type, status, scheduled_at, notes, recommended_price, final_price, price_list_id, started_at, completed_at, order_number, timestamps.
- **TowPoint:** `TowPoint` — id, tow_id, point_order, point_type, address, lat, lng, contact_name, contact_phone, status, arrived_at, completed_at, recipient_name, recipient_phone, notes, timestamps.
- **TowImage:** `TowImage` — id, tow_id, tow_vehicle_id, uploaded_by, image_url, image_type, notes, created_at.
- **TowVehicle:** `TowVehicle` — id, tow_id, plate_number, manufacturer, model, year, vehicle_type, color, is_working, tow_reason, notes, order_index, created_at.
- **TowLeg, TowPointVehicle, TowPointImage, TowStatusHistory** — קשורים לגרירות ונקודות.

**Customer & CustomerUser:**
- **Customer:** `Customer` — id, user_id, customer_type, name, id_number, phone, email, address, notes, timestamps.
- **CustomerUser:** `CustomerUser` — id, customer_id, user_id, role (admin/manager/viewer), is_active, timestamps.
- **CustomerUserWithDetails:** `CustomerUser` + `user: { full_name, email, phone }`.
- **CustomerCompany**, **CustomerWithCompanyDetails**.

**Driver & User:**
- **User:** `User` — id, email, phone, full_name, role, company_id, is_active, id_number, address, timestamps.
- **Driver:** `Driver` — id, user_id, company_id, license_number, license_expiry, status, license_type, years_experience, notes, timestamps.
- **DriverWithDetails:** `Driver` + user, current_truck, today_tows_count.

**אחרים:**
- **Company, TowTruck, DriverTruckAssignment, PriceList, Invoice, InvoiceItem, Notification, AuditLog, SystemSettings, CompanySettings**
- **VehicleLookupResult** (data.gov.il)
- **TowWithDetails, TowWithPoints, TowPointWithDetails**
- **DriverTowPoint, DriverActiveTow** (אפליקציית נהג)
- **CustomerPortalTow, CustomerPortalTowDetail** (פורטל לקוח)
- **TruckWithDetails**

---

## 3. Supabase Integration

### קליינט ראשי (anon) — `app/lib/supabase.ts`

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

משמש בכל האפליקציה (דפים, קומפוננטות, queries) כשצריך גישה עם הרשאות המשתמש (RLS).

### קליינט Admin / Service Role
**כן — נפרד ומוגדר רק ב־API routes (שרת):**

- **`app/api/customer-users/route.ts`**  
  `createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)` — כ־`supabaseAdmin`.
- **`app/api/drivers/route.ts`** — אותו דבר, כ־`supabaseAdmin`.
- **`app/api/admin/create-company/route.ts`** — אותו דבר.
- **`app/api/admin/delete-company/route.ts`** — אותו דבר.
- **`app/api/admin/reset-password/route.ts`** — אותו דבר.

ב־client (דפים, AuthContext, queries) משתמשים רק ב־`supabase` מ־`app/lib/supabase.ts` (anon). ה־service role לא נחשף ל־client.

### קריאות Supabase הקשורות ל־`customer_users`

**`app/lib/queries/customer-portal.ts`:**
- שורות 11–27: `getCustomerForUser(userId)` — `from('customer_users').select(...).eq('user_id', userId).eq('is_active', true).single()`.
- שורות 173–193: `getCustomerUsers(customerId)` — `from('customer_users').select(...).eq('customer_id', customerId)`.
- שורות 242–247: `updateCustomerUserRole` — `from('customer_users').update({ role, updated_at }).eq('id', customerUserId)`.
- שורות 252–257: `toggleCustomerUserActive` — `from('customer_users').update({ is_active, updated_at }).eq('id', customerUserId)`.
- שורות 262–268: `deleteCustomerUser(customerUserId)` — `from('customer_users').delete().eq('id', customerUserId)`.

**`app/api/customer-users/route.ts`:**
- שורות 52–59: אחרי יצירת user ב־auth ו־users — `from('customer_users').insert({ customer_id, user_id, role, is_active: true })`.

### קריאות Supabase הקשורות ל־`customers`

- **`app/dashboard/customers/[id]/page.tsx`** (שורות 100–109):  
  `from('customers').select(...).eq('id', customerId).single()`.
- **`app/lib/queries/customers.ts`**:  
  `from('customers')` — select, delete (שורה 160), ועוד.
- **`app/lib/queries/reports.ts`** (שורה 784):  
  `from('customers')`.

### שימוש ב־Supabase Realtime (subscribe / channel)

**1) `app/driver/page.tsx` (שורות 65–81)**

```typescript
useEffect(() => {
  if (!driverInfo?.id) return

  const channel = supabase
    .channel(`driver-realtime-${driverInfo.id}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'tows',
      filter: `driver_id=eq.${driverInfo.id}`
    }, () => loadData())
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}, [driverInfo?.id])
```

- טבלה: **`tows`**.
- פילטר: `driver_id=eq.{driverId}`.
- cleanup: `supabase.removeChannel(channel)` ב־return.

**2) `app/dashboard/tows/[id]/page.tsx` (שורות 145–174)**

```typescript
useEffect(() => {
  if (!towId) return

  const channel = supabase
    .channel(`tow-realtime-${towId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tow_points', filter: `tow_id=eq.${towId}` }, () => loadData())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tow_images', filter: `tow_id=eq.${towId}` }, () => loadData())
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tows', filter: `id=eq.${towId}` }, () => loadData())
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}, [towId])
```

- טבלאות: **`tow_points`**, **`tow_images`**, **`tows`** (רק UPDATE).
- פילטרים: `tow_id=eq.{towId}` / `id=eq.{towId}`.
- cleanup: `supabase.removeChannel(channel)` ב־return.

---

## 4. Authentication & Authorization

### Auth flow
1. **`app/layout.tsx`** — עוטף את האפליקציה ב־`<AuthProvider>` מ־`app/lib/AuthContext.tsx`.
2. **`AuthContext`**:
   - קורא ל־`supabase.auth.getSession()` בטעינה.
   - אם יש session — שולף משתמש מ־`users` לפי `session.user.id` ומעדכן state.
   - מאזין ל־`supabase.auth.onAuthStateChange` (למשל SIGNED_OUT).
   - מספק: `user`, `loading`, `companyId`, `signOut`.
3. **התחברות:**
   - **`/login`** — `supabase.auth.signInWithPassword`, then שליפת `role` מ־`users`, redirect: driver → `/driver`, super_admin → `/superadmin`, customer → `/customer`, אחרת → `/dashboard`.
   - **`/driver/login`** — אותו מנגנון; driver → `/driver`, אחרת → `/dashboard`.
   - **שכחת סיסמה:** `/forgot-password` — `supabase.auth.resetPasswordForEmail`; קישור איפוס ל־`/reset-password`.

### Role-based access
- **מוגדר לפי role ב־`users.role`:** `super_admin` | `company_admin` | `dispatcher` | `driver` | `customer` (מ־`types.ts`).
- **הפניה אחרי לוגין:** לפי role (ראו למעלה).
- **Layouts:**
  - **Customer** (`app/customer/layout.tsx`): בודק `user.role !== 'customer'` → redirect ל־`/dashboard`; טוען `getCustomerForUser` ומציג תפריט (כולל `/customer/users` ל־admin).
  - **Superadmin** (`app/superadmin/layout.tsx`): בודק `!user` → redirect ל־`/login`; קורא ל־`checkIsSuperAdmin(user.id)` (שאילתה ל־`users`), אם לא super_admin → redirect ל־`/dashboard`.
  - **Dashboard** (`app/dashboard/layout.tsx`): רק מציג loading מ־`useAuth()` — **אין בדיקת role ואין redirect** כשאין משתמש.
  - **Driver** (`app/driver/layout.tsx`): לא מבצע redirect; דפי הנהג מסתמכים על טעינת נתונים (למשל `getDriverByUserId`).

### קבצים קשורים ל־Auth
- `app/lib/AuthContext.tsx` — provider + useAuth.
- `app/lib/supabase.ts` — קליינט להתחברות.
- `app/login/page.tsx`, `app/driver/login/page.tsx` — לוגין.
- `app/forgot-password/page.tsx`, `app/reset-password/page.tsx` — איפוס סיסמה.
- `app/customer/layout.tsx` — הגנה וניתוב לפורטל.
- `app/superadmin/layout.tsx` — הגנה ובדיקת super_admin.
- `app/dashboard/layout.tsx` — ללא הגנת auth.
- `app/lib/superadmin.ts` — `checkIsSuperAdmin`.

---

## 5. Portal (פורטל לקוח)

### קבצים תחת פורטל
- `app/customer/layout.tsx` — layout עם תפריט (גרירות, משתמשים ל־admin).
- `app/customer/page.tsx` — דשבורד גרירות + סטטיסטיקות.
- `app/customer/tows/[id]/page.tsx` — פרטי גרירה בודדת.

**חסר:** `app/customer/users/page.tsx` — בתפריט יש קישור ל־`/customer/users` שאין לו דף (404).

### לוגיקת Login/Signup לפורטל
- אין הרשמה עצמאית מפורטל; משתמשי פורטל נוצרים מדשבורד החברה (דף פרטי לקוח → טאב "משתמשי פורטל" → הוספת משתמש).
- התחברות: אותו `/login`; אם `user.role === 'customer'` מנותב ל־`/customer`.
- ב־`app/customer/layout.tsx`: אם אין user → redirect ל־`/login`; אם role לא customer → redirect ל־`/dashboard`; טעינת `getCustomerForUser(user.id)` לזיהוי לקוח ותפקיד (admin וכו').

### API routes קשורים לפורטל
- **POST `/api/customer-users`** — יצירת משתמש פורטל (auth + users + customer_users). נקרא מ־`createCustomerUser()` ב־`app/lib/queries/customer-portal.ts`, שמשמש את דשבורד הלקוח (דף פרטי לקוח).

### פונקציות שעושות DELETE על `customer_users`
- **`app/lib/queries/customer-portal.ts`** — `deleteCustomerUser(customerUserId)`:  
  `supabase.from('customer_users').delete().eq('id', customerUserId)`.
- **קריאה מהפרונט:** `app/dashboard/customers/[id]/page.tsx` — `handleDeleteUser` קורא ל־`deleteCustomerUser(customerUserId)` (שורות 177–186). המחיקה מתבצעת רק על טבלת `customer_users`; אין מחיקה מ־`auth.users` או מ־`users`, כך שהמשתמש עדיין יכול להתחבר.

---

## 6. Dashboard (דשבורד ניהול)

### API routes תחת `/api/`
- **POST** `/api/customer-users` — יצירת משתמש פורטל (auth + users + customer_users).
- **POST** `/api/drivers` — יצירת נהג (auth + users + drivers, אופציונלי driver_truck_assignments).
- **POST** `/api/admin/create-company` — יצירת חברה, מנוי, ומשתמש אדמין (invite או סיסמה).
- **DELETE** `/api/admin/delete-company` — מחיקת חברה וכל הנתונים המשויכים.
- **POST** `/api/admin/reset-password` — איפוס סיסמה (קישור במייל או עדכון ידני).

**כל ה־API routes האלה משתמשים ב־service role; אף אחד מהם לא בודק JWT או session — גישה פתוחה למי שיודע את ה־URL.**

### ניהול משתמשי פורטל (customer_users)
- **דשבורד — דף פרטי לקוח:** `app/dashboard/customers/[id]/page.tsx` — טאב "משתמשי פורטל": רשימת משתמשים (via `getCustomerUsers`), הוספה (via `createCustomerUser` → POST `/api/customer-users`), עדכון תפקיד (`updateCustomerUserRole`), הפעלה/השבתה (`toggleCustomerUserActive`), מחיקה (`deleteCustomerUser`).
- **דף "ניהול משתמשים" בתוך הפורטל (תוכן):** `app/dashboard/customers/users/page.tsx` — מיועד ל־customer עם תפקיד admin: טוען `getCustomerForUser` ו־`getCustomerUsers`, מציג רשימה, עדכון תפקיד והפעלה/השבתה (בלי מחיקה). **ה־URL של הדף הזה הוא `/dashboard/customers/users`**, בעוד שבתפריט הפורטל הקישור הוא ל־`/customer/users` (שאינו קיים).

### לוגיקת מחיקת משתמש פורטל
- **פרונט:** `app/dashboard/customers/[id]/page.tsx`: כפתור/מודל מחיקה → `handleDeleteUser(customerUserId)` → `deleteCustomerUser(customerUserId)`.
- **שכבת data:** `app/lib/queries/customer-portal.ts` — `deleteCustomerUser` עושה רק `supabase.from('customer_users').delete().eq('id', customerUserId)`.
- **תוצאה:** הרשומה ב־`customer_users` נמחקת; הרשומות ב־`users` ו־`auth.users` נשארות — המשתמש יכול עדיין להתחבר למערכת.

---

## 7. Realtime

- **`app/driver/page.tsx`** — channel `driver-realtime-{driverId}` על טבלת **`tows`** עם `driver_id=eq.{driverId}`; ב־cleanup: `removeChannel`.
- **`app/dashboard/tows/[id]/page.tsx`** — channel `tow-realtime-{towId}` על **`tow_points`**, **`tow_images`**, **`tows`** (UPDATE); ב־cleanup: `removeChannel`.

אין שימוש נוסף ב־realtime (למשל על `customer_users` או `customers`).

---

## 8. Environment

- **`.env*`** ב־`.gitignore` — לא נבדקו ערכים, רק שמות משתנים מהשימוש בקוד.

### שמות משתנים שמופיעים בקוד
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (מפות)
- `RESEND_API_KEY` (מייל ב־create-company, reset-password)
- `NEXT_PUBLIC_APP_URL` (ב־create-company — קישור לוגין בהזמנה)
- **ב־login (דיבאג):** `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` — לא בשימוש ב־supabase client (ב־supabase משתמשים ב־`NEXT_PUBLIC_SUPABASE_ANON_KEY`).

לא נמצא קובץ `.env.example` או תיעוד רשמי של הבדלים בין dev ל־production; ההנחה היא שההבדל הוא בערכי המשתנים (למשל Supabase project נפרד, RESEND וכו').

---

## 9. חיפוש באגים ובעיות

להלן ממצאים לפי קטגוריות, עם קובץ, שורה (בערך), חומרה, תיאור, השפעה ותיקון מוצע — **בלי לבצע שינויים בקוד.**

---

### אבטחה

**1) API routes בלי בדיקת auth/authorization**  
- **קבצים:** `app/api/customer-users/route.ts`, `app/api/drivers/route.ts`, `app/api/admin/create-company/route.ts`, `app/api/admin/delete-company/route.ts`, `app/api/admin/reset-password/route.ts`.  
- **חומרה:** קריטי.  
- **תיאור:** אף route לא בודק JWT, session או role. כל קריאה עם body/params מתאימים תפעיל את הפעולה.  
- **השפעה:** יצירת משתמשי פורטל/נהגים, יצירה/מחיקת חברות, איפוס סיסמאות — מכל client שיודע את ה־URL.  
- **תיקון מוצע:** בכל route: לאמת session (למשל `createServerClient` מ־@supabase/ssr או JWT מה־cookie), ולבדוק role (למשל רק company_admin יכול POST ל־customer-users/drivers, רק super_admin ל־admin/*). להחזיר 401/403 כשהמשתמש לא מאומת או לא מורשה.

**2) מחיקת "משתמש פורטל" רק מ־customer_users**  
- **קובץ:** `app/lib/queries/customer-portal.ts` (פונקציה `deleteCustomerUser`).  
- **חומרה:** בינוני.  
- **תיאור:** המחיקה היא רק מ־`customer_users`. לא נמחקים `users` ו־`auth.users`.  
- **השפעה:** משתמש "מחוק" עדיין יכול להתחבר; יופיע ב־login כ־customer ויוכל לגשת לפורטל עד ש־RLS/לוגיקה חוסמת.  
- **תיקון מוצע:** להחליט אם "מחיקה" = הסרת גישה (רק customer_users / is_active) או מחיקה מלאה. אם מלאה — להוסיף API route שמשתמש ב־service role ומוחק גם מ־auth (admin.deleteUser) ומ־users, ולוודא שהקריאה אליו מורשית (רק ממנהלי החברה ללקוח הזה).

**3) חוסר validation על input ב־API**  
- **קבצים:** כל ה־API routes.  
- **חומרה:** בינוני.  
- **תיאור:** יש בדיקות בסיסיות (למשל `!email || !fullName || !customerId` ב־customer-users), אבל אין ולידציה לפורמט (אימייל, טלפון), אורך, או שה־customerId שייך לחברה של המשתמש.  
- **השפעה:** נתונים לא תקינים או ניצול של customerId של לקוח אחר.  
- **תיקון מוצע:** לוודא פורמט (אימייל, טלפון), אורך מקסימלי, ולאחר אימות משתמש — לוודא ש־customerId שייך ל־company_id של המשתמש (או ל־customer_company).

**4) סיסמה זמנית מוחזרת ב־response**  
- **קובץ:** `app/api/customer-users/route.ts` (שורות 67–71), `app/api/drivers/route.ts` (שורות 101–105).  
- **חומרה:** בינוני.  
- **תיאור:** `tempPassword` מוחזר ב־JSON ל־client.  
- **השפעה:** אם ה־API לא מוגן, הסיסמה נחשפת; גם עם הגנה, עדיף לשלוח במייל/SMS ולא ב־response.  
- **תיקון מוצע:** לא להחזיר סיסמה ב־response; לשלוח קישור איפוס או סיסמה זמנית במייל/מסרון. אם חייבים להציג פעם אחת — רק אחרי אימות חזק ו־HTTPS.

---

### לוגיקה

**5) קישור בתפריט פורטל לדף שלא קיים**  
- **קובץ:** `app/customer/layout.tsx` (שורה 78).  
- **חומרה:** בינוני.  
- **תיאור:** `href: '/customer/users'` — אין `app/customer/users/page.tsx`.  
- **השפעה:** לחיצה על "משתמשים" בפורטל מובילה ל־404.  
- **תיקון מוצע:** ליצור `app/customer/users/page.tsx` (למשל עם אותו תוכן כמו `app/dashboard/customers/users/page.tsx`), או לשנות את הקישור ל־`/dashboard/customers/users` אם רוצים שהלקוח ייכנס תחת דשבורד (פחות מתאים ל־UX של פורטל).

**6) Dashboard בלי redirect כשאין משתמש**  
- **קובץ:** `app/dashboard/layout.tsx`.  
- **חומרה:** בינוני.  
- **תיאור:** ה־layout רק מציג loading מ־useAuth(); כש־loading=false ו־user=null אין redirect ל־/login.  
- **השפעה:** משתמש לא מאומת יכול לראות את מבנה הדשבורד (סיידבר) ודפים ש־companyId=null (תוכן ריק/שגיאות).  
- **תיקון מוצע:** אחרי `loading === false` אם `!user` לבצע `router.push('/login')` (או redirect דומה) ולא להציג את תוכן הדשבורד.

**7) Driver — אין redirect מפורש כשאין user**  
- **קובץ:** `app/driver/page.tsx` (ו־layout).  
- **חומרה:** נמוך–בינוני.  
- **תיאור:** כש־user null, loadData לא רץ ו־driverInfo נשאר null — מוצגת הודעת שגיאה ("לא נמצא פרופיל נהג"). אין redirect ל־/driver/login או /login.  
- **השפעה:** חוויית משתמש מבלבלת; גישה עקיפה לאזור נהג בלי התחברות.  
- **תיקון מוצע:** אם `!authLoading && !user` → `router.push('/driver/login')` או `/login`.

**8) אי-טיפול ב־error ב־loadNotifications (driver layout)**  
- **קובץ:** `app/driver/layout.tsx` (שורות 68–76).  
- **תיאור:** `const { data } = await supabase...` — לא נבדק `error`.  
- **חומרה:** נמוך.  
- **תיקון מוצע:** לבדוק `error` ולהימנע משימוש ב־data במקרה של שגיאה; אופציונלי: להציג state של "שגיאה בהתראות".

**9) useEffect עם dependency חסר (loadData)**  
- **קבצים:** למשל `app/driver/page.tsx` — `useEffect(() => { if (!authLoading && user) loadData() }, [authLoading, user])` אבל `loadData` תלוי ב־user.  
- **חומרה:** נמוך.  
- **תיאור:** אם `loadData` לא יציב (לא עטוף ב־useCallback), ייתכן אזהרות או ריצות מיותרות.  
- **תיקון מוצע:** לכלול את `loadData` ב־dependency array או להגדיר `loadData` עם useCallback ו־deps מתאימים.

---

### Supabase & RLS

**10) deleteCustomerUser רץ עם anon client**  
- **קובץ:** `app/lib/queries/customer-portal.ts`.  
- **תיאור:** הפונקציה נקראת מהדשבורד (משתמש חברה); היא משתמשת ב־`supabase` (anon).  
- **חומרה:** תלוי ב־RLS.  
- **השפעה:** אם ל־customer_users אין policy שמאפשרת למשתמשי החברה למחוק רק רשומות של הלקוחות שלהם — ייתכן 403 או גישה לא נכונה.  
- **תיקון מוצע:** לוודא ש־RLS על `customer_users` מאפשר DELETE רק כאשר ה־customer שייך ל־company_id של המשתמש המחובר (או דרך customer_company). אם המבנה לא תומך — לשקול API route עם service role + אימות ובדיקת שיוך בח backend.

**11) realtime subscriptions**  
- **תיאור:** ב־driver ו־dashboard/tows/[id] יש cleanup עם `removeChannel`.  
- **חומרה:** נמוך.  
- **תיקון מוצע:** להשאיר כ־is; אם יוסיפו ערוצים נוספים — לוודא תמיד unsubscribe ב־return של useEffect.

---

### ביצועים

**12) שימוש ב־select('*')**  
- **קבצים:** רבים — למשל `app/lib/queries/tows.ts`, `driver-tasks.ts`, `trucks.ts`, `AuthContext.tsx`, `rejection-requests.ts`, `price-lists.ts`, `calendar.ts`, `dashboard.ts`, `invoices.ts`, `settings.ts`, `superadmin.ts`, וכו'.  
- **חומרה:** נמוך.  
- **תיאור:** שליפה של כל העמודות במקום רשימת עמודות נדרשת.  
- **השפעה:** יותר נתונים ברשת ו־בדБ; בטבלאות גדולות יכול להאט.  
- **תיקון מוצע:** להחליף ל־select עם רשימת עמודות (או select עם nested לפי צורך) בד-queries מרכזיים.

**13) חוסר pagination**  
- **תיאור:** שאילתות כמו רשימת גרירות, משתמשים, התראות — לא תמיד עם limit/pagination.  
- **חומרה:** נמוך עד בינוני (תלוי בנפח).  
- **תיקון מוצע:** להוסיף limit סביר ו־offset/cursor בדפים שמציגים רשימות גדולות.

---

### UX וקוד

**14) console.log ב־production**  
- **קבצים:** למשל `app/login/page.tsx` (ENV check, User query result), `app/lib/AuthContext.tsx` (Auth state, fetchUserData), `app/dashboard/page.tsx` (Auth state), `app/dashboard/drivers/page.tsx`, `app/dashboard/tows/new/page.tsx`, `app/lib/queries/calendar.ts` (הרבה DEBUG), `app/components/NewTaskModal.tsx`, `app/driver/history/page.tsx`, `RouteBuilder.tsx`, `AddressInput.tsx`, `PinDropModal.tsx`, `vehicle-lookup.ts`, `api/admin/create-company/route.ts`, `api/admin/delete-company/route.ts`.  
- **חומרה:** נמוך.  
- **תיאור:** console.log/console.error לדיבאג נשארו.  
- **השפעה:** זיהום קונסול, אפשרות לדליפת מידע.  
- **תיקון מוצע:** להסיר או לעטוף ב־`if (process.env.NODE_ENV === 'development')`; להשאיר רק טיפול בשגיאות הכרחי (למשל logger).

**15) אי-התאמה בשם משתנה env לוגין**  
- **קובץ:** `app/login/page.tsx` (שורות 16–17).  
- **תיאור:** בודק `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` בעוד שהקליינט משתמש ב־`NEXT_PUBLIC_SUPABASE_ANON_KEY`.  
- **חומרה:** נמוך.  
- **תיקון מוצע:** לתקן את ה־ENV check להשתמש ב־`NEXT_PUBLIC_SUPABASE_ANON_KEY` או להסיר את ה־log.

**16) err: any ב־API**  
- **קובץ:** `app/api/customer-users/route.ts` (שורה 72).  
- **תיאור:** `catch (err: any)` ושימוש ב־`err.message`.  
- **חומרה:** נמוך.  
- **תיקון מוצע:** להגדיר כ־`unknown` ולטפל בהתאם (למשל `err instanceof Error ? err.message : 'שגיאה ביצירת המשתמש'`).

**17) (data.customer as any) ב־customer-portal**  
- **קובץ:** `app/lib/queries/customer-portal.ts` (שורות 30–33).  
- **תיאור:** casting ל־any עבור customer.  
- **תיקון מוצע:** להגדיר טייפ מפורש ל־select של customer (או interface) ולהימנע מ־any.

---

### סיכום ממצאים (חומרה)

- **קריטי:** API routes בלי auth (1).
- **בינוני:** מחיקה חלקית של משתמש פורטל (2), validation ב־API (3), החזרת סיסמה זמנית (4), קישור 404 לפורטל (5), דשבורד בלי redirect (6), driver בלי redirect (7), RLS/delete customer_user (10).
- **נמוך:** שאר הסעיפים (8, 9, 11, 12, 13, 14, 15, 16, 17).

---

*סיום הסיכום. לא בוצעו שינויים בקוד.*
