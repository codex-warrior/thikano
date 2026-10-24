#!/usr/bin/env bash
# Habistat go-live: run ONCE after billing (Blaze) is attached to the project.
#
#   bash tools/go-live.sh thikano-prod <billing-account-id> --yes
#
# Prerequisites: firebase + gcloud CLIs logged in with an owner of the project; in the
# Firebase console: Authentication → Get started → enable Google (and Email/Password).
# Safe to re-run: every step is idempotent.
set -euo pipefail

PROJECT="${1:-}"
BILLING="${2:-}"
[[ -n "$PROJECT" && -n "$BILLING" && "${3:-}" == "--yes" ]] || { echo "Usage: bash tools/go-live.sh <project-id> <billing-account-id> --yes"; exit 1; }
cd "$(dirname "$0")/.."

step() { printf '\n\033[1m▶ %s\033[0m\n' "$*"; }

step "Checking billing is enabled on $PROJECT"
ENABLED=$(gcloud billing projects describe "$PROJECT" --format='value(billingEnabled)')
[[ "$ENABLED" == "True" ]] || { echo "Billing is not enabled on $PROJECT. Attach it first (Firebase console → Usage and billing → Modify plan)."; exit 1; }

step "Enabling Google Cloud services"
gcloud services enable --project "$PROJECT" \
  cloudfunctions.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com run.googleapis.com \
  eventarc.googleapis.com pubsub.googleapis.com cloudscheduler.googleapis.com secretmanager.googleapis.com \
  firebasestorage.googleapis.com storage.googleapis.com iamcredentials.googleapis.com identitytoolkit.googleapis.com \
  fcm.googleapis.com firebaseapphosting.googleapis.com billingbudgets.googleapis.com compute.googleapis.com

step "Creating the default Storage bucket (asia-south1) if missing"
TOKEN=$(gcloud auth print-access-token)
curl -sS -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -H "x-goog-user-project: $PROJECT" \
  "https://firebasestorage.googleapis.com/v1beta/projects/$PROJECT/defaultBucket" -d '{"location":"asia-south1"}' \
  | grep -qE '"name"|ALREADY_EXISTS' && echo "bucket ready" || echo "bucket: check the Firebase console → Storage"

step "Secrets (generated or placeholders — features stay off until real values are set)"
ensure_secret() {
  local name="$1" value="$2"
  if gcloud secrets describe "$name" --project "$PROJECT" >/dev/null 2>&1; then echo "$name exists"; else
    printf '%s' "$value" | gcloud secrets create "$name" --project "$PROJECT" --replication-policy=automatic --data-file=- >/dev/null && echo "$name created"; fi
}
ensure_secret OTP_HMAC_SECRET "$(openssl rand -hex 32)"
for s in MSG91_AUTH_KEY RAZORPAY_KEY_ID RAZORPAY_KEY_SECRET RAZORPAY_WEBHOOK_SECRET APNS_KEY; do ensure_secret "$s" "unset"; done

step "Deploying Firestore rules + indexes + TTL, Storage rules, and Cloud Functions"
npm run build -w @thikano/functions
firebase deploy --project "$PROJECT" --only firestore,storage,functions --non-interactive --force

step "Allowing the functions service account to sign custom tokens (phone OTP)"
NUMBER=$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')
SA="${NUMBER}-compute@developer.gserviceaccount.com"
gcloud iam service-accounts add-iam-policy-binding "$SA" --project "$PROJECT" \
  --member="serviceAccount:$SA" --role=roles/iam.serviceAccountTokenCreator >/dev/null && echo "signBlob granted to $SA"

step "Budget alert: ₹2,000/month at 50/90/100%"
if ! gcloud billing budgets list --billing-project="$PROJECT" --billing-account="$BILLING" --format='value(displayName)' | grep -q "Habistat $PROJECT"; then
  gcloud billing budgets create --billing-project="$PROJECT" --billing-account="$BILLING" --display-name="Habistat $PROJECT" \
    --budget-amount=2000INR --filter-projects="projects/$PROJECT" \
    --threshold-rule=percent=0.5 --threshold-rule=percent=0.9 --threshold-rule=percent=1.0
fi

cat <<EOF

✅ Backend is live on $PROJECT.
Next:
  1. Web apps: Firebase console → App Hosting → create 3 backends from GitHub (root dirs apps/web,
     apps/owner, apps/admin; region asia-southeast1). The apphosting.yaml files are already filled in.
  2. First admin:  npx tsx tools/src/bootstrap-admin.ts --project $PROJECT --email <you> --yes
  3. Google sign-in on mobile: put the Web client ID from Authentication → Google into
     apps/mobile/eas.json (EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID), add the release SHA-1 in project settings.
  4. Later: Razorpay → firebase functions:secrets:set RAZORPAY_KEY_ID … and set PAYMENTS_MODE=razorpay.
EOF
