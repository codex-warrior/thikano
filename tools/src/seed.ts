/**
 * Seed the LOCAL EMULATORS with the THIKANO development dataset.
 *
 *   npm run emulators         (terminal 1)
 *   npm run seed              (terminal 2)
 *
 * Hard safety rails: refuses unless both emulator hosts are set AND the project id
 * starts with "demo-" (Firebase demo projects cannot reach production resources).
 */
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type WriteBatch } from 'firebase-admin/firestore';
import { projectPublicProperty, splitForOrder, type PublicRoom } from '@thikano/domain';
import * as fx from '@thikano/fixtures';

// `--local` opts into the default local emulator ports (still demo- projects only).
if (process.argv.includes('--local')) {
  process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
  process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';
}

const PROJECT = process.env.GCLOUD_PROJECT ?? process.env.FIREBASE_PROJECT ?? 'demo-thikano';
const DEV_PASSWORD = 'thikano-dev-123';

function guard() {
  const problems: string[] = [];
  if (!process.env.FIRESTORE_EMULATOR_HOST) problems.push('FIRESTORE_EMULATOR_HOST is not set');
  if (!process.env.FIREBASE_AUTH_EMULATOR_HOST) problems.push('FIREBASE_AUTH_EMULATOR_HOST is not set');
  if (!PROJECT.startsWith('demo-')) problems.push(`project "${PROJECT}" is not a demo- project`);
  if (process.env.THIKANO_ENV === 'production') problems.push('THIKANO_ENV=production');
  if (problems.length) {
    console.error(`Refusing to seed: ${problems.join('; ')}.`);
    process.exit(1);
  }
  fx.assertFixturesAllowed();
}

guard();
initializeApp({ projectId: PROJECT });
const db = getFirestore();
const auth = getAuth();

/** Batched writer that flushes every 400 operations. */
class Writer {
  private batch: WriteBatch = db.batch();
  private n = 0;
  count = 0;
  set(path: string, data: object) {
    this.batch.set(db.doc(path), JSON.parse(JSON.stringify(data)));
    this.n++;
    this.count++;
    return this.n >= 400 ? this.flush() : Promise.resolve();
  }
  async flush() {
    if (!this.n) return;
    await this.batch.commit();
    this.batch = db.batch();
    this.n = 0;
  }
}

async function upsertUser(uid: string, props: { email?: string; phoneNumber?: string; displayName: string }, claims?: Record<string, unknown>) {
  try {
    await auth.getUser(uid);
    await auth.updateUser(uid, { ...props, ...(props.email ? { password: DEV_PASSWORD } : {}) });
  } catch {
    await auth.createUser({ uid, ...props, ...(props.email ? { password: DEV_PASSWORD, emailVerified: true } : {}) });
  }
  if (claims) await auth.setCustomUserClaims(uid, claims);
}

