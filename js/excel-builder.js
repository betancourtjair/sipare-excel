/**
 * excel-builder.js
 * Construye el libro de Excel a partir de los datos extraídos,
 * replicando el formato de "Hojas SIPARE.xlsx".
 */

const FONT = 'Aptos Narrow';

const C = {
  azulOscuro: 'FF17365D',
  azulMedio: 'FF2F75B5',
  azulClaro: 'FFEAF2F8',
  azulSubtotal: 'FFD9EAF7',
  amarillo: 'FFFFF2CC',
  gris: 'FF666666',
  etiqueta: 'FF44546A',
  blanco: 'FFFFFFFF',
};

const MONEDA = '"$"#,##0.00';
const ENTERO = '#,##0';
const FECHA = 'dd/mm/yyyy';
const MES = 'mmm-yy';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const fill = (color) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: color } });
const thin = { style: 'thin', color: { argb: 'FFBFBFBF' } };

/** "08-2026" -> Date(2026, 7, 1) */
function periodoADate(p) {
  const m = /^(\d{2})-(\d{4})$/.exec(p || '');
  if (!m) return p || '';
  return new Date(Number(m[2]), Number(m[1]) - 1, 1);
}

/** "17/09/2026" o "01/01/26" -> Date */
function fechaADate(f) {
  let m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(f || '');
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  m = /^(\d{2})\/(\d{2})\/(\d{2})$/.exec(f || '');
  if (m) return new Date(2000 + Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return f || '';
}

function tituloPeriodo(p) {
  const m = /^(\d{2})-(\d{4})$/.exec(p || '');
  if (!m) return 'LÍNEA DE PAGO IMSS';
  return `LÍNEA DE PAGO IMSS · ${MESES[Number(m[1]) - 1].toUpperCase()} ${m[2]}`;
}

const num = (v) => (typeof v === 'number' ? v : 0);

/* ------------------------------------------------------------------ */

function seccion(ws, row, texto) {
  ws.mergeCells(`A${row}:E${row}`);
  const c = ws.getCell(`A${row}`);
  c.value = texto;
  c.font = { name: FONT, size: 11, bold: true, color: { argb: C.blanco } };
  c.fill = fill(C.azulMedio);
  c.alignment = { horizontal: 'left', vertical: 'middle' };
}

function par(ws, row, colEtiqueta, colValor, etiqueta, valor, numFmt) {
  const e = ws.getCell(`${colEtiqueta}${row}`);
  e.value = etiqueta;
  e.font = { name: FONT, size: 11, bold: true, color: { argb: C.etiqueta } };
  e.fill = fill(C.azulClaro);
  e.alignment = { vertical: 'middle' };

  const v = ws.getCell(`${colValor}${row}`);
  v.value = valor === null || valor === undefined ? '' : valor;
  v.font = { name: FONT, size: 11 };
  v.alignment = { vertical: 'middle' };
  if (numFmt) v.numFmt = numFmt;
}

/**
 * Escribe una hoja con los datos de una línea de pago.
 * @param {import('exceljs').Worksheet} ws
 * @param {object} d  resultado de parsePage
 */
export function escribirHoja(ws, d) {
  ws.columns = [
    { width: 18.14 }, { width: 38.14 }, { width: 21.86 }, { width: 23.86 }, { width: 21.86 },
  ];

  /* --- Título --- */
  ws.mergeCells('A1:E1');
  const t = ws.getCell('A1');
  t.value = tituloPeriodo(d.periodoIMSS);
  t.font = { name: FONT, size: 18, bold: true, color: { argb: C.blanco } };
  t.fill = fill(C.azulOscuro);
  t.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 24;

  ws.mergeCells('A2:E2');
  const s = ws.getCell('A2');
  s.value = 'Formato para pago de cuotas obrero patronales, aportaciones y amortizaciones';
  s.font = { name: FONT, size: 10, color: { argb: C.gris } };
  s.alignment = { horizontal: 'center' };

  /* --- Datos del patrón --- */
  seccion(ws, 4, 'DATOS DEL PATRÓN');
  par(ws, 5, 'A', 'B', 'Razón social', d.razonSocial);
  ws.mergeCells('B5:E5');
  par(ws, 6, 'A', 'B', 'Registro patronal', d.registroPatronal);
  par(ws, 6, 'D', 'E', 'RFC', d.rfc);
  par(ws, 7, 'A', 'B', 'Domicilio', d.domicilio);
  par(ws, 7, 'D', 'E', 'Municipio / Estado', d.municipioEstado);
  par(ws, 8, 'A', 'B', 'Código postal', d.cp, ENTERO);
  par(ws, 8, 'D', 'E', 'Actividad', d.actividad);

  /* --- Datos del pago --- */
  seccion(ws, 10, 'DATOS DEL PAGO');
  par(ws, 11, 'A', 'B', 'Período seguros IMSS', periodoADate(d.periodoIMSS), MES);
  par(ws, 11, 'D', 'E', 'Bimestre RCV e INFONAVIT', periodoADate(d.bimestreRCV), MES);
  par(ws, 12, 'A', 'B', 'Delegación', d.delegacion);
  par(ws, 12, 'D', 'E', 'Subdelegación', d.subdelegacion);
  par(ws, 13, 'A', 'B', 'Folio SUA', d.folioSUA, '0');
  par(ws, 13, 'D', 'E', 'Clave recepción archivo', d.claveRecepcion, '0');
  par(ws, 14, 'A', 'B', 'Fecha límite de pago', fechaADate(d.fechaLimite), FECHA);
  par(ws, 14, 'D', 'E', 'No. de cotizantes', d.cotizantes, ENTERO);
  par(ws, 15, 'A', 'B', 'No. de días a cotizar', d.diasCotizar, ENTERO);
  par(ws, 15, 'D', 'E', 'No. de acreditados', d.acreditados, ENTERO);
  par(ws, 16, 'A', 'B', 'S.M.G.D.F.', d.smgdf, MONEDA);
  par(ws, 16, 'D', 'E', 'Fecha salario mínimo', fechaADate(d.fechaSalMin), FECHA);
  par(ws, 17, 'A', 'B', 'Valor UMA', d.valorUMA, MONEDA);
  par(ws, 17, 'D', 'E', 'Tipo de cédula', d.tipoCedula);

  /* --- Tabla de conceptos --- */
  seccion(ws, 19, 'INFORMACIÓN DETALLADA DEL IMPORTE TOTAL DE CUOTAS');

  const enc = ['Categoría', 'Concepto', 'Cuotas patronales / aportaciones',
    'Cuotas obreras / amortización', 'Suma total'];
  enc.forEach((txt, i) => {
    const c = ws.getCell(20, i + 1);
    c.value = txt;
    c.font = { name: FONT, size: 11, bold: true, color: { argb: C.blanco } };
    c.fill = fill(C.azulOscuro);
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  ws.getRow(20).height = 30;

  const R0 = 21;
  d.filas.forEach((f, i) => {
    const r = R0 + i;
    const esSub = f.tipo === 'sub';
    const esTotal = f.tipo === 'total';
    const size = esTotal ? 12 : 11;
    const bold = esSub || esTotal;

    const a = ws.getCell(`A${r}`);
    a.value = f.categoria;
    const b = ws.getCell(`B${r}`);
    b.value = f.concepto;
    b.alignment = { vertical: 'middle', wrapText: true };

    const escribeImporte = (col, valor) => {
      const c = ws.getCell(`${col}${r}`);
      if (valor === 'NO APLICA') {
        c.value = 'NO APLICA';
        c.alignment = { horizontal: 'right', vertical: 'middle' };
      } else {
        c.value = typeof valor === 'number' ? valor : null;
        c.numFmt = MONEDA;
        c.alignment = { horizontal: 'right', vertical: 'middle' };
      }
      return c;
    };
    escribeImporte('C', f.patronal);
    escribeImporte('D', f.obrera);

    const e = ws.getCell(`E${r}`);
    e.value = { formula: `SUM(C${r}:D${r})`, result: num(f.patronal) + num(f.obrera) };
    e.numFmt = MONEDA;
    e.alignment = { horizontal: 'right', vertical: 'middle' };

    // fórmulas de subtotales y total
    if (f.sum) {
      const [i0, i1] = f.sum;
      for (const col of ['C', 'D']) {
        const cell = ws.getCell(`${col}${r}`);
        if (cell.value === 'NO APLICA') continue;
        const key = col === 'C' ? 'patronal' : 'obrera';
        const res = d.filas.slice(i0, i1 + 1).reduce((acc, x) => acc + num(x[key]), 0);
        cell.value = { formula: `SUM(${col}${R0 + i0}:${col}${R0 + i1})`, result: res };
        cell.numFmt = MONEDA;
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      }
    }
    if (esTotal) {
      const idx = (nombre) => d.filas.findIndex((x) => x.concepto === nombre);
      const refs = ['SUBTOTAL SEGUROS IMSS', 'SUBTOTAL RCV', 'SUBTOTAL VIVIENDA Y ACV']
        .map(idx).filter((k) => k >= 0).map((k) => R0 + k);
      for (const col of ['C', 'D']) {
        const cell = ws.getCell(`${col}${r}`);
        if (cell.value === 'NO APLICA') continue;
        const key = col === 'C' ? 'patronal' : 'obrera';
        const res = refs.reduce((acc, rr) => acc + num(d.filas[rr - R0][key]), 0);
        cell.value = { formula: refs.map((rr) => `${col}${rr}`).join('+'), result: res };
        cell.numFmt = MONEDA;
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      }
    }

    // estilos de la fila
    for (let col = 1; col <= 5; col++) {
      const c = ws.getCell(r, col);
      c.font = {
        name: FONT,
        size,
        bold,
        color: { argb: esTotal ? C.blanco : col === 1 ? C.etiqueta : 'FF000000' },
      };
      c.border = esSub
        ? { top: thin, bottom: thin }
        : { bottom: thin };
      if (esSub) c.fill = fill(C.azulSubtotal);
      if (esTotal) c.fill = fill(C.azulOscuro);
      if (!c.alignment) c.alignment = { vertical: 'middle' };
    }
    if (f.concepto.length > 44) ws.getRow(r).height = 30;
    if (esTotal) ws.getRow(r).height = 15.75;
  });

  /* --- Línea de captura --- */
  const rRef = R0 + d.filas.length + 1; // 57
  seccion(ws, rRef, 'REFERENCIA DE PAGO · LÍNEA DE CAPTURA SIPARE');

  ws.mergeCells(`A${rRef + 1}:E${rRef + 1}`);
  const lc = ws.getCell(`A${rRef + 1}`);
  lc.value = d.lineaCaptura || '(no disponible)';
  lc.font = { name: FONT, size: 12, bold: true };
  lc.fill = fill(C.amarillo);
  lc.alignment = { horizontal: 'center', vertical: 'middle' };
  lc.border = { top: thin, bottom: thin };
  ws.getRow(rRef + 1).height = 15.75;

  ws.mergeCells(`A${rRef + 3}:E${rRef + 3}`);
  const src = ws.getCell(`A${rRef + 3}`);
  src.value = `Fuente: ${d.archivo}${d.pagina ? ` · ${d.pagina}` : ''}`;
  src.font = { name: FONT, size: 9, color: { argb: C.gris } };
  src.alignment = { wrapText: true, vertical: 'middle' };
  ws.getRow(rRef + 3).height = 27.95;

  ws.views = [{ showGridLines: false }];
  ws.pageSetup = { fitToPage: true, fitToWidth: 1, fitToHeight: 0, orientation: 'portrait' };
}

/* ------------------------------------------------------------------ */
/* Hoja de resumen                                                     */
/* ------------------------------------------------------------------ */

export function escribirResumen(ws, hojas) {
  ws.columns = [
    { width: 20 }, { width: 44 }, { width: 18 }, { width: 16 },
    { width: 12 }, { width: 18 }, { width: 18 }, { width: 18 },
  ];
  ws.mergeCells('A1:H1');
  const t = ws.getCell('A1');
  t.value = 'CONCENTRADO DE LÍNEAS DE PAGO';
  t.font = { name: FONT, size: 18, bold: true, color: { argb: C.blanco } };
  t.fill = fill(C.azulOscuro);
  t.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 24;

  const enc = ['Hoja', 'Razón social', 'Registro patronal', 'RFC', 'Período',
    'Cuotas patronales', 'Cuotas obreras', 'Total a pagar'];
  enc.forEach((txt, i) => {
    const c = ws.getCell(3, i + 1);
    c.value = txt;
    c.font = { name: FONT, size: 11, bold: true, color: { argb: C.blanco } };
    c.fill = fill(C.azulOscuro);
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  ws.getRow(3).height = 30;

  hojas.forEach(({ nombre, datos }, i) => {
    const r = 4 + i;
    const total = datos.filas[datos.filas.length - 1];
    ws.getCell(r, 1).value = { text: nombre, hyperlink: `#'${nombre}'!A1` };
    ws.getCell(r, 1).font = { name: FONT, size: 11, color: { argb: 'FF0563C1' }, underline: true };
    ws.getCell(r, 2).value = datos.razonSocial;
    ws.getCell(r, 3).value = datos.registroPatronal;
    ws.getCell(r, 4).value = datos.rfc;
    ws.getCell(r, 5).value = datos.periodoIMSS;
    [['F', 'patronal'], ['G', 'obrera'], ['H', 'total']].forEach(([col, key]) => {
      const c = ws.getCell(`${col}${r}`);
      c.value = typeof total[key] === 'number' ? total[key] : null;
      c.numFmt = MONEDA;
      c.alignment = { horizontal: 'right' };
    });
    for (let col = 1; col <= 8; col++) {
      const c = ws.getCell(r, col);
      if (!c.font) c.font = { name: FONT, size: 11 };
      c.border = { bottom: thin };
    }
  });

  const rT = 4 + hojas.length;
  ws.getCell(rT, 2).value = `TOTAL (${hojas.length} líneas de pago)`;
  [['F', 'patronal'], ['G', 'obrera'], ['H', 'total']].forEach(([col, key]) => {
    const res = hojas.reduce((acc, h) => {
      const t2 = h.datos.filas[h.datos.filas.length - 1];
      return acc + (typeof t2[key] === 'number' ? t2[key] : 0);
    }, 0);
    const c = ws.getCell(`${col}${rT}`);
    c.value = { formula: `SUM(${col}4:${col}${rT - 1})`, result: res };
    c.numFmt = MONEDA;
    c.alignment = { horizontal: 'right' };
  });
  for (let col = 1; col <= 8; col++) {
    const c = ws.getCell(rT, col);
    c.font = { name: FONT, size: 12, bold: true, color: { argb: C.blanco } };
    c.fill = fill(C.azulOscuro);
    c.border = { top: thin, bottom: thin };
  }
  ws.getRow(rT).height = 15.75;
  ws.views = [{ showGridLines: false, state: 'frozen', ySplit: 3 }];
}

/* ------------------------------------------------------------------ */

/**
 * Construye el libro completo.
 * @param {Array<{nombre:string, datos:object}>} hojas
 * @param {object} ExcelJS
 * @param {{resumen?:boolean}} opciones
 * @returns {Promise<ArrayBuffer>}
 */
export async function construirLibro(hojas, ExcelJS, opciones = {}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Convertidor SIPARE → Excel';
  wb.created = new Date();

  if (opciones.resumen !== false && hojas.length > 1) {
    escribirResumen(wb.addWorksheet('Resumen'), hojas);
  }
  for (const { nombre, datos } of hojas) {
    escribirHoja(wb.addWorksheet(nombre), datos);
  }
  return wb.xlsx.writeBuffer();
}

/** Evita nombres de hoja duplicados. */
export function nombreUnico(nombre, usados) {
  let n = nombre;
  let i = 2;
  while (usados.has(n.toLowerCase())) {
    const sufijo = ` (${i++})`;
    n = nombre.slice(0, 31 - sufijo.length) + sufijo;
  }
  usados.add(n.toLowerCase());
  return n;
}
