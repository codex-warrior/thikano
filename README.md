# THIKANO

**The operating system for PGs & hostels.** Students discover real rooms, residents live better, and owners fill vacancies and earn more.

Start with [docs/THIKANO-PRODUCT.md](docs/THIKANO-PRODUCT.md), [docs/THIKANO-ARCHITECTURE.md](docs/THIKANO-ARCHITECTURE.md) and [docs/THIKANO-ROADMAP.md](docs/THIKANO-ROADMAP.md) (status and production dependencies).

## Layout

| Path | What |
|---|---|
| `apps/mobile` | Expo app: Discover mode (students) → Resident mode |
| `apps/owner` | THIKANO Owner (Next.js), port 3001 |
| `apps/admin` | THIKANO Admin (Next.js), port 3002 |
| `apps/web` | Public pages `/pg/*`, `/room/*`, `/qr/*` (Next.js), port 3000 |
| `functions` | Cloud Functions (callables, triggers, schedules, provider adapters) |
| `packages/domain` | All business rules plus unit tests |
| `packages/server` · `packages/client` | Firebase Admin (Next.js server) and client SDK setup |
| `packages/tokens` · `packages/web-ui` | Design system |
| `packages/fixtures` · `tools` | Development dataset plus emulator seed (refuses non-`demo-` projects) |
| `firebase-tests` | Security rules and end-to-end journey tests |

## Run locally

Requirements: Node ≥ 22, Java 21+ (Firestore emulator), Firebase CLI.

```bash
npm install
npm run emulators        # terminal 1 — Auth, Firestore, Functions, Storage (project demo-thikano)
npm run seed             # terminal 2 — 2,397 docs + demo accounts
npm run dev:owner        # http://localhost:3001
npm run dev:admin        # http://localhost:3002
npm run dev:web          # http://localhost:3000/pg/sunrise-pg-kukas
npm run dev:mobile       # Expo — press w for web; Android emulator: set EXPO_PUBLIC_FIREBASE_EMULATOR_HOST=10.0.2.2
```

Demo accounts (emulator only, password `thikano-dev-123`):

| Who | Sign in |
|---|---|
| Owner (Sunrise PG) | `shashank@thikano.dev` |
| Manager · maintenance staff | `ramesh@thikano.dev` · `suresh@thikano.dev` |
| Platform admin · support | `admin@thikano.dev` · `support@thikano.dev` |
| Resident Rohit (mobile) | phone `9000000001`; the emulator shows the OTP in the app |

## Test

```bash
npm test                 # domain + dataset unit tests (71)
npm run test:firebase    # rules + storage + end-to-end journeys on emulators (51)
npm run typecheck
npm run build:web-apps
```
