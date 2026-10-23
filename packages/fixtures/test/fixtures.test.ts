import { describe, expect, it } from 'vitest';
import { deriveRoomInventory, isSearchable, deriveListingStatus } from '@thikano/domain';
import { beds, invoices, leads, properties, publicRooms, residents, rooms, serviceOrders, FIXTURE_NOW } from '../src';

describe('fixture dataset', () => {
  it('Sunrise PG has exactly 100 beds, 94 occupied, 6 vacant', () => {
    const sb = beds.filter((b) => b.propertyId === 'prop-sunrise');
    expect(sb).toHaveLength(100);
    expect(sb.filter((b) => b.status === 'occupied')).toHaveLength(94);
    expect(sb.filter((b) => b.status === 'available')).toHaveLength(6);
  });

  it('marketplace has 5 properties and 500+ beds', () => {
    expect(properties).toHaveLength(5);
    expect(beds.length).toBeGreaterThanOrEqual(500);
  });

  it('room inventory caches match bed source of truth', () => {
    for (const r of rooms) {
      expect(r.inventory).toEqual(deriveRoomInventory(beds.filter((b) => b.roomId === r.id), r.rent, FIXTURE_NOW));
    }
  });

  it('every occupied bed has exactly one resident', () => {
    const occupied = beds.filter((b) => b.status === 'occupied');
    expect(residents).toHaveLength(occupied.length);
    expect(new Set(residents.map((r) => r.bedId)).size).toBe(residents.length);
  });

  it('public projection never includes unverified properties or private fields', () => {
    expect(publicRooms.some((r) => r.propertyId === 'prop-ananta')).toBe(false);
    for (const r of publicRooms) {
      const keys = Object.keys(r);
      expect(keys).not.toContain('residentId');
      expect(keys).not.toContain('location');
    }
  });

  it('searchable rooms all have free beds', () => {
    for (const r of publicRooms.filter((x) => isSearchable(x.listingStatus))) expect(r.availableBeds).toBeGreaterThan(0);
  });

  it('Room 204 is vacant and unlisted (demo: one-click list)', () => {
    const r = rooms.find((x) => x.number === '204' && x.propertyId === 'prop-sunrise')!;
    expect(r.inventory.availableBeds).toBe(2);
    expect(deriveListingStatus({ intent: r.listingIntent, propertyVerification: 'verified', operationalStatus: 'active', inventory: r.inventory })).toBe('draft');
  });

  it('demo resident Rohit is in Room 312 with overdue October rent', () => {
    const rohit = residents.find((r) => r.uid === 'resident-rohit')!;
    expect(rohit.roomId).toBe('prop-sunrise-r312');
    expect(invoices.find((i) => i.residentId === rohit.id && i.period === '2026-10')!.paid).toBe(0);
  });

  it('service splits always sum to gross', () => {
    for (const o of serviceOrders) expect(o.split.provider + o.split.thikano + o.split.partner + o.split.otherFees).toBe(o.gross);
  });

  it('has fresh leads for the owner inbox', () => {
    expect(leads.filter((l) => l.status === 'new').length).toBeGreaterThanOrEqual(4);
  });
});
