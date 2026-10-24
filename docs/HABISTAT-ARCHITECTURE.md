# Habistat — Architecture

_Status: Phases 0–11 implemented against the Firebase emulator suite · Last updated 2026-10-22_

## Phase 0 audit result

The repository was **empty** at audit time, so every decision is greenfield. Toolchain: Node 24, npm workspaces, Firebase CLI 15, Java 25 (emulators).

## Monorepo

```text
apps/
  mobile/        Expo SDK 58 + Expo Router — ONE app: Discover (guest/student) → Resident
  owner/         Next.js 16 — Habistat Owner (owner.habistat.com)          :3001
  admin/         Next.js 16 — Habistat Admin (admin.habistat.com)          :3002
  web/           Next.js 16 — public pages habistat.com/pg/*, /room/*, /qr/*  :3000
packages/
  domain/        All business rules (pure TS) — inventory, listing, pipeline, rent, economics, permissions, search, projections
  tokens/        Design tokens (web + mobile)
  web-ui/        React + Tailwind components (RoomCard, StatTile, …)
  client/        Firebase client SDK setup + friendly errors (web apps + mobile)
  server/        Firebase Admin for Next.js: sessions, owner/platform/public repositories
  fixtures/      DEVELOPMENT-ONLY deterministic dataset (refuses to load in production)
functions/       Cloud Functions (bundled with esbuild so @thikano/domain ships inside)
firebase-tests/  Rules + end-to-end journey tests against the emulators
tools/           Emulator seed (refuses non-demo projects)
firestore.rules · storage.rules · firestore.indexes.json · firebase.json
```

## Request paths

```text
Owner / Admin (Next.js)
  Server Components ── @thikano/server (Admin SDK) ── re-checks domain permissions per request
  Client components ── Firebase client SDK
       ├── direct writes (property, rooms, beds, notices, maintenance status) ── validated by firestore.rules
       └── callables (listing, leads pipeline, move-in, payments, members, verification) ── Cloud Functions
Public web (Next.js) ── @thikano/server/public ── reads ONLY publicRooms / publicProperties
     └── createLead / trackRoomView (public callables, rate-limited, App Check-ready)
Mobile (Expo) ── Firebase JS SDK
     ├── Discover: geohash queries on publicRooms + domain searchRooms
     └── Resident: getResidentHome, payRentOnline, raiseMaintenance, placeServiceOrder
Cloud Functions ── @thikano/domain for every rule; triggers keep derived data in sync
```

**Session model (web):** the browser signs in with Firebase Auth and posts its ID token once to `/api/session`, which creates an httpOnly session cookie. Every server render verifies the cookie, including revocation. `proxy.ts` is only an optimistic redirect.

**Mode model (mobile):** guest / student / resident is derived from auth and the `stay` custom claim, which the move-in function sets and move-out clears. The user never chooses it.

## Source of truth and derived data

| Data | Source of truth | Derived copies | Maintained by |
|---|---|---|---|
| Availability | `beds/{id}.status` | `rooms.inventory`, `publicRooms.availableBeds`, `publicProperties.availableBeds` | `onBedWritten` → `onRoomWritten` |
| Public listing | room `listingIntent` + property verification + inventory + moderation | `publicRooms/{id}` | `deriveListingStatus` + `projectPublicRoom` |
| Slugs | `slugs/{slug}` (transactional reservation) | `room.publicSlug`, `property.slug` | `onRoomWritten` / `onPropertyWritten` |
| Invoice status | amounts + due date | `invoices.status` | `refreshInvoices` (daily) + payment functions |
| Partner earnings | `platformLedger/{orderId}` (full split) | `organizations/*/ledger/{orderId}` (partner share only) | `onServiceOrderWritten` |
| Resident mode | active `residents` doc | `users.activeStay`, `stay` claim | move-in / move-out functions |

## Cloud Functions (asia-south1)

| Module | Functions |
|---|---|
| identity | `ensureProfile`, `updateProfile`, `createOrganization`, `addMember`, `updateMember`, `setPlatformRole`, `requestOtp`, `verifyOtp` |
| inventory | `onBedWritten`, `onRoomWritten`, `onPropertyWritten`, `setRoomListing`, `listAllEligibleRooms`, `submitPropertyForVerification` |
| marketplace | `createLead`, `trackRoomView`, `trackShare`, `logSearch`, `startApplication`, `advanceBooking`, `moveIn`, `addResident`, `startMoveOut`, `completeMoveOut`, `transferResident` |
| operations | `generateInvoicesNow`, `monthlyInvoices` (cron), `refreshInvoices` (cron), `recordPayment`, `payRentOnline`, `raiseMaintenance`, `onMaintenanceUpdated`, `onNoticeWritten`, `onParcelCreated` |
| resident | `getResidentHome` |
| services | `getServiceCatalog`, `placeServiceOrder`, `updateServiceOrderStatus`, `onServiceOrderWritten`, `getPartnerEarnings`, `upsertRevenueRule` |
| platform | `reviewProperty`, `setPropertySuspended`, `setRoomSuspended`, `getPropertyInsights` |

Global options are set in `lib/options.ts`, which is imported first. ES module imports evaluate before the importing module's body runs, so setting options inside `index.ts` would come too late.

## Realtime policy

Owner and Admin pages render on the server per request; there are no long-lived listeners. Mobile fetches on focus and pull-to-refresh, and the resident home is a single callable. Realtime is reserved for places where it pays off. The in-app inbox already receives every notification, so adding live listeners later is a UI-only change.

## Local development

```bash
npm install
npm run emulators      # terminal 1 — builds functions, starts Auth/Firestore/Functions/Storage
npm run seed           # terminal 2 — loads the dataset into the emulators
npm run dev:owner | dev:admin | dev:web | dev:mobile
```

## Going to production

1. Create the Firebase project (Blaze). Set `.firebaserc`, then deploy rules, indexes and functions (`firebase deploy`).
2. Set function config: `OTP_HMAC_SECRET`, `SMS_PROVIDER` and its keys, payment gateway keys, Dwarpar keys, and `THIKANO_ENFORCE_APP_CHECK=true`.
3. Grant the functions service account `iam.serviceAccounts.signBlob`, which custom tokens need for OTP sign-in.
4. Bootstrap the first platform admin with a one-off Admin SDK script. Admins grant later roles in Admin → Settings.
5. Host the Next apps on Firebase App Hosting or another Node host with ADC. Set the `NEXT_PUBLIC_FIREBASE_*` variables from `.env.example`.
6. Build mobile with EAS. Set the `EXPO_PUBLIC_FIREBASE_*` variables and remove the emulator host.
