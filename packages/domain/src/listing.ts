import type { ListingIntent, ListingStatus, PropertyVerificationStatus, RoomInventory, RoomOperationalStatus } from './types';

/**
 * Effective listing status is DERIVED — owners only express intent
 * (listed / paused / unlisted / archived). Availability and property
 * verification decide the rest. This guarantees a room can never be
 * publicly "available" when it has no free beds.
 */
export interface ListingInputs {
  intent: ListingIntent;
  propertyVerification: PropertyVerificationStatus;
  operationalStatus: RoomOperationalStatus;
  inventory: Pick<RoomInventory, 'availableBeds' | 'totalBeds'>;
  /** Set by admins on moderation. */
  adminSuspended?: boolean;
}

export function deriveListingStatus(i: ListingInputs): ListingStatus {
  if (i.intent === 'archived') return 'archived';
  if (i.adminSuspended || i.propertyVerification === 'suspended') return 'suspended';
  if (i.intent === 'unlisted') return 'draft';
  if (i.intent === 'paused') return 'paused';
  // intent === 'listed'
  if (i.propertyVerification !== 'verified') return 'pending_verification';
  if (i.operationalStatus !== 'active') return 'paused';
  if (i.inventory.availableBeds <= 0) return 'fully_occupied';
  return 'published';
}

/** Statuses that are visible on public pages / Discover. */
const PUBLIC_STATUSES: ReadonlySet<ListingStatus> = new Set(['published', 'fully_occupied']);

export function isPubliclyVisible(status: ListingStatus): boolean {
  return PUBLIC_STATUSES.has(status);
}

/** Only `published` rooms appear in availability search results. */
export function isSearchable(status: ListingStatus): boolean {
  return status === 'published';
}

export const LISTING_STATUS_LABEL: Record<ListingStatus, string> = {
  draft: 'Not listed',
  pending_verification: 'Awaiting verification',
  published: 'Listed on THIKANO',
  paused: 'Paused',
  fully_occupied: 'Fully occupied',
  suspended: 'Suspended',
  archived: 'Archived',
};

/** Rooms an owner can list in one click ("List all eligible vacancies"). */
export function isEligibleForOneClickListing(i: Omit<ListingInputs, 'intent'> & { intent: ListingIntent }): boolean {
  return (
    i.intent === 'unlisted' &&
    !i.adminSuspended &&
    i.operationalStatus === 'active' &&
    i.inventory.availableBeds > 0 &&
    i.propertyVerification !== 'suspended' &&
    i.propertyVerification !== 'rejected'
  );
}

export function conversionRate(enquiries: number, views: number): number {
  return views === 0 ? 0 : enquiries / views;
}
