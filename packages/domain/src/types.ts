import type { Paise } from './money';

/**
 * Canonical THIKANO entity shapes. Timestamps are epoch milliseconds in the
 * domain layer; the Firebase layer converts to/from Firestore Timestamps.
 * See docs/THIKANO-DATABASE.md for where each entity lives in Firestore.
 */
export type ID = string;
export type Millis = number;

export interface Audited {
  createdAt: Millis;
  updatedAt: Millis;
  createdBy: ID;
}

// ───────────────────────── Identity ─────────────────────────

export type PlatformRole = 'platform_admin' | 'platform_support';
export type OrgRole = 'owner' | 'manager' | 'staff';

export interface UserProfile {
  uid: ID;
  displayName: string;
  phone?: string;
  email?: string;
  photoUrl?: string;
  /** Drives mobile Discover ↔ Resident mode. Derived server-side from active stays. */
  activeStay?: { orgId: ID; propertyId: ID; residentId: ID } | null;
  disabled?: boolean;
  createdAt: Millis;
}

export interface OrgMember {
  uid: ID;
  role: OrgRole;
  /** null = all properties in org. Otherwise property-scoped access. */
  propertyIds: ID[] | null;
  /** Fine-grained grants for staff. Owners/managers implicitly have all. */
  permissions?: StaffPermission[];
  status: 'active' | 'invited' | 'removed';
  displayName: string;
}

export type StaffPermission =
  | 'inventory.read'
  | 'inventory.write'
  | 'residents.read'
  | 'residents.write'
  | 'rent.read'
  | 'rent.collect'
  | 'maintenance.read'
  | 'maintenance.write'
  | 'notices.write'
  | 'leads.read'
  | 'leads.write'
  | 'listings.publish'
  | 'earnings.read';

export interface Organization extends Audited {
  id: ID;
  name: string;
  ownerUid: ID;
  verification: OwnerVerificationStatus;
  status: 'active' | 'restricted' | 'suspended';
}

export type OwnerVerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';

// ───────────────────────── Inventory ─────────────────────────

export type PropertyKind = 'pg' | 'hostel' | 'student_housing';
export type GenderRule = 'boys' | 'girls' | 'coed';

export type PropertyVerificationStatus =
  | 'draft'
  | 'submitted'
  | 'changes_requested'
  | 'verified'
  | 'rejected'
  | 'suspended';

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface Address {
  line1: string;
  line2?: string;
  locality: string; // e.g. "Kukas"
  city: string; // e.g. "Jaipur"
  state: string;
  pincode: string;
}

export interface Property extends Audited {
  id: ID;
  orgId: ID;
  name: string;
  slug: string;
  kind: PropertyKind;
  genderRule: GenderRule;
  description: string;
  address: Address;
  /** Exact location — private. Public projection uses an approximate point. */
  location: GeoPoint;
  nearbyColleges: string[];
  amenities: PropertyAmenity[];
  rules: string[];
  photos: MediaAsset[];
  videos: MediaAsset[];
  foodIncluded: boolean;
  verification: PropertyVerificationStatus;
  /** Contact number students may see, only if the owner opts in. */
  publicContactPhone?: string | null;
}

export type PropertyAmenity =
  | 'food'
  | 'laundry'
  | 'cctv'
  | 'housekeeping'
  | 'power_backup'
  | 'wifi'
  | 'gym'
  | 'parking'
  | 'water_purifier'
  | 'security_guard'
  | 'lift'
  | 'common_room';

export type RoomAmenity =
  | 'ac'
  | 'wifi'
  | 'attached_bathroom'
  | 'study_table'
  | 'cupboard'
  | 'balcony'
  | 'geyser'
  | 'tv'
  | 'fridge';

export interface Building extends Audited {
  id: ID;
  orgId: ID;
  propertyId: ID;
  name: string;
  sortOrder: number;
}

export interface Floor extends Audited {
  id: ID;
  orgId: ID;
  propertyId: ID;
  buildingId: ID;
  label: string; // "Ground", "1st", ...
  level: number;
}

export type SharingType = 'single' | 'double' | 'triple' | 'quad' | 'dorm';

