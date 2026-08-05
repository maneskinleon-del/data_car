// ============================================================================
// tableDetector — P3: detección y reconstrucción de tablas de especificaciones
// ============================================================================
// El manual MG350 mezcla items de dos columnas en el mismo y (pdf.js los
// entrega intercalados). Por eso la segmentación es a nivel de ITEM:
//   1. detectar bandas de columna por huecos en x de los items
//   2. reasignar cada item a su banda y reconstruir líneas POR banda
//   3. detectar "spec rows": etiqueta → valor, combinando ETIQUETAS de líneas
//      cercanas (etiqueta multi-línea: "Manual Transmisión:" + "Llene" → 2 L)
// Resultado: filas {etiqueta, valor, unidad, página} con trazabilidad real.
// ============================================================================

import { LayoutItem, LayoutLine, ColumnBand } from "./pdfLayout";

export interface SpecRow {
  page: number;
  bandId: number;
  y: number;
  label: string;   // etiqueta (puede combinar varias líneas cercanas)
  value: string;   // valor + unidad detectado (ej: "4,5 l")
  unit?: string;   // unidad extraída
  /** contexto crudo alrededor del valor (±15 chars) para valueExclude preciso */
  valueContext: string;
}

/** Patrón de valor técnico: número (con coma/punto), rango opcional (a-b), + unidad. */
const VALUE_RE = /(\d{1,4}(?:[.,]\d{1,3})?(?:\s*[-–—]\s*\d{1,4}(?:[.,]\d{1,3})?)?)\s*(L|l|mm|Nm|nm|bar|psi|kPa|kg\/cm|°C|°F|V|A|kW|Ω|RON|g\/min|:1|ml)/;

/** Detectar bandas de columna agrupando x0 de los ITEMS (no de las líneas). */
export function detectItemBands(
  items: LayoutItem[],
  gapThreshold: number = 60
): { x0: number; x1: number }[] {
  if (items.length === 0) return [];
  const xs = items.map((i) => i.x).sort((a, b) => a - b);
  const bands: { x0: number; x1: number }[] = [{ x0: xs[0], x1: xs[0] }];
  for (const x of xs.slice(1)) {
    const last = bands[bands.length - 1];
    if (x - last.x1 <= gapThreshold) last.x1 = x;
    else bands.push({ x0: x, x1: x });
  }
  return bands;
}

/** Asignar cada item a la banda que lo contiene; reconstruir líneas por banda. */
export function splitItemsByBand(
  items: LayoutItem[],
  bands: { x0: number; x1: number }[]
): ColumnBand[] {
  const result: ColumnBand[] = bands.map((b, i) => ({
    id: i,
    x0: b.x0,
    x1: b.x1,
    lines: [],
    text: "",
  }));

  for (const it of items) {
    const center = it.x + it.w / 2;
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < bands.length; i++) {
      const b = bands[i];
      const dist = center < b.x0 ? b.x0 - center : center > b.x1 ? center - b.x1 : 0;
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    }
    result[best].lines.push({
      y: it.y,
      x0: it.x,
      x1: it.x + it.w,
      items: [it],
      text: it.str,
    } as LayoutLine);
  }

  // agrupar líneas de la banda por y (como pdfLayout, pero por banda)
  for (const band of result) {
    const sorted = band.lines.sort((a, b) => b.y - a.y);
    const merged: LayoutLine[] = [];
    for (const line of sorted) {
      const last = merged[merged.length - 1];
      if (last && Math.abs(last.y - line.y) <= 3.5) {
        last.items.push(...line.items);
        last.items.sort((a, b) => a.x - b.x);
        last.x0 = last.items[0].x;
        last.x1 = Math.max(...last.items.map((i) => i.x + i.w));
        last.text = last.items.map((i) => i.str).join("");
      } else {
        merged.push({ ...line, items: [...line.items] });
      }
    }
    band.lines = merged;
    band.text = merged.map((l) => l.text).join("\n");
  }

  return result;
}

/** Extraer el primer valor técnico de una línea (número + unidad). */
export function findValueInLine(line: LayoutLine): { value: string; unit?: string } | null {
  const m = line.text.match(VALUE_RE);
  if (!m) return null;
  return { value: m[0], unit: m[2] };
}

/** Contexto alrededor de un match de valor en una línea (±15 chars). */
function valueContextOf(lineText: string, value: string): string {
  const idx = lineText.indexOf(value);
  if (idx < 0) return lineText;
  const start = Math.max(0, idx - 15);
  const end = Math.min(lineText.length, idx + value.length + 15);
  return lineText.slice(start, end);
}

/**
 * Construir spec rows de una página con emparejamiento POR FILA-y:
 * para cada valor detectado, su etiqueta = texto antes del valor en la misma
 * línea + TODAS las líneas de bandas a la izquierda dentro de la tolerancia
 * vertical (etiquetas multi-línea y etiquetas en columna propia).
 */
export function detectSpecRows(
  page: number,
  bands: ColumnBand[],
  verticalTolerance: number = 22
): SpecRow[] {
  const rows: SpecRow[] = [];
  const seen = new Set<string>();

  for (const band of bands) {
    for (const line of band.lines) {
      const hit = findValueInLine(line);
      if (!hit) continue;
      const idx = line.text.indexOf(hit.value);

      // etiqueta en la misma línea (texto antes del valor)
      const sameLineLabel = idx > 0 ? line.text.slice(0, idx).trim() : "";

      // etiquetas de líneas en bandas a la izquierda, dentro de tolerancia
      const leftLabels: { text: string; dist: number }[] = [];
      for (const other of bands) {
        if (other.id === band.id || other.x1 >= band.x0) continue;
        for (const l of other.lines) {
          const dist = Math.abs(l.y - line.y);
          if (dist <= verticalTolerance) {
            leftLabels.push({ text: l.text.trim(), dist });
          }
        }
      }
      leftLabels.sort((a, b) => a.dist - b.dist);

      // etiquetas de líneas ARRIBA en la MISMA banda (multi-línea)
      // NOTA: en pdf.js el eje y crece HACIA ARRIBA → la línea de arriba tiene
      // y MAYOR. Condición: l.y - line.y ∈ (0, tol]
      const aboveLabels: { text: string; dist: number }[] = [];
      for (const l of band.lines) {
        const d = l.y - line.y; // l arriba (y mayor)
        if (d > 0 && d <= verticalTolerance) {
          aboveLabels.push({ text: l.text.trim(), dist: d });
        }
      }
      aboveLabels.sort((a, b) => a.dist - b.dist);

      const label = [sameLineLabel, ...leftLabels.map((x) => x.text), ...aboveLabels.map((x) => x.text)]
        .filter((t) => t.length > 0)
        .join(" ");

      const key = `${page}:${line.y.toFixed(1)}:${hit.value}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({
        page,
        bandId: band.id,
        y: line.y,
        label,
        value: hit.value,
        unit: hit.unit,
        valueContext: valueContextOf(line.text, hit.value),
      });
    }
  }

  return rows.sort((a, b) => b.y - a.y);
}
