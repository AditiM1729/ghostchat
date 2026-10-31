import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
await mkdir(new URL('server/runtime/', root), { recursive: true });
await build({ entryPoints: [fileURLToPath(new URL('server/src/index.ts', root))], outfile: fileURLToPath(new URL('server/runtime/relay.mjs', root)), bundle: true, platform: 'node', target: 'node24', format: 'esm', legalComments: 'external', banner: { js: 'import {createRequire as __createRequire} from "node:module"; const require = __createRequire(import.meta.url);' } });
for (const name of ['GhostPayEscrow', 'GhostChatTestTrade', 'GhostChatArbitratedTrade', 'GhostChatSellerTrade', 'GhostChatUTRTrade']) {
  const artifact = JSON.parse(await readFile(new URL(`contracts/artifacts/contracts/${name}.sol/${name}.json`, root), 'utf8'));
  await writeFile(new URL(`server/runtime/${name}.json`, root), JSON.stringify({ abi: artifact.abi, bytecode: artifact.bytecode, deployedBytecode: artifact.deployedBytecode }) + '\n');
}
console.log('Prepared the Node 24 relay runtime and public contract artifacts. No environment files were bundled.');
