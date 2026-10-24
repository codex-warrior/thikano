import { collection, doc, getDoc, getDocs, limit, orderBy, query, startAt, endAt, where } from 'firebase/firestore';
import { geohashQueryPrefixes, groupByProperty, searchRooms, type GeoPoint, type PublicProperty, type PublicRoom, type SearchFilters, type SortKey } from '@thikano/domain';
import { firebase } from './firebase';

/**
 * Discover reads ONLY the public projections (publicRooms / publicProperties).
 * Location search: geohash range queries around the point, then exact filtering and
 * ranking with @thikano/domain searchRooms (docs/HABISTAT-MARKETPLACE.md).
 */
export const PLACES: { label: string; kind: 'area' | 'college'; point: GeoPoint }[] = [
  { label: 'Kukas', kind: 'area', point: { lat: 27.0306, lng: 75.8896 } },
  { label: 'Sitapura', kind: 'area', point: { lat: 26.7836, lng: 75.8686 } },
  { label: 'Malviya Nagar', kind: 'area', point: { lat: 26.8549, lng: 75.8243 } },
  { label: 'Jagatpura', kind: 'area', point: { lat: 26.8212, lng: 75.8614 } },
  { label: 'JECRC', kind: 'college', point: { lat: 26.7836, lng: 75.8686 } },
  { label: 'MNIT Jaipur', kind: 'college', point: { lat: 26.8638, lng: 75.8106 } },
];

const sessionId = Math.random().toString(36).slice(2, 12);

export async function searchNear(place: (typeof PLACES)[number], filters: SearchFilters = {}, sort: SortKey = 'relevance') {
  const { db } = firebase();
  const radiusKm = filters.maxDistanceKm ?? 8;
  const prefixes = geohashQueryPrefixes(place.point, radiusKm);
  const snaps = await Promise.all(
    prefixes.map((p) => getDocs(query(collection(db, 'publicRooms'), where('listingStatus', '==', 'published'), orderBy('geohash'), startAt(p), endAt(`${p}`), limit(150)))),
  );
  const byId = new Map<string, PublicRoom>();
  for (const s of snaps) for (const d of s.docs) byId.set(d.id, d.data() as PublicRoom);
  const rooms = searchRooms([...byId.values()], { ...filters, near: place.point, maxDistanceKm: radiusKm }, sort);
  // Anonymous demand analytics (no phone / uid).
  firebase()
    .call('logSearch', { [place.kind === 'college' ? 'college' : 'area']: place.label, lat: place.point.lat, lng: place.point.lng, maxRent: filters.maxRent ?? null, sharing: filters.sharing?.[0] ?? null, filters: Object.keys(filters).filter((k) => (filters as Record<string, unknown>)[k]), results: rooms.length, sessionId })
    .catch(() => undefined);
  return { rooms, properties: groupByProperty(rooms) };
}

export async function getPublicProperty(propertyId: string) {
  const { db } = firebase();
  const [p, rooms] = await Promise.all([
    getDoc(doc(db, 'publicProperties', propertyId)),
    getDocs(query(collection(db, 'publicRooms'), where('propertyId', '==', propertyId), where('listingStatus', '==', 'published'), limit(100))),
  ]);
  if (!p.exists()) return null;
  return { property: p.data() as PublicProperty, rooms: rooms.docs.map((d) => d.data() as PublicRoom).sort((a, b) => a.rent - b.rent) };
}

export async function getPublicRoom(slug: string) {
  const { db } = firebase();
  const s = await getDocs(query(collection(db, 'publicRooms'), where('slug', '==', slug), limit(1)));
  return s.empty ? null : (s.docs[0]!.data() as PublicRoom);
}

// ───────────── Resident ─────────────

export interface ResidentHome {
  now: number;
  resident: { id: string; name: string; status: string; moveInDate: number; moveOutDate: number | null; rent: number; deposit: number; rentDueDay: number };
  property: { id: string; name: string; locality: string; city: string; rules: string[]; amenities: string[]; foodIncluded: boolean; contactPhone: string | null };
  room: { id: string; number: string; sharing: PublicRoom['sharing']; amenities: PublicRoom['roomAmenities'] };
  bed: { id: string; label: string };
  roommates: string[];
  invoices: { id: string; period: string; amount: number; lateFee: number; paid: number; dueDate: number; status: 'upcoming' | 'due' | 'partially_paid' | 'paid' | 'overdue'; outstanding: number }[];
  notices: { id: string; title: string; body: string; startsAt: number | null; endsAt: number | null; publishedAt: number }[];
  parcels: { id: string; carrier: string; location: string; arrivedAt: number }[];
  orders: { id: string; category: string; providerName: string; items: { name: string; qty: number }[]; gross: number; status: string; createdAt: number; updatedAt: number }[];
  issues: { id: string; category: 'ac' | 'fan' | 'wifi' | 'water' | 'electrical' | 'furniture' | 'plumbing' | 'other'; description: string; status: 'open' | 'assigned' | 'in_progress' | 'resolved' | 'cancelled'; createdAt: number; updatedAt: number }[];
}

export const getResidentHome = () => firebase().call<unknown, ResidentHome>('getResidentHome');

export interface CatalogItem {
  sku: string;
  name: string;
  category: string;
  price: number;
  unit?: string;
}
export const getCatalog = (category?: string) => firebase().call<unknown, { providers: { providerId: string; providerName: string; items: CatalogItem[] }[] }>('getServiceCatalog', category ? { category } : {});
