/**
 * THIKANO DEVELOPMENT DATASET — deterministic, never for production.
 *
 * Sunrise PG: exactly 100 beds, 94 occupied, 6 vacant.
 * Five properties, 500+ beds, multiple owners, vacancies, leads, bookings,
 * rent, maintenance, notices, parcels, service orders and revenue rules.
 *
 * Everything is derived through @thikano/domain so fixture numbers obey the
 * same rules as production (inventory from beds, listing status derived, etc.).
 */
import {
  deriveRoomInventory,
  projectPublicRoom,
  dueDateFor,
  propertySlug,
  roomSlug,
  rupees,
  splitForOrder,
  type Bed,
  type Booking,
  type BookingStage,
  type Building,
  type Floor,
  type Lead,
  type LeadStatus,
  type MaintenanceCategory,
  type MaintenanceIssue,
  type MaintenanceStatus,
  type MediaAsset,
  type Notice,
  type OrgMember,
  type Organization,
  type Parcel,
  type Property,
  type PropertyAmenity,
  type PublicRoom,
  type RentInvoice,
  type Resident,
  type RevenueShareRule,
  type RevenueSplit,
  type Room,
  type RoomAmenity,
  type ServiceCategory,
  type ServiceOrder,
  type SharingType,
} from '@thikano/domain';

declare const process: { env: Record<string, string | undefined> } | undefined;

export function assertFixturesAllowed(): void {
  const env = typeof process !== 'undefined' ? process.env : {};
  if (env.THIKANO_ENV === 'production' || env.NEXT_PUBLIC_THIKANO_ENV === 'production') {
    throw new Error('THIKANO fixtures must never be loaded in production.');
  }
}

/** Frozen "now" so every screen and test sees the same day: 22 Oct 2026, 9:00 IST. */
export const FIXTURE_NOW = Date.UTC(2026, 9, 22, 3, 30);
export const FIXTURE_PERIOD = '2026-10';
const DAY = 86_400_000;

// ───────────── deterministic PRNG ─────────────
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261022);
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)]!;
const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));

