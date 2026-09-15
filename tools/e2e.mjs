import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.mjs': 'text/javascript', '.json': 'application/json', '.pfb': 'font/otf',
};
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    res.writeHead(404); res.end('404'); return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  res.end(fs.readFileSync(f));
});
await new Promise((r) => server.listen(8099, r));

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext({ acceptDownloads: true });
const page = await ctx.newPage();
const errores = [];
page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
page.on('pageerror', (e) => errores.push('PAGEERROR: ' + e.message));

await page.goto('http://localhost:8099/', { waitUntil: 'networkidle' });

const zip = process.argv[2];
await page.setInputFiles('#file-input', zip);
await page.waitForSelector('#panel:not([hidden])');
const n = await page.locator('.fila').count();
console.log('Archivos detectados en el ZIP:', n);

const [download] = await Promise.all([
  page.waitForEvent('download', { timeout: 120000 }),
  page.click('#btn-convertir'),
]);
const out = process.argv[3] || '/tmp/e2e.xlsx';
await download.saveAs(out);
console.log('Descarga:', download.suggestedFilename(), '->', out);

await page.waitForSelector('#resumen:not([hidden])');
console.log('Resumen:', (await page.locator('#resumen').innerText()).replace(/\n/g, ' | '));
console.log('OK:', await page.locator('.fila.ok').count(), 'Errores:', await page.locator('.fila.error').count());
await page.screenshot({ path: process.argv[4] || '/tmp/e2e.png', fullPage: true });

if (errores.length) console.log('CONSOLA:', errores.join('\n'));
await browser.close();
server.close();
