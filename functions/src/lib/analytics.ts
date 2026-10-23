import { db, FieldValue } from './admin';

/** IST calendar day, e.g. "2026-10-22". */
export function istDay(t = Date.now()): string {
  return new Date(t + 330 * 60_000).toISOString().slice(0, 10);
}

/**
 * Increment daily counters in analyticsDaily/{scope}_{day}. Scopes: "platform",
 * "property_{id}", "room_{id}". Aggregates — never raw personal data.
 */
export async function bump(scopes: string[], counters: Record<string, number>, t = Date.now()): Promise<void> {
  const day = istDay(t);
  const batch = db.batch();
  const inc = Object.fromEntries(Object.entries(counters).map(([k, v]) => [k, FieldValue.increment(v)]));
  for (const scope of scopes) batch.set(db.doc(`analyticsDaily/${scope}_${day}`), { scope, day, ...inc }, { merge: true });
  await batch.commit();
}
