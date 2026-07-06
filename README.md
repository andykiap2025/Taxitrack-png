# Safeco Taxi Service 🚕

Taxi fleet management for Port Moresby operators (project codename: TaxiTrack PNG).
Built by **Skyworks Systems** · © 2026.

The owner leases taxis to drivers. Every night at 11pm the taxis check in at
base and takings are recorded **against the driver** (no entry = didn't work =
no target). Drivers earn **29% of gross takings each fortnight**; days under
the K180/K210 target write shortfall debits and strong days write surplus
credits to a balance ledger that nets out at payroll. The app also tracks
servicing (3 months / 5,000 km), compliance expiries (rego, safety sticker,
MVIL, licenses), incidents, and produces PDF payslips and fleet reports.

## Stack

- **Expo SDK 57** (React Native + TypeScript), expo-router
- **Supabase** — Postgres, Auth, Storage, Row Level Security
- **Offline-first check-in** — entries queue in AsyncStorage and sync on reconnect
- Roles: **owner** (everything) · **supervisor** (check-in, fleet, service; compliance read-only) ·
  **driver** (own takings & payslips)

## Running it

```bash
npm install
npx expo start        # press w for browser, or scan the QR with Expo Go
```

First time? Set up the backend once: follow **[supabase/README.md](supabase/README.md)**
(create the free Supabase project, run the 4 migrations, create logins, fill `.env`).

## Building the Android app (APK)

```bash
npm install -g eas-cli
eas login             # free expo.dev account
eas init              # once, links the project
eas build -p android --profile preview
```

EAS builds in the cloud and gives you a download link for the APK — install it
directly on any Android phone (no Play Store needed).

## Project map

- `src/app/` — screens (expo-router): tabs (dashboard, check-in, fleet, payroll,
  more) + detail/form screens
- `src/components/ui/` — the design system (cards, buttons, inputs, badges…)
- `src/lib/` — business logic: `payroll.ts` (pure, tested money math),
  `offlineQueue.ts`, `checkin.ts`, `format.ts` (PGK / DD/MM/YYYY)
- `supabase/migrations/` — full schema, RLS policies, triggers (audit, ledger,
  odometer), storage buckets
- `CLAUDE.md` — the non-negotiable business rules

## Going live

Before the first real night: clear the demo data by running the `truncate …`
statement at the top of `supabase/seed.sql` in the Supabase SQL Editor, then add
the real vehicles and drivers in the app.
