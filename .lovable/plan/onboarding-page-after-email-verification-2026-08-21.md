# Onboarding page after email verification

New users who click the emailed link land on an onboarding screen that reuses the login layout (centred left column, showcase image on the right) and collects their details before they reach the dashboard.

## The form

All fields are required; the Continue button stays disabled until every one is valid.

- First name and last name (two separate fields)
- Mobile number: a country-code selector (flag + dial code, searchable) next to the number field, international formats supported
- Password: single field with a show/hide eye toggle, minimum length enforced
- Country: searchable select
- Terms checkbox: "I agree to the Terms and Privacy Policy"

Selecting a country silently sets the matching timezone and currency behind the scenes — no visible picker, no hardcoded default.

## Flow

```text
/auth  → emailed link → /auth/callback
   ├─ profile already complete → /dashboard
   └─ no profile yet          → /onboarding → save → /dashboard
```

- `/auth/callback` already checks for a profile row; it will branch to `/onboarding` instead of always going to the dashboard.
- `/onboarding` requires a session; without one it redirects to `/auth`.
- On submit: set the account password, save the profile, then go to the dashboard.
- Someone who already finished onboarding is bounced straight to the dashboard.

## Technical notes

- New route `src/routes/onboarding.tsx`, sharing the split layout and image card from `auth.tsx` (extracted into a small shared layout component).
- Password set with `supabase.auth.updateUser({ password })`, which works because the magic-link session is active.
- Profile write: `full_name` (first + last), `phone` (E.164, dial code + number), plus `country` and `timezone`.
- `profiles` currently has no `country` or `timezone` column, so this needs a small migration adding both (nullable text) with the usual grants — flagging it since core schema is normally authored outside Lovable. No new tables.
- Country → dial code / timezone / currency mapping lives in a local data module (`src/lib/countries.ts`), no region hardcoded in UI.
- Validation with zod; the same rules gate the submit button and the submit handler.
- Business record (name, currency, timezone) is a later screen, per your answer.
