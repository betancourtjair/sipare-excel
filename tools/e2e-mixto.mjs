import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  res.end(fs.readFileSync(f));
});
await new Promise((r) => server.listen(8100, r));

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext({ acceptDownloads: true });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
await page.goto('http://localhost:8100/', { waitUntil: 'networkidle' });

// PDF suelto válido + PDF que no es SIPARE + un .txt que debe rechazarse
await page.setInputFiles('#file-input', process.argv.slice(2));
await page.waitForSelector('#panel:not([hidden])');
console.log('Filas:', await page.locator('.fila').count());

const [dl] = await Promise.all([
  page.waitForEvent('download', { timeout: 60000 }),
  page.click('#btn-convertir'),
]);
await dl.saveAs('/tmp/mixto.xlsx');
await page.waitForSelector('#resumen:not([hidden])');
console.log('OK:', await page.locator('.fila.ok').count(), '| Errores:', await page.locator('.fila.error').count());
console.log('Detalle error:', await page.locator('.fila.error .detalle').first().innerText().catch(() => '—'));
console.log('Resumen:', (await page.locator('#resumen').innerText()).replace(/\n/g, ' | '));
console.log('Toasts:', await page.locator('.toast').allInnerTexts());
await page.screenshot({ path: '/tmp/mixto.png', fullPage: true });
if (errs.length) console.log('ERRORES JS:', errs);
await browser.close();
server.close();
