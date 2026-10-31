import { readFile, appendFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
const path = new URL('../.env', import.meta.url);
let content = '';
try { content = await readFile(path, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
if (/^TEST_PAYMENT_ATTESTOR_KEY\s*=/m.test(content)) {
  console.log('Test payment attestor already configured. Keep this key stable for existing demo escrows.');
} else {
  await appendFile(path, `\n# Test-only attestor; never fund this address or use for mainnet.\nTEST_PAYMENT_ATTESTOR_KEY=0x${randomBytes(32).toString('hex')}\n`, { mode: 0o600 });
  console.log('Saved a dedicated test payment signing key privately in .env. Add your Razorpay TEST credentials there and restart the relay.');
}
