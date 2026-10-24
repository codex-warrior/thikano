# Habistat — Database (Firestore)

_Final schema decision. Supersedes the conceptual tree in the master spec (§48)._

## Decision summary

1. **Tenant root = organization.** All private operational data lives under `organizations/{orgId}/…`. Security rules derive the tenant from the document path, so isolation is structural rather than a matter of filtering.
2. **Inventory is flat under the property, not nested five levels deep.** `buildings`, `floors`, `rooms` and `beds` are sibling subcollections of a property and carry their parent IDs as fields. This makes "all vacant beds in this property" a single query, keeps rules simple, and avoids collection-group queries for owner screens. It also means a room can move to another floor without moving its document.
3. **Public data lives in separate projection collections.** Firestore rules cannot hide individual fields, so anything public is copied into `publicProperties`/`publicRooms` by Cloud Functions, using an explicit whitelist of fields. Private documents are never publicly readable.
4. **Money is integer paise; time is epoch milliseconds (numbers).** The same values flow unchanged through the domain package, the Admin SDK, the client SDK and React Native, with no Timestamp conversion layer. They are sortable and range-queryable, and the domain tests use the exact stored shape. (This revises the Phase 0 plan to use `Timestamp`s.)
5. **Internal economics are admin-only.** `revenueRules` and the provider/Habistat split are never readable by owners. Owners see only their own partner-share ledger entries.

## Collections

```text
users/{uid}                                   profile, activeStay, fcmTokens (self)
users/{uid}/devices/{deviceId}                FCM tokens
users/{uid}/inbox/{itemId}                    in-app notifications (every push also lands here)

organizations/{orgId}                         name, ownerUid, verification, status
organizations/{orgId}/members/{uid}           role, propertyIds|null, permissions[], status

organizations/{orgId}/properties/{propertyId} full private property (exact location, documents refs)
  …/buildings/{buildingId}
  …/floors/{floorId}                          buildingId, level
  …/rooms/{roomId}                            buildingId, floorId, rent, photos, listingIntent, inventory (derived), stats
  …/beds/{bedId}                              roomId, status, residentId, moveIn/OutDate   ← SOURCE OF TRUTH for availability

organizations/{orgId}/residents/{residentId}  uid?, residentUid (denorm for rules), propertyId, roomId, bedId, rent, status
organizations/{orgId}/invoices/{invoiceId}    residentId, residentUid (denorm for rules), period, amount, paid, status
organizations/{orgId}/payments/{paymentId}
organizations/{orgId}/maintenance/{issueId}   property/building/floor/room/bed/resident auto-filled
organizations/{orgId}/notices/{noticeId}
organizations/{orgId}/parcels/{parcelId}
organizations/{orgId}/leads/{leadId}          created ONLY by callable `createLead`
organizations/{orgId}/bookings/{bookingId}    stage + history (state machine in domain/pipeline.ts)
organizations/{orgId}/serviceOrders/{orderId} residentUid denorm; split stored server-side only in ledger
organizations/{orgId}/ledger/{entryId}        partner-share entries (owner-readable)

publicProperties/{propertyId}                 whitelisted projection, approx location, geohash, availableBeds, startingRent
publicRooms/{roomId}                          PublicRoom (packages/domain/src/search.ts)
slugs/{slug}                                  { kind: 'property'|'room', id, orgId } — uniqueness + URL resolution

verificationRequests/{propertyId}             submitted checklist, admin decision
providers/{providerId}                        service providers (admin)
revenueRules/{ruleId}                         admin-only
platformLedger/{entryId}                      full split per order (admin-only)
auditLogs/{logId}                             actor, action, entity, entityId, at, metadata (append-only)
platformStaff/{uid}                           mirror of platform-role claims (to find admins to notify)
ratings/{propertyId}                          rating summary used by projections
rateLimits/{hash}                             fixed-window counters (hashed keys, TTL on expiresAt)
otpChallenges/{id}                            HMAC'd OTP codes, 10-min TTL, 5 attempts
searchEvents/{eventId}                        anonymous search analytics (written by callable)
analyticsDaily/{scope_date}                   aggregated counters
reviews/{id} · disputes/{id} · supportTickets/{id}
```

## Indexes

`firestore.indexes.json` holds every composite index the code queries (27 composite indexes plus collection-group field overrides). The emulator does not enforce indexes, but production does. Add the index in the same change as the query.

### Highlights

- `publicRooms`: `geohash ASC` (range query), `(city, listingStatus, rent)`, `(nearbyColleges ARRAY_CONTAINS, listingStatus)`
- `beds`: `(status, roomId)` within property
- `leads`: `(propertyId, status, createdAt DESC)`
- `invoices`: `(propertyId, period, status)`, `(residentUid, dueDate DESC)`
- `maintenance`: `(propertyId, status, createdAt DESC)`
- collection group `leads`, `bookings` for admin: `(status, createdAt DESC)`

## Custom claims

Kept small (claims are limited to 1000 bytes):

```json
{ "platformRole": "platform_admin" | "platform_support",
  "stay": { "o": "<orgId>", "p": "<propertyId>", "r": "<residentId>" } }
```

Org membership is not stored in claims. Rules read `members/{uid}`, because owners can belong to several orgs and need changes to take effect immediately.

## Seed data

`packages/fixtures` produces the development dataset, and `npm run seed` (`tools/src/seed.ts`) writes it into the emulators: 2,397 documents plus Auth users. It refuses unless both emulator hosts are set **and** the project ID starts with `demo-`. Public projections are built with the same domain functions Cloud Functions use.
