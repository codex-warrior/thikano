# Habistat — Admin

A separate Next.js app (`apps/admin`). Access requires the `platformRole` custom claim, which is checked on the server for every route and every server action.

## Navigation

Dashboard · Owners · Properties · Residents · Students · Property Verification · Listings · Rooms · Beds · Leads · Applications · Bookings · Services · Providers · Transactions · Revenue · Reviews · Disputes · Support · Notifications · Content · Reports · Analytics · Audit Logs · Settings

## Property verification

1. The owner submits from Owner → Property → "Submit for verification". This creates `verificationRequests/{propertyId}` with a checklist: owner info, address, photos (at least 4), amenities, rooms and pricing, rules, and documents (ownership or rent agreement, owner ID).
2. Admin reviews and takes one of three actions:
   - **Approve:** property becomes `verified`, and its listed rooms become public through the projection triggers.
   - **Request changes:** status becomes `changes_requested` and the owner is notified with notes.
   - **Reject:** status becomes `rejected`.
3. Public room and property pages exist only for verified properties, so an unverified property cannot be shared. Before verification, the owner sees an authenticated preview that only their org can open.

## Controls

Approve, reject, suspend, unpublish, edit, flag, and inspect. Admins can also view activity, owners, residents, rooms, leads and bookings. Every action writes `auditLogs` with actor, action, entity, entityId, timestamp and metadata, including the reason entered by the admin. Suspending a property sets every room's listing status to `suspended` through the derivation; no room is edited by hand.

## Dashboard metrics (all from real data)

Properties, Owners, Active residents, Students searching (7-day unique search sessions), Available beds, Bookings this month, Service GMV, and Habistat revenue (`platformLedger.thikano` sum). The values come from `analyticsDaily` aggregates, not from counting live collections.

## Privacy inside Admin

Platform Support sees masked phone numbers (`+91 98•••••210`) unless they open a ticket-linked record. Economics pages are visible to Platform Admin only.
