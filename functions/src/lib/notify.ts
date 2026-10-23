import { can, type OrgMember, type StaffPermission } from '@thikano/domain';
import { db } from './admin';

export interface Notification {
  title: string;
  body: string;
  /** Deep link handled by the apps, e.g. "/leads?lead=abc" or "thikano://stay". */
  link?: string;
  kind: 'lead' | 'booking' | 'rent' | 'payment' | 'maintenance' | 'notice' | 'parcel' | 'service' | 'verification' | 'system';
}

/**
 * Every notification is written to users/{uid}/inbox (the in-app feed). Push delivery
 * happens in the onInboxItemCreated trigger (notifications.ts), so a slow or failing push
 * provider never blocks the business action. Callers decide WHO is notified — keep it relevant.
 */
export async function notifyUsers(uids: readonly string[], n: Notification): Promise<void> {
  const unique = [...new Set(uids)].filter(Boolean);
  if (!unique.length) return;
  const t = Date.now();
  const batch = db.batch();
  for (const uid of unique) batch.set(db.collection(`users/${uid}/inbox`).doc(), { ...n, createdAt: t, readAt: null });
  await batch.commit();
}

/** Notify org members who hold `permission` for the property (e.g. leads.read for new enquiries). */
export async function notifyOrg(orgId: string, propertyId: string, permission: StaffPermission, n: Notification): Promise<void> {
  const members = await db.collection(`organizations/${orgId}/members`).where('status', '==', 'active').get();
  const uids = members.docs.map((d) => d.data() as OrgMember).filter((m) => can(m, permission, propertyId)).map((m) => m.uid);
  await notifyUsers(uids, n);
}

export async function notifyPlatformAdmins(n: Notification): Promise<void> {
  const admins = await db.collection('platformStaff').where('role', '==', 'platform_admin').get();
  await notifyUsers(admins.docs.map((d) => d.id), n);
}
