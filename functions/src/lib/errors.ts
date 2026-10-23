import { logger } from 'firebase-functions';
import { HttpsError, type FunctionsErrorCode } from 'firebase-functions/v2/https';

/** Callable errors carry short human messages; technical detail is logged, never returned. */
export function fail(code: FunctionsErrorCode, message: string, detail?: Record<string, unknown>): never {
  if (detail) logger.warn(`[${code}] ${message}`, detail);
  throw new HttpsError(code, message);
}

export const notAllowed = (): never => fail('permission-denied', "You don't have access to do this.");
export const notFound = (what = 'item'): never => fail('not-found', `We couldn't find that ${what}.`);
export const badInput = (message: string): never => fail('invalid-argument', message);
