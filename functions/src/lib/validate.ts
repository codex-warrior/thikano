import { badInput } from './errors';

export type Obj = Record<string, unknown>;

export function obj(data: unknown): Obj {
  if (!data || typeof data !== 'object' || Array.isArray(data)) badInput('Something is missing. Please try again.');
  return data as Obj;
}

export function str(d: Obj, key: string, opts: { min?: number; max?: number; pattern?: RegExp } = {}): string {
  const v = d[key];
  if (typeof v !== 'string' || v.trim() === '') return badInput(`Please provide ${key}.`);
  const s = v.trim();
  if (opts.min != null && s.length < opts.min) badInput(`Please provide a valid ${key}.`);
  if (opts.max != null && s.length > opts.max) badInput(`${key} is too long.`);
  if (opts.pattern && !opts.pattern.test(s)) badInput(`Please provide a valid ${key}.`);
  return s;
}

export function optStr(d: Obj, key: string, max = 500): string | null {
  const v = d[key];
  if (v == null || v === '') return null;
  if (typeof v !== 'string') return badInput(`Invalid ${key}.`);
  if (v.length > max) badInput(`${key} is too long.`);
  return v.trim();
}

export function int(d: Obj, key: string, opts: { min?: number; max?: number } = {}): number {
  const v = d[key];
  if (typeof v !== 'number' || !Number.isInteger(v)) return badInput(`Invalid ${key}.`);
  if (opts.min != null && v < opts.min) badInput(`${key} is too small.`);
  if (opts.max != null && v > opts.max) badInput(`${key} is too large.`);
  return v;
}

export function optInt(d: Obj, key: string, opts: { min?: number; max?: number } = {}): number | null {
  return d[key] == null ? null : int(d, key, opts);
}

export function oneOf<T extends string>(d: Obj, key: string, values: readonly T[]): T {
  const v = d[key];
  if (typeof v !== 'string' || !values.includes(v as T)) return badInput(`Invalid ${key}.`);
  return v as T;
}

export function strArray<T extends string>(d: Obj, key: string, allowed: readonly T[], max = 50): T[] {
  const v = d[key];
  if (v == null) return [];
  if (!Array.isArray(v) || v.length > max || v.some((x) => typeof x !== 'string' || !allowed.includes(x as T))) return badInput(`Invalid ${key}.`);
  return [...new Set(v as T[])];
}

/** Indian mobile → E.164 (+91XXXXXXXXXX). */
export function indianPhone(d: Obj, key = 'phone'): string {
  const raw = str(d, key).replace(/[\s-]/g, '');
  const m = raw.match(/^(?:\+?91)?([6-9]\d{9})$/);
  if (!m) return badInput('Please enter a valid 10-digit mobile number.');
  return `+91${m[1]}`;
}

export const ID_RE = /^[A-Za-z0-9_-]{1,128}$/;
export const id = (d: Obj, key: string) => str(d, key, { pattern: ID_RE });

export function optEmail(d: Obj, key = 'email'): string | null {
  const v = d[key];
  if (v == null || v === '') return null;
  if (typeof v !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.trim()) || v.length > 120) return badInput('Please enter a valid email address.');
  return v.trim().toLowerCase();
}
