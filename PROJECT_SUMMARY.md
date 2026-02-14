# סיכום מפורט של הפרויקט — Towing SaaS

> מסמך זה נוצר על סמך סריקת הקוד. לא בוצעו שינויים בקבצים.

---

## 1. מבנה תיקיות ראשי

| תיקייה | תיאור |
|--------|--------|
| **app/dashboard** | לוח בקרה לחברות — גרירות, לקוחות, נהגים, גררים, לוח שנה, מחירונים, חשבוניות, דוחות, אחסנה, הגדרות, משתמשים. |
| **app/customer** | פורטל לקוח — גרירות של הלקוח, משתמשי פורטל (לפי role). |
| **app/driver** | אפליקציית נהג — משימות, ניווט, היסטוריה, סטטיסטיקות, פרופיל; לוגין נפרד ב־`/driver/login`. |
| **app/api** | API routes — customer-users, admin (reset-password, create-company, delete-company), drivers. |
| **app/lib** | לוגיקה משותפת — AuthContext, supabase client, types, queries (כל ה־DB), auth, vehicle-lookup, utils. |
| **app/components** | קומפוננטות משותפות — Sidebar, NewTaskModal, DriverSchedulePicker, tow-forms (sections, routes, shared), address. |
| **app/login, app/forgot-password, app/reset-password** | התחברות ומשתמשים (ללא driver). |
| **app/superadmin** | ממשק סופר-אדמין — חברות, משתמשים, billing, דוחות, הגדרות מערכת. |
| **app/page.tsx** | דף הבית (root). |

---

## 2. רשימת טבלאות ב-Supabase (מהקוד)

*נלקח מפניות `.from('...')` ו־RPC בקוד. ייתכן שישנן טבלאות נוספות במסד.*

### טבלאות ליבה
| טבלה | שימוש עיקרי |
|------|-------------|
| **users** | משתמשים (כולל role: super_admin, company_admin, dispatcher, driver, customer). |
| **companies** | חברות גרירה. |
| **company_settings** | הגדרות חברה. |
| **company_subscriptions** | מנויים של חברות. |
| **drivers** | נהגים (קישור ל־users דרך user_id). |
| **driver_truck_assignments** | שיוך נהג–גרר. |
| **tow_trucks** | גררים. |
| **customers** | לקוחות (גנרי). |
| **customer_company** | קשר לקוח–חברה (מחירונים, תנאי תשלום). |
| **customer_users** | משתמשי פורטל לקוח (קישור user ↔ customer, role: admin/manager/viewer). |

### גרירות ומסלולים
| טבלה | שימוש עיקרי |
|------|-------------|
| **tows** | גרירות. |
| **tow_vehicles** | רכבים בגרירה. |
| **tow_legs** | רגליים (מסלול ישן). |
| **tow_points** | נקודות גרירה (מבנה חדש). |
| **tow_point_vehicles** | רכבים לפי נקודה. |
| **tow_images** | תמונות גרירה. |
| **tow_status_history** | היסטוריית סטטוס גרירה. |
| **tow_rejection_requests** | בקשת דחייה של נהג. |

