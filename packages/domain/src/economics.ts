import type { Paise } from './money';
import type { RevenueShareRule, ServiceCategory, ID } from './types';

/**
 * Habistat Partner Share — configurable revenue split per service order.
 * Gross → Provider share → Habistat share → Property partner share → Other fees.
 * Splits are computed in integer paise; rounding remainder goes to Habistat so
 * the parts always sum exactly to gross.
 */

export const BPS_TOTAL = 10_000;

export interface SplitContext {
  category: ServiceCategory;
  providerId: ID;
  orgId: ID;
  propertyId: ID;
  at: number;
}

export interface RevenueSplit {
  gross: Paise;
  provider: Paise;
  thikano: Paise;
  partner: Paise;
  otherFees: Paise;
  ruleId: ID;
}

export class RuleValidationError extends Error {}

export function validateRule(rule: RevenueShareRule): void {
  const parts = [rule.providerBps, rule.thikanoBps, rule.partnerBps, rule.otherFeesBps];
  if (parts.some((p) => !Number.isInteger(p) || p < 0)) throw new RuleValidationError(`Rule ${rule.id}: bps must be non-negative integers`);
  const sum = parts.reduce((a, b) => a + b, 0);
  if (sum !== BPS_TOTAL) throw new RuleValidationError(`Rule ${rule.id}: shares sum to ${sum} bps, expected ${BPS_TOTAL}`);
}

function specificity(rule: RevenueShareRule): number {
  const m = rule.match;
  return (m.propertyId ? 8 : 0) + (m.orgId ? 4 : 0) + (m.providerId ? 2 : 0) + (m.category ? 1 : 0);
}

function matches(rule: RevenueShareRule, ctx: SplitContext): boolean {
  const m = rule.match;
  if (!rule.active) return false;
  if (ctx.at < rule.effectiveFrom) return false;
  if (rule.effectiveTo != null && ctx.at >= rule.effectiveTo) return false;
  if (m.category && m.category !== ctx.category) return false;
  if (m.providerId && m.providerId !== ctx.providerId) return false;
  if (m.orgId && m.orgId !== ctx.orgId) return false;
  if (m.propertyId && m.propertyId !== ctx.propertyId) return false;
  return true;
}

/** Most specific matching rule wins; ties broken by explicit priority, then latest effectiveFrom. */
export function resolveRule(rules: readonly RevenueShareRule[], ctx: SplitContext): RevenueShareRule | null {
  let best: RevenueShareRule | null = null;
  for (const r of rules) {
    if (!matches(r, ctx)) continue;
    if (!best) {
      best = r;
      continue;
    }
    const a = [specificity(r), r.priority ?? 0, r.effectiveFrom];
    const b = [specificity(best), best.priority ?? 0, best.effectiveFrom];
    for (let i = 0; i < a.length; i++) {
      if (a[i]! > b[i]!) {
        best = r;
        break;
      }
      if (a[i]! < b[i]!) break;
    }
  }
  return best;
}

export function computeSplit(gross: Paise, rule: RevenueShareRule): RevenueSplit {
  validateRule(rule);
  if (!Number.isInteger(gross) || gross < 0) throw new RangeError('gross must be non-negative integer paise');
  const part = (bps: number) => Math.floor((gross * bps) / BPS_TOTAL);
  const provider = part(rule.providerBps);
  const partner = part(rule.partnerBps);
  const otherFees = part(rule.otherFeesBps);
  const thikano = gross - provider - partner - otherFees;
  return { gross, provider, thikano, partner, otherFees, ruleId: rule.id };
}

export function splitForOrder(gross: Paise, rules: readonly RevenueShareRule[], ctx: SplitContext): RevenueSplit {
  const rule = resolveRule(rules, ctx);
  if (!rule) throw new RuleValidationError(`No revenue share rule for ${ctx.category}/${ctx.providerId}`);
  return computeSplit(gross, rule);
}

/** Owner earnings dashboard: partner share grouped by category. */
export function partnerEarningsByCategory(
  entries: readonly { category: ServiceCategory; partner: Paise }[],
): { total: Paise; byCategory: Partial<Record<ServiceCategory, Paise>> } {
  const byCategory: Partial<Record<ServiceCategory, Paise>> = {};
  let total = 0;
  for (const e of entries) {
    byCategory[e.category] = (byCategory[e.category] ?? 0) + e.partner;
    total += e.partner;
  }
  return { total, byCategory };
}
