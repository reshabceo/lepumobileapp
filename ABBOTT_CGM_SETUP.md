# Abbott CGM — Connect FreeStyle Libre to Monitraq

This guide explains how to connect an **Abbott FreeStyle Libre** sensor to the **Monitraq** mobile app using **LibreView**, **Junction** (formerly Vital), and **Supabase**.

---

## Overview

Monitraq does **not** talk to the Libre sensor directly. Data flows through Abbott’s cloud and Junction’s API:

```
FreeStyle Libre Sensor
        ↓
FreeStyle Libre app (phone)
        ↓
LibreView cloud (libreview.com)
        ↓
Junction API (freestyle_libre)
        ↓
Supabase Edge Functions (webhooks)
        ↓
Postgres (glucose_readings)
        ↓
Monitraq app (Abbott CGM screen)
```

**Integration type:** `freestyle_libre` (practice-based).  
The user links their LibreView account to Junction’s practice in the Libre app, then connects in Monitraq with their **LibreView email**.

> Junction no longer supports **new** `abbott_libreview` (password) connections. Do not use LibreView password login on link.tryvital.io for new teams.

---

## Prerequisites

### For developers

| Item | Details |
|------|---------|
| Junction account | [junction.com](https://junction.com) — request FreeStyle Libre / sandbox access |
| Supabase project | Edge Functions + Postgres enabled |
| Supabase CLI | Linked to your project (`supabase link`) |
| Monitraq app | Built with Capacitor; bundle ID `com.monitraq.mobile` |

### For end users (patients)

| Item | Details |
|------|---------|
| FreeStyle Libre sensor | Active, with readings in the Libre app |
| LibreView account | Created in the Libre app; can log in at [libreview.com](https://www.libreview.com) |
| Monitraq account | Logged in (email **can differ** from LibreView — see below) |
| Paid feature | Abbott CGM requires an active Monitraq subscription |

---

## Choose the correct Junction region

Junction teams are **US** or **EU**. The API region must match where the patient’s LibreView data lives.

| Patient LibreView region | Junction team | API base URL | `JUNCTION_LIBRE_REGION` |
|--------------------------|---------------|--------------|-------------------------|
| **India** (and most EU/APAC) | **EU sandbox** | `https://api.sandbox.eu.junction.com` | `in` |
| **United States / Canada** | US sandbox | `https://api.sandbox.us.junction.com` | `us` |

### Why India needs EU

- US sandbox Link API only accepts regions **`us`** and **`ca`**.
- India LibreView accounts (`region: in`) **cannot** be matched on a US Junction team — you get `INVALID_EMAIL_CREDENTIALS` / “email cannot be matched”.
- **EU sandbox** with `JUNCTION_LIBRE_REGION=in` is required for India patients.

Production URLs:

- US: `https://api.us.junction.com`
- EU: `https://api.eu.junction.com`

API key prefixes: `sk_us_...` (US), `sk_eu_...` (EU).

---

## Part 1 — Developer backend setup

### 1.1 Junction Dashboard

1. Create a team in the correct region (**EU for India**).
2. Enable **Sandbox** and request **FreeStyle Libre** integration from Junction if not already enabled.
3. Copy:
   - **Team API key** (`sk_eu_...` or `sk_us_...`)
   - **Webhook signing secret** (`whsec_...`) from Webhooks → your endpoint

Official reference: [Junction Abbott LibreView guide](https://docs.junction.com/wearables/guides/abbott-libreview)

### 1.2 Supabase secrets

Never commit API keys to git. Set via CLI:

**India / EU sandbox (recommended for Indian patients):**

```bash
supabase secrets set JUNCTION_API_KEY=sk_eu_your_key
supabase secrets set JUNCTION_WEBHOOK_SECRET=whsec_your_secret
supabase secrets set JUNCTION_API_BASE_URL=https://api.sandbox.eu.junction.com
supabase secrets set JUNCTION_LIBRE_PROVIDER=freestyle_libre
supabase secrets set JUNCTION_LIBRE_REGION=in
```

**US / Canada sandbox:**

```bash
supabase secrets set JUNCTION_API_KEY=sk_us_your_key
supabase secrets set JUNCTION_WEBHOOK_SECRET=whsec_your_secret
supabase secrets set JUNCTION_API_BASE_URL=https://api.sandbox.us.junction.com
supabase secrets set JUNCTION_LIBRE_PROVIDER=freestyle_libre
supabase secrets set JUNCTION_LIBRE_REGION=us
```

Verify:

```bash
supabase secrets list
```

### 1.3 Database migration

Apply the Junction CGM migration:

```bash
supabase db push
```

Or run manually: `supabase/migrations/20260618000000_junction_cgm_integration.sql`

**Tables:**

| Table | Purpose |
|-------|---------|
| `profiles` | `junction_user_id`, `junction_connected`, user email |
| `glucose_readings` | `user_id`, `glucose`, `trend`, `reading_timestamp` |

Row Level Security (RLS) restricts users to their own data. Realtime is enabled on `glucose_readings`.

### 1.4 Deploy Edge Functions

Each function folder includes its own `junction.ts` (required for Supabase bundling).

```bash
supabase functions deploy create-junction-link
supabase functions deploy junction-webhook --no-verify-jwt
```

| Function | Purpose |
|----------|---------|
| `create-junction-link` | Creates Junction user, connects LibreView email server-side |
| `junction-webhook` | Receives glucose + connection events from Junction |

`junction-webhook` **must** use `--no-verify-jwt` — Junction authenticates with Svix signatures, not Supabase JWT.

### 1.5 Configure Junction webhook

In **Junction Dashboard → Webhooks** (on the **same team** as your API key):

**URL:**

```
https://YOUR_PROJECT_REF.supabase.co/functions/v1/junction-webhook
```

Example: `https://xktewvqzmbkhnrbwtxjb.supabase.co/functions/v1/junction-webhook`

**Subscribe to events:**

- `provider.connection.created`
- `provider.connection.error`
- `daily.data.glucose.created`
- `daily.data.glucose.updated`
- `historical.data.glucose.created`

Copy the endpoint **Signing Secret** into `JUNCTION_WEBHOOK_SECRET`.

> If you switch from US to EU team, create the webhook again on the **EU team** with a new `whsec_...` secret.

---

## Part 2 — End-user setup (Libre app + LibreView)

Complete this **before** connecting in Monitraq.

### 2.1 Sensor and LibreView

1. Install **FreeStyle Libre** app and apply/scan sensor.
2. Confirm glucose readings appear in the app.
3. Ensure a **LibreView account** exists (Settings → LibreView / Account in the Libre app).
4. Verify login at [libreview.com](https://www.libreview.com) with the **same email**.

### 2.2 Link Junction practice in Libre app

1. Open Libre app → **Menu (☰)** → **Connected Apps**.
2. Select **LibreView** (not LibreLinkUp or Libre Data Share).
3. Tap **Connect** / **Connect to a Practice**.
4. Enter Practice ID:

   | Environment | Practice ID |
   |-------------|-------------|
   | Sandbox (testing) | `tryVital-sandbox` |
   | Production | `tryVital` |

5. Confirm the practice appears under linked practices.

**Alternative:** [libreview.com](https://www.libreview.com) → Account Settings → **My Practices** → add `tryVital-sandbox`.

You should see something like:

- **Vital**
- **ID:** tryVital-sandbox
- Address may show Singapore — that is normal for Junction’s global sandbox practice.

### 2.3 Confirm data sync

- Readings visible in Libre app **and** on libreview.com.
- For Libre 3, data uploads automatically when online.
- For Libre 2, scan the sensor to upload.

---

## Part 3 — Connect in Monitraq app

### 3.1 Open Abbott CGM

1. Log into Monitraq.
2. From the home dashboard, open **Abbott CGM** (`/abbott-cgm`).
3. Requires an active paid subscription.

### 3.2 Enter LibreView email

| Field | What to enter |
|-------|----------------|
| **LibreView email** | Email used on libreview.com / Libre app |
| **Monitraq login** | Can be **different** — e.g. Monitraq `user@gmail.com`, LibreView `sahil@gmail.com` |

The app sends only the **LibreView email** to Junction. Monitraq login is used for auth and storing readings under your Monitraq profile.

**Region** is set **server-side** (`JUNCTION_LIBRE_REGION`, typically `in` for EU/India). No browser or Junction Link page is opened.

### 3.3 Connect

1. Tap **Connect Abbott CGM**.
2. Wait for success toast: **Abbott CGM Connected**.
3. Connection status shows **Connected Abbott CGM**.
4. Glucose readings appear within a few minutes (webhook + optional historical backfill).

### 3.4 Reconnect

Use **Reconnect Abbott CGM** if the connection drops (e.g. after LibreView password change). Enter the same LibreView email again.

---

## How the connect flow works (technical)

1. App calls `create-junction-link` with `{ libreview_email }` and Supabase auth JWT.
2. Edge function creates/gets Junction user (`client_user_id` = Supabase `auth.users.id`).
3. Generates a Junction Link token and calls  
   `POST /v2/link/provider/email/freestyle_libre` with email + region.
4. On success, sets `profiles.junction_connected = true`.
5. Junction sends webhooks → `junction-webhook` inserts into `glucose_readings`.
6. App subscribes to Supabase Realtime on `glucose_readings` for live updates.

**Key source files:**

| Path | Role |
|------|------|
| `src/pages/AbbottCGMMonitor.tsx` | UI, connect button, glucose dashboard |
| `src/components/HealthDashboard.tsx` | Abbott CGM card on home |
| `supabase/functions/create-junction-link/` | Connect API |
| `supabase/functions/junction-webhook/` | Webhook handler |
| `supabase/migrations/20260618000000_junction_cgm_integration.sql` | Schema |

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `Unsupported region: in` | US Junction team | Switch to **EU team** + `JUNCTION_LIBRE_REGION=in` |
| `Unsupported region: sg` | Wrong region for US team | Use EU for India; US team only supports `us`/`ca` |
| `email cannot be matched` / `INVALID_EMAIL_CREDENTIALS` | Wrong email, practice not linked, or US team for India patient | Use **LibreView email**; confirm `tryVital-sandbox` on libreview.com; use **EU team** for India |
| Monitraq email used instead of LibreView | User entered wrong email | Enter **libreview.com** email only |
| Connected but no readings | Webhook not configured, or no recent sensor data | Check EU webhook + `junction-webhook` logs; scan sensor; wait 15–30 min |
| `JUNCTION_API_KEY not configured` | Missing secret | Run `supabase secrets set` and redeploy |
| `Invalid signature` on webhook | Wrong `JUNCTION_WEBHOOK_SECRET` or wrong team | Use secret from the **same team** as API key |
| Edge function non-2xx | Old deploy or missing body | Redeploy `create-junction-link`; enter LibreView email in app |

### Useful commands

```bash
# Deploy after code/secret changes
supabase functions deploy create-junction-link
supabase functions deploy junction-webhook --no-verify-jwt

# View function logs
supabase functions logs create-junction-link
supabase functions logs junction-webhook
```

### Verify in Supabase Dashboard

- **Table Editor → `profiles`:** `junction_connected = true`, `junction_user_id` set
- **Table Editor → `glucose_readings`:** rows with your `user_id`
- **Edge Functions → Logs:** successful webhook deliveries

---

## Production checklist

- [ ] Junction **production** team (EU for India patients)
- [ ] Production API URL (`api.eu.junction.com` or `api.us.junction.com`)
- [ ] Production API key and webhook secret in Supabase secrets
- [ ] Practice ID **`tryVital`** (not sandbox) in Libre app for production users
- [ ] Webhook URL points to production Supabase project
- [ ] Migration applied on production database
- [ ] Both edge functions deployed
- [ ] App Store / Play Store build includes Abbott CGM screen

---

## Security notes

- **Never** put `JUNCTION_API_KEY` or `JUNCTION_WEBHOOK_SECRET` in the React app or git.
- Rotate keys if exposed in chat, logs, or commits.
- Webhook verifies Svix signatures in `junction-webhook`.
- Glucose data is protected by Supabase RLS per authenticated user.

---

## Related documentation

- [Junction Abbott LibreView](https://docs.junction.com/wearables/guides/abbott-libreview)
- [Junction Link — email provider](https://docs.junction.com/api-reference/link/link-email-provider)
- Internal legacy doc: `JUNCTION_CGM_SETUP.md` (shorter ops reference)

---

## Quick reference — India patient (verified path)

1. **Junction:** EU sandbox team (`sk_eu_...`)
2. **Secrets:** `api.sandbox.eu.junction.com`, `JUNCTION_LIBRE_REGION=in`
3. **Libre app:** Link practice `tryVital-sandbox` via LibreView → Connected Apps
4. **libreview.com:** Confirm practice + glucose data for LibreView email
5. **Monitraq:** Abbott CGM → enter **LibreView email** → Connect
6. **Expected log:** `Junction email connect succeeded with region "in"`
