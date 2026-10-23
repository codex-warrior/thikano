# THIKANO — Security

## Principles

- Authorization is enforced in **Firestore/Storage rules** and in **Cloud Functions**. UI checks exist only for UX.
- Tenancy is derived from the document path (`organizations/{orgId}`), never from client-supplied fields.
- Anything public goes through a whitelisted projection (`publicRooms`, `publicProperties`) written by functions.
- Writes that touch invariants (bed assignment, listing, payments, leads, move-in) are callable-only. Rules deny direct client writes to those fields.
- Every privileged mutation writes an `auditLogs` entry server-side.
- App Check is enforced on callables used from public pages (`createLead`, `trackView`, `logSearch`), together with per-phone and per-IP rate limits.

## Roles

| Role | Source | Scope |
|---|---|---|
| Platform Admin | custom claim `platformRole=platform_admin` | Everything; verification, suspension, economics |
| Platform Support | claim `platform_support` | Read across tenants (minus economics), support tickets |
| Owner | `members/{uid}.role=owner` | Their org; owner-only: members, payouts, verification submission |
| Manager | `role=manager` | All org permissions within `propertyIds` |
| Staff | `role=staff` | Only explicit `permissions[]` within `propertyIds` |
| Resident | claim `stay` + `residents.uid` | Own resident record, own invoices/payments/orders/maintenance, their property's notices |
| Student | any signed-in user | Own profile, own leads/bookings (via callables), public data |
| Public | unauthenticated | `publicRooms`, `publicProperties`, `slugs`; `createLead` callable |

The permission matrix lives in `packages/domain/src/permissions.ts` and is mirrored in `firestore.rules`. Change both together.

## Tests (implemented: `npm run test:firebase`)

`firebase-tests/test/firestore-rules.test.ts` has 25 tests:
- Resident A cannot read Resident B (resident doc, invoices). A resident list query must be scoped to self.
- Residents cannot read members, leads, the ledger or property inventory. They see only *published* notices of their own property.
- Residents cannot write rent, residency or `activeStay`.
- Owner A cannot read or write anything of Owner B, or add themselves as a member. Removed members lose access.
- A manager scoped to P1 cannot see P2. Maintenance-only staff cannot read rent, leads or earnings, and can only change status or assignee.
- Clients cannot make a bed occupied (availability can't be faked). They cannot write inventory, stats, slug or listing intent, or self-approve verification. Scoped managers cannot create properties.
- Leads, residents, payments and audit logs cannot be written by clients. Owners can change only a lead's status.
- Unauthenticated users read only public projections. Support cannot read economics. Owners cannot read revenue rules or the platform ledger. Users cannot grant themselves a platform role.

`firebase-tests/test/storage-rules.test.ts` has 5 tests: media size and type limits, owner-only verification documents, residents limited to their own org for maintenance photos, and everything else closed.

`firebase-tests/test/journeys.test.ts` has 21 end-to-end tests across all critical journeys, including cross-tenant callable denial, server-side pricing (prices sent by the client are ignored), OTP single-use plus rate limits, partner-share ledger isolation, and the audit trail.

## Abuse controls

- Public callables (`createLead`, `trackRoomView`, `logSearch`) are rate-limited per IP and per phone, with hashed keys, and deduplicate repeats. App Check is enforced in production with `THIKANO_ENFORCE_APP_CHECK=true`.
- OTP: 6-digit codes are HMAC'd with a secret, expire after 10 minutes, allow 5 attempts, and are single-use. Requests are limited to 3 per phone per 15 minutes and 20 per IP per hour. Only the local emulator returns the code to the client.
- Every callable validates input server-side. Errors returned to users are human messages; technical detail goes to logs.

## Privacy

Public pages never show resident names, phone numbers, bed-level occupant info, exact addresses or coordinates (they are snapped to about 150 m by `approximateLocation`), owner phone numbers (unless `publicContactPhone` is opted in), revenue shares, or admin notes. Lead phone numbers are visible only to the owning org and to platform staff.

Errors shown to users are human-readable messages. Raw Firebase errors are logged internally and never displayed.
