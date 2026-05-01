/**
 * One-time script to grant admin role to a user.
 *
 * Usage (from project root):
 *   npx tsx server/scripts/set-admin.ts <uid>
 *
 * Example:
 *   npx tsx server/scripts/set-admin.ts v0ZaWyJ010MIhbV5rlUaqJyMAgj2
 */
import * as path from 'path';
import * as fs from 'fs';

// Load root .env (VITE_* vars) and server .env
const rootEnvPath   = path.resolve(process.cwd(), '.env');
const serverEnvPath = path.resolve(process.cwd(), 'server', '.env');
if (fs.existsSync(rootEnvPath))   require('dotenv').config({ path: rootEnvPath });
if (fs.existsSync(serverEnvPath)) require('dotenv').config({ path: serverEnvPath });

import * as admin from 'firebase-admin';

async function main() {
  const uid = process.argv[2];

  if (!uid) {
    console.error('Usage: npx tsx server/scripts/set-admin.ts <uid>');
    process.exit(1);
  }

  if (!admin.apps.length) {
    // Resolve database URL — try both the server var and the VITE frontend var
    const databaseURL =
      process.env.FIREBASE_DATABASE_URL ||
      process.env.VITE_FIREBASE_DATABASE_URL;

    if (!databaseURL) {
      console.error('FIREBASE_DATABASE_URL is not set in .env');
      process.exit(1);
    }

    let credential: admin.credential.Credential | undefined;

    if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
      const parsed = JSON.parse(
        Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf-8'),
      );
      credential = admin.credential.cert(parsed);
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      credential = admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON));
    } else {
      // Fall back to serviceAccountKey.json in project root or server/
      const candidates = [
        path.resolve(process.cwd(), 'serviceAccountKey.json'),
        path.resolve(process.cwd(), 'server', 'serviceAccountKey.json'),
        process.env.GOOGLE_APPLICATION_CREDENTIALS ?? '',
      ].filter(Boolean);

      const keyFile = candidates.find((p) => fs.existsSync(p));
      if (!keyFile) {
        console.error(
          'No Firebase credentials found.\n' +
          'Place serviceAccountKey.json in the project root, or set FIREBASE_SERVICE_ACCOUNT_JSON in .env',
        );
        process.exit(1);
      }
      credential = admin.credential.cert(JSON.parse(fs.readFileSync(keyFile, 'utf-8')));
      console.log(`Using credentials from: ${keyFile}`);
    }

    admin.initializeApp({ credential, databaseURL });
  }

  const db = admin.database();

  const snap = await db.ref(`users/${uid}`).get();
  if (!snap.exists()) {
    console.error(`No user found with uid: ${uid}`);
    process.exit(1);
  }

  const user = snap.val() as { name?: string; email?: string; role?: string };
  console.log(`Found user: ${user.name ?? '(no name)'} <${user.email ?? '(no email)'}>`);

  if (user.role === 'admin') {
    console.log('User already has role: admin — no change needed.');
    process.exit(0);
  }

  await db.ref(`users/${uid}/role`).set('admin');
  console.log(`✓ role set to "admin" for uid: ${uid}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
