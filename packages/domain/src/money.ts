/**
 * All money in Habistat is stored as integer paise (₹1 = 100 paise).
 * Never store rupees as floats.
 */
export type Paise = number;

export const rupees = (amount: number): Paise => Math.round(amount * 100);

export function assertPaise(value: number): asserts value is Paise {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`Invalid paise amount: ${value}`);
  }
}

/** ₹9,500 · ₹1,25,000 · ₹38.4L (compact) — Indian digit grouping. */
export function formatINR(paise: Paise, opts: { compact?: boolean; showPaise?: boolean } = {}): string {
  const r = paise / 100;
  if (opts.compact) {
    if (Math.abs(r) >= 1_00_00_000) return `₹${trim(r / 1_00_00_000)}Cr`;
    if (Math.abs(r) >= 1_00_000) return `₹${trim(r / 1_00_000)}L`;
    if (Math.abs(r) >= 1_000) return `₹${trim(r / 1_000)}k`;
  }
  const fractionDigits = opts.showPaise && paise % 100 !== 0 ? 2 : 0;
  return `₹${r.toLocaleString('en-IN', { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits })}`;
}

function trim(n: number): string {
  return (Math.round(n * 10) / 10).toString();
}
