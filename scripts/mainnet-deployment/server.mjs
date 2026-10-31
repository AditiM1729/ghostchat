import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { build } from 'esbuild';
import { artifacts, verifyDeployment, recordDeployment } from './verify.mjs';
const root = new URL('../../',import.meta.url), compiled = await artifacts(root);
let recorded; try { recorded=JSON.parse(await readFile(new URL('deployments/mst-mainnet.json',root),'utf8')); } catch(e) { if(e.code!=='ENOENT')throw e; }
const token = randomBytes(32).toString('hex');
const output = await build({ entryPoints: [new URL('./wallet.js',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1')], bundle:true, write:false, platform:'browser', format:'esm', target:'es2022', minify:true });
const origin = 'http://127.0.0.1:5180';
let recording = false;
const server = createServer(async (req,res)=>{
  res.setHeader('Cache-Control','no-store'); res.setHeader('X-Content-Type-Options','nosniff'); res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://mariorpc.mstblockchain.com; frame-ancestors 'none'; base-uri 'none'");
  try {
    if (req.headers.host !== '127.0.0.1:5180') throw new Error('Open the exact loopback URL printed in the terminal.');
    if (req.method==='GET' && req.url==='/') { res.setHeader('Content-Type','text/html; charset=utf-8'); return res.end(await readFile(new URL('./index.html',import.meta.url))); }
    if (req.method==='GET' && req.url==='/wallet.js') { res.setHeader('Content-Type','text/javascript'); return res.end(output.outputFiles[0].contents); }
    if (req.method==='GET' && req.url==='/config') { res.setHeader('Content-Type','application/json'); return res.end(JSON.stringify({token, recorded, abi:compiled[0].abi, bytecode:compiled[0].bytecode})); }
    if (req.method==='POST' && req.url==='/record') {
      if (req.headers.origin!==origin || req.headers['x-deployment-token']!==token || recording) throw new Error('Invalid or concurrent recording request.');
      recording=true;
      try {
        let body=''; for await(const part of req) { body+=part; if(body.length>256) throw new Error('Request too large.'); }
        const result=await verifyDeployment(JSON.parse(body).hash,compiled);
        await recordDeployment(root,result);
        recorded=result;
        res.setHeader('Content-Type','application/json'); return res.end(JSON.stringify(result));
      } finally { recording=false; }
    }
    res.statusCode=404; res.end('Not found');
  } catch(error) { res.statusCode=400; res.setHeader('Content-Type','application/json'); res.end(JSON.stringify({error:error.message})); }
});
server.listen(5180,'127.0.0.1',()=>console.log(`Mainnet deployment page: ${origin}\nBridgeKey signs one zero-value suite deployment. Real MSTC pays gas. No private keys are read by this tool.\nSuccessful deployments are verified before README.md and deployments/mst-mainnet.json are updated. No commits or pushes.`));
