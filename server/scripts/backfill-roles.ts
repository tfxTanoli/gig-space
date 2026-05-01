/**
 * One-time backfill: sets role: "user" on every user node that has no role field.
 * Skips users who already have role: "admin" (or any other role).
 *
 * Usage (from project root):
 *   npx tsx server/scripts/backfill-roles.ts
 */
import * as path from 'path';
import * as fs from 'fs';

const rootEnvPath   = path.resolve(process.cwd(), '.env');
const serverEnvPath = path.resolve(process.cwd(), 'server', '.env');
if (fs.existsSync(rootEnvPath))   require('dotenv').config({ path: rootEnvPath });
if (fs.existsSync(serverEnvPath)) require('dotenv').config({ path: serverEnvPath });

import * as admin from 'firebase-admin';

async function main() {
  if (!admin.apps.length) {
    const databaseURL =
      process.env.FIREBASE_DATABASE_URL ||
      process.env.VITE_FIREBASE_DATABASE_URL;

    if (!databaseURL) {
      console.error('FIREBASE_DATABASE_URL is not set in .env');
      process.exit(1);
    }

    let credential: admin.credential.Credential | undefined;

    if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
      credential = admin.credential.cert(
        JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf-8')),
      );
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      credential = admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON));
    } else {
      const candidates = [
        path.resolve(process.cwd(), 'serviceAccountKey.json'),
        path.resolve(process.cwd(), 'server', 'serviceAccountKey.json'),
        process.env.GOOGLE_APPLICATION_CREDENTIALS ?? '',
      ].filter(Boolean);

      const keyFile = candidates.find((p) => fs.existsSync(p));
      if (!keyFile) {
        console.error('No Firebase credentials found. Place serviceAccountKey.json in the project root.');
        process.exit(1);
      }
      credential = admin.credential.cert(JSON.parse(fs.readFileSync(keyFile, 'utf-8')));
      console.log(`Using credentials: ${keyFile}`);
    }

    admin.initializeApp({ credential, databaseURL });
  }

  const db = admin.database();
  const snap = await db.ref('users').get();

  if (!snap.exists()) {
    console.log('No users found in database.');
    process.exit(0);
  }

  const users = snap.val() as Record<string, { name?: string; email?: string; role?: string }>;
  const uids = Object.keys(users);

  console.log(`Found ${uids.length} user(s). Checking for missing role fields...`);

  const updates: Record<string, string> = {};
  let skipped = 0;

  for (const uid of uids) {
    const u = users[uid];
    if (u.role) {
      console.log(`  SKIP  ${uid} (${u.email ?? 'no email'}) — already has role: "${u.role}"`);
      skipped++;
    } else {
      console.log(`  PATCH ${uid} (${u.email ?? 'no email'}) — setting role: "user"`);
      updates[`users/${uid}/role`] = 'user';
    }
  }

  const toWrite = Object.keys(updates).length;
  if (toWrite === 0) {
    console.log('\nAll users already have a role. Nothing to update.');
    process.exit(0);
  }

  await db.ref().update(updates);
  console.log(`\n✓ Done. Updated ${toWrite} user(s), skipped ${skipped}.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
