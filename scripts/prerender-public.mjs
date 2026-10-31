import { build } from 'esbuild';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = resolve(root, 'frontend/dist');
const temporary = resolve(root, 'logs/public-prerender.mjs');
const pages = { '/about': 'About GhostChat', '/demo': 'Product walkthrough', '/privacy': 'Privacy notice', '/terms': 'Testnet demo terms', '/contact': 'Contact GhostChat' };
const template = await readFile(resolve(output, 'index.html'), 'utf8');
const manifest = JSON.parse(await readFile(resolve(output, '.vite/manifest.json'), 'utf8'));
const pageEntry = manifest['src/company/PublicPages.tsx'];
assert.ok(pageEntry, 'Public-page build entry is missing.');
const styles = (pageEntry.css || []).map(path => `<link rel="stylesheet" href="/${path}">`).join('');
await mkdir(resolve(root, 'logs'), { recursive: true });
try {
  await build({ entryPoints: [resolve(root, 'frontend/src/company/PublicPages.tsx')], outfile: temporary, bundle: true, platform: 'node', format: 'esm', packages: 'external', loader: { '.css': 'empty' } });
  const { default: PublicPages } = await import(pathToFileURL(temporary));
  for (const [route, title] of Object.entries(pages)) {
    const content = renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [route] }, createElement(PublicPages)));
    assert.ok(content.includes('<main'), `${route}: public content did not render.`);
    let html = template.replace(/<title>[^<]*<\/title>/, `<title>${title} — GhostChat</title>`)
      .replace('</head>', `${styles}</head>`)
      .replace(/<div id="root">[\s\S]*<\/div>\s*<\/body>/, `<div id="root">${content}</div></body>`);
    assert.ok(html.includes(content), `${route}: template did not accept public content.`);
    await mkdir(resolve(output, route.slice(1)), { recursive: true });
    await writeFile(resolve(output, route.slice(1), 'index.html'), html.replace(/\r\n/g, '\n').replace(/[\t ]+$/gm, ''));
  }
  console.log(`Pre-rendered ${Object.keys(pages).length} public information pages; their content is readable without JavaScript.`);
} finally {
  await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; });
}
