# THIKANO — Launch Plan

_Last updated 2026-10-23._

## Status

**Code:** V1 complete. Sign-in is Google-first (Owner, Admin and mobile). Phone OTP is optional and needs an SMS provider. Residents link to their app by booking, by verified Gmail (automatically) or by invite code, so **launch no longer depends on SMS/DLT**.

**Verified locally:** 78 unit tests, 54 emulator tests (rules, storage, journeys including Google sign-in, invite codes, payment webhook and account deletion), 4 browser journeys, 12-workspace typecheck, 3 production web builds, the Android bundle and expo-doctor.

**Already set up for real (done by Claude):**

| Item | State |
|---|---|
| GitHub | Private repo `codex-warrior/thikano`, branch `thikano-v1` pushed |
| Firebase project | `thikano-prod` (owner `ahamshashvat@gmail.com`), free Spark plan |
| Apps registered | Web, Android and iOS (`in.thikano.app`). Configs are in `apps/*/apphosting.yaml`, `apps/mobile/eas.json`, `google-services.json` and `GoogleService-Info.plist` |
| Firestore | Database created in `asia-south1` (Mumbai), **security rules deployed** |
| Production config | `.firebaserc` alias `prod`, `functions/.env.thikano-prod` (payments off, Google-only sign-in) |
| Go-live automation | `tools/go-live.sh` does everything after billing in one run |

## What only you can do (about 15 minutes in total, plus waiting on others)

| # | Action | Why I can't | Time |
|---|---|---|---|
| 1 | **Firebase console → Authentication → Get started**, then enable **Google** and **Email/Password** | Firebase Auth can only be initialized from the console; it also creates the Google OAuth client | 2 min |
| 2 | **Attach billing** (Blaze) to `thikano-prod` when you're ready, then tell me | Commits your money; you chose to wait | 2 min |
| 3 | **GitHub → Settings → Billing**: fix the failed payment / Actions spending limit (or tell me to make the repo public) | CI jobs are refused by GitHub until then | 2 min |
| 4 | `eas login` once (or give me an `EXPO_TOKEN`) | Expo account credentials | 2 min |
| 5 | Business details for the legal pages, then a lawyer's review | Legal facts about your company | — |
| 6 | Domains: thikano.in (+ owner., admin.) | Purchase in your name | — |
| 7 | Later: Razorpay KYC (online rent), Play/Apple developer accounts | KYC and identity verification | days |

## What I do the moment you finish 1–2

1. Read the Google Web client ID from the Auth config and put it into `eas.json`.
2. `bash tools/go-live.sh thikano-prod <billing-account> --yes`. This enables the services, creates the Storage bucket, sets secrets, deploys indexes, TTL, Storage rules and all functions, grants signBlob, and adds a ₹2,000/month budget alert.
3. Create the three App Hosting backends (asia-southeast1) and connect the domains. This needs one GitHub-connect click in the console.
4. Bootstrap your admin account (`tools/src/bootstrap-admin.ts`) and smoke-test every journey on production.
5. Android: an EAS preview build (APK) for the pilot PG. Add its SHA-1 to Firebase for Google sign-in.

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
