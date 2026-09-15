/**
 * sipare-parser.js
 * Extrae los datos de una "Línea de pago SIPARE" (formato IMSS SPR-05)
 * a partir del texto posicionado de un PDF.
 *
 * Funciona en el navegador (pdf.js) y en Node (pdfjs-dist/legacy).
 * No depende de red ni de servidor: todo el análisis es local.
 */

/* ------------------------------------------------------------------ */
/* Esquema de conceptos (orden fijo del formato SPR-05)                */
/* ------------------------------------------------------------------ */

// tipo: 'dato' = fila con importes | 'sub' = subtotal | 'total' = total a pagar
export const SCHEMA = [
  { cat: 'IMSS', label: 'ENFERMEDADES Y MATERNIDAD - CUOTA FIJA', pdf: ['- CUOTA FIJA', 'CUOTA FIJA'], tipo: 'dato' },
  { cat: 'IMSS', label: 'ENFERMEDADES Y MATERNIDAD - EXCEDENTE CUOTA', pdf: ['- EXCEDENTE - CUOTA', '- EXCEDENTE'], tipo: 'dato' },
  { cat: 'IMSS', label: 'ENFERMEDADES Y MATERNIDAD - PRESTACIONES EN DINERO', pdf: ['- PRESTACIONES EN DINERO'], tipo: 'dato' },
  { cat: 'IMSS', label: 'GASTOS MÉDICOS PENSIONADOS ART. 25', pdf: ['- GASTOS MEDICOS PENSIONADOS ART. 25', 'GASTOS MEDICOS PENSIONADOS ART. 25'], tipo: 'dato' },
  { cat: 'IMSS', label: 'RIESGOS DE TRABAJO', pdf: ['RIESGOS DE TRABAJO'], tipo: 'dato' },
  { cat: 'IMSS', label: 'INVALIDEZ Y VIDA', pdf: ['INVALIDEZ Y VIDA'], tipo: 'dato' },
  { cat: 'IMSS', label: 'GUARDERÍAS Y PRESTACIONES SOCIALES', pdf: ['GUARDERIAS Y PRESTACIONES SOCIALES'], tipo: 'dato' },
  { cat: 'IMSS', label: 'SUB TOTAL', pdf: ['SUB TOTAL'], tipo: 'sub', sum: [0, 6] },
  { cat: 'IMSS', label: 'ACTUALIZACIÓN', pdf: ['ACTUALIZACION'], tipo: 'dato' },
  { cat: 'IMSS', label: 'RECARGOS', pdf: ['RECARGOS'], tipo: 'dato' },
  { cat: 'IMSS', label: 'MULTA IMSS', pdf: ['MULTA IMSS'], tipo: 'dato' },
  { cat: 'IMSS', label: 'ACTUALIZACIÓN MULTA IMSS', pdf: ['ACTUALIZACION MULTA IMSS'], tipo: 'dato' },
  { cat: 'IMSS', label: 'MULTA RCV', pdf: ['MULTA RCV'], tipo: 'dato' },
  { cat: 'IMSS', label: 'ACTUALIZACIÓN MULTA RCV', pdf: ['ACTUALIZACION MULTA RCV'], tipo: 'dato' },
  { cat: 'IMSS', label: 'OTROS INGRESOS', pdf: ['OTROS INGRESOS'], tipo: 'dato' },
  { cat: 'IMSS', label: 'GASTOS DE EJECUCIÓN', pdf: ['GASTOS DE EJECUCION'], tipo: 'dato' },
  { cat: 'IMSS', label: 'SUBTOTAL SEGUROS IMSS', pdf: ['SUBTOTAL SEGUROS IMSS'], tipo: 'sub', sum: [7, 15] },

  { cat: 'RCV', label: 'RETIRO', pdf: ['RETIRO'], tipo: 'dato' },
  { cat: 'RCV', label: 'CESANTÍA EN EDAD AVANZADA Y VEJEZ', pdf: ['CESANTIA EN EDAD AVANZADA Y VEJEZ'], tipo: 'dato' },
  { cat: 'RCV', label: 'SUB TOTAL', pdf: ['SUB TOTAL'], tipo: 'sub', sum: [17, 18] },
  { cat: 'RCV', label: 'ACTUALIZACIÓN', pdf: ['ACTUALIZACION'], tipo: 'dato' },
  { cat: 'RCV', label: 'RECARGOS', pdf: ['RECARGOS'], tipo: 'dato' },
  { cat: 'RCV', label: 'APORTACIONES VOLUNTARIAS', pdf: ['APORTACIONES VOLUNTARIAS'], tipo: 'dato' },
  { cat: 'RCV', label: 'APORTACIONES COMPLEMENTARIAS', pdf: ['APORTACIONES COMPLEMENTARIAS'], tipo: 'dato' },
  { cat: 'RCV', label: 'SUBTOTAL RCV', pdf: ['SUBTOTAL RCV'], tipo: 'sub', sum: [19, 23] },

  { cat: 'VIVIENDA', label: 'APORTACIÓN PATRONAL SIN CRÉDITO', pdf: ['APORTACION PATRONAL SIN CREDITO'], tipo: 'dato' },
  { cat: 'VIVIENDA', label: 'APORTACIÓN PATRONAL CON CRÉDITO', pdf: ['APORTACION PATRONAL CON CREDITO'], tipo: 'dato' },
  { cat: 'VIVIENDA', label: 'AMORTIZACIÓN', pdf: ['AMORTIZACION'], tipo: 'dato' },
  { cat: 'VIVIENDA', label: 'SUB TOTAL', pdf: ['SUB TOTAL'], tipo: 'sub', sum: [25, 27] },
  { cat: 'VIVIENDA', label: 'ACTUALIZACIÓN DE APORTACIONES Y AMORTIZACIONES', pdf: ['ACTUALIZACION DE APORTACIONES Y AMORTIZACIONES'], tipo: 'dato' },
  { cat: 'VIVIENDA', label: 'RECARGOS DE APORTACIONES Y AMORTIZACIONES', pdf: ['RECARGOS DE APORTACIONES Y AMORTIZACIONES'], tipo: 'dato' },
  { cat: 'VIVIENDA', label: 'MULTA', pdf: ['MULTA'], tipo: 'dato' },
  { cat: 'VIVIENDA', label: 'DONATIVO FUNDEMEX', pdf: ['DONATIVO FUNDEMEX'], tipo: 'dato' },
  { cat: 'VIVIENDA', label: 'SUBTOTAL VIVIENDA Y ACV', pdf: ['SUBTOTAL VIVIENDA Y ACV'], tipo: 'sub', sum: [28, 32] },

  { cat: 'TOTAL', label: 'TOTAL A PAGAR', pdf: ['TOTAL A PAGAR'], tipo: 'total' },
];

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */

