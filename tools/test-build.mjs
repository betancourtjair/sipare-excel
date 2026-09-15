import fs from 'node:fs';
import path from 'node:path';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import ExcelJS from 'exceljs';
import { parsePdf, sheetNameFromFile } from '../js/sipare-parser.js';
import { construirLibro, nombreUnico } from '../js/excel-builder.js';

const dir = process.argv[2];
const out = process.argv[3] || 'salida.xlsx';
const files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.pdf')).sort();
const hojas = [];
const usados = new Set();
for (const f of files) {
  const data = new Uint8Array(fs.readFileSync(path.join(dir, f)));
  const res = await parsePdf(data, pdfjs, { archivo: f });
  res.forEach((r, i) => {
    const base = sheetNameFromFile(f, r) + (res.length > 1 ? ` p${i + 1}` : '');
    hojas.push({ nombre: nombreUnico(base, usados), datos: r });
  });
}
const buf = await construirLibro(hojas, ExcelJS, { resumen: true });
fs.writeFileSync(out, Buffer.from(buf));
console.log('OK ->', out, hojas.length, 'hojas');
