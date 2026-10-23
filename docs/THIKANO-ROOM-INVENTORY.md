# THIKANO — Room Inventory

Hierarchy: `Organization → Property → Building → Floor → Room → Bed → Resident`.

## Rooms are first-class

A room has its own ID, public slug, photos, videos, rent, deposit, amenities, beds, listing intent, derived inventory, and listing stats. The same room document powers the Owner room card, the public room page, Discover search, share links, leads, bookings, and resident assignment. It is entered once and used everywhere.

## Source of truth: beds

Availability is **never** typed in by an owner. It is computed from bed states by `deriveRoomInventory(beds, rent)` in `packages/domain/src/inventory.ts`:

```text
Room 204
Bed A → Rohit → occupied
Bed B → (none) → available
⇒ { totalBeds: 2, availableBeds: 1, occupancy: 'partially_occupied' }
```

`rooms/{id}.inventory` is a **cache** of that function's output. The `onBedWrite` trigger and the bed-mutating callables (which run it inside the same transaction) are the only writers. If the cache is ever suspected stale, `recomputeRoomInventory(roomId)` rebuilds it from beds. A room has at most about 6 beds, so this is cheap.

## Bed state machine

```text
            reserve          assign
available ─────────► reserved ─────► occupied
   ▲  │ ◄──release──┘                   │
   │  │ assign ─────────────────────────┘
   │  ├─ block ─────► blocked ── unblock ──► available
   │  └─ start_maintenance ─► maintenance ── end_maintenance ──► available
   └──────────────── vacate ─────────────── occupied
```

Invalid transitions throw `InvalidTransitionError` (for example, assigning an occupied bed, or blocking an occupied bed).

## Room statuses

The spec lists room states that mix three different things. THIKANO keeps them separate so they never conflict:

| Concept | Values | Who sets it |
|---|---|---|
| Operational status | `active`, `inactive`, `maintenance` | Owner |
| Occupancy (derived) | `empty`, `partially_occupied`, `fully_occupied`, `no_beds` | Computed from beds |
| Listing intent | `unlisted`, `listed`, `paused`, `archived` | Owner (one click) |
| Listing status (derived) | `draft`, `pending_verification`, `published`, `paused`, `fully_occupied`, `suspended`, `archived` | `deriveListingStatus` |

"Available" means `operationalStatus = active` and `availableBeds > 0`. "Listed" means `listingIntent = listed`.

## Media

- Photos: client compresses to ≤1600 px JPEG/WebP (~200–400 KB) before upload to `orgs/{orgId}/rooms/{roomId}/photos/{assetId}.jpg`. A Storage-triggered function writes a 400 px thumbnail and appends a `MediaAsset` to the room.
- Videos: optional; ≤60 s and ≤50 MB, uploaded resumably. A failed upload never blocks saving the room; the asset is marked `failed` and the owner can retry.
- Only URLs and metadata go in Firestore, never file contents.

## Bulk actions (architected)

"List all eligible vacancies" uses `isEligibleForOneClickListing` over the property's rooms and applies the change in one batched callable. Unlisting selected rooms, bulk rent updates, adding multiple beds, and CSV import follow the same pattern: one callable, validated by domain functions, with one audit entry per room.
