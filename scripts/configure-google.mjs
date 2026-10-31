import { readFile, writeFile, rename } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
const clientId = process.argv[2];
if (!clientId || !/^\d+-[a-z\d-]+\.apps\.googleusercontent\.com$/.test(clientId)) throw new Error('Supply the public Google OAuth Web Client ID, not a client secret.');
const envPath = new URL('../.env', import.meta.url); let content = '';
try { content = await readFile(envPath, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
if (!/^PROFILE_ENCRYPTION_KEY=\S+/m.test(content) && !process.env.PROFILE_ENCRYPTION_KEY) {
  const dbPath = fileURLToPath(new URL('../data/accounts.sqlite', import.meta.url));
  if (existsSync(dbPath)) {
    const db = new DatabaseSync(dbPath, { readOnly: true });
    try { if (db.prepare('SELECT count(*) AS total FROM accounts').get().total > 0) throw new Error('Restore the existing PROFILE_ENCRYPTION_KEY before configuring Google. Existing profile data must keep its original key.'); }
    finally { db.close(); }
  }
  content = content.replace(/^PROFILE_ENCRYPTION_KEY=.*\r?\n?/m, '');
  content += `\nPROFILE_ENCRYPTION_KEY=${randomBytes(32).toString('hex')}\n`;
}
content = content.replace(/^GOOGLE_CLIENT_ID=.*\r?\n?/m, ''); content += `\nGOOGLE_CLIENT_ID=${clientId}\n`;
await writeFile(new URL('../.env.tmp', import.meta.url), content, { mode: 0o600 }); await rename(new URL('../.env.tmp', import.meta.url), envPath);
console.log('Google OAuth Web Client ID configured. Private profile encryption configured. No client secret is needed or stored. Restart the relay.');