export interface MediaAsset {
  id: ID;
  kind: 'photo' | 'video';
  storagePath: string;
  url: string;
  thumbUrl?: string;
  width?: number;
  height?: number;
  durationSec?: number;
  caption?: string;
  sortOrder: number;
}

/**
 * Room operational status is set by the owner. Occupancy status is DERIVED
 * from beds — never stored as an owner-editable field.
 */
export type RoomOperationalStatus = 'active' | 'inactive' | 'maintenance';

export interface Room extends Audited {
  id: ID;
  orgId: ID;
  propertyId: ID;
  buildingId: ID;
  floorId: ID;
  number: string; // "204"
  publicSlug: string;
  sharing: SharingType;
  description: string;
  rent: Paise; // default monthly rent per bed
  deposit: Paise;
  amenities: RoomAmenity[];
  photos: MediaAsset[];
  videos: MediaAsset[];
  operationalStatus: RoomOperationalStatus;
  /** Owner intent to be on the marketplace. Effective listing status is derived. */
  listingIntent: ListingIntent;
  /** Derived cache maintained by Cloud Functions from beds. Source of truth = beds. */
  inventory: RoomInventory;
  stats: ListingStats;
}

export type ListingIntent = 'unlisted' | 'listed' | 'paused' | 'archived';

export interface ListingStats {
  views: number;
  shares: number;
  enquiries: number;
  applications: number;
  bookings: number;
}

export type BedStatus = 'available' | 'occupied' | 'reserved' | 'blocked' | 'maintenance';

export interface Bed extends Audited {
  id: ID;
  orgId: ID;
  propertyId: ID;
  roomId: ID;
  label: string; // "A", "B"
  status: BedStatus;
  /** Overrides room.rent when set. */
  rentOverride?: Paise | null;
  residentId?: ID | null;
  reservedForBookingId?: ID | null;
  moveInDate?: Millis | null;
  /** Expected / notice-period move-out. Bed stays occupied until move-out completes. */
  moveOutDate?: Millis | null;
}

export interface RoomInventory {
  totalBeds: number;
  availableBeds: number;
  occupiedBeds: number;
  reservedBeds: number;
  unavailableBeds: number; // blocked + maintenance
  /** Beds that will free up within the notice window (occupied with moveOutDate). */
  upcomingVacancies: number;
  occupancy: RoomOccupancyStatus;
  minRent: Paise;
}

export type RoomOccupancyStatus = 'empty' | 'partially_occupied' | 'fully_occupied' | 'no_beds';

// ───────────────────────── Marketplace ─────────────────────────

export type ListingStatus =
  | 'draft'
  | 'pending_verification'
  | 'published'
  | 'paused'
  | 'fully_occupied'
  | 'suspended'
  | 'archived';

export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'visit_scheduled'
  | 'interested'
  | 'applied'
  | 'approved'
  | 'rejected'
  | 'converted'
  | 'lost';

export type LeadSource = 'room_share_link' | 'property_share_link' | 'discover' | 'qr' | 'walk_in' | 'other';

export interface Lead extends Audited {
  id: ID;
  orgId: ID;
  propertyId: ID;
  roomId?: ID | null;
  bedId?: ID | null;
  studentUid?: ID | null;
  name: string;
  phone: string;
  expectedMoveIn?: Millis | null;
  message?: string;
  source: LeadSource;
  status: LeadStatus;
  bookingId?: ID | null;
}

export type BookingStage =
  | 'inquiry'
  | 'visit_requested'
  | 'visit_scheduled'
  | 'application'
  | 'owner_review'
  | 'approved'
  | 'rejected'
  | 'booked'
  | 'moved_in'
  | 'cancelled';

export interface Booking extends Audited {
  id: ID;
  orgId: ID;
  propertyId: ID;
  roomId: ID;
  bedId?: ID | null;
  leadId?: ID | null;
  studentUid?: ID | null;
  studentName: string;
  stage: BookingStage;
  visitAt?: Millis | null;
  moveInDate?: Millis | null;
  rent: Paise;
  deposit: Paise;
  history: { stage: BookingStage; at: Millis; by: ID; note?: string }[];
}

// ───────────────────────── Operations ─────────────────────────

