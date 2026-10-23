/**
 * Storage rules: org media uploads, type/size limits, verification documents, maintenance photos.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, type FirebaseStorage } from 'firebase/storage';
import { afterAll, beforeAll, describe, it } from 'vitest';

let env: RulesTestEnvironment;
const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-thikano',
    firestore: { rules: readFileSync(resolve(__dirname, '../../firestore.rules'), 'utf8') },
    storage: { rules: readFileSync(resolve(__dirname, '../../storage.rules'), 'utf8') },
  });
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'organizations/sOrgA/members/sOwnerA'), { uid: 'sOwnerA', role: 'owner', propertyIds: null, status: 'active' });
    await setDoc(doc(db, 'organizations/sOrgA/members/sStaff'), { uid: 'sStaff', role: 'staff', propertyIds: ['p1'], status: 'active', permissions: ['maintenance.read'] });
  });
});
afterAll(async () => env?.cleanup());

const storage = (uid: string | null, claims: Record<string, unknown> = {}) =>
  (uid ? env.authenticatedContext(uid, claims) : env.unauthenticatedContext()).storage() as unknown as FirebaseStorage;

describe('storage rules', () => {
  it('owner uploads room photos; size/type limits apply', async () => {
    const s = storage('sOwnerA');
    await assertSucceeds(uploadBytes(ref(s, 'orgs/sOrgA/properties/p1/media/a.jpg'), jpg, { contentType: 'image/jpeg' }));
    await assertFails(uploadBytes(ref(s, 'orgs/sOrgA/properties/p1/media/a.exe'), jpg, { contentType: 'application/octet-stream' }));
    await assertFails(uploadBytes(ref(s, 'orgs/sOrgA/properties/p1/media/big.jpg'), new Uint8Array(11 * 1024 * 1024), { contentType: 'image/jpeg' }));
  });

  it('other users, staff without inventory.write, and anonymous users cannot upload', async () => {
    await assertFails(uploadBytes(ref(storage('stranger'), 'orgs/sOrgA/properties/p1/media/x.jpg'), jpg, { contentType: 'image/jpeg' }));
    await assertFails(uploadBytes(ref(storage('sStaff'), 'orgs/sOrgA/properties/p1/media/x.jpg'), jpg, { contentType: 'image/jpeg' }));
    await assertFails(uploadBytes(ref(storage(null), 'orgs/sOrgA/properties/p1/media/x.jpg'), jpg, { contentType: 'image/jpeg' }));
  });

  it('verification documents are owner-only', async () => {
    await assertSucceeds(uploadBytes(ref(storage('sOwnerA'), 'orgs/sOrgA/verification/deed.pdf'), jpg, { contentType: 'application/pdf' }));
    await assertFails(uploadBytes(ref(storage('sStaff'), 'orgs/sOrgA/verification/deed.pdf'), jpg, { contentType: 'application/pdf' }));
  });

  it('residents can attach maintenance photos only for their own org', async () => {
    await assertSucceeds(uploadBytes(ref(storage('res1', { stay: { o: 'sOrgA', p: 'p1', r: 'r1' } }), 'orgs/sOrgA/maintenance/i1/p.jpg'), jpg, { contentType: 'image/jpeg' }));
    await assertFails(uploadBytes(ref(storage('res2', { stay: { o: 'other', p: 'p9', r: 'r9' } }), 'orgs/sOrgA/maintenance/i1/p.jpg'), jpg, { contentType: 'image/jpeg' }));
  });

  it('everything else is closed', async () => {
    await assertFails(uploadBytes(ref(storage('sOwnerA'), 'random/file.jpg'), jpg, { contentType: 'image/jpeg' }));
  });
});
