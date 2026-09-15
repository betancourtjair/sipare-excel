import fs from 'node:fs';
import path from 'node:path';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { parsePdf, sheetNameFromFile } from '../js/sipare-parser.js';

const dir = process.argv[2];
const files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.pdf')).sort();
const all = [];
for (const f of files) {
  const data = new Uint8Array(fs.readFileSync(path.join(dir, f)));
  try {
    const res = await parsePdf(data, pdfjs, { archivo: f });
    for (const r of res) {
      all.push({ hoja: sheetNameFromFile(f, r), ...r });
    }
  } catch (e) {
    console.error('ERROR', f, e.message);
  }
}
fs.writeFileSync(process.argv[3] || 'parsed.json', JSON.stringify(all, null, 2));
for (const r of all) {
  console.log('='.repeat(70));
  console.log(r.hoja, '|', r.archivo);
  console.log('  razon:', r.razonSocial);
  console.log('  rp:', r.registroPatronal, '| rfc:', r.rfc, '| cedula:', r.tipoCedula);
  console.log('  dom:', r.domicilio, '|| mpio/edo:', r.municipioEstado, '| cp:', r.cp, '| act:', r.actividad);
  console.log('  deleg:', r.delegacion, '| subdeleg:', r.subdelegacion);
  console.log('  per:', r.periodoIMSS, '| bim:', r.bimestreRCV, '| folio:', r.folioSUA, '| clave:', r.claveRecepcion);
  console.log('  flim:', r.fechaLimite, '| smgdf:', r.smgdf, '| salmin:', r.fechaSalMin, '| uma:', r.valorUMA);
  console.log('  cot:', r.cotizantes, '| dias:', r.diasCotizar, '| acred:', r.acreditados);
  console.log('  total:', r.totalAPagar, '| lc:', r.lineaCaptura, '|', r.pagina);
  if (r.warnings.length) console.log('  !! ', r.warnings.join(' | '));
  // verifica consistencia aritmética
  const f = r.filas;
  const chk = [];
  const near = (a, b) => a == null || b == null || Math.abs(a - b) < 0.02;
  const sumr = (from, to, key) => f.slice(from, to + 1).reduce((s, x) => s + (typeof x[key] === 'number' ? x[key] : 0), 0);
  for (const row of f) {
    if (row.sum) {
      for (const key of ['patronal', 'obrera']) {
        const got = row[key];
        if (typeof got === 'number' && !near(got, sumr(row.sum[0], row.sum[1], key))) {
          chk.push(`${row.categoria}/${row.concepto}/${key}: ${got} vs ${sumr(row.sum[0], row.sum[1], key).toFixed(2)}`);
        }
      }
    }
    const p = typeof row.patronal === 'number' ? row.patronal : 0;
    const o = typeof row.obrera === 'number' ? row.obrera : 0;
    if (typeof row.total === 'number' && !near(row.total, p + o)) {
      chk.push(`${row.concepto}: total ${row.total} vs ${(p + o).toFixed(2)}`);
    }
  }
  const ii = f.findIndex((x) => x.concepto === 'SUBTOTAL SEGUROS IMSS');
  const ri = f.findIndex((x) => x.concepto === 'SUBTOTAL RCV');
  const vi = f.findIndex((x) => x.concepto === 'SUBTOTAL VIVIENDA Y ACV');
  const ti = f.length - 1;
  for (const key of ['patronal', 'obrera', 'total']) {
    const exp = ['patronal', 'obrera', 'total'].includes(key)
      ? [ii, ri, vi].reduce((s, i) => s + (typeof f[i][key] === 'number' ? f[i][key] : 0), 0)
      : 0;
    if (typeof f[ti][key] === 'number' && !near(f[ti][key], exp)) {
      chk.push(`TOTAL/${key}: ${f[ti][key]} vs ${exp.toFixed(2)}`);
    }
  }
  if (chk.length) console.log('  ARITMÉTICA:', chk.join(' | '));
}
console.log('\nTotal hojas:', all.length);