export interface Resident extends Audited {
  id: ID;
  orgId: ID;
  propertyId: ID;
  roomId: ID;
  bedId: ID;
  uid?: ID | null; // linked THIKANO account (null until invite accepted)
  name: string;
  phone: string;
  status: 'invited' | 'active' | 'notice' | 'moved_out';
  moveInDate: Millis;
  moveOutDate?: Millis | null;
  rent: Paise;
  deposit: Paise;
  rentDueDay: number; // 1-28
}

export type InvoiceStatus = 'upcoming' | 'due' | 'partially_paid' | 'paid' | 'overdue';

export interface RentInvoice extends Audited {
  id: ID;
  orgId: ID;
  propertyId: ID;
  residentId: ID;
  period: string; // "2026-10"
  amount: Paise;
  lateFee: Paise;
  paid: Paise;
  dueDate: Millis;
}

export interface Payment extends Audited {
  id: ID;
  orgId: ID;
  propertyId: ID;
  residentId: ID;
  invoiceId: ID;
  amount: Paise;
  method: 'cash' | 'upi' | 'bank_transfer' | 'gateway';
  gatewayRef?: string | null;
  status: 'pending' | 'succeeded' | 'failed' | 'refunded';
  receiptNo: string;
}

export type MaintenanceCategory = 'ac' | 'fan' | 'wifi' | 'water' | 'electrical' | 'furniture' | 'plumbing' | 'other';
export type MaintenanceStatus = 'open' | 'assigned' | 'in_progress' | 'resolved' | 'cancelled';

export interface MaintenanceIssue extends Audited {
  id: ID;
  orgId: ID;
  propertyId: ID;
  buildingId: ID;
  floorId: ID;
  roomId: ID;
  bedId?: ID | null;
  residentId?: ID | null;
  category: MaintenanceCategory;
  description: string;
  photos: MediaAsset[];
  status: MaintenanceStatus;
  assigneeUid?: ID | null;
  resolvedAt?: Millis | null;
}

export interface Notice extends Audited {
  id: ID;
  orgId: ID;
  propertyId: ID;
  buildingIds: ID[] | null; // null = whole property
  title: string;
  body: string;
  startsAt?: Millis | null;
  endsAt?: Millis | null;
  publishedAt?: Millis | null;
}

export interface Parcel extends Audited {
  id: ID;
  orgId: ID;
  propertyId: ID;
  residentId: ID;
  carrier: string;
  location: string; // "Reception"
  arrivedAt: Millis;
  collectedAt?: Millis | null;
}

// ───────────────────────── Services & economics ─────────────────────────

export type ServiceCategory =
  | 'food'
  | 'laundry'
  | 'cleaning'
  | 'groceries'
  | 'pharmacy'
  | 'printing'
  | 'courier'
  | 'repairs'
  | 'other';

export type ServiceOrderStatus = 'placed' | 'accepted' | 'in_progress' | 'ready' | 'delivered' | 'cancelled' | 'failed';

export interface ServiceOrder extends Audited {
  id: ID;
  orgId: ID;
  propertyId: ID;
  residentId: ID;
  providerId: ID;
  providerOrderRef?: string | null;
  category: ServiceCategory;
  items: { sku: string; name: string; qty: number; unitPrice: Paise }[];
  gross: Paise;
  status: ServiceOrderStatus;
}

/**
 * Revenue split rule. Resolution picks the most specific matching active rule
 * (property > org > provider+category > category > default). Basis points: 100 bps = 1%.
 */
export interface RevenueShareRule {
  id: ID;
  active: boolean;
  priority?: number;
  match: {
    category?: ServiceCategory;
    providerId?: ID;
    orgId?: ID;
    propertyId?: ID;
  };
  providerBps: number;
  thikanoBps: number;
  partnerBps: number;
  /** Payment gateway or other fees, in bps of gross. */
  otherFeesBps: number;
  effectiveFrom: Millis;
  effectiveTo?: Millis | null;
}

export interface AuditLog {
  id: ID;
  actorUid: ID;
  actorRole: string;
  action: string; // "room.published"
  entity: string; // "room"
  entityId: ID;
  orgId?: ID | null;
  at: Millis;
  metadata?: Record<string, unknown>;
}
