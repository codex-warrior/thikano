import type { Transaction, WriteBatch } from 'firebase-admin/firestore';
import { db } from './admin';

export interface AuditEntry {
  actorUid: string;
  actorRole: string;
  action: string; // e.g. "room.published"
  entity: string; // e.g. "room"
  entityId: string;
  orgId?: string | null;
  metadata?: Record<string, unknown>;
}

/** Append-only audit log. Pass a transaction/batch so the log commits atomically with the change. */
export async function audit(entry: AuditEntry, w?: Transaction | WriteBatch): Promise<void> {
  const ref = db.collection('auditLogs').doc();
  const data = { id: ref.id, at: Date.now(), orgId: null, metadata: {}, ...entry };
  if (w) {
    (w as WriteBatch).set(ref, data);
    return;
  }
  await ref.set(data);
}
