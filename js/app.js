import * as pdfjsLib from '../vendor/pdf.min.mjs';
import { parsePdf, sheetNameFromFile } from './sipare-parser.js';
import { construirLibro, nombreUnico } from './excel-builder.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdf.worker.min.mjs', import.meta.url).href;
const STANDARD_FONTS = new URL('../vendor/standard_fonts/', import.meta.url).href;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const dropzone = $('#dropzone');
const input = $('#file-input');
const listaEl = $('#lista');
const vacioEl = $('#vacio');
const panelEl = $('#panel');
const btnConvertir = $('#btn-convertir');
const btnLimpiar = $('#btn-limpiar');
const progresoEl = $('#progreso');
const barraEl = $('#barra');
const estadoEl = $('#estado');
const resumenEl = $('#resumen');
const contadorEl = $('#contador');

/** @type {Array<{id:number, nombre:string, bytes:Uint8Array, origen:string, estado:string, error?:string, datos?:Array}>} */
let archivos = [];
let seq = 0;
let trabajando = false;

/* ------------------------------------------------------------------ */
/* Entrada de archivos                                                 */
/* ------------------------------------------------------------------ */

const esPdf = (n) => /\.pdf$/i.test(n);
const esZip = (n) => /\.zip$/i.test(n);

async function agregarArchivos(fileList) {
  // copia inmediata: el FileList del input se invalida al limpiarlo
  const entrada = Array.from(fileList);
  const nuevos = [];
  for (const file of entrada) {
    if (esZip(file.name)) {
      try {
        const zip = await window.JSZip.loadAsync(file);
        const entradas = Object.values(zip.files)
          .filter((e) => !e.dir && esPdf(e.name) && !/(^|\/)__MACOSX\//.test(e.name))
          .sort((a, b) => a.name.localeCompare(b.name, 'es'));
        if (!entradas.length) {
          toast(`El ZIP "${file.name}" no contiene PDFs.`, true);
          continue;
        }
        for (const e of entradas) {
          const bytes = await e.async('uint8array');
          nuevos.push({
            id: ++seq,
            nombre: e.name.split('/').pop(),
            bytes,
            origen: file.name,
            estado: 'pendiente',
          });
        }
      } catch (err) {
        toast(`No se pudo leer el ZIP "${file.name}": ${err.message}`, true);
      }
    } else if (esPdf(file.name)) {
      nuevos.push({
        id: ++seq,
        nombre: file.name,
        bytes: new Uint8Array(await file.arrayBuffer()),
        origen: '',
        estado: 'pendiente',
      });
    } else {
      toast(`"${file.name}" no es PDF ni ZIP; se omitió.`, true);
    }
  }

  // evita duplicados por nombre + tamaño
  for (const n of nuevos) {
    const dup = archivos.some((a) => a.nombre === n.nombre && a.bytes.length === n.bytes.length);
    if (!dup) archivos.push(n);
  }
  render();
}

dropzone.addEventListener('click', () => input.click());
dropzone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
});
input.addEventListener('change', (e) => {
  agregarArchivos(e.target.files);
  input.value = '';
});

['dragenter', 'dragover'].forEach((ev) =>
  dropzone.addEventListener(ev, (e) => {
    e.preventDefault();
    dropzone.classList.add('activo');
  })
);
['dragleave', 'drop'].forEach((ev) =>
  dropzone.addEventListener(ev, (e) => {
    e.preventDefault();
    if (ev === 'dragleave' && dropzone.contains(e.relatedTarget)) return;
    dropzone.classList.remove('activo');
  })
);
dropzone.addEventListener('drop', (e) => {
  if (e.dataTransfer?.files?.length) agregarArchivos(e.dataTransfer.files);
});

document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => e.preventDefault());

/* ------------------------------------------------------------------ */
/* Render                                                              */
/* ------------------------------------------------------------------ */

const ICONO = {
  pendiente: '<span class="punto pendiente"></span>',
  procesando: '<span class="spinner"></span>',
  ok: '<svg viewBox="0 0 16 16" class="ico ok"><path d="M13.5 4.5 6.5 11.5 2.5 7.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  error: '<svg viewBox="0 0 16 16" class="ico err"><path d="M8 4v5M8 11.5v.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
};

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

