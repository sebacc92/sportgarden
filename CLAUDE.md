# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # Start dev server (SSR mode via Vite)
pnpm build        # Full production build (client + server)
pnpm lint         # ESLint on src/**/*.ts*
pnpm fmt          # Prettier format
pnpm fmt.check    # Check formatting without writing
pnpm build.types  # TypeScript type check only
pnpm preview      # Build + serve preview
pnpm deploy       # Deploy to Vercel
```

There are no automated tests in this project.

## Architecture

**Framework**: Qwik + QwikCity (directory-based routing), deployed as Vercel Edge Functions.

**Database**: Supabase (PostgreSQL). All DB access goes through `src/db/index.ts` → `getDB(requestEvent)`, which returns a Supabase client initialized with `SUPABASE_SERVICE_ROLE_KEY`. Supabase column names are snake_case; the codebase uses camelCase — always use `camelize()` when reading and `snakize()` when writing to Supabase. The schema types live in `src/db/schema.ts` (TypeScript interfaces, no ORM).

**Authentication**: Dual-layer system managed in `src/routes/plugin@session.ts`:
1. Google OAuth via Auth.js (`plugin@auth.ts`) — stored in `sharedMap("session")`
2. Custom email/password — stored as a JWT cookie `session`, verified via `src/lib/auth.ts` (jose + bcrypt)

Admin routes use a separate `auth_session` cookie containing the user ID directly. All `/admin/*` paths are guarded in `plugin@session.ts`.

**Timezone**: All date logic uses Argentina timezone (`America/Argentina/Buenos_Aires`). Helper functions are in `src/routes/admin/calendar/utils.ts` — use `getArgentinaParts`, `getBAHoursAndMinutes`, `toBALocalISOString` instead of raw JS date operations when dealing with booking times.

**Pricing**: `src/utils/pricing.ts` — `calculateProportionalPrice()` evaluates price minute-by-minute against `PitchPricingRule[]` and holiday lists. `src/utils/availability.ts` — checks pitch availability including `pitch_overlaps` (bidirectional join table for physically overlapping courts).

## Domain Model

The app is a futbol club booking/management platform (`gardenclub.com.ar`). Key entities in `src/db/schema.ts`:

- **Pitch** — courts with type (F5/F6/F9), pricing rules, deposit config, overlap relationships
- **Booking** — reservations linked to a user or group, with status workflow: `PENDING_APPROVAL → PENDING_PAYMENT → CONFIRMED → COMPLETED/ATTENDED/CANCELLED`
- **GuestRequest** — anonymous booking requests awaiting approval
- **PitchSubscription** — recurring weekly bookings for fixed slots
- **Group / GroupTransaction** — team accounts with a balance ledger
- **Student / StudentSubscription** — football school (escuelita) enrollment and monthly fees
- **CashRegister / Transaction** — cash register open/close sessions with income/expense tracking
- **SiteSettings** (id=1) — single-row config: AI chatbot settings, payment gateway credentials (MercadoPago, Payway), club info, operating hours, pricing, gallery, etc.

## Route Structure

```
src/routes/
  index.tsx                    # Public landing page (booking + store)
  plugin@auth.ts               # Auth.js Google OAuth plugin
  plugin@session.ts            # Session resolution + route guards
  auth/                        # Login, register pages
  admin/
    layout.tsx                 # Admin shell (sidebar nav, auth check)
    calendar/                  # Booking calendar (day/week/month views)
    cash/                      # Cash register management
    clients/                   # Client CRM
    club/                      # Club settings (SiteSettings)
    contenido/                 # Landing page content editor
    escuelita/                 # Football school management
    gallery/                   # Gallery management
    groups/                    # Group account management
    ia/                        # AI chatbot configuration
    leads/                     # Lead tracking
    pitches/                   # Court configuration
    store/                     # Product/order management
    subscriptions/             # Fixed subscription management
    users/                     # User management
  api/
    bookings/                  # Booking CRUD + guest requests
    chat/                      # AI chatbot endpoint (OpenAI)
    cron/instagram/            # Instagram feed sync cron
    reserva/checkout/          # Checkout flow
    webhooks/mercadopago/      # MercadoPago payment webhook
    webhooks/payway/           # Payway payment webhook
```

## Key Patterns

**Loaders vs Actions**: Use `routeLoader$` for read-only data (runs on server at render time). Use `routeAction$` with `zod$` for mutations. Both receive `requestEvent` — pass it to `getDB()` to get the Supabase client.

**Server functions**: `server$()` is used for server-only logic called from the client (e.g., Realtime subscriptions bypass RLS by using service role key through a server action).

**Component libs**: `@qwik-ui/headless` and `@qwik-ui/styled` for UI primitives; `@qwikest/icons/lucide` for icons; TailwindCSS v4 (via `@tailwindcss/vite`) for styling.

**Payment gateways**: MercadoPago (primary, OAuth-connected per club) in `src/lib/mercadopago/`; Payway in `src/lib/payway/`. Credentials stored in `SiteSettings`.

**Realtime**: The admin calendar uses Supabase Realtime to push booking updates. Due to RLS on the `users` and `guest_requests` tables, the client subscribes via a `server$` function that uses the service role key.

## Environment Variables

Required in `.env.local`:
- `PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`
- `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`
- `JWT_SECRET`
- MercadoPago and Payway credentials (also stored in DB `site_settings`)
