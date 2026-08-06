// ============================================================================
// build-base-json — genera src/data/mg350Base.json (base técnica precargada)
// ============================================================================
// Ejecuta el pipeline V2 contra el manual real y empaqueta la DB completa
// (componentes extraídos con trazabilidad + catálogo de repuestos) en un
// JSON embebible. Así CUALQUIER dispositivo carga la misma información del
// MG 350 sin necesitar el PDF (28 MB).
//
// Uso:
//   ./node_modules/.bin/esbuild scripts/build-base-json.mjs \
//     --bundle --platform=node --format=esm --outfile=.build-base.mjs \
//     --external:pdfjs-dist
//   node .build-base.mjs
//   rm -f .build-base.mjs
// ============================================================================

import * as fs from "node:fs";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { extractPageLayout } from "../src/lib/pdfLayout.ts";
import { TechnicalExtractorV2 } from "../src/lib/technicalExtractorV2.ts";
import { attachPartsCatalog } from "../src/lib/partsCatalogProvider.ts";

const PDF_PATH = process.env.MG350_PDF || "/home/mangonz/Descargas/mg350-manual-final.pdf";
// Se corre desde la raíz del proyecto (cd data_car); usa cwd para no depender
// de la ubicación del bundle de esbuild ni de symlinks (~/proyectos/data_car).
const OUT = new URL(`file://${process.cwd()}/src/data/mg350Base.json`);

if (!fs.existsSync(PDF_PATH)) {
  console.error(`PDF no encontrado: ${PDF_PATH}`);
  process.exit(1);
}

const data = new Uint8Array(fs.readFileSync(PDF_PATH));
const doc = await pdfjsLib.getDocument({ data }).promise;
console.log(`manual: ${doc.numPages} páginas`);

// ── 1. Layout (coordenadas x/y) ──
const layout = { pages: [] };
for (let i = 1; i <= doc.numPages; i++) {
  const page = await doc.getPage(i);
  layout.pages.push(await extractPageLayout(page, i));
}
console.log("layout extraído ✓");

// ── 2. Base técnica V2 + catálogo de repuestos ──
const db = new TechnicalExtractorV2(layout, "mg350-manual-final.pdf").buildDatabase();
db.extractionSource = "mg350-manual-final.pdf";
attachPartsCatalog(db);
db.lastExtracted = new Date().toISOString();

// Marca de base precargada (schema V2 + campo extra de la app)
const out = {
  ...db,
  preloaded: true,
};

fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
const kb = (fs.statSync(OUT).size / 1024).toFixed(1);
console.log(`✔ ${OUT} (${kb} KB)`);
console.log(`  extraídos: ${db.coverage.extracted} · decision-ready: ${db.coverage.decisionReady}`);
console.log(`  piezas catálogo: ${db.parts.entries.length} entradas`);
console.log(`  componentes: ${Object.values(db.components).flat().length}`);