function render() {
  contadorEl.textContent = archivos.length
    ? `${archivos.length} ${archivos.length === 1 ? 'archivo' : 'archivos'}`
    : '';
  vacioEl.hidden = archivos.length > 0;
  panelEl.hidden = archivos.length === 0;

  listaEl.innerHTML = archivos
    .map((a) => {
      const detalle = a.estado === 'error'
        ? `<span class="detalle err">${esc(a.error || 'Error')}</span>`
        : a.estado === 'ok' && a.datos
          ? `<span class="detalle">${esc(a.datos[0].razonSocial)} · ${a.datos.length > 1 ? `${a.datos.length} páginas · ` : ''}${fmtMoneda(a.datos.reduce((s, d) => s + (d.totalAPagar || 0), 0))}</span>`
          : a.origen
            ? `<span class="detalle">de ${esc(a.origen)}</span>`
            : '';
      const avisos = a.datos ? a.datos.flatMap((d) => d.warnings) : [];
      return `<li class="fila ${a.estado}">
        <span class="estado">${ICONO[a.estado]}</span>
        <span class="nombre" title="${esc(a.nombre)}">${esc(a.nombre)}</span>
        ${detalle}
        ${avisos.length ? `<span class="aviso" title="${esc(avisos.join('\n'))}">${avisos.length} aviso${avisos.length > 1 ? 's' : ''}</span>` : ''}
        <button class="quitar" data-id="${a.id}" aria-label="Quitar ${esc(a.nombre)}" ${trabajando ? 'disabled' : ''}>&times;</button>
      </li>`;
    })
    .join('');

  $$('.quitar').forEach((b) =>
    b.addEventListener('click', () => {
      archivos = archivos.filter((a) => a.id !== Number(b.dataset.id));
      render();
    })
  );

  btnConvertir.disabled = trabajando || !archivos.length;
  btnLimpiar.disabled = trabajando || !archivos.length;
}

const fmtMoneda = (n) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0);

function toast(msg, esError = false) {
  const el = document.createElement('div');
  el.className = 'toast' + (esError ? ' err' : '');
  el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => el.classList.add('fuera'), 4000);
  setTimeout(() => el.remove(), 4600);
}

/* ------------------------------------------------------------------ */
/* Conversión                                                          */
/* ------------------------------------------------------------------ */

async function convertir() {
  if (trabajando || !archivos.length) return;
  trabajando = true;
  resumenEl.hidden = true;
  progresoEl.hidden = false;
  render();

  const hojas = [];
  const usados = new Set();
  let hechos = 0;

  for (const a of archivos) {
    a.estado = 'procesando';
    a.error = undefined;
    estadoEl.textContent = `Leyendo ${a.nombre}…`;
    barraEl.style.width = `${(hechos / archivos.length) * 100}%`;
    render();
    await new Promise((r) => setTimeout(r, 0)); // deja pintar la UI

    try {
      const copia = a.bytes.slice(); // pdf.js consume el buffer
      const res = await parsePdf(copia, pdfjsLib, {
        archivo: a.nombre,
        standardFontDataUrl: STANDARD_FONTS,
      });
      a.datos = res;
      a.estado = 'ok';
      res.forEach((d, i) => {
        const base = sheetNameFromFile(a.nombre, d) + (res.length > 1 ? ` p${i + 1}` : '');
        hojas.push({ nombre: nombreUnico(base, usados), datos: d });
      });
    } catch (err) {
      a.estado = 'error';
      a.error = err.message || String(err);
    }
    hechos++;
  }

  barraEl.style.width = '100%';
  render();

  if (!hojas.length) {
    estadoEl.textContent = 'Ningún archivo se pudo convertir.';
    progresoEl.hidden = true;
    trabajando = false;
    render();
    toast('No se pudo extraer ninguna línea de pago.', true);
    return;
  }

  estadoEl.textContent = 'Generando Excel…';
  await new Promise((r) => setTimeout(r, 0));

  try {
    const buffer = await construirLibro(hojas, window.ExcelJS, {
      resumen: $('#opt-resumen').checked,
    });
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    descargar(blob, nombreSalida(hojas));
    mostrarResumen(hojas);
  } catch (err) {
    toast(`Error al generar el Excel: ${err.message}`, true);
  }

  progresoEl.hidden = true;
  trabajando = false;
  render();
}

function nombreSalida(hojas) {
  const p = hojas[0]?.datos?.periodoIMSS || '';
  const m = /^(\d{2})-(\d{4})$/.exec(p);
  const sufijo = m ? `_${m[2]}-${m[1]}` : '';
  return `Hojas SIPARE${sufijo}.xlsx`;
}

function descargar(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function mostrarResumen(hojas) {
  const total = hojas.reduce((s, h) => s + (h.datos.totalAPagar || 0), 0);
  const errores = archivos.filter((a) => a.estado === 'error').length;
  const avisos = hojas.reduce((s, h) => s + h.datos.warnings.length, 0);
  resumenEl.innerHTML = `
    <div class="ok-badge">Excel descargado</div>
    <p><strong>${hojas.length}</strong> ${hojas.length === 1 ? 'línea de pago' : 'líneas de pago'} ·
    total a pagar <strong>${fmtMoneda(total)}</strong>
    ${errores ? ` · <span class="err">${errores} con error</span>` : ''}
    ${avisos ? ` · <span class="warn">${avisos} aviso(s)</span>` : ''}</p>
    <button id="btn-otra" class="secundario">Convertir de nuevo</button>`;
  resumenEl.hidden = false;
  $('#btn-otra').addEventListener('click', convertir);
}

btnConvertir.addEventListener('click', convertir);
btnLimpiar.addEventListener('click', () => {
  archivos = [];
  resumenEl.hidden = true;
  render();
});

render();
