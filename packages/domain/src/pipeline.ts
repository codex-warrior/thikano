import { InvalidTransitionError } from './inventory';
import type { BookingStage, LeadStatus, MaintenanceCategory, MaintenanceStatus } from './types';

/**
 * Student journey: Inquiry → Visit → Application → Owner review →
 * Approved/Rejected → Booking → Move-in → Resident.
 * A student becomes a resident ONLY on `moved_in`, which also assigns the bed.
 */
const BOOKING_TRANSITIONS: Record<BookingStage, readonly BookingStage[]> = {
  inquiry: ['visit_requested', 'application', 'cancelled'],
  visit_requested: ['visit_scheduled', 'application', 'cancelled'],
  visit_scheduled: ['application', 'visit_requested', 'cancelled'],
  application: ['owner_review', 'cancelled'],
  owner_review: ['approved', 'rejected', 'cancelled'],
  approved: ['booked', 'cancelled'],
  rejected: [],
  booked: ['moved_in', 'cancelled'],
  moved_in: [],
  cancelled: [],
};

export function canAdvanceBooking(from: BookingStage, to: BookingStage): boolean {
  return BOOKING_TRANSITIONS[from].includes(to);
}

export function advanceBooking(from: BookingStage, to: BookingStage): BookingStage {
  if (!canAdvanceBooking(from, to)) throw new InvalidTransitionError('booking', from, to);
  return to;
}

export function nextBookingStages(from: BookingStage): readonly BookingStage[] {
  return BOOKING_TRANSITIONS[from];
}

/** Stages at which the bed is held for the student. */
export function bookingHoldsBed(stage: BookingStage): boolean {
  return stage === 'booked';
}

export function isTerminalBooking(stage: BookingStage): boolean {
  return BOOKING_TRANSITIONS[stage].length === 0;
}

/** Keep the owner-facing lead status in sync with the booking pipeline. */
export function leadStatusForBooking(stage: BookingStage): LeadStatus {
  switch (stage) {
    case 'inquiry':
      return 'new';
    case 'visit_requested':
      return 'interested';
    case 'visit_scheduled':
      return 'visit_scheduled';
    case 'application':
    case 'owner_review':
      return 'applied';
    case 'approved':
    case 'booked':
      return 'approved';
    case 'rejected':
      return 'rejected';
    case 'moved_in':
      return 'converted';
    case 'cancelled':
      return 'lost';
  }
}

const LEAD_TRANSITIONS: Record<LeadStatus, readonly LeadStatus[]> = {
  new: ['contacted', 'visit_scheduled', 'interested', 'applied', 'lost', 'rejected'],
  contacted: ['visit_scheduled', 'interested', 'applied', 'lost', 'rejected'],
  visit_scheduled: ['interested', 'applied', 'lost', 'rejected', 'contacted'],
  interested: ['visit_scheduled', 'applied', 'lost', 'rejected'],
  applied: ['approved', 'rejected', 'lost'],
  approved: ['converted', 'lost'],
  rejected: [],
  converted: [],
  lost: ['contacted'],
};

export function canMoveLead(from: LeadStatus, to: LeadStatus): boolean {
  return LEAD_TRANSITIONS[from].includes(to);
}

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  visit_scheduled: 'Visit scheduled',
  interested: 'Interested',
  applied: 'Applied',
  approved: 'Approved',
  rejected: 'Rejected',
  converted: 'Moved in',
  lost: 'Lost',
};

const MAINTENANCE_TRANSITIONS: Record<MaintenanceStatus, readonly MaintenanceStatus[]> = {
  open: ['assigned', 'in_progress', 'resolved', 'cancelled'],
  assigned: ['in_progress', 'resolved', 'open', 'cancelled'],
  in_progress: ['resolved', 'assigned'],
  resolved: ['open'], // reopen
  cancelled: [],
};

export function canMoveMaintenance(from: MaintenanceStatus, to: MaintenanceStatus): boolean {
  return MAINTENANCE_TRANSITIONS[from].includes(to);
}

export const MAINTENANCE_CATEGORY_LABEL: Record<MaintenanceCategory, string> = {
  ac: 'AC',
  fan: 'Fan',
  wifi: 'Wi-Fi',
  water: 'Water',
  electrical: 'Electrical',
  furniture: 'Furniture',
  plumbing: 'Plumbing',
  other: 'Other',
};
