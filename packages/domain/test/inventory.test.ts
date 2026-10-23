import { describe, expect, it } from 'vitest';
import {
  canTransitionBed,
  deriveRoomInventory,
  InvalidTransitionError,
  isRoomBookable,
  rupees,
  summarizeProperty,
  transitionBed,
  UPCOMING_VACANCY_WINDOW_MS,
  type BedStatus,
} from '../src';

const bed = (status: BedStatus, extra: { rentOverride?: number; moveOutDate?: number } = {}) => ({ status, ...extra });
const NOW = Date.UTC(2026, 9, 22);

describe('deriveRoomInventory', () => {
  it('derives availability from bed assignments (Room 204: A occupied, B empty → 1 available)', () => {
    const inv = deriveRoomInventory([bed('occupied'), bed('available')], rupees(9500), NOW);
    expect(inv).toMatchObject({ totalBeds: 2, availableBeds: 1, occupiedBeds: 1, occupancy: 'partially_occupied' });
  });

  it('becomes fully occupied when the last bed is assigned', () => {
    const inv = deriveRoomInventory([bed('occupied'), bed('occupied')], rupees(9500), NOW);
    expect(inv.availableBeds).toBe(0);
    expect(inv.occupancy).toBe('fully_occupied');
  });

  it('counts reserved beds as taken but not occupied', () => {
    const inv = deriveRoomInventory([bed('reserved'), bed('available')], rupees(9500), NOW);
    expect(inv).toMatchObject({ availableBeds: 1, reservedBeds: 1, occupiedBeds: 0, occupancy: 'partially_occupied' });
  });

  it('treats blocked and maintenance beds as unavailable', () => {
    const inv = deriveRoomInventory([bed('blocked'), bed('maintenance'), bed('available')], rupees(8000), NOW);
    expect(inv).toMatchObject({ availableBeds: 1, unavailableBeds: 2, occupancy: 'empty' });
  });

  it('handles rooms with no beds', () => {
    expect(deriveRoomInventory([], rupees(8000), NOW).occupancy).toBe('no_beds');
  });

  it('uses the cheapest available bed rent as minRent', () => {
    const inv = deriveRoomInventory(
      [bed('available', { rentOverride: rupees(9000) }), bed('available'), bed('occupied', { rentOverride: rupees(1) })],
      rupees(9500),
      NOW,
    );
    expect(inv.minRent).toBe(rupees(9000));
  });

  it('flags upcoming vacancies within the window only', () => {
    const inv = deriveRoomInventory(
      [bed('occupied', { moveOutDate: NOW + 5 * 86400000 }), bed('occupied', { moveOutDate: NOW + UPCOMING_VACANCY_WINDOW_MS + 1 })],
      rupees(9500),
      NOW,
    );
    expect(inv.upcomingVacancies).toBe(1);
  });
});

describe('isRoomBookable', () => {
  it('requires an active room with a free bed', () => {
    const inv = deriveRoomInventory([bed('available')], 100, NOW);
    expect(isRoomBookable({ operationalStatus: 'active' }, inv)).toBe(true);
    expect(isRoomBookable({ operationalStatus: 'maintenance' }, inv)).toBe(false);
  });
});

describe('bed state machine', () => {
  it('allows the move-in lifecycle', () => {
    let s: BedStatus = 'available';
    s = transitionBed(s, 'reserve');
    s = transitionBed(s, 'assign');
    expect(s).toBe('occupied');
    s = transitionBed(s, 'vacate');
    expect(s).toBe('available');
  });

  it('rejects double assignment', () => {
    expect(() => transitionBed('occupied', 'assign')).toThrow(InvalidTransitionError);
    expect(canTransitionBed('occupied', 'reserve')).toBe(false);
  });

  it('cannot block an occupied bed', () => {
    expect(canTransitionBed('occupied', 'block')).toBe(false);
  });
});

describe('summarizeProperty', () => {
  it('aggregates beds and vacant revenue, ignoring inactive rooms for vacancy', () => {
    const s = summarizeProperty(
      [
        { rent: rupees(9500), operationalStatus: 'active', beds: [bed('available'), bed('available')] },
        { rent: rupees(8500), operationalStatus: 'active', beds: [bed('occupied'), bed('occupied'), bed('available')] },
        { rent: rupees(7000), operationalStatus: 'maintenance', beds: [bed('available')] },
      ],
      NOW,
    );
    expect(s.totalBeds).toBe(6);
    expect(s.occupiedBeds).toBe(2);
    expect(s.availableBeds).toBe(3);
    expect(s.vacantRevenue).toBe(rupees(9500 * 2 + 8500));
    expect(s.startingRent).toBe(rupees(8500));
    expect(s.occupancyRate).toBeCloseTo(2 / 6);
  });
});
