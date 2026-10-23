import { describe, expect, it } from 'vitest';
import {
  applyPayment,
  computeLateFee,
  computeSplit,
  deriveInvoiceStatus,
  dueDateFor,
  formatINR,
  partnerEarningsByCategory,
  proratedRent,
  resolveRule,
  rupees,
  RuleValidationError,
  splitForOrder,
  type RevenueShareRule,
} from '../src';

const DAY = 86_400_000;

describe('formatINR', () => {
  it('uses Indian digit grouping', () => {
    expect(formatINR(rupees(9500))).toBe('₹9,500');
    expect(formatINR(rupees(125000))).toBe('₹1,25,000');
  });
  it('compacts lakhs and crores', () => {
    expect(formatINR(rupees(3_840_000), { compact: true })).toBe('₹38.4L');
    expect(formatINR(rupees(25_000_000), { compact: true })).toBe('₹2.5Cr');
  });
});

describe('rent', () => {
  const due = Date.UTC(2026, 9, 5);
  const inv = { amount: rupees(9500), lateFee: 0, paid: 0, dueDate: due };

  it('moves upcoming → due → overdue over time', () => {
    expect(deriveInvoiceStatus(inv, due - 10 * DAY)).toBe('upcoming');
    expect(deriveInvoiceStatus(inv, due - 2 * DAY)).toBe('due');
    expect(deriveInvoiceStatus(inv, due + 2 * DAY)).toBe('overdue');
  });

  it('partial then full payment', () => {
    const paid = applyPayment(inv, rupees(5000));
    expect(deriveInvoiceStatus({ ...inv, paid }, due - DAY)).toBe('partially_paid');
    const paid2 = applyPayment({ ...inv, paid }, rupees(4500));
    expect(deriveInvoiceStatus({ ...inv, paid: paid2 }, due + 30 * DAY)).toBe('paid');
  });

  it('rejects overpayment and non-integer payments', () => {
    expect(() => applyPayment(inv, rupees(10000))).toThrow(RangeError);
    expect(() => applyPayment(inv, 10.5)).toThrow(RangeError);
  });

  it('late fee respects grace period and cap', () => {
    const policy = { graceDays: 3, flat: rupees(200), perDay: rupees(50), max: rupees(500) };
    expect(computeLateFee(due, due + 3 * DAY, policy)).toBe(0);
    expect(computeLateFee(due, due + 4 * DAY, policy)).toBe(rupees(250));
    expect(computeLateFee(due, due + 40 * DAY, policy)).toBe(rupees(500));
  });

  it('due date is IST midnight of the clamped due day', () => {
    expect(new Date(dueDateFor('2026-02', 31)).toISOString()).toBe('2026-02-27T18:30:00.000Z');
  });

  it('prorates first month', () => {
    expect(proratedRent(rupees(9300), 17, 31)).toBe(rupees(4500));
  });
});

const rule = (id: string, match: RevenueShareRule['match'], partnerBps: number, extra: Partial<RevenueShareRule> = {}): RevenueShareRule => ({
  id,
  active: true,
  match,
  providerBps: 8000,
  thikanoBps: 2000 - partnerBps - 200,
  partnerBps,
  otherFeesBps: 200,
  effectiveFrom: 0,
  ...extra,
});

describe('revenue share', () => {
  const ctx = { category: 'food' as const, providerId: 'dwarpar', orgId: 'org1', propertyId: 'p1', at: 1000 };
  const rules = [
    rule('default', {}, 300),
    rule('food', { category: 'food' }, 500),
    rule('food-dwarpar', { category: 'food', providerId: 'dwarpar' }, 600),
    rule('sunrise', { propertyId: 'p1', category: 'food' }, 800),
    rule('laundry', { category: 'laundry' }, 1000),
  ];

  it('picks the most specific matching rule', () => {
    expect(resolveRule(rules, ctx)?.id).toBe('sunrise');
    expect(resolveRule(rules, { ...ctx, propertyId: 'p2' })?.id).toBe('food-dwarpar');
    expect(resolveRule(rules, { ...ctx, propertyId: 'p2', category: 'printing' })?.id).toBe('default');
  });

  it('ignores inactive and out-of-window rules', () => {
    const r = [rule('a', {}, 300), rule('b', { category: 'food' }, 500, { effectiveTo: 500 }), rule('c', { category: 'food' }, 500, { active: false })];
    expect(resolveRule(r, ctx)?.id).toBe('a');
  });

  it('split always sums to gross exactly', () => {
    for (const gross of [1, 99, 12345, rupees(249), rupees(17850)]) {
      const s = splitForOrder(gross, rules, ctx);
      expect(s.provider + s.thikano + s.partner + s.otherFees).toBe(gross);
    }
  });

  it('computes partner share', () => {
    const s = computeSplit(rupees(1000), rules[3]!);
    expect(s.partner).toBe(rupees(80));
    expect(s.provider).toBe(rupees(800));
  });

  it('rejects rules that do not sum to 100%', () => {
    expect(() => computeSplit(100, { ...rules[0]!, partnerBps: 9999 })).toThrow(RuleValidationError);
  });

  it('throws when no rule matches', () => {
    expect(() => splitForOrder(100, [rule('l', { category: 'laundry' }, 100)], ctx)).toThrow(RuleValidationError);
  });

  it('groups partner earnings by category', () => {
    const r = partnerEarningsByCategory([
      { category: 'food', partner: 100 },
      { category: 'food', partner: 50 },
      { category: 'laundry', partner: 25 },
    ]);
    expect(r).toEqual({ total: 175, byCategory: { food: 150, laundry: 25 } });
  });
});
