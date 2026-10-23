import { createHash } from 'node:crypto';
import { db } from './admin';
import { fail } from './errors';

/**
 * Fixed-window rate limiter stored in rateLimits/{hash}. Keys are hashed so phone
 * numbers and IPs are never stored in clear text.
 */
export async function rateLimit(key: string, limit: number, windowMs: number, message = 'Too many attempts. Please try again in a few minutes.'): Promise<void> {
  const id = createHash('sha256').update(key).digest('hex').slice(0, 40);
  const ref = db.collection('rateLimits').doc(id);
  const allowed = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const t = Date.now();
    const d = snap.data() as { windowStart: number; count: number } | undefined;
    if (!d || t - d.windowStart >= windowMs) {
      tx.set(ref, { windowStart: t, count: 1, expiresAt: t + windowMs });
      return true;
    }
    if (d.count >= limit) return false;
    tx.update(ref, { count: d.count + 1 });
    return true;
  });
  if (!allowed) fail('resource-exhausted', message, { key: id });
}
