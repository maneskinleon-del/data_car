// ============================================================================
// pdfLayout — P1/P2: extracción de layout desde pdf.js
// ============================================================================
// pdf.js entrega cada fragmento de texto con su posición real (transform[4]=x,
// transform[5]=y, width, height). V1 los aplanaba con .join(" ") perdiendo toda
// la estructura espacial. Aquí conservamos coordenadas y reconstruimos:
//   items → líneas (mismo y) → bandas de columna (x) → líneas por banda
// ============================================================================

import { normalizeText } from "./technicalExtractor";

export interface LayoutItem {
  str: string;       // texto normalizado
  x: number;         // posición izquierda
  y: number;         // posición vertical (origen pdf.js: abajo → arriba)
  w: number;         // ancho
  h: number;         // alto (fontSize)
}

export interface LayoutLine {
  y: number;         // y representativo de la línea
  x0: number;        // inicio
  x1: number;        // fin
  items: LayoutItem[];
  text: string;      // concatenación normalizada
}

/** Banda de columna: región vertical continua delimitada por huecos en x. */
export interface ColumnBand {
  id: number;
  x0: number;
  x1: number;
  lines: LayoutLine[];
  /** texto completo de la banda (orden lectura: y desc, luego x asc) */
  text: string;
}

export interface PageLayout {
  page: number;             // 1-based
  width: number;
  height: number;
  lines: LayoutLine[];      // todas las líneas de la página
  bands: ColumnBand[];      // bandas de columna detectadas
}

export interface DocumentLayout {
  pages: PageLayout[];
}

const LINE_Y_TOLERANCE = 3.5;   // px de tolerancia para agrupar items en una línea

function extractItems(textContent: any): LayoutItem[] {
  const items: LayoutItem[] = [];
  for (const it of textContent.items ?? []) {
    const str = normalizeText(String(it.str ?? ""));
    if (!str.trim()) continue;
    items.push({
      str,
      x: it.transform?.[4] ?? 0,
      y: it.transform?.[5] ?? 0,
      w: it.width ?? 0,
      h: it.transform?.[3] ?? 0,
    });
  }
  return items;
}

/** Agrupar items en líneas según y (el origen pdf.js va de abajo hacia arriba). */
export function groupItemsIntoLines(items: LayoutItem[]): LayoutLine[] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: LayoutLine[] = [];
  for (const it of sorted) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.y - it.y) <= LINE_Y_TOLERANCE) {
      last.items.push(it);
    } else {
      lines.push({ y: it.y, x0: it.x, x1: it.x + it.w, items: [it], text: "" });
    }
  }
  for (const line of lines) {
    line.items.sort((a, b) => a.x - b.x);
    line.x0 = line.items[0].x;
    line.x1 = Math.max(...line.items.map((i) => i.x + i.w));
    line.text = line.items.map((i) => i.str).join("");
  }
  return lines;
}

/**
 * Detección de bandas de columna: agrupa los x0 de las líneas en clusters.
 * El manual MG350 usa 2 columnas (x≈29-280 y x≈296-560); las bandas permiten
 * no mezclar la tabla de fluidos (col izq) con las notas (col der).
 */
export function detectColumnBands(lines: LayoutLine[], maxGap: number = 40): ColumnBand[] {
  if (lines.length === 0) return [];

  // x0 representativo por línea: el inicio de su primer item
  const starts = lines.map((l) => l.x0).sort((a, b) => a - b);

  // Clusterizar inicios cercanos
  const clusters: number[][] = [];
  for (const s of starts) {
    const last = clusters[clusters.length - 1];
    if (last && s - last[last.length - 1] <= maxGap) last.push(s);
    else clusters.push([s]);
  }

  // Banda por cluster: rango x = [min x0, max fin de línea del cluster]
  return clusters.map((cluster, i) => {
    const x0 = Math.min(...cluster);
    const bandLines = lines.filter((l) => {
      // la línea pertenece a la banda si su inicio cae en el rango del cluster
      // (con tolerancia) o si se solapa mayoritariamente con la banda
      return cluster.some((c) => Math.abs(l.x0 - c) <= maxGap / 2);
    });
    // expandir: líneas cuyo x0 está entre bandas (p.ej. texto centrado)
    const x1 = bandLines.length > 0 ? Math.max(...bandLines.map((l) => l.x1)) : x0 + 1;
    const lines2 = bandLines.sort((a, b) => b.y - a.y);
    return {
      id: i,
      x0,
      x1,
      lines: lines2,
      text: "",
    } as ColumnBand;
  });
}

/** Reconstruir el texto de una banda en orden de lectura. */
export function bandText(band: ColumnBand): string {
  return band.lines
    .map((l) => l.text)
    .join("\n");
}

export async function extractPageLayout(
  page: any,
  pageNumber: number
): Promise<PageLayout> {
  const textContent = await page.getTextContent();
  const viewport = page.getViewport({ scale: 1 });
  const items = extractItems(textContent);
  const lines = groupItemsIntoLines(items);
  const bands = detectColumnBands(lines);
  for (const b of bands) b.text = bandText(b);
  return {
    page: pageNumber,
    width: viewport.width,
    height: viewport.height,
    lines,
    bands,
  };
}

export async function extractDocumentLayout(
  doc: any,
  numPages: number
): Promise<DocumentLayout> {
  const pages: PageLayout[] = [];
  for (let i = 1; i <= numPages; i++) {
    const page = await doc.getPage(i);
    pages.push(await extractPageLayout(page, i));
  }
  return { pages };
}