async function main() {
  const t0 = Date.now();
  const w = new Writer();
  const rohit = fx.residents.find((r) => r.uid === fx.DEMO.residentUid)!;
  const residentUid = (residentId: string) => (residentId === rohit.id ? fx.DEMO.residentUid : null);

  // ── Auth: owners, staff, admin, demo resident ──
  for (const o of fx.OWNERS) await upsertUser(o.uid, { email: `${o.uid.replace('owner-', '')}@thikano.dev`, displayName: o.name });
  await upsertUser('mgr-ramesh', { email: 'ramesh@thikano.dev', displayName: 'Ramesh Saini' });
  await upsertUser('staff-suresh', { email: 'suresh@thikano.dev', displayName: 'Suresh (Maintenance)' });
  await upsertUser(fx.DEMO.adminUid, { email: 'admin@thikano.dev', displayName: 'THIKANO Ops' }, { platformRole: 'platform_admin' });
  await upsertUser('support-thikano', { email: 'support@thikano.dev', displayName: 'THIKANO Support' }, { platformRole: 'platform_support' });
  await upsertUser(fx.DEMO.residentUid, { phoneNumber: '+919000000001', displayName: 'Rohit Singh' }, { stay: { o: rohit.orgId, p: rohit.propertyId, r: rohit.id } });
  await w.set(`platformStaff/${fx.DEMO.adminUid}`, { uid: fx.DEMO.adminUid, role: 'platform_admin', updatedAt: t0 });
  await w.set(`platformStaff/support-thikano`, { uid: 'support-thikano', role: 'platform_support', updatedAt: t0 });

  // ── Users ──
  for (const o of fx.OWNERS) await w.set(`users/${o.uid}`, { uid: o.uid, displayName: o.name, email: `${o.uid.replace('owner-', '')}@thikano.dev`, activeStay: null, createdAt: t0 });
  await w.set(`users/${fx.DEMO.residentUid}`, { uid: fx.DEMO.residentUid, displayName: 'Rohit Singh', phone: '+919000000001', activeStay: { orgId: rohit.orgId, propertyId: rohit.propertyId, residentId: rohit.id }, createdAt: t0 });

  // ── Organizations & members ──
  for (const o of fx.organizations) await w.set(`organizations/${o.id}`, o);
  for (const { orgId, ...m } of fx.members) await w.set(`organizations/${orgId}/members/${m.uid}`, m);

  // ── Inventory ──
  for (const p of fx.properties) await w.set(`organizations/${p.orgId}/properties/${p.id}`, p);
  for (const b of fx.buildings) await w.set(`organizations/${b.orgId}/properties/${b.propertyId}/buildings/${b.id}`, b);
  for (const f of fx.floors) await w.set(`organizations/${f.orgId}/properties/${f.propertyId}/floors/${f.id}`, f);
  for (const r of fx.rooms) await w.set(`organizations/${r.orgId}/properties/${r.propertyId}/rooms/${r.id}`, r);
  for (const b of fx.beds) await w.set(`organizations/${b.orgId}/properties/${b.propertyId}/beds/${b.id}`, b);
  for (const p of fx.properties) await w.set(`slugs/${p.slug}`, { kind: 'property', id: p.id, orgId: p.orgId, propertyId: p.id, createdAt: t0 });
  for (const r of fx.rooms) await w.set(`slugs/${r.publicSlug}`, { kind: 'room', id: r.id, orgId: r.orgId, propertyId: r.propertyId, createdAt: t0 });
  for (const p of fx.properties) await w.set(`ratings/${p.id}`, { rating: fx.ratings[p.id] ?? null, count: fx.ratingCounts[p.id] ?? 0 });
  if (fx.properties.some((p) => p.verification === 'submitted')) {
    for (const p of fx.properties.filter((x) => x.verification === 'submitted')) {
      await w.set(`verificationRequests/${p.id}`, { propertyId: p.id, orgId: p.orgId, status: 'pending', submittedBy: p.createdBy, submittedAt: t0 - 86_400_000, notes: null });
    }
  }

  // ── Public projections (same domain builders the functions use) ──
  for (const pr of fx.publicRooms) await w.set(`publicRooms/${pr.roomId}`, pr);
  for (const p of fx.properties) {
    const pp = projectPublicProperty(p, fx.publicRooms.filter((r: PublicRoom) => r.propertyId === p.id), { rating: fx.ratings[p.id] ?? null, ratingCount: fx.ratingCounts[p.id] ?? 0 });
    if (pp) await w.set(`publicProperties/${p.id}`, pp);
  }

  // ── Operations ──
  for (const r of fx.residents) await w.set(`organizations/${r.orgId}/residents/${r.id}`, { ...r, residentUid: r.uid ?? null });
  for (const i of fx.invoices) await w.set(`organizations/${i.orgId}/invoices/${i.id}`, { ...i, residentUid: residentUid(i.residentId) });
  for (const m of fx.maintenance) await w.set(`organizations/${m.orgId}/maintenance/${m.id}`, { ...m, residentUid: m.residentId ? residentUid(m.residentId) : null });
  for (const n of fx.notices) await w.set(`organizations/${n.orgId}/notices/${n.id}`, { ...n, pushedAt: n.publishedAt });
  for (const p of fx.parcels) await w.set(`organizations/${p.orgId}/parcels/${p.id}`, { ...p, residentUid: residentUid(p.residentId) });
  for (const l of fx.leads) await w.set(`organizations/${l.orgId}/leads/${l.id}`, l);
  for (const b of fx.bookings) await w.set(`organizations/${b.orgId}/bookings/${b.id}`, b);

  // ── Services & economics ──
  for (const p of fx.providers) {
    // Development: every provider (incl. Dwarpar) runs on the catalog adapter. Production sets adapter: 'dwarpar'.
    await w.set(`providers/${p.id}`, { id: p.id, name: p.name, categories: p.categories, status: p.status, adapter: 'mock' });
    for (const item of fx.catalogs[p.id] ?? []) await w.set(`providers/${p.id}/catalog/${item.sku}`, item);
  }
  for (const r of fx.revenueRules) await w.set(`revenueRules/${r.id}`, r);
  const providerName = Object.fromEntries(fx.providers.map((p) => [p.id, p.name]));
  for (const { split, ...o } of fx.serviceOrders) {
    await w.set(`organizations/${o.orgId}/serviceOrders/${o.id}`, { ...o, residentUid: residentUid(o.residentId) ?? `unlinked-${o.residentId}`, providerName: providerName[o.providerId] });
    if (o.status !== 'delivered') continue;
    const s = splitForOrder(o.gross, fx.revenueRules, { category: o.category, providerId: o.providerId, orgId: o.orgId, propertyId: o.propertyId, at: o.createdAt });
    const period = new Date(o.updatedAt + 330 * 60_000).toISOString().slice(0, 7);
    await w.set(`platformLedger/${o.id}`, { orderId: o.id, orgId: o.orgId, propertyId: o.propertyId, providerId: o.providerId, category: o.category, period, ...s, createdAt: o.updatedAt });
    await w.set(`organizations/${o.orgId}/ledger/${o.id}`, { orderId: o.id, propertyId: o.propertyId, category: o.category, period, gross: o.gross, partner: s.partner, createdAt: o.updatedAt });
  }

  await w.flush();
  console.log(`Seeded ${w.count} documents into ${PROJECT} in ${((Date.now() - t0) / 1000).toFixed(1)}s.`);
  console.log(`Sign-in (password ${DEV_PASSWORD}): shashank@thikano.dev (owner) · admin@thikano.dev (admin) · resident phone +91 9000000001`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
