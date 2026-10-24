# THIKANO — Launch Plan

_Last updated 2026-10-23._

## Status

**Code:** V1 complete. Sign-in is Google-first (Owner, Admin and mobile). Phone OTP is optional and needs an SMS provider. Residents link to their app by booking, by verified Gmail (automatically) or by invite code, so **launch no longer depends on SMS/DLT**.

**Verified locally:** 78 unit tests, 54 emulator tests (rules, storage, journeys including Google sign-in, invite codes, payment webhook and account deletion), 4 browser journeys, 12-workspace typecheck, 3 production web builds, the Android bundle and expo-doctor.

**Live on `thikano-prod` (verified 2026-10-24):**

| Item | State |
|---|---|
| Public site | https://web--thikano-prod.asia-southeast1.hosted.app (home, sitemap, room/PG pages, legal pages) |
| Owner console | https://owner--thikano-prod.asia-southeast1.hosted.app (Google sign-in, session cookie → onboarding) |
| Admin | https://admin--thikano-prod.asia-southeast1.hosted.app (platform admin: ahamshashvat@gmail.com) |
| Backend | 51 Cloud Functions in asia-south1 (40 callables, 8 Firestore triggers, Razorpay webhook, 2 schedules) |
| Data | Firestore rules + indexes, Storage bucket + rules, TTL policies |
| Auth | Google + Email/Password; hosted.app domains authorized |
| Cost guard | Budget alert ₹2,000/month at 50/90/100% |
| Off until configured | Online rent (`PAYMENTS_MODE=off`), phone OTP (`SMS_PROVIDER=none`), iOS push |

**Deploying again:** `bash tools/go-live.sh thikano-prod <billing-account> --yes` (backend) and
`firebase deploy --project thikano-prod --only apphosting` (web apps). App Hosting builds from the repo
root: each backend's environment name (web|owner|admin) selects `apphosting.<name>.yaml`, which sets
`THIKANO_APP`; `tools/hoist-next-build.mjs` moves the build into the layout App Hosting's Next.js
adapter expects.

Android APK (internal, EAS preview profile): built and verified 2026-10-24; signing key in `apps/mobile/credentials/` (gitignored, back it up).

## Still to do

| # | Who | Action |
|---|---|---|
| 1 | You | Sign in to Admin and Owner with Google once to confirm (Admin: ahamshashvat@gmail.com) |
| 2 | Claude | **Before public launch: remove the demo listings** (5 sample Jaipur PGs, 98 rooms, written 2026-10-24): `ACCESS_TOKEN=$(gcloud auth print-access-token) npx tsx tools/src/demo-listings.ts thikano-prod --remove` |
| 3 | You | Business details for the legal pages (DRAFT banner shows until then), then a lawyer's review |
| 4 | You | Buy thikano.in; Claude connects it (owner./admin. subdomains) and switches the public URL |
| 5 | You | Razorpay KYC → Claude sets secrets and `PAYMENTS_MODE=razorpay` |
| 6 | You | Play Console / Apple developer accounts for store releases |

## Timeline

| Milestone | When |
|---|---|
| Web live (public site, Owner, Admin) with Google sign-in; rent recorded by owners (cash/UPI) | **1–2 days** after steps 1–2 |
| Pilot PG using the Android app (preview APK, no store needed) | **same week** |
| Online rent payments | when Razorpay activation completes (usually a few working days after you apply) |
| Play Store public | about 3 weeks with a new personal account (closed-test rule), about 1 week with an organization account |
| App Store | 1–2 weeks after Apple enrollment |

## Residual risks

| Risk | Mitigation |
|---|---|
| App Hosting + npm workspaces build is untested | First deploy tells us; fallback is Cloud Run with Next standalone output (about half a day) |
| Google sign-in, push and payments on real phones are untested | Covered in the production smoke test and the pilot APK |
| CI has never run on GitHub (account billing) | Runs once item 3 is fixed; all suites pass locally |
| MSG91 API details are unverified | Only matters if you turn phone OTP on; configurable and unit-tested |
| An emulator glitch once (`RESOURCE_EXHAUSTED`) | Did not reproduce; watch CI |
| Scale beyond the pilot | Indexes declared; run a load test before onboarding many PGs |
