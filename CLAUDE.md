# TaxiTrack PNG — Claude Code Anchor

Display name: **Safeco Taxi Service** (all user-visible branding).
Technical ids keep the codename: slug taxitrack-png, package com.skyworks.taxitrackpng.

## What this is
Taxi fleet management app for PNG taxi operators.
Owner/builder: Skyworks Systems (formerly written as Skyworks Communication and Computing). Attribution line: "Built by Skyworks Systems · © 2026".
Full spec: ../TaxiTrack-PNG-Build-Plan.md · Design bar: ../Premium Mobile App Design Rules.pdf

## Stack
- React Native + Expo SDK 57 (TypeScript), expo-router (src/app)
- Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ (see AGENTS.md)
- Supabase: Postgres, Auth, Storage, RLS (migrations in supabase/migrations)
- Offline-first: local queue in AsyncStorage, sync on reconnect
- Path alias `@/*` → `src/*`

## PNG Conventions (NON-NEGOTIABLE)
- Currency: PGK, format "K1,234.50" via src/lib/format.ts formatPGK()
- Dates: DD/MM/YYYY, timezone Pacific/Port_Moresby (business day = POM date, use todayISO())
- Phone: +675 format

## Business Rules (NON-NEGOTIABLE)
- Daily takings are recorded AGAINST THE DRIVER: one record
  per (driver_id, date), unique-constrained. No record for a
  date = driver didn't work (sick/off) → NO target applies,
  NO shortfall generated for that day
- vehicle_id on each takings record identifies which taxi
  was driven — the target rate (K180/K210) comes from that
  vehicle's class. Payroll (29%) and balance_ledger aggregate
  BY DRIVER; vehicle reports aggregate by vehicle_id
- Daily targets: K180 standard vehicle, K210 new vehicle
  (stored as snapshot on each takings record — never recompute
  historical records from current settings)
- Driver pay: 29% of gross takings per 14-day period
  (rate snapshotted on pay_periods.commission_rate)
- Nightly check-in 11pm; missed check-in alert 11:30pm
- Shortfalls write DEBITS and surpluses write CREDITS to
  balance_ledger; offset engine nets them per pay period.
  Only a negative net balance becomes a payroll deduction
  (policy configurable: offset / pay-through / bonus)
- Surplus is already inside gross takings — never add it to
  gross a second time when applying bonus mode
- Targets suppressed while vehicle has open downtime_log entry
- Relief drivers: takings credit the ACTUAL driver (driver_id on
  daily_takings), not the assigned driver
- Takings records lock after 24h; owner unlock is audited
- Service due: 3 months OR +5,000km, whichever first
- Compliance: rego 12mo, safety sticker 6mo, MVIL 12mo,
  driver license per-document

## RBAC
- owner: full access
- supervisor: enter takings, view fleet, log service &
  incidents; compliance READ-ONLY; no reports/payroll/settings
- driver: read own records only

## Design System (NON-NEGOTIABLE — see the PDF)
- All tokens in src/lib/theme.ts — never hard-code colors/spacing
- 8px spacing grid, card radius 16–24px, soft shadows, Inter font
- Components in src/components/ui — reuse, never re-style ad hoc
- Icons: lucide-react-native only
- Every list screen needs loading (Skeleton) and EmptyState

## Workflow
- Build in numbered phases from ../TaxiTrack-PNG-Build-Plan.md
- git commit after every completed phase
- Never modify locked pay_periods or locked daily_takings
  without an audit_log entry
