/**
 * TEMPORARY demo listings on a real project, so Explore and the public site are not empty
 * before the first owner lists. Writes only the listing side of the fixtures (organizations,
 * properties, rooms, beds, slugs, ratings and their public projections) plus the demo PGs'
 * residents, rent, issues, notices, parcels and leads; codes THKDEMO1–3 redeem three of the stays.
 * No Auth users and no real money. Every path is derived from the
 * fixtures, so --remove deletes exactly what this wrote (an account that redeemed a code keeps
 * its stay claim until it signs out or uses Settings → delete account).
 *
 *   ACCESS_TOKEN=$(gcloud auth print-access-token) npx tsx tools/src/demo-listings.ts <project> [--remove]
 *
 * Remove before public launch.
 */
import { projectPublicProperty, type PublicRoom } from '@thikano/domain';
import * as fx from '@thikano/fixtures';

const [project] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const remove = process.argv.includes('--remove');
const token = process.env.ACCESS_TOKEN;
if (!project || !token) {
  console.error('usage: ACCESS_TOKEN=... tsx tools/src/demo-listings.ts <project> [--remove]');
  process.exit(1);
}

const docs: [string, object][] = [];
const t0 = Date.now();
for (const o of fx.organizations) docs.push([`organizations/${o.id}`, { ...o, demo: true }]);
for (const { orgId, ...m } of fx.members.filter((m) => m.role === 'owner')) docs.push([`organizations/${orgId}/members/${m.uid}`, m]);
for (const p of fx.properties) docs.push([`organizations/${p.orgId}/properties/${p.id}`, p]);
for (const b of fx.buildings) docs.push([`organizations/${b.orgId}/properties/${b.propertyId}/buildings/${b.id}`, b]);
for (const f of fx.floors) docs.push([`organizations/${f.orgId}/properties/${f.propertyId}/floors/${f.id}`, f]);
for (const r of fx.rooms) docs.push([`organizations/${r.orgId}/properties/${r.propertyId}/rooms/${r.id}`, r]);
for (const b of fx.beds) docs.push([`organizations/${b.orgId}/properties/${b.propertyId}/beds/${b.id}`, b]);
for (const p of fx.properties) docs.push([`slugs/${p.slug}`, { kind: 'property', id: p.id, orgId: p.orgId, propertyId: p.id, createdAt: t0 }]);
for (const r of fx.rooms) docs.push([`slugs/${r.publicSlug}`, { kind: 'room', id: r.id, orgId: r.orgId, propertyId: r.propertyId, createdAt: t0 }]);
for (const p of fx.properties) docs.push([`ratings/${p.id}`, { rating: fx.ratings[p.id] ?? null, count: fx.ratingCounts[p.id] ?? 0 }]);
for (const pr of fx.publicRooms) docs.push([`publicRooms/${pr.roomId}`, pr]);
// Day-to-day records for the demo PGs, so the demo owner account (Auth uid owner-shashank, created
// separately — see docs/THIKANO-LAUNCH.md) sees a working PG. Every resident is unlinked; the first
// three active Sunrise residents get fixed invite codes so a tester can redeem one in the app and
// see Resident mode. Each code works once; re-running resets them (and any edits to these records).
const DEMO_STAYS = fx.residents.filter((r) => r.propertyId === fx.DEMO.propertyId && r.status === 'active').slice(0, 3);
const codes = new Map(DEMO_STAYS.map((r, i) => [r.id, `THKDEMO${i + 1}`]));
for (const r of fx.residents) docs.push([`organizations/${r.orgId}/residents/${r.id}`, { ...r, uid: null, residentUid: null, inviteCode: codes.get(r.id) ?? null }]);
for (const [residentId, code] of codes) {
  const r = DEMO_STAYS.find((x) => x.id === residentId)!;
  docs.push([`residentInvites/${code}`, { orgId: r.orgId, propertyId: r.propertyId, residentId, createdAt: t0, expiresAt: t0 + 90 * 86_400_000 }]);
}
for (const inv of fx.invoices) docs.push([`organizations/${inv.orgId}/invoices/${inv.id}`, { ...inv, residentUid: null }]);
for (const m of fx.maintenance) docs.push([`organizations/${m.orgId}/maintenance/${m.id}`, { ...m, residentUid: null }]);
for (const n of fx.notices) docs.push([`organizations/${n.orgId}/notices/${n.id}`, { ...n, pushedAt: n.publishedAt }]);
for (const p of fx.parcels) docs.push([`organizations/${p.orgId}/parcels/${p.id}`, { ...p, residentUid: null }]);
for (const l of fx.leads) docs.push([`organizations/${l.orgId}/leads/${l.id}`, l]);
for (const b of fx.bookings) docs.push([`organizations/${b.orgId}/bookings/${b.id}`, b]);

for (const p of fx.properties) {
  const pp = projectPublicProperty(p, fx.publicRooms.filter((r: PublicRoom) => r.propertyId === p.id), { rating: fx.ratings[p.id] ?? null, ratingCount: fx.ratingCounts[p.id] ?? 0 });
  if (pp) docs.push([`publicProperties/${p.id}`, pp]);
}

/** JSON value → Firestore REST Value. */
function value(v: unknown): object {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(value) } };
  return { mapValue: { fields: fields(v as Record<string, unknown>) } };
}
function fields(o: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined).map(([k, v]) => [k, value(v)]));
}

const base = `projects/${project}/databases/(default)/documents`;
async function main() {
  for (let i = 0; i < docs.length; i += 400) {
    const writes = docs.slice(i, i + 400).map(([path, data]) => (remove ? { delete: `${base}/${path}` } : { update: { name: `${base}/${path}`, fields: fields(JSON.parse(JSON.stringify(data))) } }));
    const res = await fetch(`https://firestore.googleapis.com/v1/${base}:commit`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'x-goog-user-project': project! },
      body: JSON.stringify({ writes }),
    });
    if (!res.ok) throw new Error(`commit failed (${res.status}): ${await res.text()}`);
  }
  if (remove) {
    // The demo owner login (created by hand with the Identity Toolkit API) goes with its data.
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts:delete`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'x-goog-user-project': project! },
      body: JSON.stringify({ localId: fx.DEMO.ownerUid }),
    });
    if (!res.ok && !(await res.text()).includes('USER_NOT_FOUND')) throw new Error(`could not delete demo owner (${res.status})`);
  }
  console.log(`${remove ? 'Removed' : 'Wrote'} ${docs.length} demo listing documents ${remove ? 'from' : 'to'} ${project}: ${fx.properties.length} properties, ${fx.publicRooms.length} public rooms.`);
  if (!remove) console.log(`Invite codes: ${DEMO_STAYS.map((r, i) => `THKDEMO${i + 1} (${r.name}, room ${r.roomId.split("-r").pop()})`).join(", ")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
