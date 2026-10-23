/**
 * One-time: make someone the first THIKANO platform admin on a REAL project.
 * Later admins are granted from Admin → Settings (audited setPlatformRole function).
 *
 *   gcloud auth application-default login
 *   npx tsx tools/src/bootstrap-admin.ts --project thikano-prod --email founder@thikano.in --yes
 *
 * Creates the user if missing and prints a password-reset link to set their password.
 */
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const project = arg('project');
const email = arg('email');
if (!project || !email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error('Usage: bootstrap-admin --project <firebase-project-id> --email <admin email> --yes');
  process.exit(1);
}
if (!process.argv.includes('--yes')) {
  console.error(`This grants FULL platform admin on "${project}" to ${email}. Re-run with --yes to confirm.`);
  process.exit(1);
}

initializeApp({ projectId: project });
const auth = getAuth();
const db = getFirestore();

async function main() {
  let user;
  try {
    user = await auth.getUserByEmail(email!);
  } catch {
    user = await auth.createUser({ email: email!, emailVerified: false, displayName: 'THIKANO Admin' });
    console.log(`Created user ${user.uid}`);
  }
  await auth.setCustomUserClaims(user.uid, { ...(user.customClaims ?? {}), platformRole: 'platform_admin' });
  const t = Date.now();
  await db.doc(`platformStaff/${user.uid}`).set({ uid: user.uid, role: 'platform_admin', updatedAt: t });
  await db.collection('auditLogs').add({ actorUid: 'bootstrap-script', actorRole: 'system', action: 'platform.role_granted', entity: 'user', entityId: user.uid, orgId: null, at: t, metadata: { role: 'platform_admin', email } });
  const link = await auth.generatePasswordResetLink(email!);
  console.log(`✓ ${email} is a platform admin on ${project}.`);
  console.log(`Set a password here (link expires): ${link}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
