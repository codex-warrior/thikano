import { describe, expect, it } from 'vitest';
import {
  deriveRoomInventory,
  encodeGeohash,
  geohashQueryPrefixes,
  haversineKm,
  projectPublicProperty,
  projectPublicRoom,
  PUBLIC_ROOM_KEYS,
  rupees,
  type Property,
  type Room,
} from '../src';

const property: Property = {
  id: 'p1', orgId: 'o1', name: 'Sunrise PG', slug: 'sunrise-pg-kukas', kind: 'pg', genderRule: 'boys', description: 'd',
  address: { line1: 'Plot 12, Secret Lane', locality: 'Kukas', city: 'Jaipur', state: 'RJ', pincode: '302028' },
  location: { lat: 27.03061, lng: 75.88963 }, nearbyColleges: ['JECRC'], amenities: ['food'], rules: [], photos: [], videos: [],
  foodIncluded: true, verification: 'verified', publicContactPhone: null, createdAt: 0, updatedAt: 0, createdBy: 'u',
};
const room = (over: Partial<Room> = {}): Room => ({
  id: 'r1', orgId: 'o1', propertyId: 'p1', buildingId: 'b', floorId: 'f', number: '204', publicSlug: 'sunrise-pg-room-204', sharing: 'double',
  description: '', rent: rupees(9500), deposit: rupees(9500), amenities: ['ac'], photos: [], videos: [], operationalStatus: 'active', listingIntent: 'listed',
  inventory: deriveRoomInventory([{ status: 'available' }, { status: 'occupied' }], rupees(9500)), stats: { views: 0, shares: 0, enquiries: 0, applications: 0, bookings: 0 },
  createdAt: 0, updatedAt: 0, createdBy: 'u', ...over,
});

describe('geohash', () => {
  it('encodes a known point', () => {
    // Canonical reference: (42.6, -5.6) → ezs42
    expect(encodeGeohash({ lat: 42.6, lng: -5.6 }, 5)).toBe('ezs42');
  });
  it('query prefixes cover nearby points', () => {
    const c = { lat: 27.0306, lng: 75.8896 };
    const near = { lat: 27.045, lng: 75.9 };
    expect(haversineKm(c, near)).toBeLessThan(3);
    const prefixes = geohashQueryPrefixes(c, 3);
    expect(prefixes.some((p) => encodeGeohash(near).startsWith(p))).toBe(true);
  });
});

describe('public projections', () => {
  it('publishes a listed room of a verified property, with only whitelisted keys', () => {
    const pr = projectPublicRoom(property, room())!;
    expect(pr.listingStatus).toBe('published');
    expect(Object.keys(pr).sort()).toEqual([...PUBLIC_ROOM_KEYS].sort());
    expect(JSON.stringify(pr)).not.toContain('Secret Lane');
    expect(pr.approxLocation).not.toEqual(property.location);
  });
  it('hides unlisted rooms and unverified properties', () => {
    expect(projectPublicRoom(property, room({ listingIntent: 'unlisted' }))).toBeNull();
    expect(projectPublicRoom({ ...property, verification: 'submitted' }, room())).toBeNull();
    expect(projectPublicRoom(property, room(), undefined, true)).toBeNull();
  });
  it('keeps fully occupied rooms public but unsearchable', () => {
    const full = room({ inventory: deriveRoomInventory([{ status: 'occupied' }], rupees(9500)) });
    expect(projectPublicRoom(property, full)?.listingStatus).toBe('fully_occupied');
  });
  it('property projection aggregates available beds and starting rent', () => {
    const rooms = [projectPublicRoom(property, room())!, projectPublicRoom(property, room({ id: 'r2', rent: rupees(8000), publicSlug: 'x' }))!];
    const pp = projectPublicProperty(property, rooms)!;
    expect(pp.availableBeds).toBe(2);
    expect(pp.startingRent).toBe(rupees(8000));
    expect(JSON.stringify(pp)).not.toContain('Secret Lane');
    expect(projectPublicProperty({ ...property, verification: 'suspended' }, rooms)).toBeNull();
  });
});
