import { describe, expect, it } from 'vitest';
import {
  advanceBooking,
  bookingHoldsBed,
  canAdvanceBooking,
  canMoveLead,
  canMoveMaintenance,
  deriveListingStatus,
  isEligibleForOneClickListing,
  isPubliclyVisible,
  isSearchable,
  leadStatusForBooking,
  type BookingStage,
  type ListingInputs,
} from '../src';

const base: ListingInputs = {
  intent: 'listed',
  propertyVerification: 'verified',
  operationalStatus: 'active',
  inventory: { availableBeds: 2, totalBeds: 2 },
};

describe('deriveListingStatus', () => {
  it('publishes a listed room in a verified property with free beds', () => {
    expect(deriveListingStatus(base)).toBe('published');
  });

  it('automatically flips to fully_occupied when beds run out', () => {
    const s = deriveListingStatus({ ...base, inventory: { availableBeds: 0, totalBeds: 2 } });
    expect(s).toBe('fully_occupied');
    expect(isSearchable(s)).toBe(false);
    expect(isPubliclyVisible(s)).toBe(true);
  });

  it('never publishes before property verification', () => {
    for (const v of ['draft', 'submitted', 'changes_requested', 'rejected'] as const) {
      expect(deriveListingStatus({ ...base, propertyVerification: v })).toBe('pending_verification');
    }
  });

  it('suspension overrides intent', () => {
    expect(deriveListingStatus({ ...base, adminSuspended: true })).toBe('suspended');
    expect(deriveListingStatus({ ...base, propertyVerification: 'suspended' })).toBe('suspended');
    expect(isPubliclyVisible('suspended')).toBe(false);
  });

  it('respects owner intent', () => {
    expect(deriveListingStatus({ ...base, intent: 'unlisted' })).toBe('draft');
    expect(deriveListingStatus({ ...base, intent: 'paused' })).toBe('paused');
    expect(deriveListingStatus({ ...base, intent: 'archived' })).toBe('archived');
  });

  it('pauses rooms under maintenance', () => {
    expect(deriveListingStatus({ ...base, operationalStatus: 'maintenance' })).toBe('paused');
  });
});

describe('one-click listing eligibility', () => {
  it('only unlisted active rooms with free beds', () => {
    expect(isEligibleForOneClickListing({ ...base, intent: 'unlisted' })).toBe(true);
    expect(isEligibleForOneClickListing({ ...base, intent: 'listed' })).toBe(false);
    expect(isEligibleForOneClickListing({ ...base, intent: 'unlisted', inventory: { availableBeds: 0, totalBeds: 2 } })).toBe(false);
    expect(isEligibleForOneClickListing({ ...base, intent: 'unlisted', propertyVerification: 'rejected' })).toBe(false);
  });
});

describe('booking state machine', () => {
  it('walks the full happy path', () => {
    const path: BookingStage[] = ['visit_requested', 'visit_scheduled', 'application', 'owner_review', 'approved', 'booked', 'moved_in'];
    let s: BookingStage = 'inquiry';
    for (const next of path) s = advanceBooking(s, next);
    expect(s).toBe('moved_in');
  });

  it('cannot become a resident without approval and booking', () => {
    expect(canAdvanceBooking('application', 'moved_in')).toBe(false);
    expect(canAdvanceBooking('approved', 'moved_in')).toBe(false);
    expect(canAdvanceBooking('inquiry', 'booked')).toBe(false);
  });

  it('terminal stages are final', () => {
    expect(canAdvanceBooking('rejected', 'approved')).toBe(false);
    expect(canAdvanceBooking('moved_in', 'cancelled')).toBe(false);
  });

  it('only a booking holds a bed', () => {
    expect(bookingHoldsBed('booked')).toBe(true);
    expect(bookingHoldsBed('approved')).toBe(false);
  });

  it('maps booking stages to lead statuses', () => {
    expect(leadStatusForBooking('moved_in')).toBe('converted');
    expect(leadStatusForBooking('cancelled')).toBe('lost');
    expect(leadStatusForBooking('owner_review')).toBe('applied');
  });
});

describe('lead + maintenance transitions', () => {
  it('lead cannot jump from new to converted', () => {
    expect(canMoveLead('new', 'converted')).toBe(false);
    expect(canMoveLead('approved', 'converted')).toBe(true);
    expect(canMoveLead('lost', 'contacted')).toBe(true);
  });

  it('maintenance can be reopened but not uncancelled', () => {
    expect(canMoveMaintenance('resolved', 'open')).toBe(true);
    expect(canMoveMaintenance('cancelled', 'open')).toBe(false);
  });
});
