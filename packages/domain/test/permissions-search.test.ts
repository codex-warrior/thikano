import { describe, expect, it } from 'vitest';
import {
  approximateLocation,
  can,
  canOwnerOnly,
  groupByProperty,
  haversineKm,
  isPlatformAdmin,
  isPlatformStaff,
  propertySlug,
  roomSlug,
  rupees,
  searchRooms,
  type OrgMember,
  type PublicRoom,
} from '../src';

const member = (m: Partial<OrgMember>): OrgMember => ({
  uid: 'u',
  role: 'staff',
  propertyIds: null,
  status: 'active',
  displayName: 'X',
  ...m,
});

describe('permissions', () => {
  it('owners and managers have every org permission', () => {
    expect(can(member({ role: 'owner' }), 'rent.collect')).toBe(true);
    expect(can(member({ role: 'manager' }), 'listings.publish')).toBe(true);
  });

  it('staff only have explicit grants', () => {
    const s = member({ permissions: ['maintenance.read', 'maintenance.write'] });
    expect(can(s, 'maintenance.write')).toBe(true);
    expect(can(s, 'rent.read')).toBe(false);
    expect(can(s, 'earnings.read')).toBe(false);
  });

  it('property scoping is enforced', () => {
    const m = member({ role: 'manager', propertyIds: ['p1'] });
    expect(can(m, 'residents.read', 'p1')).toBe(true);
    expect(can(m, 'residents.read', 'p2')).toBe(false);
  });

  it('inactive or missing members have nothing', () => {
    expect(can(member({ role: 'owner', status: 'removed' }), 'inventory.read')).toBe(false);
    expect(can(null, 'inventory.read')).toBe(false);
  });

  it('managers cannot do owner-only actions', () => {
    expect(canOwnerOnly(member({ role: 'manager' }), 'org.manage_members')).toBe(false);
    expect(canOwnerOnly(member({ role: 'owner' }), 'org.manage_members')).toBe(true);
  });

  it('platform roles are separate from org roles', () => {
    expect(isPlatformAdmin({ uid: 'a', platformRole: 'platform_support' })).toBe(false);
    expect(isPlatformStaff({ uid: 'a', platformRole: 'platform_support' })).toBe(true);
    expect(isPlatformStaff({ uid: 'a' })).toBe(false);
  });
});

const JECRC = { lat: 26.7836, lng: 75.8686 };
const room = (r: Partial<PublicRoom>): PublicRoom => ({
  roomId: 'r',
  slug: 's',
  propertyId: 'p',
  propertySlug: 'ps',
  propertyName: 'P',
  locality: 'Kukas',
  city: 'Jaipur',
  approxLocation: JECRC,
  geohash: 'ts',
  nearbyColleges: ['JECRC University'],
  genderRule: 'coed',
  number: '1',
  sharing: 'double',
  rent: rupees(9000),
  deposit: rupees(9000),
  availableBeds: 1,
  totalBeds: 2,
  roomAmenities: ['wifi'],
  propertyAmenities: ['food'],
  foodIncluded: true,
  coverPhotoUrl: null,
  photoUrls: [],
  videoUrl: null,
  rating: 4.5,
  ratingCount: 10,
  listingStatus: 'published',
  updatedAt: 0,
  ...r,
});

describe('search', () => {
  const rooms = [
    room({ roomId: 'near', approxLocation: { lat: 26.79, lng: 75.87 }, rent: rupees(9500), roomAmenities: ['ac', 'wifi'] }),
    room({ roomId: 'far', approxLocation: { lat: 26.9, lng: 75.8 }, rent: rupees(7000) }),
    room({ roomId: 'full', availableBeds: 0, listingStatus: 'fully_occupied' }),
    room({ roomId: 'girls', genderRule: 'girls', propertyId: 'p2' }),
  ];

  it('never returns rooms without available beds', () => {
    expect(searchRooms(rooms, {}).map((r) => r.room.roomId)).not.toContain('full');
  });

  it('filters by distance, budget, AC and gender', () => {
    expect(searchRooms(rooms, { near: JECRC, maxDistanceKm: 3 }).map((r) => r.room.roomId)).not.toContain('far');
    expect(searchRooms(rooms, { maxRent: rupees(8000) }).map((r) => r.room.roomId)).toEqual(['far']);
    expect(searchRooms(rooms, { ac: true }).map((r) => r.room.roomId)).toEqual(['near']);
    expect(searchRooms(rooms, { gender: 'boys' }).map((r) => r.room.roomId)).not.toContain('girls');
  });

  it('matches colleges loosely', () => {
    expect(searchRooms(rooms, { college: 'jecrc' })).toHaveLength(3);
    expect(searchRooms(rooms, { college: 'MNIT' })).toHaveLength(0);
  });

  it('sorts by distance', () => {
    expect(searchRooms(rooms, { near: JECRC }, 'distance').at(-1)?.room.roomId).toBe('far');
  });

  it('groups results into properties with summed beds and starting rent', () => {
    const g = groupByProperty(searchRooms(rooms, {}));
    const p = g.find((x) => x.propertyId === 'p')!;
    expect(p.availableBeds).toBe(2);
    expect(p.startingRent).toBe(rupees(7000));
  });

  it('haversine is sane (JECRC → Jaipur centre is > 15 km)', () => {
    expect(haversineKm(JECRC, { lat: 26.9124, lng: 75.7873 })).toBeGreaterThan(15);
    expect(haversineKm(JECRC, JECRC)).toBe(0);
  });

  it('approximate location moves the point by less than ~150 m', () => {
    const exact = { lat: 26.78412, lng: 75.86931 };
    expect(haversineKm(exact, approximateLocation(exact))).toBeLessThan(0.15);
  });
});

describe('slugs', () => {
  it('makes clean URLs', () => {
    expect(propertySlug('Sunrise PG', 'Kukas')).toBe('sunrise-pg-kukas');
    expect(roomSlug('Sunrise PG', '204')).toBe('sunrise-pg-room-204');
  });
});
