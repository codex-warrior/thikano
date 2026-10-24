# Habistat — Marketplace (Discover, public pages, leads, bookings)

## Listing lifecycle

Owner presses **List on Habistat**, which sets `listingIntent = listed`. Nothing else is asked, because the room already has its rent, photos, amenities and availability. The effective status comes from `deriveListingStatus`:

| Condition | Status | Public? | In search? |
|---|---|---|---|
| intent archived | archived | no | no |
| admin suspended / property suspended | suspended | no | no |
| intent unlisted | draft | no | no |
| intent paused or room not active | paused | no | no |
| property not verified | pending_verification | no | no |
| no available beds | fully_occupied | page stays up, shows "Currently full" | no |
| otherwise | published | yes | yes |

When the last bed is assigned, the room drops out of search automatically and the public page shows "Currently full", with the property's other rooms suggested instead.

## Public projection

`publicRooms/{roomId}` and `publicProperties/{propertyId}` are written by the `syncPublicRoom` / `syncPublicProperty` triggers using whitelisted fields (`PublicRoom` in `domain/search.ts`). Location is snapped to about 150 m. When the status is not public, the projection document is deleted.

## Search (no extra search service in V1)

1. The client resolves a location (GPS, area, or college lookup) to a point.
2. The client runs geohash range queries on `publicRooms` (geofire-common bounds for radius R), capped at about 200 docs.
3. `searchRooms(candidates, filters, sort)` filters and ranks the results, and `groupByProperty` builds the property cards.
4. College search uses `nearbyColleges array-contains`, with a typo-tolerant match on the client.

Ranking order: rooms with real availability first, then distance, media quality, and rating. A search service such as Typesense is only worth adding past about 50k listings; the `searchRooms` contract stays the same if that happens.

## Share links

- Room: `habistat.com/room/<property>-room-<number>` (for example `sunrise-pg-room-204`)
- Property: `habistat.com/pg/<property>-<locality>` (for example `sunrise-pg-kukas`)
- Slug uniqueness is enforced through `slugs/{slug}`, with collisions suffixed `-2`, `-3`, and so on.
- Pages are server-rendered (ISR, revalidated on projection change) and include Open Graph and Twitter tags, a generated 1200×630 OG image (room photo, rent, beds available, Habistat mark), and JSON-LD (`LodgingBusiness` / `Accommodation` / `Offer`).
- Share options: native Web Share API, WhatsApp deep link (`https://wa.me/?text=`), and copy. QR codes (planned) encode the property URL with `?src=qr`.

## Lead capture (no app install)

The **I'm interested** button opens a form asking for name, phone, expected move-in date and an optional message. It calls the `createLead` callable, which has App Check, rate limits, and validation. The function:

1. Resolves slug → org/property/room server-side (the client never chooses the org).
2. Creates `organizations/{orgId}/leads/{id}` with `source = room_share_link | property_share_link | discover | qr`.
3. Increments `rooms.stats.enquiries`, notifies owner members by FCM, and writes an audit/analytics event.

**Request a visit** creates the lead plus a booking at stage `visit_requested`.

## Booking pipeline

`inquiry → visit_requested → visit_scheduled → application → owner_review → approved | rejected → booked → moved_in` (plus `cancelled`). See `domain/pipeline.ts`.

- `booked` reserves a bed (bed: available → reserved).
- `moved_in` assigns the bed (reserved → occupied), creates the resident, links the student's `uid`, sets `users/{uid}.activeStay` and the `stay` claim, and generates the first invoice. The app then switches to Resident mode.
- Lead status follows the pipeline via `leadStatusForBooking`.

## Analytics collected now (used later)

Search events record area, college, budget range, sharing type, filters and result count. They are anonymous: a random session ID only, no phone or uid. Room views, shares, enquiries, applications and bookings increment counters on the room and on daily aggregates. Demand intelligence (Phase 11) is deterministic aggregation over these, with no ML.
