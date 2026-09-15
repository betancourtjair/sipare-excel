# SIPARE → Excel

Convierte **líneas de pago del IMSS (formato SPR-05 / SIPARE)** en PDF a un archivo **Excel editable**, con una hoja por línea de pago.

👉 **[Abrir la aplicación](https://betancourtjair.github.io/sipare-excel/)**

## Qué hace

- Acepta un **ZIP** con varias líneas de pago o **PDF sueltos** (arrastrando o seleccionándolos).
- Lee de cada formato: razón social, registro patronal, RFC, domicilio, delegación y subdelegación, período, folio SUA, clave de recepción, cotizantes, días, acreditados, los 35 conceptos de cuotas (IMSS, RCV y Vivienda) y la línea de captura.
- Genera un `.xlsx` con una hoja por línea de pago, **fórmulas vivas** (`SUM` en subtotales y totales), formato de moneda y celdas editables.
- Opcionalmente agrega una hoja **Resumen** con el concentrado de todas las líneas y enlaces a cada hoja.

## Privacidad

Todo el procesamiento ocurre **dentro del navegador**. Los PDF no se suben a ningún servidor, no se almacenan y no salen de la computadora. El sitio es estático: no tiene backend ni base de datos.

## Estructura

```
index.html              página
css/estilos.css         estilos
js/app.js               interfaz: carga de archivos, progreso, descarga
js/sipare-parser.js     extracción de datos del PDF (pdf.js)
js/excel-builder.js     generación del libro de Excel (ExcelJS)
vendor/                 librerías incluidas localmente (pdf.js, ExcelJS, JSZip)
tools/                  scripts de prueba (Node, no se publican en el sitio)
```

## Desarrollo

```bash
npm install                                   # sólo para los scripts de prueba
npx http-server . -p 8080                     # o cualquier servidor estático
node tools/test-parse.mjs <carpeta-con-pdfs>  # verifica la extracción
node tools/test-build.mjs <carpeta> out.xlsx  # genera un libro de prueba
node tools/e2e.mjs <archivo.zip> out.xlsx     # prueba completa en navegador
```

Debe servirse por HTTP (no `file://`) porque `js/app.js` es un módulo ES.

## Verificación

Probado contra 16 líneas de pago reales de agosto 2026: los 16 PDF se extraen sin avisos, cada subtotal y total recalculado en Excel coincide con el importe impreso en el PDF, y el gran total ($4,419,518.47) corresponde a la suma de los importes de los 16 archivos.

## Notas

- Las filas de Vivienda que el IMSS marca como `NO APLICA` se conservan con ese texto, tal como aparecen en el PDF.
- Si un PDF no es una línea de pago SIPARE, se marca con error y los demás se convierten de todas formas.
- Los nombres de hoja se derivan del nombre del archivo (`..._CHO_Puebla_$157,506.34.pdf` → `CHO Puebla`).
