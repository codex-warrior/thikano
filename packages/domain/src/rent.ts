import type { Paise } from './money';
import type { InvoiceStatus, RentInvoice } from './types';

const DAY = 24 * 60 * 60 * 1000;

export interface LateFeePolicy {
  /** Days after due date before a late fee applies. */
  graceDays: number;
  /** Flat fee once grace ends. */
  flat: Paise;
  /** Additional fee per day after grace. */
  perDay: Paise;
  /** Cap on the total late fee. */
  max: Paise;
}

export const NO_LATE_FEE: LateFeePolicy = { graceDays: 0, flat: 0, perDay: 0, max: 0 };

/** Invoices become "due" this many days before the due date. */
export const DUE_WINDOW_DAYS = 5;

export function computeLateFee(dueDate: number, now: number, policy: LateFeePolicy): Paise {
  const daysLate = Math.floor((now - dueDate) / DAY);
  if (daysLate <= policy.graceDays) return 0;
  const fee = policy.flat + policy.perDay * (daysLate - policy.graceDays);
  return Math.min(fee, policy.max);
}

export function outstanding(inv: Pick<RentInvoice, 'amount' | 'lateFee' | 'paid'>): Paise {
  return Math.max(0, inv.amount + inv.lateFee - inv.paid);
}

export function deriveInvoiceStatus(
  inv: Pick<RentInvoice, 'amount' | 'lateFee' | 'paid' | 'dueDate'>,
  now: number = Date.now(),
): InvoiceStatus {
  if (outstanding(inv) === 0) return 'paid';
  if (now > inv.dueDate + DAY - 1) return 'overdue';
  if (inv.paid > 0) return 'partially_paid';
  if (inv.dueDate - now <= DUE_WINDOW_DAYS * DAY) return 'due';
  return 'upcoming';
}

/** Applies a payment, returns the new paid amount. Overpayments are rejected. */
export function applyPayment(inv: Pick<RentInvoice, 'amount' | 'lateFee' | 'paid'>, amount: Paise): Paise {
  if (!Number.isInteger(amount) || amount <= 0) throw new RangeError('Payment must be a positive integer amount in paise');
  if (amount > outstanding(inv)) throw new RangeError('Payment exceeds outstanding amount');
  return inv.paid + amount;
}

/** Due date for a period like "2026-10" with a monthly due day (clamped 1..28), IST midnight. */
export function dueDateFor(period: string, dueDay: number): number {
  const [y, m] = period.split('-').map(Number) as [number, number];
  const day = Math.min(Math.max(1, Math.trunc(dueDay)), 28);
  // 00:00 IST == 18:30 UTC previous day
  return Date.UTC(y, m - 1, day) - (5 * 60 + 30) * 60 * 1000;
}

/** Pro-rated first-month rent for a mid-month move-in. */
export function proratedRent(monthlyRent: Paise, moveInDay: number, daysInMonth: number): Paise {
  const days = daysInMonth - moveInDay + 1;
  return Math.round((monthlyRent * days) / daysInMonth);
}

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  upcoming: 'Upcoming',
  due: 'Due',
  partially_paid: 'Partially paid',
  paid: 'Paid',
  overdue: 'Overdue',
};
