import { deriveListingStatus, isPubliclyVisible } from './listing';
import type { Paise } from './money';
import { approximateLocation, type PublicRoom } from './search';
import type { GenderRule, GeoPoint, ID, Property, PropertyAmenity, Room } from './types';

/**
 * PUBLIC PROJECTIONS — the only shapes that ever leave a tenant boundary.
 * Built here (pure) and written by Cloud Functions. Adding a field to the public
 * surface means adding it here, deliberately. See docs/THIKANO-SECURITY.md.
 */

// ───────────── geohash (base32, no dependency) ─────────────
const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

export function encodeGeohash(p: GeoPoint, precision = 9): string {
  let latMin = -90, latMax = 90, lngMin = -180, lngMax = 180;
  let hash = '';
  let bit = 0, ch = 0, even = true;
  while (hash.length < precision) {
    if (even) {
      const mid = (lngMin + lngMax) / 2;
      if (p.lng >= mid) { ch = (ch << 1) | 1; lngMin = mid; } else { ch = ch << 1; lngMax = mid; }
    } else {
      const mid = (latMin + latMax) / 2;
      if (p.lat >= mid) { ch = (ch << 1) | 1; latMin = mid; } else { ch = ch << 1; latMax = mid; }
    }
    even = !even;
    if (++bit === 5) {
      hash += BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }
  return hash;
}

/**
 * Geohash prefixes covering a radius. Uses a precision whose cell is larger than the
 * radius and returns the centre cell + 8 neighbours — Firestore range queries on
 * `geohash` then fetch candidates, and `searchRooms` filters exact distance.
 */
export function geohashQueryPrefixes(center: GeoPoint, radiusKm: number): string[] {
  // Approx cell heights (km) for precision 1..7
  const cell = [5000, 625, 156, 19.5, 4.9, 0.61, 0.153];
  let precision = 1;
  for (let i = 0; i < cell.length; i++) if (cell[i]! >= radiusKm) precision = i + 1;
  const dLat = radiusKm / 111;
  const dLng = radiusKm / (111 * Math.cos((center.lat * Math.PI) / 180));
  const set = new Set<string>();
  for (const a of [-1, 0, 1]) for (const b of [-1, 0, 1]) set.add(encodeGeohash({ lat: center.lat + a * dLat, lng: center.lng + b * dLng }, precision));
  return [...set];
}

// ───────────── projections ─────────────
export interface RatingSummary {
  rating: number | null;
  ratingCount: number;
}

export function projectPublicRoom(property: Property, room: Room, rating: RatingSummary = { rating: null, ratingCount: 0 }, adminSuspended = false): PublicRoom | null {
  const status = deriveListingStatus({
    intent: room.listingIntent,
    propertyVerification: property.verification,
    operationalStatus: room.operationalStatus,
    inventory: room.inventory,
    adminSuspended,
  });
  if (!isPubliclyVisible(status) || !property.slug || !room.publicSlug) return null;
  const approx = approximateLocation(property.location);
  return {
    roomId: room.id,
    slug: room.publicSlug,
    propertyId: property.id,
    propertySlug: property.slug,
    propertyName: property.name,
    locality: property.address.locality,
    city: property.address.city,
    approxLocation: approx,
    geohash: encodeGeohash(approx),
    nearbyColleges: property.nearbyColleges,
    genderRule: property.genderRule,
    number: room.number,
    sharing: room.sharing,
    rent: room.rent,
    deposit: room.deposit,
    availableBeds: room.inventory.availableBeds,
    totalBeds: room.inventory.totalBeds,
    roomAmenities: room.amenities,
    propertyAmenities: property.amenities,
    foodIncluded: property.foodIncluded,
    coverPhotoUrl: room.photos[0]?.thumbUrl ?? room.photos[0]?.url ?? null,
    photoUrls: room.photos.map((p) => p.url),
    videoUrl: room.videos[0]?.url ?? null,
    rating: rating.rating,
    ratingCount: rating.ratingCount,
    listingStatus: status as PublicRoom['listingStatus'],
    updatedAt: room.updatedAt,
  };
}

export interface PublicProperty {
  propertyId: ID;
  orgId: ID;
  slug: string;
  name: string;
  kind: Property['kind'];
  genderRule: GenderRule;
  description: string;
  locality: string;
  city: string;
  approxLocation: GeoPoint;
  geohash: string;
  nearbyColleges: string[];
  amenities: PropertyAmenity[];
  rules: string[];
  photoUrls: string[];
  videoUrl: string | null;
  foodIncluded: boolean;
  contactPhone: string | null;
  rating: number | null;
  ratingCount: number;
  availableBeds: number;
  availableRooms: number;
  startingRent: Paise | null;
  updatedAt: number;
}

/** null ⇒ property must not be public (unverified / suspended). */
export function projectPublicProperty(property: Property, publicRooms: readonly PublicRoom[], rating: RatingSummary = { rating: null, ratingCount: 0 }): PublicProperty | null {
  if (property.verification !== 'verified' || !property.slug) return null;
  const available = publicRooms.filter((r) => r.listingStatus === 'published' && r.availableBeds > 0);
  const approx = approximateLocation(property.location);
  return {
    propertyId: property.id,
    orgId: property.orgId,
    slug: property.slug,
    name: property.name,
    kind: property.kind,
    genderRule: property.genderRule,
    description: property.description,
    locality: property.address.locality,
    city: property.address.city,
    approxLocation: approx,
    geohash: encodeGeohash(approx),
    nearbyColleges: property.nearbyColleges,
    amenities: property.amenities,
    rules: property.rules,
    photoUrls: property.photos.map((p) => p.url),
    videoUrl: property.videos[0]?.url ?? null,
    foodIncluded: property.foodIncluded,
    contactPhone: property.publicContactPhone ?? null,
    rating: rating.rating,
    ratingCount: rating.ratingCount,
    availableBeds: available.reduce((a, r) => a + r.availableBeds, 0),
    availableRooms: available.length,
    startingRent: available.length ? Math.min(...available.map((r) => r.rent)) : null,
    updatedAt: property.updatedAt,
  };
}

/** Exhaustive list of keys allowed in publicRooms docs — enforced by tests. */
export const PUBLIC_ROOM_KEYS: readonly (keyof PublicRoom)[] = [
  'roomId', 'slug', 'propertyId', 'propertySlug', 'propertyName', 'locality', 'city', 'approxLocation', 'geohash',
  'nearbyColleges', 'genderRule', 'number', 'sharing', 'rent', 'deposit', 'availableBeds', 'totalBeds', 'roomAmenities',
  'propertyAmenities', 'foodIncluded', 'coverPhotoUrl', 'photoUrls', 'videoUrl', 'rating', 'ratingCount', 'listingStatus', 'updatedAt',
];
