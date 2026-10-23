# THIKANO — Launch Plan

_Last updated 2026-10-23._

## Where we are

The product is **code-complete for V1** and verified on the Firebase emulators:

| Check | Result |
|---|---|
| Unit tests (domain rules, dataset, provider adapters) | 78 passing |
| Emulator tests (Firestore rules, Storage rules, end-to-end journeys incl. webhook + deletion) | 54 passing |
| Browser tests in repo (`e2e/`) — owner, student, public SEO, admin | 4 passing |
| Typecheck (12 workspaces) · production builds (3 web apps) · Android bundle · expo-doctor | all passing |

Launch infrastructure that is ready and waiting for credentials:

- **Phone sign-in:** MSG91 adapter and OTP secrets wiring.
- **Online rent:** Razorpay Payment Links gateway and a signed, idempotent webhook.
- **Push:** Android via FCM, iOS via APNs, plus device registration in the app.
- **Account deletion:** in the app and as a public `/delete-account` page.
- **Legal pages:** `/privacy`, `/terms`, `/refunds` and `/contact`. They show a DRAFT banner until your details are filled in.
- **Hosting and builds:** App Hosting configs for the three web apps, EAS build profiles and production app identifiers (`in.thikano.app`).
- **Tooling:** the first-admin bootstrap script and the CI workflow.

## What you need to do (in this order; start the slow ones first)

| # | Task | Typical lead time | Notes |
|---|---|---|---|
| 1 | **Register the business entity details** you'll use everywhere: legal name, address, GST if any, support email, grievance officer | — | Needed by Razorpay, DLT, Play and Apple |
| 2 | **MSG91 + DLT registration** (entity + an OTP SMS template with one variable) | often about a week (telecom DLT approvals) | Slowest item. Ask MSG91 for the exact API endpoint and variable name for your template |
| 3 | **Razorpay account + KYC activation** | a few working days | They review your website. The legal pages need to be filled in and live first |
| 4 | **Google Play developer account** | 1–2 days to open | New *personal* accounts must run a closed test (currently 12 testers for 14 days) before going public. An *organization* account avoids this but needs a D-U-N-S number |
| 5 | **Apple Developer Program** (organization) | days to 2 weeks (D-U-N-S) | Needed for iOS and the APNs key |
| 6 | **Firebase project on Blaze**, billing alerts, region `asia-south1` | same day | Send me the project ID and web app config |
| 7 | **Domains**: thikano.in, owner.thikano.in, admin.thikano.in | hours | DNS records come from App Hosting |
| 8 | **Lawyer review** of privacy, terms and refunds | about a week | Templates describe exactly what the app does |
| 9 | **Dwarpar API docs + key** | unknown | Optional for launch; the catalog adapter works meanwhile |
| 10 | **Pilot PG(s)** willing to onboard first | — | Strongly recommended before opening to everyone |

## What I do when credentials arrive (about 1–2 working days)

1. Point `.firebaserc` and the `apphosting.yaml` files at the real project. Deploy rules, indexes and functions (`firebase deploy`).
2. Set secrets: `firebase functions:secrets:set OTP_HMAC_SECRET MSG91_AUTH_KEY RAZORPAY_KEY_ID RAZORPAY_KEY_SECRET RAZORPAY_WEBHOOK_SECRET APNS_KEY`. Copy `functions/.env.example` to `functions/.env.<project-id>`.
3. Grant the functions service account permission to sign custom tokens (`iam.serviceAccounts.signBlob`), which OTP sign-in needs.
4. Create the three App Hosting backends (root directories `apps/web`, `apps/owner` and `apps/admin`, region `asia-southeast1`). Connect the domains.
5. Register the Razorpay webhook `https://asia-south1-<project>.cloudfunctions.net/razorpayWebhook` for `payment_link.paid`, then make a ₹1 live test payment.
6. Confirm the MSG91 endpoint and variable with a real OTP to your phone.
7. Bootstrap your admin account: `npx tsx tools/src/bootstrap-admin.ts --project <id> --email <you> --yes`.
8. Build Android and iOS with EAS. Test on real phones: OTP, push, payment, deep links. Then submit.
9. Onboard the pilot PG: create the property and rooms, verify it, list rooms and share links.

## Timeline (honest estimate)

| Milestone | When |
|---|---|
| Web live (public pages, Owner, Admin) with real OTP + payments | about **1–1.5 weeks** after you start items 2–3 (bounded by DLT and Razorpay KYC) |
| Android public on Play | about **3 weeks** with a new personal account (closed-test rule), about 1 week with an organization account |
| iOS on the App Store | about **1–2 weeks** after Apple enrollment completes (review is usually 1–3 days) |
| Pilot running with real residents | the week the web apps go live, using the Android test build |

These are typical third-party lead times, not guarantees. Engineering is not the bottleneck.

## Residual risks I could not verify here

| Risk | Why | Mitigation |
|---|---|---|
| MSG91 endpoint and payload | MSG91's API docs couldn't be fetched (client-rendered) | Configurable `MSG91_FLOW_URL` / `MSG91_OTP_VAR`, adapter unit-tested, live test at step 6 |
| App Hosting + npm workspaces build | Not covered in Firebase docs; first deploy will tell | Fallback: Cloud Run with Next standalone output (about half a day) |
| Push on real devices | Needs a development build plus credentials; only token registration logic is tested | Real-device test at step 8 |
| Mobile UI on real phones | Verified on react-native-web and the Android bundle, not on hardware | Pilot with a preview APK before the store submission |
| CI on GitHub | Workflow written; repo has no remote yet | First push runs it; fix any Linux-only issues |
| App Check | Mobile attestation needs native modules; enforcement is off (rate limits are on) | Enable after moving mobile to React Native Firebase, or for web-only callables |
| Scale | Tested on emulator data (5 properties, 509 beds) | Indexes declared; run a load test before onboarding many PGs |