### מחירונים ותמחור
| טבלה | שימוש עיקרי |
|------|-------------|
| **price_lists** | מחירון בסיס (מחיר לק"מ, מינימום וכו'). |
| **distance_tiers** | דירוגי מרחק. |
| **truck_type_surcharges** | תוספות לפי סוג גרר. |
| **time_surcharges** | תוספות זמן (שישי/שבת). |
| **location_surcharges** | תוספות מיקום. |
| **service_surcharges** | תוספות שירות. |
| **customer_price_items** | פריטי מחיר ללקוח (מחירון מותאם). |
| **fixed_price_items** | תעריפים קבועים כלליים. |

### אחסנה ורכבים
| טבלה | שימוש עיקרי |
|------|-------------|
| **stored_vehicles** | רכבים באחסנה (מאגר בסיס). |
| **vehicles** | מאגר רכבים (חיפוש לוחית). |
| **vehicle_models** | דגמי רכב. |

### חשבוניות והזמנות
| טבלה | שימוש עיקרי |
|------|-------------|
| **invoices** | חשבוניות. |

### מערכת והנהלה
| טבלה | שימוש עיקרי |
|------|-------------|
| **notifications** | התראות (נהגים). |
| **subscription_plans** | תוכניות מנוי (סופר-אדמין). |
| **billing_history** | היסטוריית חיוב. |
| **audit_log** | לוג ביקורת. |
| **impersonation_sessions** | אימפרסונציה (כניסה כחברה). |
| **system_settings** | הגדרות מערכת (סופר-אדמין). |

### Storage (Supabase Storage — לא טבלאות)
- `company-logos` — לוגואים.
- `truck-documents` — מסמכי גרר.
- `tow-images` — תמונות גרירה.

---

## 3. רשימת API Routes

| נתיב | קובץ | תיאור (מהקוד) |
|------|------|----------------|
| **POST/GET/DELETE /api/customer-users** | `app/api/customer-users/route.ts` | ניהול משתמשי פורטל לקוח (יצירה, רשימה, מחיקה) — משתמש ב־service role. |
| **POST /api/admin/reset-password** | `app/api/admin/reset-password/route.ts` | איפוס סיסמה (admin). |
| **POST /api/admin/create-company** | `app/api/admin/create-company/route.ts` | יצירת חברה חדשה + הגדרות + משתמש ראשון. |
| **POST /api/admin/delete-company** | `app/api/admin/delete-company/route.ts` | מחיקת חברה וכל הנתונים המשויכים. |
| **POST/GET/DELETE /api/drivers** | `app/api/drivers/route.ts` | רישום/קבלת/מחיקת נהג — משתמש ב־service role. |

*אין API route ליצירת לקוח (customers) — נעשה ישירות מהקליינט.*

---

## 4. רשימת דפים (Pages)

### Dashboard (משתמשי חברה: company_admin, dispatcher)
| נתיב | קובץ |
|------|------|
| /dashboard | `app/dashboard/page.tsx` |
| /dashboard/tows | `app/dashboard/tows/page.tsx` |
| /dashboard/tows/new | `app/dashboard/tows/new/page.tsx` |
| /dashboard/tows/[id] | `app/dashboard/tows/[id]/page.tsx` |
| /dashboard/calendar | `app/dashboard/calendar/page.tsx` |
| /dashboard/customers | `app/dashboard/customers/page.tsx` |
| /dashboard/customers/[id] | `app/dashboard/customers/[id]/page.tsx` |
| /dashboard/customers/users | `app/dashboard/customers/users/page.tsx` |
| /dashboard/drivers | `app/dashboard/drivers/page.tsx` |
| /dashboard/trucks | `app/dashboard/trucks/page.tsx` |
| /dashboard/storage | `app/dashboard/storage/page.tsx` |
| /dashboard/price-lists | `app/dashboard/price-lists/page.tsx` |
| /dashboard/invoices | `app/dashboard/invoices/page.tsx` |
| /dashboard/reports | `app/dashboard/reports/page.tsx` |
| /dashboard/reports/customer/[id] | `app/dashboard/reports/customer/[id]/page.tsx` |
| /dashboard/reports/driver/[id] | `app/dashboard/reports/driver/[id]/page.tsx` |
| /dashboard/settings | `app/dashboard/settings/page.tsx` |
| /dashboard/users | `app/dashboard/users/page.tsx` |

### Customer (פורטל לקוח — role: customer)
| נתיב | קובץ |
|------|------|
| /customer | `app/customer/page.tsx` |
| /customer/tows/[id] | `app/customer/tows/[id]/page.tsx` |
| /customer/users | `app/customer/users/page.tsx` |

### Driver (אפליקציית נהג)
| נתיב | קובץ |
|------|------|
| /driver | `app/driver/page.tsx` |
| /driver/login | `app/driver/login/page.tsx` |
| /driver/task/[id] | `app/driver/task/[id]/page.tsx` |
| /driver/navigation/[id] | `app/driver/navigation/[id]/page.tsx` |
| /driver/history | `app/driver/history/page.tsx` |
| /driver/stats | `app/driver/stats/page.tsx` |
| /driver/profile | `app/driver/profile/page.tsx` |

### Superadmin
| נתיב | קובץ |
|------|------|
| /superadmin | `app/superadmin/page.tsx` |
| /superadmin/users | `app/superadmin/users/page.tsx` |
| /superadmin/companies | `app/superadmin/companies/page.tsx` |
| /superadmin/companies/new | `app/superadmin/companies/new/page.tsx` |
| /superadmin/companies/[id] | `app/superadmin/companies/[id]/page.tsx` |
| /superadmin/companies/[id]/edit | `app/superadmin/companies/[id]/edit/page.tsx` |
| /superadmin/billing | `app/superadmin/billing/page.tsx` |
| /superadmin/reports | `app/superadmin/reports/page.tsx` |
| /superadmin/settings | `app/superadmin/settings/page.tsx` |

### כללי
| נתיב | קובץ |
|------|------|
| / | `app/page.tsx` |
| /login | `app/login/page.tsx` |
| /forgot-password | `app/forgot-password/page.tsx` |
| /reset-password | `app/reset-password/page.tsx` |

---

## 5. קומפוננטות תחת app/components

| קומפוננטה | נתיב |
|------------|------|
| Sidebar | `app/components/Sidebar.tsx` |
| NewTaskModal | `app/components/NewTaskModal.tsx` |
| DriverSchedulePicker | `app/components/DriverSchedulePicker.tsx` |
| **tow-forms/sections** | CustomerSection, TowTypeSelector, PaymentSection, PriceSummary |
| **tow-forms/routes** | SingleRoute, ExchangeRoute, RouteBuilder, AddressInput, VehicleCard, StorageVehicleSelector, VehicleInfoCard |
| **tow-forms/shared** | VehicleLookup, ServiceSurchargeSelector, TowTruckTypeSelector, DefectSelector, PinDropModal, StartFromBase |
| **address** | AddressInput, DistanceDisplay, PinDropModal |

---

## 6. פונקציות ב-app/lib/queries (לפי קובץ)

### storage.ts
- getStoredVehicles, searchStoredVehicle, addVehicleToStorage, releaseVehicleFromStorage, updateStoredVehicle, getVehicleStorageHistory, getStorageStats, getCustomerStoredVehicles

### tows.ts
- getTows, getTow, getTowWithPoints, createTow, updateTowStatus, assignDriver, updateTowPrice, updateTow, deleteTow, recalculateTowPrice

### customer-portal.ts
- getCustomerForUser, getCustomerTows, getCustomerTowDetail, getCustomerUsers, getCustomerStats, createCustomerUser, updateCustomerUserRole, toggleCustomerUserActive, deleteCustomerUser

### drivers.ts
- getDrivers, createDriver, updateDriver, deleteDriver, checkDuplicates, updateDriverStatus, getAvailableDrivers

### driver-tasks.ts
- getDriverByUserId, getDriverTasks, getDriverTasksToday, getTaskDetail, getDriverStats, updateDriverStatus, acceptTask, rejectTask, updateTaskStatus, updateTaskStatusWithHistory, updateLegStatus, updatePointStatus, uploadTowImage, deleteTowImage, getPointImages, getTowStatusHistory, areAllPointsCompleted, getCurrentPoint, getCurrentPointIndex

### trucks.ts
- uploadTruckDocument, deleteTruckDocument, getTrucks, createTruck, updateTruck, updateWinterInspection, deleteTruck, checkTruckDuplicate

### rejection-requests.ts
- createRejectionRequest, getPendingRejectionRequest, countPendingRejectionRequests, getPendingRejectionRequests, approveRejectionRequest, denyRejectionRequest

### price-lists.ts
- getBasePriceList, upsertBasePriceList, getDistanceTiers, saveDistanceTiers, getTruckTypeSurcharges, saveTruckTypeSurcharges, getTimeSurcharges, saveTimeSurcharges, getLocationSurcharges, saveLocationSurcharges, getServiceSurcharges, saveServiceSurcharges, getCustomersWithPricing, updateCustomerPricing, getFixedPriceItems, saveFixedPriceItems, getFullPriceList, isTimeInRange, isSaturday, isFriday, getActiveTimeSurcharges, calculateTimeSurchargePercent

### settings.ts
- getCompanyDetails, updateCompanyDetails, getCompanySettings, updateCompanySettings, updateIntegrations, uploadCompanyLogo, deleteCompanyLogo

### calendar.ts
- getCalendarTows, getWeekTows, getDayTows, updateTowSchedule

### alerts.ts
- getExpiryAlerts

### users.ts
- getUsers, getUser, getUserStats, createUser, updateUser, toggleUserStatus, deleteUser, sendPasswordReset, getRoleLabel, getRoleColor

### reports.ts
- getDateRange, getReportsSummary, getTowsOverTime, getVehicleTypeBreakdown, getTowReasonBreakdown, getCustomerTypeBreakdown, getTopDrivers, getTopCustomers, getDriverReport, getDriverTowsOverTime, getDriverTows, getCustomerReport, getCustomerTowsOverTime, getCustomerTows

### invoices.ts
- getInvoices, getInvoice, getInvoiceStats, generateInvoiceNumber, createInvoice, createInvoiceFromTow, updateInvoice, updateInvoiceStatus, deleteInvoice, addInvoiceItem, updateInvoiceItem, deleteInvoiceItem, getInvoiceByTowId, towHasInvoice, getTowsWithoutInvoice

### dashboard.ts
- getDashboardStats, getRecentTows

### customers.ts
- getCustomers, createCustomer, updateCustomer, deleteCustomer, checkCustomerDuplicate

---

## 7. מבנה Auth — AuthContext, Roles, זיהוי סוג משתמש

### AuthContext (`app/lib/AuthContext.tsx`)
- **ערכים:** `user`, `loading`, `companyId`, `signOut`.
- **אתחול:** `supabase.auth.getSession()` ואז שליפת רשומת `users` לפי `session.user.id`.
- **עדכון:** `onAuthStateChange` — ב־SIGNED_OUT מאפסים `user` ל־null.
- **companyId:** נגזר מ־`user?.company_id` (null ל־customer / super_admin שאין להם company).

### Roles (מטבלת users — `UserRole`)
- **super_admin** — גישה ל־/superadmin.
- **company_admin** — מנהל חברה (דשבורד).
- **dispatcher** — מפעיל (דשבורד).
- **driver** — נהג (משתמש ב־/driver; יש גם שורה ב־`drivers` עם `user_id`).
- **customer** — לקוח (משתמש בפורטל /customer; פרטי לקוח מ־`getCustomerForUser` דרך `customer_users`).

### זיהוי סוג משתמש
- **בדשבורד:** `user.role !== 'customer'` (ולא driver לדשבורד רגיל) + `user.company_id` לא null.
- **בפורטל לקוח:** `user.role === 'customer'`; פרטי הלקוח וה־role בתוך הפורטל (admin/manager/viewer) מ־`getCustomerForUser` → `customerUserRole`.
- **באפליקציית נהג:** אותו `user` עם `role === 'driver'`; קיום רשומה ב־`drivers` עם `user_id = user.id` (נבדק ב־`getDriverByUserId`). לוגין נפרד ב־/driver/login.

---

## 8. מבנה הנהג — אפליקציית נהג, מה הנהג יכול לעשות

### גישה
- לוגין: `/driver/login` (אותו Supabase Auth).
- אחרי התחברות: Layout טוען `getDriverByUserId(user.id)` — אם אין נהג, מוצגת שגיאה.

### דפים
- **/driver** — בית: רשימת משימות (getDriverTasks), סטטוס (available/busy/break/unavailable), קבלה/דחייה של משימה, פתיחת פרטי משימה.
- **/driver/task/[id]** — פרטי משימה: נקודות, סטטוסים, עדכון סטטוס נקודה, העלאת תמונות.
- **/driver/navigation/[id]** — ניווט (Waze וכו').
- **/driver/history** — היסטוריית גרירות.
- **/driver/stats** — סטטיסטיקות.
- **/driver/profile** — פרופיל נהג.

### יכולות (מהקוד)
- צפייה במשימות ששויכו אליו.
- עדכון סטטוס נהג (available/busy/break/unavailable) ב־`drivers.status`.
- קבלת משימה (acceptTask) / דחייה עם סיבה (rejectTask → tow_rejection_requests).
- עדכון סטטוס נקודות (updatePointStatus) וסטטוס גרירה.
- העלאת תמונות (uploadTowImage) ומחיקה (deleteTowImage).
- צפייה בהתראות (טבלת notifications).
- Realtime על טבלת `tows` לפי `driver_id`.

---

## 9. מבנה הפורטל — מה הלקוח רואה, Roles (admin/manager/viewer)

### גישה
- רק `user.role === 'customer'`.
- פרטי לקוח ו־role: `getCustomerForUser(user.id)` → `customerId`, `customerName`, `customerType`, `customerUserRole`, `portalSettings`.

### תפריט (layout)
- **גרירות** — תמיד.
- **משתמשים** — רק אם `customerUserRole === 'admin'` (מוסתר מ־manager ו־viewer).

### דפים
- **/customer** — רשימת גרירות הלקוח (getCustomerTows), סטטיסטיקות (getCustomerStats), סינון וחיפוש. תצוגה לפי portal_settings (לא מוצג מחיר אם כבוי).
- **/customer/tows/[id]** — פרטי גרירה: נהג, רכבים, מסלול, תמונות, הערות — כולם לפי portal_settings (show_driver_info, show_photos, show_price וכו').
- **/customer/users** — רק ל־admin: ניהול משתמשי פורטל (createCustomerUser, עדכון role, הפעלה/כיבוי, מחיקה).

### Roles בפורטל (`CustomerUserRole` — טבלת customer_users)
- **admin** — גישה ל"משתמשים" וניהול משתמשי פורטל.
- **manager** — ללא טאב "משתמשים".
- **viewer** — ללא טאב "משתמשים".

ההצגה/הסתרה של מחיר, תמונות, נהג וכו' נשלטת על ידי **portal_settings** של הלקוח (מטבלת customers / customer_company), לא לפי role של המשתמש בפורטל.

---

## 10. RPC Functions ב-Supabase (מהקריאות בקוד)

| RPC | קובץ | שימוש |
|-----|------|--------|
| **add_vehicle_to_storage** | `app/lib/queries/storage.ts` | הכנסת רכב לאחסנה (פרמטרים: p_company_id, p_customer_id, p_plate_number, p_vehicle_data, p_location, p_tow_id, p_performed_by, p_notes). |
| **release_vehicle_from_storage** | `app/lib/queries/storage.ts` | שחרור רכב מאחסנה (p_stored_vehicle_id, p_tow_id, p_performed_by, p_notes). |
| **get_vehicle_storage_history** | `app/lib/queries/storage.ts` | היסטוריית אחסנה לרכב (p_stored_vehicle_id, p_limit). |

*לא נמצאו קריאות RPC נוספות בפרויקט (רק שלושת אלה).*

---

*סוף הסיכום.*