// ───────────── imagery (Unsplash, dev only) ─────────────
const ROOM_PHOTOS = [
  '1522708323590-d24dbb6b0267',
  '1505693416388-ac5ce068fe85',
  '1540518614846-7eded433c457',
  '1555854877-bab0e564b8d5',
  '1586023492125-27b2c045efd7',
  '1560185007-cde436f6a4d0',
  '1513694203232-719a280e022f',
  '1595526114035-0d45ed16cfbf',
  '1616594039964-ae9021a400a0',
  '1631049307264-da0ec9d70304',
  '1598928506311-c55ded91a20c',
  '1502672260266-1c1ef2d93688',
];
const PROPERTY_PHOTOS = ['1560448204-e02f11c3d0e2', '1484154218962-a197022b5858', '1493809842364-78817add7ffb', '1554995207-c18c203602cb', '1567767292278-a4f21aa2d36e', '1600585154340-be6161a56a0c'];
const unsplash = (id: string, w: number) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=70`;
function media(ids: string[], prefix: string): MediaAsset[] {
  return ids.map((id, i) => ({
    id: `${prefix}-ph${i}`,
    kind: 'photo',
    storagePath: `dev/${prefix}/${i}.jpg`,
    url: unsplash(id, 1200),
    thumbUrl: unsplash(id, 400),
    width: 1200,
    height: 800,
    sortOrder: i,
  }));
}
function rotate<T>(arr: readonly T[], n: number, count: number): T[] {
  return Array.from({ length: count }, (_, i) => arr[(n + i) % arr.length]!);
}

// ───────────── people ─────────────
const FIRST = ['Aarav', 'Vivaan', 'Aditya', 'Arjun', 'Sai', 'Ishaan', 'Kabir', 'Ananya', 'Diya', 'Priya', 'Riya', 'Sneha', 'Rahul', 'Karan', 'Yash', 'Harsh', 'Nikhil', 'Pooja', 'Neha', 'Tanvi', 'Manish', 'Deepak', 'Kunal', 'Aman', 'Siddharth', 'Mehul', 'Sakshi', 'Kritika', 'Ayush', 'Varun', 'Rohan', 'Shreya', 'Tanya', 'Abhinav', 'Lakshya', 'Mohit'];
const LAST = ['Sharma', 'Verma', 'Gupta', 'Singh', 'Jain', 'Agarwal', 'Meena', 'Choudhary', 'Rathore', 'Shekhawat', 'Saini', 'Yadav', 'Mehta', 'Khandelwal', 'Joshi', 'Bansal', 'Kumawat', 'Soni'];
const phone = () => `+91 9${int(100000000, 999999999)}`;
const personName = () => `${pick(FIRST)} ${pick(LAST)}`;

// ───────────── organizations & owners ─────────────
export const OWNERS = [
  { uid: 'owner-shashank', name: 'Shashank Agarwal', orgId: 'org-sunrise', orgName: 'Sunrise Stays' },
  { uid: 'owner-meera', name: 'Meera Rathore', orgId: 'org-meera', orgName: 'Rathore Hospitality' },
  { uid: 'owner-vikram', name: 'Vikram Khandelwal', orgId: 'org-vatika', orgName: 'Vatika Living' },
] as const;

const audit = (by: string, at = FIXTURE_NOW - 120 * DAY) => ({ createdAt: at, updatedAt: at, createdBy: by });

export const organizations: Organization[] = OWNERS.map((o) => ({
  id: o.orgId,
  name: o.orgName,
  ownerUid: o.uid,
  verification: 'verified',
  status: 'active',
  ...audit(o.uid),
}));

export const members: (OrgMember & { orgId: string })[] = [
  ...OWNERS.map((o) => ({ orgId: o.orgId, uid: o.uid, role: 'owner' as const, propertyIds: null, status: 'active' as const, displayName: o.name })),
  { orgId: 'org-sunrise', uid: 'mgr-ramesh', role: 'manager', propertyIds: ['prop-sunrise'], status: 'active', displayName: 'Ramesh Saini' },
  { orgId: 'org-sunrise', uid: 'staff-suresh', role: 'staff', propertyIds: ['prop-sunrise'], status: 'active', displayName: 'Suresh (Maintenance)', permissions: ['maintenance.read', 'maintenance.write', 'inventory.read'] },
];

// ───────────── property blueprints ─────────────
interface Blueprint {
  id: string;
  orgId: string;
  name: string;
  kind: Property['kind'];
  gender: Property['genderRule'];
  locality: string;
  location: { lat: number; lng: number };
  colleges: string[];
  amenities: PropertyAmenity[];
  baseRent: Record<SharingType, number>;
  blocks: { name: string; floors: number; roomsPerFloor: number }[];
  targetBeds: number;
  vacancyRate: number;
  verification: Property['verification'];
  rating: number;
  description: string;
}

const COMMON_RULES = ['Gate closes at 10:30 PM', 'Visitors allowed in common area till 8 PM', 'No smoking or alcohol on premises', 'One month notice before moving out'];

const BLUEPRINTS: Blueprint[] = [
  {
    id: 'prop-sunrise',
    orgId: 'org-sunrise',
    name: 'Sunrise PG',
    kind: 'pg',
    gender: 'boys',
    locality: 'Kukas',
    location: { lat: 27.0306, lng: 75.8896 },
    colleges: ['JECRC Foundation', 'Arya College of Engineering', 'Poornima University'],
    amenities: ['food', 'laundry', 'cctv', 'housekeeping', 'power_backup', 'wifi', 'water_purifier', 'security_guard'],
    baseRent: { single: 12500, double: 9500, triple: 8500, quad: 7500, dorm: 6000 },
    blocks: [
      { name: 'Block A', floors: 3, roomsPerFloor: 12 },
      { name: 'Block B', floors: 2, roomsPerFloor: 8 },
    ],
    targetBeds: 100,
    vacancyRate: 0,
    verification: 'verified',
    rating: 4.6,
    description: 'Well-run boys PG five minutes from the Kukas college belt. Home-style veg meals three times a day, daily housekeeping and 24×7 power backup.',
  },
  {
    id: 'prop-greenhouse',
    orgId: 'org-meera',
    name: 'Green House PG',
    kind: 'pg',
    gender: 'coed',
    locality: 'Kukas',
    location: { lat: 27.0391, lng: 75.8812 },
    colleges: ['Arya College of Engineering', 'JECRC Foundation'],
    amenities: ['food', 'wifi', 'cctv', 'power_backup', 'common_room'],
    baseRent: { single: 11500, double: 9000, triple: 7800, quad: 7000, dorm: 5500 },
    blocks: [{ name: 'Main', floors: 4, roomsPerFloor: 10 }],
    targetBeds: 105,
    vacancyRate: 0.12,
    verification: 'verified',
    rating: 4.3,
    description: 'Bright, airy rooms with separate floors for men and women. Terrace common room and fast fibre Wi-Fi.',
  },
  {
    id: 'prop-shivshakti',
    orgId: 'org-meera',
    name: 'Shiv Shakti Girls Hostel',
    kind: 'hostel',
    gender: 'girls',
    locality: 'Sitapura',
    location: { lat: 26.7836, lng: 75.8686 },
    colleges: ['JECRC University', 'Jaipur National University', 'SKIT'],
    amenities: ['food', 'laundry', 'cctv', 'housekeeping', 'security_guard', 'lift', 'water_purifier', 'wifi'],
    baseRent: { single: 13000, double: 10500, triple: 9000, quad: 8000, dorm: 6500 },
    blocks: [
      { name: 'Tower 1', floors: 5, roomsPerFloor: 8 },
      { name: 'Tower 2', floors: 3, roomsPerFloor: 6 },
    ],
    targetBeds: 140,
    vacancyRate: 0.08,
    verification: 'verified',
    rating: 4.7,
    description: 'Secure girls hostel with biometric entry, women wardens on every floor, and AC rooms close to JECRC University.',
  },
  {
    id: 'prop-vatika',
    orgId: 'org-vatika',
    name: 'Vatika Student Living',
    kind: 'student_housing',
    gender: 'coed',
    locality: 'Malviya Nagar',
    location: { lat: 26.8549, lng: 75.8243 },
    colleges: ['MNIT Jaipur', 'Malaviya National Institute of Technology', 'IIHMR University'],
    amenities: ['wifi', 'gym', 'laundry', 'housekeeping', 'cctv', 'power_backup', 'common_room', 'lift'],
    baseRent: { single: 16000, double: 12500, triple: 10000, quad: 9000, dorm: 7000 },
    blocks: [{ name: 'Vatika', floors: 5, roomsPerFloor: 9 }],
    targetBeds: 110,
    vacancyRate: 0.15,
    verification: 'verified',
    rating: 4.5,
    description: 'Modern managed student residence near MNIT with a gym, study lounges and weekly community events.',
  },
  {
    id: 'prop-ananta',
    orgId: 'org-vatika',
    name: 'Ananta Boys Hostel',
    kind: 'hostel',
    gender: 'boys',
    locality: 'Jagatpura',
    location: { lat: 26.8212, lng: 75.8614 },
    colleges: ['Poornima College', 'JECRC University', 'Rajasthan Technical University'],
    amenities: ['food', 'wifi', 'parking', 'power_backup', 'water_purifier'],
    baseRent: { single: 10000, double: 8000, triple: 7000, quad: 6200, dorm: 5000 },
    blocks: [{ name: 'Main', floors: 3, roomsPerFloor: 10 }],
    targetBeds: 80,
    vacancyRate: 0.2,
    verification: 'submitted',
    rating: 4.1,
    description: 'Budget-friendly boys hostel in Jagatpura with mess, parking and a quiet study hall. Newly onboarded.',
  },
];

const ROOM_AMENITY_SETS: RoomAmenity[][] = [
  ['ac', 'wifi', 'attached_bathroom', 'study_table', 'cupboard'],
  ['wifi', 'attached_bathroom', 'study_table', 'cupboard'],
  ['ac', 'wifi', 'study_table', 'cupboard', 'balcony'],
  ['wifi', 'study_table', 'cupboard', 'geyser'],
];

const SHARING_BEDS: Record<SharingType, number> = { single: 1, double: 2, triple: 3, quad: 4, dorm: 6 };
const SHARING_CYCLE: SharingType[] = ['double', 'triple', 'double', 'single', 'triple', 'double', 'quad', 'double'];
const BED_LABELS = 'ABCDEF';

/** Rooms whose sharing is fixed so demo stories stay stable. */
const SUNRISE_OVERRIDES: Record<string, SharingType> = { '204': 'double', '312': 'triple', '108': 'double' };
/** Sunrise's 6 vacant beds: 204-A, 204-B, 312-C, 108-B, B105-A and B103-C. */
const SUNRISE_VACANT = new Set(['204-A', '204-B', '312-C', '108-B', 'B105-A', 'B103-C']);

// ───────────── generation ─────────────
export const properties: Property[] = [];
export const buildings: Building[] = [];
export const floors: Floor[] = [];
export const rooms: Room[] = [];
export const beds: Bed[] = [];
export const residents: Resident[] = [];

for (const [pIndex, bp] of BLUEPRINTS.entries()) {
  const owner = OWNERS.find((o) => o.orgId === bp.orgId)!;
  const slug = propertySlug(bp.name, bp.locality);
  properties.push({
    id: bp.id,
    orgId: bp.orgId,
    name: bp.name,
    slug,
    kind: bp.kind,
    genderRule: bp.gender,
    description: bp.description,
    address: { line1: `Plot ${12 + pIndex * 7}, ${bp.locality} Main Road`, locality: bp.locality, city: 'Jaipur', state: 'Rajasthan', pincode: ['302028', '302028', '302022', '302017', '302017'][pIndex]! },
    location: bp.location,
    nearbyColleges: bp.colleges,
    amenities: bp.amenities,
    rules: COMMON_RULES,
    photos: media(rotate(PROPERTY_PHOTOS, pIndex, 4), bp.id),
    videos: [],
    foodIncluded: bp.amenities.includes('food'),
    verification: bp.verification,
    publicContactPhone: null,
    ...audit(owner.uid, FIXTURE_NOW - (200 - pIndex * 30) * DAY),
  });

  let bedsSoFar = 0;
  let roomCounter = 0;
  outer: for (const [bIndex, block] of bp.blocks.entries()) {
    const buildingId = `${bp.id}-b${bIndex}`;
    buildings.push({ id: buildingId, orgId: bp.orgId, propertyId: bp.id, name: block.name, sortOrder: bIndex, ...audit(owner.uid) });
    for (let level = 1; level <= block.floors; level++) {
      const floorId = `${buildingId}-f${level}`;
      floors.push({ id: floorId, orgId: bp.orgId, propertyId: bp.id, buildingId, label: ordinalFloor(level), level, ...audit(owner.uid) });
      for (let r = 1; r <= block.roomsPerFloor; r++) {
        if (bedsSoFar >= bp.targetBeds) break outer;
        const base = `${level}${String(r).padStart(2, '0')}`;
        const number = bIndex === 0 ? base : `${block.name.at(-1)}${base}`;
        let sharing: SharingType = (bp.id === 'prop-sunrise' && SUNRISE_OVERRIDES[number]) || SHARING_CYCLE[roomCounter % SHARING_CYCLE.length]!;
        // Fit exactly to targetBeds with the last room.
        while (bedsSoFar + SHARING_BEDS[sharing] > bp.targetBeds) sharing = smaller(sharing);
        roomCounter++;
        const roomId = `${bp.id}-r${number}`;
        const bedCount = SHARING_BEDS[sharing];
        const rent = rupees(bp.baseRent[sharing] + (level >= 3 ? 250 : 0));
        const amenities = ROOM_AMENITY_SETS[(roomCounter + pIndex) % ROOM_AMENITY_SETS.length]!;
        const roomBeds: Bed[] = [];
        for (let b = 0; b < bedCount; b++) {
          const label = BED_LABELS[b]!;
          const bedKey = `${number}-${label}`;
          const vacant = bp.id === 'prop-sunrise' ? SUNRISE_VACANT.has(bedKey) : rand() < bp.vacancyRate;
          const bed: Bed = {
            id: `${roomId}-${label}`,
            orgId: bp.orgId,
            propertyId: bp.id,
            roomId,
            label,
            status: vacant ? 'available' : 'occupied',
            rentOverride: null,
            residentId: null,
            moveInDate: null,
            moveOutDate: null,
            ...audit(owner.uid),
          };
          roomBeds.push(bed);
        }
        bedsSoFar += bedCount;
        const listed = bp.id === 'prop-sunrise' ? ['312', '108'].includes(number) : roomCounter % 3 !== 0;
        const room: Room = {
          id: roomId,
          orgId: bp.orgId,
          propertyId: bp.id,
          buildingId,
          floorId,
          number,
          publicSlug: roomSlug(bp.name, number),
          sharing,
          description: `${capitalize(sharing)} sharing room on the ${ordinalFloor(level).toLowerCase()} floor of ${block.name}. ${amenities.includes('ac') ? 'Air-conditioned, ' : ''}${amenities.includes('attached_bathroom') ? 'with attached bathroom, ' : ''}good natural light and individual study tables.`,
          rent,
          deposit: rent,
          amenities,
          photos: media(rotate(ROOM_PHOTOS, roomCounter + pIndex * 3, 4), roomId),
          videos: [],
          operationalStatus: 'active',
          listingIntent: listed ? 'listed' : 'unlisted',
          inventory: deriveRoomInventory(roomBeds, rent, FIXTURE_NOW),
          stats: { views: listed ? int(20, 160) : 0, shares: listed ? int(1, 14) : 0, enquiries: 0, applications: 0, bookings: 0 },
          ...audit(owner.uid),
        };
        rooms.push(room);
        beds.push(...roomBeds);
      }
    }
  }
}

function smaller(s: SharingType): SharingType {
  return ({ dorm: 'quad', quad: 'triple', triple: 'double', double: 'single', single: 'single' } as const)[s];
}
function ordinalFloor(level: number) {
  return ['Ground', '1st', '2nd', '3rd', '4th', '5th', '6th'][level] ?? `${level}th`;
}
function capitalize(s: string) {
  return s[0]!.toUpperCase() + s.slice(1);
}

// Sunrise demo stories
const sunriseRoom204 = rooms.find((r) => r.id === 'prop-sunrise-r204')!;
sunriseRoom204.stats = { views: 48, shares: 9, enquiries: 6, applications: 2, bookings: 0 };

// ───────────── residents (one per occupied bed) ─────────────
const room = new Map(rooms.map((r) => [r.id, r]));
for (const bed of beds) {
  if (bed.status !== 'occupied') continue;
  const r = room.get(bed.roomId)!;
  const isRohit = bed.id === 'prop-sunrise-r312-A';
  const monthsAgo = int(1, 14);
  const moveIn = isRohit ? Date.UTC(2026, 7, 12) : FIXTURE_NOW - monthsAgo * 30 * DAY;
  const res: Resident = {
    id: `res-${bed.id}`,
    orgId: bed.orgId,
    propertyId: bed.propertyId,
    roomId: bed.roomId,
    bedId: bed.id,
    uid: isRohit ? 'resident-rohit' : null,
    name: isRohit ? 'Rohit Singh' : personName(),
    phone: phone(),
    status: 'active',
    moveInDate: moveIn,
    moveOutDate: null,
    rent: r.rent,
    deposit: r.deposit,
    rentDueDay: 5,
    ...audit(r.createdBy, moveIn),
  };
  residents.push(res);
  bed.residentId = res.id;
  bed.moveInDate = moveIn;
}
// Two Sunrise residents leaving this month
for (const id of ['prop-sunrise-r101-A', 'prop-sunrise-r205-B']) {
  const b = beds.find((x) => x.id === id);
  if (!b) continue;
  b.moveOutDate = Date.UTC(2026, 9, 31);
  const res = residents.find((x) => x.bedId === id)!;
  res.status = 'notice';
  res.moveOutDate = b.moveOutDate;
}
// Re-derive room inventory now that move-outs are set.
for (const r of rooms) {
  r.inventory = deriveRoomInventory(
    beds.filter((b) => b.roomId === r.id),
    r.rent,
    FIXTURE_NOW,
  );
}

// ───────────── rent: October invoices for Sunrise ─────────────
export const invoices: RentInvoice[] = [];
const sunriseResidents = residents.filter((r) => r.propertyId === 'prop-sunrise');
for (const [i, res] of sunriseResidents.entries()) {
  const isRohit = res.uid === 'resident-rohit';
  const roll = i % 12;
  const amount = res.rent;
  // ~80% paid, some partial, a few overdue (Rohit is overdue by design).
  const paid = isRohit ? 0 : roll < 9 ? amount : roll === 9 ? Math.round(amount / 2) : 0;
  invoices.push({
    id: `inv-${res.id}-${FIXTURE_PERIOD}`,
    orgId: res.orgId,
    propertyId: res.propertyId,
    residentId: res.id,
    period: FIXTURE_PERIOD,
    amount,
    lateFee: 0,
    paid,
    dueDate: dueDateFor(FIXTURE_PERIOD, res.rentDueDay),
    ...audit(res.orgId, Date.UTC(2026, 9, 1)),
  });
}
// November invoice for Rohit (upcoming)
const rohit = residents.find((r) => r.uid === 'resident-rohit')!;
invoices.push({
  id: `inv-${rohit.id}-2026-11`,
  orgId: rohit.orgId,
  propertyId: rohit.propertyId,
  residentId: rohit.id,
  period: '2026-11',
  amount: rohit.rent,
  lateFee: 0,
  paid: 0,
  dueDate: dueDateFor('2026-11', 5),
  ...audit(rohit.orgId, FIXTURE_NOW),
});

// ───────────── maintenance ─────────────
const MAINT: { room: string; cat: MaintenanceCategory; text: string; status: MaintenanceStatus; daysAgo: number }[] = [
  { room: '204', cat: 'ac', text: 'AC not cooling, makes rattling noise', status: 'open', daysAgo: 0 },
  { room: '312', cat: 'wifi', text: 'Wi-Fi drops every evening after 9 PM', status: 'assigned', daysAgo: 1 },
  { room: '105', cat: 'water', text: 'Low water pressure in bathroom', status: 'in_progress', daysAgo: 2 },
  { room: '110', cat: 'fan', text: 'Fan regulator broken', status: 'open', daysAgo: 1 },
  { room: '207', cat: 'electrical', text: 'Switchboard sparking near study table', status: 'open', daysAgo: 0 },
  { room: '301', cat: 'furniture', text: 'Cupboard door hinge loose', status: 'assigned', daysAgo: 3 },
  { room: '209', cat: 'plumbing', text: 'Leaking tap', status: 'open', daysAgo: 4 },
  { room: '302', cat: 'ac', text: 'AC remote not working', status: 'resolved', daysAgo: 6 },
  { room: '106', cat: 'wifi', text: 'Cannot connect to Wi-Fi', status: 'resolved', daysAgo: 8 },
  { room: '211', cat: 'other', text: 'Window latch broken', status: 'resolved', daysAgo: 10 },
];
export const maintenance: MaintenanceIssue[] = MAINT.map((m, i) => {
  const r = room.get(`prop-sunrise-r${m.room}`)!;
  const bed = beds.find((b) => b.roomId === r.id && b.status === 'occupied');
  const at = FIXTURE_NOW - m.daysAgo * DAY - i * 3_600_000;
  return {
    id: `mnt-${i + 1}`,
    orgId: r.orgId,
    propertyId: r.propertyId,
    buildingId: r.buildingId,
    floorId: r.floorId,
    roomId: r.id,
    bedId: bed?.id ?? null,
    residentId: bed?.residentId ?? null,
    category: m.cat,
    description: m.text,
    photos: [],
    status: m.status,
    assigneeUid: m.status === 'open' ? null : 'staff-suresh',
    resolvedAt: m.status === 'resolved' ? at + DAY : null,
    ...audit(bed?.residentId ?? 'owner-shashank', at),
  };
});
// Rohit's own open request
maintenance.push({ ...maintenance[1]!, id: 'mnt-rohit', bedId: rohit.bedId, residentId: rohit.id, category: 'wifi' });
maintenance.splice(1, 1);

// ───────────── notices ─────────────
export const notices: Notice[] = [
  { id: 'ntc-1', orgId: 'org-sunrise', propertyId: 'prop-sunrise', buildingIds: ['prop-sunrise-b0'], title: 'Water maintenance', body: 'Tank cleaning in Block A. Water supply will be off.', startsAt: Date.UTC(2026, 9, 22, 12, 30), endsAt: Date.UTC(2026, 9, 22, 13, 30), publishedAt: FIXTURE_NOW - 2 * 3_600_000, ...audit('owner-shashank', FIXTURE_NOW - 2 * 3_600_000) },
  { id: 'ntc-2', orgId: 'org-sunrise', propertyId: 'prop-sunrise', buildingIds: null, title: 'Diwali dinner on Saturday 🪔', body: 'Special thali dinner on the terrace at 8 PM. Everyone is invited.', startsAt: Date.UTC(2026, 9, 24, 14, 30), endsAt: null, publishedAt: FIXTURE_NOW - DAY, ...audit('owner-shashank', FIXTURE_NOW - DAY) },
  { id: 'ntc-3', orgId: 'org-sunrise', propertyId: 'prop-sunrise', buildingIds: null, title: 'New Wi-Fi password', body: 'The Wi-Fi password has been updated. Check My Stay for details.', startsAt: null, endsAt: null, publishedAt: FIXTURE_NOW - 4 * DAY, ...audit('owner-shashank', FIXTURE_NOW - 4 * DAY) },
];

export const parcels: Parcel[] = [
  { id: 'pcl-1', orgId: 'org-sunrise', propertyId: 'prop-sunrise', residentId: rohit.id, carrier: 'Amazon', location: 'Reception', arrivedAt: FIXTURE_NOW - 40 * 60_000, collectedAt: null, ...audit('mgr-ramesh', FIXTURE_NOW - 40 * 60_000) },
];

// ───────────── leads & bookings ─────────────
const LEAD_STATUSES: LeadStatus[] = ['new', 'new', 'new', 'new', 'contacted', 'visit_scheduled', 'interested', 'applied', 'approved', 'converted', 'lost', 'rejected'];
export const leads: Lead[] = [];
export const bookings: Booking[] = [];
const listedWithBeds = rooms.filter((r) => r.inventory.availableBeds > 0);
for (let i = 0; i < 36; i++) {
  const r = i < 6 ? sunriseRoom204 : listedWithBeds[(i * 7) % listedWithBeds.length]!;
  const status = i < 4 ? 'new' : LEAD_STATUSES[i % LEAD_STATUSES.length]!;
  const at = FIXTURE_NOW - (i < 4 ? i * 3 * 3_600_000 : int(1, 20) * DAY);
  const lead: Lead = {
    id: `lead-${i + 1}`,
    orgId: r.orgId,
    propertyId: r.propertyId,
    roomId: r.id,
    bedId: null,
    studentUid: i % 3 === 0 ? `student-${i}` : null,
    name: personName(),
    phone: phone(),
    expectedMoveIn: FIXTURE_NOW + int(3, 40) * DAY,
    message: pick(['Is food included?', 'Can I visit this weekend?', 'Is the room still available?', 'Looking for a room from next month.', '']),
    source: pick(['room_share_link', 'room_share_link', 'discover', 'property_share_link', 'qr'] as const),
    status,
    bookingId: null,
    ...audit('public', at),
  };
  leads.push(lead);
  if (['visit_scheduled', 'applied', 'approved', 'converted'].includes(status)) {
    const stage: BookingStage = ({ visit_scheduled: 'visit_scheduled', applied: 'owner_review', approved: 'booked', converted: 'moved_in' } as Record<string, BookingStage>)[status]!;
    const b: Booking = {
      id: `bkg-${i + 1}`,
      orgId: r.orgId,
      propertyId: r.propertyId,
      roomId: r.id,
      bedId: null,
      leadId: lead.id,
      studentUid: lead.studentUid ?? null,
      studentName: lead.name,
      stage,
      visitAt: stage === 'visit_scheduled' ? FIXTURE_NOW + int(1, 4) * DAY : null,
      moveInDate: lead.expectedMoveIn ?? null,
      rent: r.rent,
      deposit: r.deposit,
      history: [{ stage: 'inquiry', at, by: 'public' }, { stage, at: at + DAY, by: r.createdBy }],
      ...audit('public', at),
    };
    lead.bookingId = b.id;
    bookings.push(b);
  }
}
for (const r of rooms) {
  const rl = leads.filter((l) => l.roomId === r.id);
  if (r.id !== sunriseRoom204.id) {
    r.stats.enquiries = rl.length;
    r.stats.applications = rl.filter((l) => ['applied', 'approved', 'converted'].includes(l.status)).length;
    r.stats.bookings = rl.filter((l) => l.status === 'converted').length;
  }
}

// ───────────── services & partner economics ─────────────
export const providers = [
  { id: 'dwarpar', name: 'Dwarpar', categories: ['food', 'groceries', 'courier'] as ServiceCategory[], status: 'active' as const, adapter: 'dwarpar' },
  { id: 'washwise', name: 'WashWise Laundry', categories: ['laundry'] as ServiceCategory[], status: 'active' as const, adapter: 'mock' },
  { id: 'sparkle', name: 'Sparkle Cleaning', categories: ['cleaning'] as ServiceCategory[], status: 'active' as const, adapter: 'mock' },
  { id: 'medkart', name: 'MedKart', categories: ['pharmacy'] as ServiceCategory[], status: 'pending' as const, adapter: 'mock' },
];

export const revenueRules: RevenueShareRule[] = [
  { id: 'rule-default', active: true, match: {}, providerBps: 8500, thikanoBps: 900, partnerBps: 400, otherFeesBps: 200, effectiveFrom: 0 },
  { id: 'rule-food', active: true, match: { category: 'food' }, providerBps: 8000, thikanoBps: 1100, partnerBps: 700, otherFeesBps: 200, effectiveFrom: 0 },
  { id: 'rule-laundry', active: true, match: { category: 'laundry' }, providerBps: 7500, thikanoBps: 1300, partnerBps: 1000, otherFeesBps: 200, effectiveFrom: 0 },
  { id: 'rule-cleaning', active: true, match: { category: 'cleaning' }, providerBps: 7800, thikanoBps: 1100, partnerBps: 900, otherFeesBps: 200, effectiveFrom: 0 },
];

const MENU: Record<'food' | 'laundry' | 'cleaning' | 'groceries', { sku: string; name: string; price: number }[]> = {
  food: [
    { sku: 'thali', name: 'Rajasthani Thali', price: 180 },
    { sku: 'maggi', name: 'Masala Maggi', price: 60 },
    { sku: 'paratha', name: 'Aloo Paratha (2)', price: 90 },
    { sku: 'biryani', name: 'Veg Biryani', price: 160 },
  ],
  laundry: [
    { sku: 'wash-fold', name: 'Wash & Fold (per kg)', price: 70 },
    { sku: 'iron', name: 'Ironing (per piece)', price: 12 },
  ],
  cleaning: [{ sku: 'deep-clean', name: 'Room Deep Clean', price: 299 }],
  groceries: [{ sku: 'kit', name: 'Snack & Essentials Kit', price: 245 }],
};

export const serviceOrders: (ServiceOrder & { split: RevenueSplit })[] = [];
const activeResidents = residents.filter((r) => r.propertyId === 'prop-sunrise');
for (let i = 0; i < 220; i++) {
  const res = i < 3 ? rohit : activeResidents[(i * 13) % activeResidents.length]!;
  const category = (['food', 'food', 'food', 'laundry', 'laundry', 'cleaning', 'groceries'] as const)[i % 7]!;
  const providerId = category === 'laundry' ? 'washwise' : category === 'cleaning' ? 'sparkle' : 'dwarpar';
  const item = pick(MENU[category]);
  const qty = category === 'laundry' && item.sku === 'wash-fold' ? int(2, 5) : int(1, 2);
  const gross = rupees(item.price * qty);
  const at = FIXTURE_NOW - (i < 3 ? i * 3_600_000 : int(0, 21) * DAY + int(0, 12) * 3_600_000);
  const status = i === 0 ? 'ready' : i === 1 ? 'in_progress' : 'delivered';
  serviceOrders.push({
    id: `ord-${i + 1}`,
    orgId: res.orgId,
    propertyId: res.propertyId,
    residentId: res.id,
    providerId,
    providerOrderRef: providerId === 'dwarpar' ? `DW-MOCK-${10000 + i}` : null,
    category,
    items: [{ sku: item.sku, name: item.name, qty, unitPrice: rupees(item.price) }],
    gross,
    status,
    split: splitForOrder(gross, revenueRules, { category, providerId, orgId: res.orgId, propertyId: res.propertyId, at }),
    ...audit(res.id, at),
  });
}
// Rohit's laundry is ready for pickup — first order is laundry
serviceOrders[0]!.category = 'laundry';
serviceOrders[0]!.providerId = 'washwise';
serviceOrders[0]!.items = [{ sku: 'wash-fold', name: 'Wash & Fold (per kg)', qty: 3, unitPrice: rupees(70) }];
serviceOrders[0]!.gross = rupees(210);
serviceOrders[0]!.split = splitForOrder(rupees(210), revenueRules, { category: 'laundry', providerId: 'washwise', orgId: rohit.orgId, propertyId: rohit.propertyId, at: FIXTURE_NOW });

// ───────────── public projection (same builder Cloud Functions use) ─────────────
export const ratings: Record<string, number> = Object.fromEntries(BLUEPRINTS.map((b) => [b.id, b.rating]));
export const ratingCounts: Record<string, number> = Object.fromEntries(BLUEPRINTS.map((b) => [b.id, 20 + b.targetBeds]));

export function toPublicRoom(r: Room): PublicRoom | null {
  const p = properties.find((x) => x.id === r.propertyId)!;
  return projectPublicRoom(p, r, { rating: ratings[p.id] ?? null, ratingCount: ratingCounts[p.id] ?? 0 });
}

export const publicRooms: PublicRoom[] = rooms.map(toPublicRoom).filter((x): x is PublicRoom => x !== null);

/** Provider catalogs (prices in paise) — seeded into providers/{id}/catalog in development. */
export const catalogs: Record<string, { sku: string; name: string; category: ServiceCategory; price: number; unit?: string; available: boolean }[]> = {
  dwarpar: [
    ...MENU.food.map((m) => ({ sku: m.sku, name: m.name, category: 'food' as const, price: rupees(m.price), available: true })),
    ...MENU.groceries.map((m) => ({ sku: m.sku, name: m.name, category: 'groceries' as const, price: rupees(m.price), available: true })),
  ],
  washwise: MENU.laundry.map((m) => ({ sku: m.sku, name: m.name, category: 'laundry' as const, price: rupees(m.price), unit: m.sku === 'wash-fold' ? 'per kg' : 'per piece', available: true })),
  sparkle: MENU.cleaning.map((m) => ({ sku: m.sku, name: m.name, category: 'cleaning' as const, price: rupees(m.price), available: true })),
};

/** Convenience: the demo identities used across apps in development. */
export const DEMO = {
  ownerUid: 'owner-shashank',
  orgId: 'org-sunrise',
  propertyId: 'prop-sunrise',
  residentUid: 'resident-rohit',
  residentId: rohit.id,
  adminUid: 'admin-thikano',
} as const;
