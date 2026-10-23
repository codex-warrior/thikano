import type { Paise } from './money';
import type { Bed, BedStatus, Room, RoomInventory, RoomOccupancyStatus } from './types';

/**
 * INVENTORY — source of truth is the set of Bed documents.
 * Room.inventory is a derived cache produced by `deriveRoomInventory` and
 * written only by Cloud Functions (see docs/THIKANO-ROOM-INVENTORY.md).
 */

type BedLike = Pick<Bed, 'status' | 'rentOverride' | 'moveOutDate'>;

/** Window (ms) within which a scheduled move-out counts as an "upcoming vacancy". */
export const UPCOMING_VACANCY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export function deriveRoomInventory(
  beds: readonly BedLike[],
  roomRent: Paise,
  now: number = Date.now(),
): RoomInventory {
  let available = 0;
  let occupied = 0;
  let reserved = 0;
  let unavailable = 0;
  let upcoming = 0;
  let minRent = Number.POSITIVE_INFINITY;

  for (const bed of beds) {
    switch (bed.status) {
      case 'available':
        available++;
        minRent = Math.min(minRent, bed.rentOverride ?? roomRent);
        break;
      case 'occupied':
        occupied++;
        if (bed.moveOutDate != null && bed.moveOutDate - now <= UPCOMING_VACANCY_WINDOW_MS) upcoming++;
        break;
      case 'reserved':
        reserved++;
        break;
      case 'blocked':
      case 'maintenance':
        unavailable++;
        break;
    }
  }

  const total = beds.length;
  return {
    totalBeds: total,
    availableBeds: available,
    occupiedBeds: occupied,
    reservedBeds: reserved,
    unavailableBeds: unavailable,
    upcomingVacancies: upcoming,
    occupancy: occupancyStatus(total, occupied + reserved),
    minRent: Number.isFinite(minRent) ? minRent : roomRent,
  };
}

function occupancyStatus(total: number, taken: number): RoomOccupancyStatus {
  if (total === 0) return 'no_beds';
  if (taken === 0) return 'empty';
  if (taken >= total) return 'fully_occupied';
  return 'partially_occupied';
}

/** A room can take a new resident / be shown as available on the marketplace. */
export function isRoomBookable(room: Pick<Room, 'operationalStatus'>, inventory: RoomInventory): boolean {
  return room.operationalStatus === 'active' && inventory.availableBeds > 0;
}

// ─────────────── Bed state machine ───────────────

export type BedEvent =
  | 'reserve' // booking approved, holds bed
  | 'release' // reservation cancelled
  | 'assign' // move-in
  | 'vacate' // move-out completed
  | 'block'
  | 'unblock'
  | 'start_maintenance'
  | 'end_maintenance';

const BED_TRANSITIONS: Record<BedStatus, Partial<Record<BedEvent, BedStatus>>> = {
  available: { reserve: 'reserved', assign: 'occupied', block: 'blocked', start_maintenance: 'maintenance' },
  reserved: { release: 'available', assign: 'occupied' },
  occupied: { vacate: 'available' },
  blocked: { unblock: 'available' },
  maintenance: { end_maintenance: 'available' },
};

export class InvalidTransitionError extends Error {
  constructor(
    readonly machine: string,
    readonly from: string,
    readonly event: string,
  ) {
    super(`${machine}: cannot '${event}' from '${from}'`);
    this.name = 'InvalidTransitionError';
  }
}

export function transitionBed(from: BedStatus, event: BedEvent): BedStatus {
  const to = BED_TRANSITIONS[from][event];
  if (!to) throw new InvalidTransitionError('bed', from, event);
  return to;
}

export function canTransitionBed(from: BedStatus, event: BedEvent): boolean {
  return BED_TRANSITIONS[from][event] !== undefined;
}

// ─────────────── Property-level aggregation ───────────────

export interface PropertyInventorySummary {
  rooms: number;
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
  reservedBeds: number;
  upcomingVacancies: number;
  /** Monthly rent currently not being earned on available beds. */
  vacantRevenue: Paise;
  occupancyRate: number; // 0..1
  startingRent: Paise | null;
}

export function summarizeProperty(
  rooms: readonly { rent: Paise; operationalStatus: Room['operationalStatus']; beds: readonly BedLike[] }[],
  now: number = Date.now(),
): PropertyInventorySummary {
  const s: PropertyInventorySummary = {
    rooms: rooms.length,
    totalBeds: 0,
    occupiedBeds: 0,
    availableBeds: 0,
    reservedBeds: 0,
    upcomingVacancies: 0,
    vacantRevenue: 0,
    occupancyRate: 0,
    startingRent: null,
  };
  for (const room of rooms) {
    const inv = deriveRoomInventory(room.beds, room.rent, now);
    s.totalBeds += inv.totalBeds;
    s.occupiedBeds += inv.occupiedBeds;
    s.reservedBeds += inv.reservedBeds;
    s.upcomingVacancies += inv.upcomingVacancies;
    if (room.operationalStatus !== 'active') continue;
    s.availableBeds += inv.availableBeds;
    for (const bed of room.beds) {
      if (bed.status === 'available') s.vacantRevenue += bed.rentOverride ?? room.rent;
    }
    if (inv.availableBeds > 0) {
      s.startingRent = s.startingRent == null ? inv.minRent : Math.min(s.startingRent, inv.minRent);
    }
  }
  s.occupancyRate = s.totalBeds === 0 ? 0 : s.occupiedBeds / s.totalBeds;
  return s;
}
