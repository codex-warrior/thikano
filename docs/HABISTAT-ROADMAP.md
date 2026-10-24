# Habistat — Roadmap & Status

_Last updated 2026-10-22. ✅ means built and verified by automated tests and/or a browser walkthrough against the Firebase emulators. Production launch dependencies are listed at the end._

| Phase | Scope | Status | Where |
|---|---|---|---|
| 0 | Audit, architecture, docs, domain core | ✅ | `docs/`, `packages/domain` |
| 1 | Design system + app shells | ✅ | `packages/tokens`, `packages/web-ui`, all apps |
| 2 | Firebase + identity: Auth, profiles, orgs, roles, rules, Storage, FCM, rules tests | ✅ | `firestore.rules`, `storage.rules`, `functions/src/identity.ts`, `firebase-tests/` |
| 3 | Property → building → floor → room → bed, photos/video, derived occupancy | ✅ | Owner `/properties`, `/rooms`; `functions/src/inventory.ts` |
| 4 | Owner OS: dashboard, residents, rent, payments, maintenance, notices, staff, vacancies | ✅ | Owner app; `functions/src/operations.ts` |
| 5 | Discover + public pages: search, filters, room/property pages, OG, share links, live availability, sitemap, QR | ✅ | `apps/web`, mobile Discover |
| 6 | Leads, visits, applications, approval, booking, move-in, resident activation, move-out | ✅ | `functions/src/marketplace.ts`; Owner `/leads` |
| 7 | Resident: Home (Habistat Daily), My Stay, rent, maintenance, notices, community, profile | ✅ | mobile Resident; `functions/src/resident.ts` |
| 8 | Services: marketplace, provider abstraction, orders, Dwarpar adapter | ✅ (Dwarpar live mode needs credentials) | `functions/src/services.ts`, `functions/src/providers/` |
| 9 | Partner economics: rules, splits, ledgers, earnings | ✅ | `packages/domain/src/economics.ts`, Owner `/earnings`, Admin `/revenue` |
| 10 | Admin: verification, moderation, owners, students, leads, bookings, providers, transactions, revenue, support, audit | ✅ | `apps/admin`; `functions/src/platform.ts` |
| 11 | Analytics & growth: listing analytics, search/demand analytics, vacancy intelligence | ✅ (deterministic, no ML) | `getPropertyInsights`, Owner `/reports`, Admin `/analytics` |

## Verified critical journeys (spec §81–85)

| Journey | Automated (emulators) | Browser walkthrough |
|---|---|---|
| 1 Owner: property → rooms → beds → verify → list → availability updates | `firebase-tests/test/journeys.test.ts` | Owner app: list Room 204 → public; assign bed → 1 available |
| 2 Student: public link → enquiry, no install | ✓ | Web room page → "Request sent ✓" → lead in Owner inbox |
| 3 Move-in: application → approval → booking → resident activation | ✓ | Owner `/leads` pipeline |
| 4 Daily resident: home, rent, services, maintenance | ✓ | Mobile: OTP sign-in → Resident mode → pay (test mode) → order laundry → report issue |
| 5 Admin: review → approve → public | ✓ | Admin: approve Ananta → 10 rooms public, audit logged |

## Production dependencies (not faked)

| Dependency | Needed for | Until then |
|---|---|---|
| Firebase project (Blaze) | Deploying functions, Auth, custom tokens (IAM `signBlob`) | Emulators (`demo-thikano`) |
| SMS provider (MSG91/Twilio/Gupshup) + `OTP_HMAC_SECRET` | Resident/student phone sign-in | Emulator returns the code to the app; production refuses |
| Payment gateway (Razorpay/Cashfree) + webhook secret | Online rent | Test gateway in emulator (`mode: 'test'`); owners record cash/UPI |
| Dwarpar API base URL + key | Live food/grocery ordering | Catalog adapter; live adapter refuses |
| App Check (Play Integrity / DeviceCheck / reCAPTCHA Enterprise) | Abuse protection on public callables | Rate limits only; set `THIKANO_ENFORCE_APP_CHECK=true` |
| APNs key | iOS push | In-app inbox works everywhere |
| Maps key | Map view | List view + geohash search |

## Next (architected, not built)

Room saving and side-by-side comparison (all compared fields are already in `publicRooms`), reviews (collection + rules + admin queue exist), resident↔owner support tickets UI, digital agreements, move-in/out checklists, deposit refunds, payouts to owners, referral programmes, a map view, owner bulk import/edit, and a dedicated search service once there are more than about 50k listings.
