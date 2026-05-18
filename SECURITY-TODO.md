# Security TODO

Tracking findings from the security audit on May 18, 2026. Items are grouped by priority.

## ✅ Completed

### Infrastructure & Config
- [x] Custom domain `magrar-crm.com` connected with HTTPS via Vercel
- [x] `npm audit fix` — patched 6 transitive dependency vulnerabilities
- [x] HTTP security headers added: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`
- [x] Next.js upgraded from 16.0.7 → 16.2.6 (closed 24 CVEs)
- [x] Verified Vercel environment variables — no NEXT_PUBLIC secrets leaked
- [x] Service Role Key audit — verified server-side only, zero client exposure

### Supabase Config
- [x] Verified RLS enabled on all 49 tables
- [x] Disabled `Allow new users to sign up`
- [x] Updated Site URL to `https://magrar-crm.com`
- [x] Added `magrar-crm.com` redirect URLs to allowlist
- [x] Confirmed Supabase rate limits at defaults

### Code Fixes
- [x] Fixed Open Redirect in `app/auth/callback/route.ts` (validates `next` param)
- [x] Set session cookies to `httpOnly: true` in `app/auth/callback/route.ts`

---

## 🚨 BLOCKERS — Must fix before onboarding tenant #2

Multi-tenant IDOR vulnerabilities. Not exploitable with one tenant, but become live the moment a second tenant company exists.

### 1. `POST /api/users` — company_id from request body
Problem: `company_id` comes from request body, allowing company_admin of Company A to create users in Company B.
Fix: For `company_admin`, force `company_id = currentUser.company_id` (ignore body). Only `super_admin` may pass body `company_id`.

### 2. `DELETE /api/users/[id]` — no company verification
Problem: Deletes user by ID without verifying target `company_id`.
Fix: Load target with `company_id`; return 403 if `company_admin` and `target.company_id !== currentUser.company_id`.

### 3. `POST /api/drivers` — companyId from request body
Problem: Same pattern as #1.
Fix: Force `companyId = currentUser.company_id` unless `super_admin`.

### 4. `DELETE /api/drivers/[id]` — no company verification
Problem: Same pattern as #2 but for drivers.
Fix: After fetch, compare `driver.company_id` to `currentUser.company_id` for non-super-admins.

### 5. `POST /api/customer-users` — customerId not tied to caller's company
Problem: `customerId` not verified via `customer_company` junction.
Fix: Verify `customer_company` row exists for `(customerId, currentUser.company_id)` before create.

### 6. `DELETE /api/customer-users` — `customer` role has no resource scope
Problem: Portal user with `role='customer'` can delete arbitrary `customer_users` rows.
Fix: For portal users, require `customer_users` row with `user_id = caller` AND `role = admin`; forbid arbitrary `customerUserId` deletes.

---

## ⚠️ Important — Should fix soon

### Supabase RLS — `users.admin_view_customer_portal_users` policy
Problem: Policy `(role = 'customer'::user_role)` has no company scope — allows any authenticated user to view all customer-role users across all companies.
Fix: Add company scoping OR delete the policy if redundant. Critical before second tenant.

### Supabase RLS — `customers` INSERT policies
Problem: Two duplicate INSERT policies both with `WITH CHECK (true)` — any authenticated user can insert customer records.
Fix: Drop both, create one new with `WITH CHECK (get_my_company_id() IS NOT NULL)`. Rollback SQL documented in audit notes.

### Google Maps API key — not restricted by referrer
Problem: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` exposed in client (necessary) but unrestricted; stolen key billable to your account.
Fix: In Google Cloud Console restrict key to:
- `magrar-crm.com/*`
- `*.magrar-crm.com/*`
- `towing-saas.vercel.app/*` (during transition)
- `localhost:3000/*` (dev)
Also restrict to specific APIs (Maps JS, Geocoding) and set monthly quota cap.

### Content Security Policy (CSP)
Problem: No CSP header — primary XSS defense missing. Mozilla Observatory -25 points.
Fix: Implement CSP in `next.config.ts` after auditing all script/style/image sources (Supabase, Google Maps, Resend, etc.). Likely requires nonces for inline scripts. Estimate: 1-2 hours including testing.

### App-level rate limiting on `/api/auth/forgot-password`
Problem: No application rate limit; Supabase email limit (30/hr project-wide) provides partial defense only.
Fix: Add IP-based rate limiter middleware (e.g., 5 requests per minute per IP).

---

## 💡 Nice to have

### `app/lib/superadmin.ts` — uses anon client for admin methods
Status: Feature currently inactive (not used).
Issue: Calls `supabase.auth.admin.*` via anon client; will fail silently.
Fix when activating: Pass a service-role Supabase client to admin methods.

### Reset-password page — no recovery session check
Problem: `app/reset-password/page.tsx` doesn't check that a valid recovery session exists before showing the form.
Risk: UX confusion (user types password, gets error after submit), not a security flaw.
Fix: On mount, check session exists; if not, redirect to `/forgot-password` with message.

### Session expiration — currently "never"
Status: Set to `0` (never) in Supabase. Deferred for driver UX reasons.
Consider: 30-day Time-box once user base scales beyond pilot. With httpOnly cookies and Open Redirect now fixed, immediate risk is low.

### Captcha + Leaked Password Protection
Status: Disabled in Supabase Attack Protection. Deferred to keep UX simple for drivers.
Consider: Enable Leaked Password protection at minimum once user base grows beyond known team.

---

## Future audits (separate sessions)

- Layer 4 — Active testing: try unauthorized requests, cross-tenant access attempts, privilege escalation
- CSP rollout: identify all required sources, implement with nonces, test all flows
- Pen testing: consider hiring outside firm before public launch with paying customers
- OWASP Top 10 systematic review
- Dependency scanning automation (GitHub Dependabot or similar)

---
*Generated: May 18, 2026 — Security audit session*
