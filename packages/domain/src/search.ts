import type { Paise } from './money';
import type { GenderRule, GeoPoint, ID, PropertyAmenity, RoomAmenity, SharingType } from './types';

/**
 * Public, denormalized room projection used by Discover and public pages.
 * Lives at publicRooms/{roomId}; written ONLY by Cloud Functions.
 * Contains no resident data, no exact location, no owner phone unless opted-in.
 */
export interface PublicRoom {
  roomId: ID;
  slug: string;
  propertyId: ID;
  propertySlug: string;
  propertyName: string;
  locality: string;
  city: string;
  /** Approximate (≈150 m) point. Never the exact address. */
  approxLocation: GeoPoint;
  geohash: string;
  nearbyColleges: string[];
  genderRule: GenderRule;
  number: string;
  sharing: SharingType;
  rent: Paise;
  deposit: Paise;
  availableBeds: number;
  totalBeds: number;
  roomAmenities: RoomAmenity[];
  propertyAmenities: PropertyAmenity[];
  foodIncluded: boolean;
  coverPhotoUrl: string | null;
  photoUrls: string[];
  videoUrl: string | null;
  rating: number | null;
  ratingCount: number;
  listingStatus: 'published' | 'fully_occupied';
  updatedAt: number;
}

export interface SearchFilters {
  near?: GeoPoint | null;
  maxDistanceKm?: number;
  minRent?: Paise;
  maxRent?: Paise;
  sharing?: SharingType[];
  food?: boolean;
  ac?: boolean;
  wifi?: boolean;
  gender?: GenderRule;
  college?: string;
  /** Default true: only rooms with free beds. */
  onlyAvailable?: boolean;
}

export type SortKey = 'relevance' | 'distance' | 'rent_asc' | 'rent_desc';

export interface SearchResult {
  room: PublicRoom;
  distanceKm: number | null;
}

const EARTH_KM = 6371;
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Deterministically snap a location to a ~150 m grid for public display. */
export function approximateLocation(p: GeoPoint, gridDeg = 0.0015): GeoPoint {
  const snap = (v: number) => Math.round(v / gridDeg) * gridDeg;
  return { lat: Number(snap(p.lat).toFixed(5)), lng: Number(snap(p.lng).toFixed(5)) };
}

export function matchesFilters(room: PublicRoom, f: SearchFilters, distanceKm: number | null): boolean {
  if ((f.onlyAvailable ?? true) && (room.listingStatus !== 'published' || room.availableBeds <= 0)) return false;
  if (f.maxDistanceKm != null && distanceKm != null && distanceKm > f.maxDistanceKm) return false;
  if (f.minRent != null && room.rent < f.minRent) return false;
  if (f.maxRent != null && room.rent > f.maxRent) return false;
  if (f.sharing?.length && !f.sharing.includes(room.sharing)) return false;
  if (f.food && !room.foodIncluded && !room.propertyAmenities.includes('food')) return false;
  if (f.ac && !room.roomAmenities.includes('ac')) return false;
  if (f.wifi && !room.roomAmenities.includes('wifi') && !room.propertyAmenities.includes('wifi')) return false;
  if (f.gender && room.genderRule !== 'coed' && room.genderRule !== f.gender) return false;
  if (f.college) {
    const q = normalize(f.college);
    if (!room.nearbyColleges.some((c) => normalize(c).includes(q))) return false;
  }
  return true;
}

/**
 * Client/server-side filter + rank over a candidate set already narrowed by a
 * geohash range query (see docs/HABISTAT-MARKETPLACE.md). Real availability first.
 */
export function searchRooms(candidates: readonly PublicRoom[], f: SearchFilters, sort: SortKey = 'relevance'): SearchResult[] {
  const results: SearchResult[] = [];
  for (const room of candidates) {
    const distanceKm = f.near ? haversineKm(f.near, room.approxLocation) : null;
    if (matchesFilters(room, f, distanceKm)) results.push({ room, distanceKm });
  }
  const byDistance = (a: SearchResult, b: SearchResult) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity);
  switch (sort) {
    case 'distance':
      return results.sort(byDistance);
    case 'rent_asc':
      return results.sort((a, b) => a.room.rent - b.room.rent);
    case 'rent_desc':
      return results.sort((a, b) => b.room.rent - a.room.rent);
    case 'relevance':
      return results.sort((a, b) => relevance(b) - relevance(a));
  }
}

function relevance(r: SearchResult): number {
  const dist = r.distanceKm == null ? 0 : Math.max(0, 5 - r.distanceKm); // 0..5
  const avail = r.room.availableBeds > 0 ? 3 : 0;
  const media = r.room.photoUrls.length >= 3 ? 1 : r.room.photoUrls.length > 0 ? 0.5 : 0;
  const rating = r.room.rating ? (r.room.rating - 3) * 0.5 : 0;
  return dist + avail + media + rating;
}

/** Group room results into property cards ("Sunrise PG · 6 beds available · from ₹8,500"). */
export interface PropertyResult {
  propertyId: ID;
  propertySlug: string;
  propertyName: string;
  locality: string;
  distanceKm: number | null;
  availableBeds: number;
  startingRent: Paise;
  rating: number | null;
  coverPhotoUrl: string | null;
  rooms: SearchResult[];
}

export function groupByProperty(results: readonly SearchResult[]): PropertyResult[] {
  const map = new Map<ID, PropertyResult>();
  for (const r of results) {
    let p = map.get(r.room.propertyId);
    if (!p) {
      p = {
        propertyId: r.room.propertyId,
        propertySlug: r.room.propertySlug,
        propertyName: r.room.propertyName,
        locality: r.room.locality,
        distanceKm: r.distanceKm,
        availableBeds: 0,
        startingRent: r.room.rent,
        rating: r.room.rating,
        coverPhotoUrl: r.room.coverPhotoUrl,
        rooms: [],
      };
      map.set(r.room.propertyId, p);
    }
    p.rooms.push(r);
    p.availableBeds += r.room.availableBeds;
    p.startingRent = Math.min(p.startingRent, r.room.rent);
  }
  return [...map.values()];
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export const SHARING_LABEL: Record<SharingType, string> = {
  single: 'Single',
  double: 'Double Sharing',
  triple: 'Triple Sharing',
  quad: 'Four Sharing',
  dorm: 'Dormitory',
};

export const ROOM_AMENITY_LABEL: Record<RoomAmenity, string> = {
  ac: 'AC',
  wifi: 'Wi-Fi',
  attached_bathroom: 'Attached Bathroom',
  study_table: 'Study Table',
  cupboard: 'Cupboard',
  balcony: 'Balcony',
  geyser: 'Geyser',
  tv: 'TV',
  fridge: 'Fridge',
};

export const PROPERTY_AMENITY_LABEL: Record<PropertyAmenity, string> = {
  food: 'Food',
  laundry: 'Laundry',
  cctv: 'CCTV',
  housekeeping: 'Housekeeping',
  power_backup: 'Power Backup',
  wifi: 'Wi-Fi',
  gym: 'Gym',
  parking: 'Parking',
  water_purifier: 'RO Water',
  security_guard: 'Security',
  lift: 'Lift',
  common_room: 'Common Room',
};