const norm = (s) =>
  (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

const RE_MONEY = /^-?\$?\s*-?[\d,]+(\.\d+)?$/;
const RE_DATE_LONG = /^\d{2}\/\d{2}\/\d{4}$/;
const RE_DATE_SHORT = /^\d{2}\/\d{2}\/\d{2}$/;
const RE_PERIODO = /^\d{2}-\d{4}$/;
const RE_LINEA_CAPTURA = /^[A-Z0-9]{4,}(-[A-Z0-9]+){4,}$/;

function toNumber(txt) {
  if (txt == null) return null;
  const t = String(txt).replace(/\$/g, '').replace(/,/g, '').replace(/\s/g, '');
  if (t === '' ) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Agrupa items de texto en renglones por coordenada vertical. */
function buildLines(items, tol = 3) {
  const lines = [];
  const sorted = [...items].sort((a, b) => a.top - b.top || a.x - b.x);
  for (const it of sorted) {
    let line = lines.find((l) => Math.abs(l.top - it.top) < tol);
    if (!line) {
      line = { top: it.top, items: [] };
      lines.push(line);
    }
    line.items.push(it);
  }
  for (const l of lines) {
    l.items.sort((a, b) => a.x - b.x);
    l.text = l.items.map((i) => i.str).join(' ').replace(/\s+/g, ' ').trim();
  }
  lines.sort((a, b) => a.top - b.top);
  return lines;
}

/** Quita items repetidos en la misma coordenada x (artefacto de algunos PDFs). */
function dedupe(items) {
  const out = [];
  for (const it of items) {
    if (out.some((o) => Math.abs(o.x - it.x) < 2 && o.str === it.str)) continue;
    out.push(it);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Extracción de items de texto con pdf.js                             */
/* ------------------------------------------------------------------ */

/**
 * @param {Uint8Array|ArrayBuffer} data  contenido del PDF
 * @param {object} pdfjsLib              módulo pdf.js ya configurado
 * @returns {Promise<Array<{items:Array, width:number, height:number}>>}
 */
export async function extractPages(data, pdfjsLib, opts = {}) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const params = {
    data: bytes,
    isEvalSupported: false,
    useSystemFonts: false,
    verbosity: 0,
  };
  if (opts.standardFontDataUrl) params.standardFontDataUrl = opts.standardFontDataUrl;
  if (opts.cMapUrl) { params.cMapUrl = opts.cMapUrl; params.cMapPacked = true; }
  const doc = await pdfjsLib.getDocument(params).promise;

  const pages = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const vp = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();
    const items = [];
    for (const it of tc.items) {
      if (!it.str || !it.str.trim()) continue;
      const t = it.transform;
      const rotated = Math.abs(t[1]) > 0.01 || Math.abs(t[2]) > 0.01;
      if (rotated) continue; // etiquetas verticales del formato
      items.push({
        x: t[4],
        top: vp.height - t[5],
        str: it.str.replace(/\s+/g, ' ').trim(),
        w: it.width || 0,
      });
    }
    pages.push({ items, width: vp.width, height: vp.height });
    page.cleanup();
  }
  await doc.destroy();
  return pages;
}

/* ------------------------------------------------------------------ */
/* Parser de una página                                                */
/* ------------------------------------------------------------------ */

/** Columnas de importes, por coordenada x (el formato es de ancho fijo). */
const COL_LABEL_MAX = 300;
const COL1 = [300, 400]; // cuotas patronales / aportaciones patronales
const COL2 = [400, 500]; // cuotas obreras / amortización de crédito
const COL3 = [500, 620]; // suma total

function colOf(x) {
  if (x >= COL1[0] && x < COL1[1]) return 0;
  if (x >= COL2[0] && x < COL2[1]) return 1;
  if (x >= COL3[0] && x < COL3[1]) return 2;
  return -1;
}

function valuesOfLine(line) {
  const cols = [[], [], []];
  for (const it of dedupe(line.items)) {
    const c = colOf(it.x);
    if (c < 0) continue;
    cols[c].push(it.str);
  }
  return cols.map((parts) => {
    const txt = parts.join(' ').replace(/\s+/g, ' ').trim();
    if (!txt) return null;
    if (/NO\s*APLICA/i.test(txt)) return 'NO APLICA';
    return toNumber(txt);
  });
}

function labelOfLine(line) {
  return line.items
    .filter((i) => i.x < COL_LABEL_MAX)
    .map((i) => i.str)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Convierte una página en un objeto estructurado.
 * @returns {object} datos de la línea de pago
 */
export function parsePage(page, meta = {}) {
  const lines = buildLines(page.items);
  const warnings = [];
  const find = (re, from = 0) => lines.findIndex((l, i) => i >= from && re.test(norm(l.text)));

  /* ---------- Delegación / Subdelegación ---------- */
  const readDeleg = (word) => {
    for (const l of lines) {
      const idx = l.items.findIndex((i) => norm(i.str) === word);
      if (idx === -1) continue;
      const rest = l.items.slice(idx + 1).filter((i) => i.x > 250 && i.x < 470);
      if (!rest.length) continue;
      const clave = rest[0].str.trim();
      const nombre = rest.slice(1).map((i) => i.str).join(' ').trim();
      return { clave, nombre, texto: nombre ? `${clave} · ${nombre}` : clave };
    }
    return { clave: '', nombre: '', texto: '' };
  };
  const delegacion = readDeleg('DELEGACION');
  const subdelegacion = readDeleg('SUBDELEGACION');

  /* ---------- Bloque del patrón ---------- */
  const iReg = find(/REGISTRO PATRONAL/);
  const iCP = find(/^C\.?P\.?\s/);

  const leftLines = (from, to) =>
    lines
      .filter((l, i) => i > from && i < to && l.items.some((it) => it.x < COL_LABEL_MAX))
      .map((l) => ({
        i: lines.indexOf(l),
        text: l.items.filter((it) => it.x < COL_LABEL_MAX).map((it) => it.str).join(' ').replace(/\s+/g, ' ').trim(),
      }))
      .filter((l) => l.text);

  // Razón social: renglones de la izquierda entre el encabezado y "REGISTRO PATRONAL"
  const iHeaderEnd = Math.max(
    find(/FORMATO PARA PAGO DE CUOTAS/),
    find(/^DELEGACION\b/),
    find(/^SUBDELEGACION\b/)
  );
  const razonLines = leftLines(iHeaderEnd, iReg === -1 ? 6 : iReg)
    .map((l) => l.text)
    .filter((t) => !/^(DELEGACION|SUBDELEGACION|P[ÁA]GINA)\b/.test(norm(t)));
  const razonSocial = razonLines.join(' ').trim();
  if (!razonSocial) warnings.push('No se encontró la razón social.');

  // Registro patronal y RFC
  let registroPatronal = '';
  let rfc = '';
  if (iReg !== -1) {
    const its = lines[iReg].items;
    const ri = its.findIndex((i) => /REGISTRO PATRONAL/.test(norm(i.str)));
    const fi = its.findIndex((i) => /^RFC/.test(norm(i.str)));
    const grab = (start) => {
      const parts = [];
      for (let k = start + 1; k < its.length; k++) {
        if (its[k].x >= COL_LABEL_MAX) break;
        if (/^RFC/.test(norm(its[k].str))) break;
        parts.push(its[k].str);
      }
      return parts.join(' ').trim();
    };
    const inlineReg = /REGISTRO PATRONAL:?\s*(\S+)/.exec(lines[iReg].text);
    registroPatronal = ri !== -1 ? grab(ri) : inlineReg ? inlineReg[1] : '';
    const inlineRfc = /RFC:?\s*([A-Z0-9-]+)/.exec(norm(lines[iReg].text));
    rfc = fi !== -1 ? grab(fi) : inlineRfc ? inlineRfc[1] : '';
    registroPatronal = registroPatronal.replace(/^:/, '').trim();
    rfc = rfc.replace(/^:/, '').trim();
  }

  // Domicilio y municipio/estado: renglones entre "REGISTRO PATRONAL" y "C.P."
  let domicilio = '';
  let municipioEstado = '';
  if (iReg !== -1 && iCP !== -1) {
    const dom = leftLines(iReg, iCP).map((l) => l.text);
    if (dom.length >= 2) {
      municipioEstado = dom[dom.length - 1];
      domicilio = dom.slice(0, -1).join(' ');
    } else if (dom.length === 1) {
      domicilio = dom[0];
    }
  }

  // C.P. / municipio clave
  let cp = null;
  let mpio = '';
  if (iCP !== -1) {
    const m = /C\.?P\.?\s*(\d+)/.exec(lines[iCP].text);
    if (m) cp = toNumber(m[1]);
    const mm = /MPIO\.?\s*(\S+)/.exec(lines[iCP].text);
    if (mm) mpio = mm[1];
  }

  // Actividad: primer renglón izquierdo después del C.P.
  let actividad = '';
  if (iCP !== -1) {
    const after = leftLines(iCP, iCP + 4);
    if (after.length) actividad = after[0].text;
  }

  /* ---------- Períodos, folio, clave ---------- */
  const topOf = (l) => l.top;
  const periodos = [];
  for (const l of lines) {
    if (topOf(l) > 200) break;
    for (const it of l.items) {
      if (it.x > 330 && RE_PERIODO.test(it.str.trim())) periodos.push(it);
    }
  }
  periodos.sort((a, b) => a.x - b.x);
  const periodoIMSS = periodos[0] ? periodos[0].str.trim() : '';
  const bimestreRCV = periodos[1] ? periodos[1].str.trim() : '';

  let folioSUA = null;
  let claveRecepcion = null;
  for (const l of lines) {
    if (topOf(l) > 200) break;
    for (const it of l.items) {
      if (!/^\d{4,}$/.test(it.str.trim())) continue;
      if (it.x >= 350 && it.x < 460 && folioSUA == null) folioSUA = toNumber(it.str);
      else if (it.x >= 460 && it.x < 580 && claveRecepcion == null) claveRecepcion = toNumber(it.str);
    }
  }

  // Tipo de cédula (LC-1, LC-2, ...)
  let tipoCedula = '';
  for (const l of lines) {
    if (topOf(l) > 230) break;
    const hit = l.items.find((i) => /^LC-\d+$/i.test(i.str.trim()));
    if (hit) { tipoCedula = hit.str.trim().toUpperCase(); break; }
  }

  /* ---------- Datos generales de la propuesta ---------- */
  let fechaLimite = '';
  let smgdf = null;
  let fechaSalMin = '';
  let valorUMA = null;
  let cotizantes = null;
  let diasCotizar = null;
  let acreditados = null;

  for (const l of lines) {
    if (topOf(l) > 240) break;
    const items = l.items;
    for (let k = 0; k < items.length; k++) {
      const s = items[k].str.trim();
      if (!fechaLimite && RE_DATE_LONG.test(s) && items[k].x < 260) fechaLimite = s;
      if (!fechaSalMin && RE_DATE_SHORT.test(s)) fechaSalMin = s;
      if (smgdf == null && RE_MONEY.test(s) && items[k].x >= 235 && items[k].x < 300 && s.includes('.')) {
        smgdf = toNumber(s);
      }
      if (/^VALOR UMA$/.test(norm(s)) && items[k + 1]) valorUMA = toNumber(items[k + 1].str);
    }
    const nt = norm(l.text);
    const tail = items.filter((i) => i.x > 500).map((i) => i.str).join('');
    if (/NO\. DE COTIZANTES/.test(nt) && cotizantes == null) cotizantes = toNumber(tail);
    if (/NO\. DE DIAS A COTIZAR/.test(nt) && diasCotizar == null) diasCotizar = toNumber(tail);
    if (/NO\. DE ACREDITADOS/.test(nt) && acreditados == null) acreditados = toNumber(tail);
  }

  /* ---------- Tabla de conceptos ---------- */
  const iConceptos = find(/^CONCEPTOS\b/);
  const iFin = find(/LINEA DE CAPTURA/);
  const tabla = lines.slice(
    iConceptos === -1 ? 0 : iConceptos + 1,
    iFin === -1 ? lines.length : iFin
  );

  const filas = SCHEMA.map((s) => ({
    categoria: s.cat,
    concepto: s.label,
    tipo: s.tipo,
    sum: s.sum,
    patronal: null,
    obrera: null,
    total: null,
    encontrado: false,
  }));

  let ptr = 0;
  for (const line of tabla) {
    const vals = valuesOfLine(line);
    if (vals.every((v) => v === null)) continue; // renglón de encabezado sin importes
    const lab = norm(labelOfLine(line));
    if (!lab) continue;

    // busca la siguiente entrada del esquema cuya etiqueta coincida
    let hit = -1;
    for (let k = ptr; k < SCHEMA.length; k++) {
      if (SCHEMA[k].pdf.some((p) => norm(p) === lab)) { hit = k; break; }
    }
    if (hit === -1) {
      for (let k = ptr; k < SCHEMA.length; k++) {
        if (SCHEMA[k].pdf.some((p) => lab.startsWith(norm(p)) || norm(p).startsWith(lab))) { hit = k; break; }
      }
    }
    if (hit === -1) {
      warnings.push(`Concepto no reconocido: "${labelOfLine(line)}"`);
      continue;
    }
    filas[hit].patronal = vals[0];
    filas[hit].obrera = vals[1];
    filas[hit].total = vals[2];
    filas[hit].encontrado = true;
    ptr = hit + 1;
  }

  const faltantes = filas.filter((f) => !f.encontrado).map((f) => f.concepto);
  if (faltantes.length) warnings.push(`Conceptos sin datos en el PDF: ${faltantes.join(', ')}`);

  /* ---------- Línea de captura ---------- */
  let lineaCaptura = '';
  const start = iFin === -1 ? 0 : iFin;
  for (let i = start; i < lines.length; i++) {
    for (const it of lines[i].items) {
      const s = it.str.trim().replace(/\s+/g, '');
      if (RE_LINEA_CAPTURA.test(s) && s.length > 30) { lineaCaptura = s; break; }
    }
    if (lineaCaptura) break;
  }
  if (!lineaCaptura) warnings.push('No se encontró la línea de captura.');

  /* ---------- Paginación ---------- */
  let pagina = '';
  for (const l of lines.slice(0, 12)) {
    const m = /P[ÁA]GINA\s+(\d+)\s+DE\s+(\d+)/.exec(norm(l.text));
    if (m) { pagina = `Página ${m[1]} de ${m[2]}`; break; }
  }

  const totalRow = filas[filas.length - 1];

  return {
    archivo: meta.archivo || '',
    pagina,
    razonSocial,
    registroPatronal,
    rfc,
    domicilio,
    municipioEstado,
    cp,
    mpio,
    actividad,
    delegacion: delegacion.texto,
    subdelegacion: subdelegacion.texto,
    periodoIMSS,
    bimestreRCV,
    folioSUA,
    claveRecepcion,
    tipoCedula,
    fechaLimite,
    smgdf,
    fechaSalMin,
    valorUMA,
    cotizantes,
    diasCotizar,
    acreditados,
    filas,
    lineaCaptura,
    totalAPagar: totalRow ? totalRow.total : null,
    warnings,
  };
}

/**
 * Procesa un PDF completo (todas sus páginas que sean línea de pago).
 */
export async function parsePdf(data, pdfjsLib, meta = {}) {
  const pages = await extractPages(data, pdfjsLib, meta);
  const out = [];
  pages.forEach((p, idx) => {
    const lines = buildLines(p.items);
    const esLinea = lines.some((l) => /FORMATO PARA PAGO DE CUOTAS/.test(norm(l.text)));
    if (!esLinea) return;
    out.push(parsePage(p, { ...meta, indicePagina: idx + 1 }));
  });
  if (!out.length) {
    throw new Error('El PDF no parece ser una línea de pago SIPARE (formato SPR-05).');
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Nombre de hoja                                                      */
/* ------------------------------------------------------------------ */

const INVALID_SHEET = /[\\\/\?\*\[\]:]/g;

/**
 * Deriva el nombre de la hoja desde el nombre del archivo, p. ej.
 * "Linea de pago agosto. 2026_CHO_Puebla_$157,506.34.pdf" -> "CHO Puebla"
 */
export function sheetNameFromFile(fileName, datos) {
  const base = fileName.replace(/\.pdf$/i, '');
  const partes = base.split('_').map((p) => p.trim()).filter(Boolean);
  // descarta el primer segmento (descripción/periodo) y cualquier importe
  const utiles = partes.slice(1).filter((p) => !/^\$/.test(p) && !/^[\d,.]+$/.test(p));
  let nombre = utiles.join(' ').trim();
  if (!nombre && datos) {
    nombre = (datos.registroPatronal || datos.razonSocial || 'Hoja').slice(0, 25);
  }
  nombre = nombre.replace(INVALID_SHEET, '-').replace(/\s+/g, ' ').trim();
  return nombre.slice(0, 31) || 'Hoja';
}

export { norm, buildLines, toNumber };
