# Setting up the TaxiTrack PNG backend (one-time, ~10 minutes)

The app stores all its data in a free [Supabase](https://supabase.com) project.
Follow these steps once; after that the app just works.

## 1. Create the project

1. Go to <https://supabase.com> → **Start your project** → sign up (GitHub or email).
2. Click **New project**:
   - Name: `taxitrack-png`
   - Database password: choose one and **save it somewhere safe**
   - Region: pick **Sydney (ap-southeast-2)** — closest to Port Moresby
3. Wait ~2 minutes while the project is provisioned.

## 2. Run the database migrations

1. In the Supabase dashboard, open **SQL Editor** (left sidebar).
2. Open each file below **in order**, paste its full contents, press **Run**:
   1. `migrations/00001_schema.sql`
   2. `migrations/00002_rls.sql`
   3. `migrations/00003_storage.sql`
   4. `migrations/00004_odometer_sync.sql`
3. Each should end with "Success. No rows returned".

> Already set up before migration 00004 existed? Just run
> `migrations/00004_odometer_sync.sql` on its own — it's safe to add later.

## 3. Load the sample data (recommended for testing)

Paste and run `seed.sql` the same way. This loads 5 vehicles, 6 drivers and
about a month of realistic takings so every screen has data. Before going
live with real records, you can clear it by re-running just the
`truncate …` line at the top of `seed.sql`.

## 4. Create your login accounts

1. In the dashboard go to **Project Settings → API** and copy:
   - **Project URL**
   - **service_role key** (keep secret — it bypasses all security)
2. In PowerShell, from the `taxitrack-png` folder:

```powershell
$env:SUPABASE_URL = "https://YOUR-PROJECT.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "PASTE-SERVICE-ROLE-KEY"
$env:OWNER_EMAIL = "you@example.com";  $env:OWNER_PASSWORD = "choose-a-strong-password"
$env:SUPERVISOR_EMAIL = "supervisor@example.com"; $env:SUPERVISOR_PASSWORD = "another-password"
node scripts/create-users.mjs
```

## 5. Point the app at your project

1. Copy `.env.example` to `.env` (in the `taxitrack-png` folder).
2. Fill in the **Project URL** and the **anon public key**
   (Project Settings → API — the *anon* key, NOT the service_role key).
3. Restart the Expo dev server.

Done. Log in with the owner email/password from step 4.

## 6. Driver logins (optional, any time later)

Drivers can get a read-only login that shows their own takings, fortnight
estimate and payslips:

1. Re-run the step-4 command with driver details instead:

```powershell
$env:SUPABASE_URL = "https://YOUR-PROJECT.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "PASTE-SERVICE-ROLE-KEY"
$env:DRIVER_EMAIL = "driver@example.com"; $env:DRIVER_PASSWORD = "a-password"; $env:DRIVER_NAME = "John Kaupa"
node scripts/create-users.mjs
```

2. In the app (as owner): **Fleet → Drivers → tap the driver → pencil icon →
   App login** → pick the new account → Save.
