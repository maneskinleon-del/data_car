// ============================================================================
// technicalExtractorV2 — P6: pipeline de extracción estructurada
// ============================================================================
// Recibe el DocumentLayout (coordenadas) + dominio → DB v2.
// Flujo por slot:
//   1. SpecRows (tablas): etiqueta→valor con trazabilidad de página.
//   2. Búsqueda por banda (prosa): el manual separa ETIQUETA y VALOR en bandas
//      de columna distintas (label x≈34-280, valor x≈212/292+) al mismo y.
//      Por eso la búsqueda cruza BANDAS por fila-y y toma el valor MÁS CERCANO
//      al concepto — nunca "el primer número del texto pegado".
//   3. Variantes MT/AT por etiqueta de la fila/banda.
//   4. Validación (jerarquía de 7 niveles) → validationStatus.
//   5. Estado del slot: ✓ extracted / ⚪ not_found / ⚠️ not_published.
// ============================================================================

import {
  VehicleTechnicalDatabaseV2,
  TechnicalComponentV2,
  SpecField,
  TechValue,
  ValidationStatus,
  SystemCategory,
} from "../types/technicalV2";
import { DocumentLayout, ColumnBand, LayoutLine } from "./pdfLayout";
import { findValueInLine } from "./tableDetector";
import {
  SlotDef,
  PLAUSIBILITY,
  validateValue,
  ValidationInput,
  COMPONENT_DEFS,
} from "./domainModelV2";

// ── Configuración ────────────────────────────────────────────────────────────
const CONCEPT_WINDOW_Y = 45;      // px verticales para buscar valor cerca del concepto
const ROW_CONTEXT_Y = 50;         // px hacia arriba para contexto de variante
const MIN_CONFIDENCE_FILL = 0.5;  // umbral para llenar un valor en la DB

// ── Helpers ─────────────────────────────────────────────────────────────────
function toNumber(raw: string): number | null {
  const m = raw.replace(",", ".").match(/-?\d+(?:\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

// ── Extracción por slot ─────────────────────────────────────────────────────
interface SlotCandidate {
  value: string;
  raw: string;
  page: number;
  section?: string;
  structural: boolean;   // vino de una fila de tabla (SpecRow)
  variant?: VariantRef;
  labelMatched: boolean;
  unitMatched: boolean;
  plausibilityOk: boolean;
  confidence: number;
  distance: number;      // distancia vertical px al concepto (menor = mejor)
}

interface VariantRef {
  kind: "transmission" | "engine" | "market";
  id: string;
  label: string;
}

class SlotExtractor {
  constructor(
    private layout: DocumentLayout,
    private pdfName: string,
    private slot: SlotDef
  ) {}

  /** Aplicar patrón/extract del slot a un texto. */
  private extractValue(text: string): string | null {
    if (this.slot.extract) return this.slot.extract(text);
    const m = text.match(this.slot.valuePattern);
    return m ? m[0].trim() : null;
  }

  private resolveVariant(text: string): VariantRef | undefined {
    if (!this.slot.variantWhen) return undefined;
    for (const v of this.slot.variantWhen) {
      if (v.keyword.test(text)) {
        return { kind: "transmission", id: v.variant, label: v.variant === "mt" ? "Transmisión Manual (MT)" : "Transmisión Automática (AT)" };
      }
    }
    return undefined;
  }

  /** Etiqueta excluida (anti-falsos positivos por concepto). */
  private isExcluded(text: string): boolean {
    return this.slot.exclude?.some((re) => re.test(text)) ?? false;
  }

  /**
   * Exclusión de VALOR: se prueba contra la LÍNEA que contiene el valor (no
   * contra toda la ventana). Ej: "Sistema de refrigeración - 1,5 l Motor:"
   * tiene "Motor" → el "1,5 l" es la cilindrada, NO la capacidad del sistema.
   */
  private isValueExcluded(containingLine: string): boolean {
    return this.slot.valueExclude?.some((re) => re.test(containingLine)) ?? false;
  }

  /** Rango de plausibilidad: FILTRO (descarta absurdos; nunca valida exactitud). */
  private checkPlausibility(numeric: number | null): boolean {
    if (!this.slot.plausibility) return true;
    if (numeric === null) return true;
    const range = PLAUSIBILITY[this.slot.plausibility];
    if (!range) return true;
    return numeric >= range.min && numeric <= range.max;
  }

  private checkUnit(value: string): boolean {
    const unit = this.slot.unit;
    if (!unit || unit === "norma" || unit === "tipo" || unit === "ref" || unit === "medida" || unit === "SAE") return true;
    const unitMap: Record<string, RegExp> = {
      L: /[Ll]/,
      mm: /mm/,
      Nm: /Nm/,
      bar: /bar/,
      DOT: /DOT/,
      RON: /RON/,
      ratio: /:/,
    };
    return unitMap[unit]?.test(value) ?? true;
  }

  private baseConfidence(structural: boolean, unitOk: boolean, plausOk: boolean, distance: number): number {
    let c = 0;
    if (structural) c += 0.3;               // (1) contexto estructural
    c += 0.3;                                // (2) etiqueta/concepto correcto
    if (unitOk) c += 0.2;                    // (3) unidad correcta
    if (this.slot.variantWhen) c += 0.1;     // (4) variante resuelta
    c += 0.1;                                // (6) fuente/página conocida
    if (distance <= 8) c += 0.1;
    else if (distance <= 20) c += 0.05;
    if (!plausOk) return 0.2;
    return Math.min(c, 1);
  }

  /**
   * Extraer candidatos del slot en todo el documento.
   * Fuente 1: tablas por banda con encabezados de grupo — estructura fuerte.
   * Fuente 2: cruce de bandas por fila-y — solo en páginas NO cubiertas por
   * tablas (evita que la prosa duplique filas de tabla con ruido vecino).
   */
  extract(): SlotCandidate[] {
    const candidates: SlotCandidate[] = [];
    const tablePages = new Set<number>();

    // ── Fuente 1: tablas por banda con ENCABEZADOS DE GRUPO ──
    // La tabla de fluidos usa encabezados que agrupan filas:
    //   "Manual Transmisión:" → Llene 2 L · Relleno seca 2,2 L
    //   "Transmisión automática:" → Llenar 2,9 l
    // Cada fila hereda el encabezado vigente (la última línea-etiqueta sin
    // valor). Esto resuelve la variante MT/AT por estructura, no por cercanía.
    for (const page of this.layout.pages) {
      for (const band of page.bands) {
        const lines = [...band.lines].sort((a, b) => b.y - a.y);
        let currentLabel = ""; // encabezado de grupo o etiqueta de fila vigente
        for (const line of lines) {
          const hit = findValueInLine(line);
          if (!hit) {
            // línea-etiqueta: candidata a encabezado de grupo (corta o termina en ":")
            const t = line.text.trim();
            if (t.length > 0 && t.length < 40 && (/[:]$/.test(t) || !/\d/.test(t))) {
              currentLabel = t;
            }
            continue;
          }
          const idx = line.text.indexOf(hit.value);
          const sameLineLabel = idx > 0 ? line.text.slice(0, idx).trim() : "";
          const labelWords = sameLineLabel.split(/\s+/).filter(Boolean).length;
          const completeLabel = labelWords > 2 || sameLineLabel.length > 15;
          // Etiqueta completa en la misma línea ("Aceite del motor y del
          // filtro", "Sistema de refrigeración", "Tanque del lavaparabrisas"):
          // la fila se identifica SOLA → reinicia el grupo. Si la etiqueta es
          // corta ("Llene", "Relleno seca", "Llenar") hereda la etiqueta/el
          // encabezado VIGENTE. Esto evita que "Relleno seca 7.3 L" (fila de
          // refrigerante) herede "Transmisión automática:" solo porque un
          // encabezado anterior sigue en memoria.
          const context = completeLabel
            ? sameLineLabel
            : (currentLabel + " " + sameLineLabel).trim();
          if (completeLabel) currentLabel = sameLineLabel;
          if (!this.slot.concept.test(context)) continue;
          if (this.isExcluded(context)) continue;

          const value = this.extractValue(hit.value);
          if (!value) continue;
          if (this.isValueExcluded(line.text)) continue;

          const numeric = toNumber(value);
          const plausOk = this.checkPlausibility(numeric);
          const unitOk = this.checkUnit(value);

          candidates.push({
            value: this.slot.transform ? this.slot.transform(value) : value,
            raw: value,
            page: page.page,
            section: currentLabel || undefined,
            structural: true,
            variant: this.resolveVariant(context),
            labelMatched: true,
            unitMatched: unitOk,
            plausibilityOk: plausOk,
            confidence: this.baseConfidence(true, unitOk, plausOk, 0),
            distance: 0,
          });
          tablePages.add(page.page);
        }
      }
    }

    // ── Fuente 2: cruce de bandas por fila-y (solo páginas sin tabla) ──
    // Para cada línea que matchea el concepto, buscar valores en TODAS las
    // bandas dentro de la ventana vertical, y quedarse con el más cercano.
    for (const page of this.layout.pages) {
      if (tablePages.has(page.page)) continue; // ya cubierta por tabla
      for (const band of page.bands) {
        const sortedLines = [...band.lines].sort((a, b) => b.y - a.y);
        for (const conceptLine of sortedLines) {
          if (!this.slot.concept.test(conceptLine.text)) continue;
          if (this.isExcluded(conceptLine.text)) continue;

          // todas las líneas de TODAS las bandas dentro de la ventana vertical
          const windowLines: { line: LayoutLine; bandId: number; dist: number }[] = [];
          for (const b of page.bands) {
            for (const l of b.lines) {
              const dist = Math.abs(l.y - conceptLine.y);
              if (dist <= CONCEPT_WINDOW_Y) windowLines.push({ line: l, bandId: b.id, dist });
            }
          }
          windowLines.sort((a, b) => a.dist - b.dist || (a.bandId - b.bandId));

          // texto de la ventana para variante/extract
          const win = windowLines.map((w) => w.line.text).join(" ");

          // encontrar el valor más cercano entre las líneas de la ventana
          let best: { value: string; line: LayoutLine; dist: number } | null = null;
          for (const w of windowLines) {
            // extract multi-línea se prueba sobre la ventana completa
            if (this.slot.extract) break;
            const m = w.line.text.match(this.slot.valuePattern);
            if (!m) continue;
            if (this.isValueExcluded(w.line.text)) continue;
            if (!best || w.dist < best.dist) {
              best = { value: m[0].trim(), line: w.line, dist: w.dist };
            }
          }

          // extract avanzado (reconstrucción multi-línea, ej: ACEA A3/B3)
          let value: string | null = best?.value ?? null;
          let valueLine: LayoutLine | null = best?.line ?? null;
          if (!value && this.slot.extract) {
            value = this.slot.extract(win);
            valueLine = conceptLine;
          }
          if (!value) continue;

          const numeric = toNumber(value);
          const plausOk = this.checkPlausibility(numeric);
          const unitOk = this.checkUnit(value);

          candidates.push({
            value: this.slot.transform ? this.slot.transform(value) : value,
            raw: value,
            page: page.page,
            structural: false,
            variant: this.resolveVariant(win),
            labelMatched: true,
            unitMatched: unitOk,
            plausibilityOk: plausOk,
            confidence: this.baseConfidence(false, unitOk, plausOk, best ? best.dist : 0),
            distance: best ? best.dist : 0,
          });
        }
      }
    }

    return candidates;
  }
}

// ── Build de la DB v2 ───────────────────────────────────────────────────────
export class TechnicalExtractorV2 {
  private db: VehicleTechnicalDatabaseV2 | null = null;

  constructor(
    private layout: DocumentLayout,
    private pdfName: string,
    private vehicle: { transmission?: "mt" | "at" | "unknown" } = {}
  ) {}

  buildDatabase(): VehicleTechnicalDatabaseV2 {
    if (this.db) return this.db;

    const components: Record<SystemCategory, TechnicalComponentV2[]> = {
      motor: [], fluidos: [], encendido: [], filtros: [], frenos: [],
      suspension: [], transmision: [], electrico: [], neumaticos: [], carroceria: [],
    };
    let totalSlots = 0, extracted = 0, notFound = 0, notPublished = 0;

    for (const def of COMPONENT_DEFS) {
      const fields: SpecField[] = [];
      let hasExtracted = false;
      let hasNotPublished = false;

      for (const slot of def.slots) {
        totalSlots++;
        const field: SpecField = {
          id: slot.id,
          label: slot.label,
          values: [],
          dependsOnVariant: !!slot.variantWhen,
          expectedUnit: slot.unit,
        };

        if (slot.scope === "never-publishes") {
          // ⚠️ NO_PUBLICADO: el manual de servicio no publica este tipo de dato
          notPublished++;
          hasNotPublished = true;
          field.values.push({
            value: "",
            status: "not_published",
            validationStatus: "plausible",
            confidence: 0,
          });
          fields.push(field);
          continue;
        }

        const extractor = new SlotExtractor(this.layout, this.pdfName, slot);
        const candidates = extractor.extract();

        // FILTRAR inválidos ANTES de agrupar variantes (rango de plausibilidad)
        const valid = candidates.filter((c) => c.plausibilityOk);

        // agrupar por variante
        const byVariant = new Map<string, SlotCandidate[]>();
        for (const c of valid) {
          const key = c.variant?.id ?? "base";
          if (!byVariant.has(key)) byVariant.set(key, []);
          byVariant.get(key)!.push(c);
        }

        for (const [, cands] of byVariant) {
          // dedupe por valor (misma variante, mismo valor, distinta página)
          const seenValues = new Set<string>();
          const uniq = cands
            .sort((a, b) => b.confidence - a.confidence || a.distance - b.distance)
            .filter((c) => {
              const k = c.value.toLowerCase();
              if (seenValues.has(k)) return false;
              seenValues.add(k);
              return true;
            });

          // CONFLICTO real: valores DISTINTOS desde PÁGINAS distintas con
          // confianza similar (candidatos rivales genuinos). Valores
          // complementarios de la MISMA página (7.7/8.2 mm = admisión/escape;
          // 2L/2,2L = llenado/relleno seco) NO son conflicto: son filas reales
          // del manual y ambas se conservan.
          const distinct = uniq.map((c) => c.value);
          const sourcePages = new Set(uniq.map((c) => c.page));
          const topConf = uniq[0]?.confidence ?? 0;
          const spread = uniq.length > 1 ? topConf - uniq[uniq.length - 1].confidence : 0;
          const conflict = distinct.length > 1 && sourcePages.size > 1 && spread < 0.2;

          for (const cand of uniq) {
            const status = validateValue({
              structural: cand.structural,
              labelMatched: cand.labelMatched,
              unitMatched: cand.unitMatched,
              variantResolved: !!cand.variant || !slot.variantWhen,
              plausibilityOk: cand.plausibilityOk,
              hasSource: cand.page > 0,
              conflict,
              confidence: cand.confidence,
            });
            if (status === "invalid") continue;

            field.values.push({
              value: cand.value,
              status: "extracted",
              validationStatus: status,
              confidence: cand.confidence,
              variant: cand.variant,
              conflict,
              source: {
                document: this.pdfName,
                pages: [cand.page],
                section: cand.section,
                rawText: cand.raw,
              },
            });
            extracted++;
            hasExtracted = true;
          }
        }

        if (field.values.length === 0) {
          // ⚪ NO_ENCONTRADO (pero el manual podría publicarlo)
          notFound++;
          field.values.push({
            value: "",
            status: "not_found",
            validationStatus: "invalid",
            confidence: 0,
          });
        }

        fields.push(field);
      }

      // El componente SIEMPRE se agrega (Prioridad 4): un campo ⚪ NO
      // ENCONTRADO le dice al usuario que el manual fue consultado y que ese
      // dato no aparece; ocultarlo lo haría parecer un error del extractor.
      // Solo los componentes con TODOS los slots sin hallazgo quedan con
      // status "not_found" (el manual podría publicarlo pero no se encontró).
      components[def.system].push({
        id: def.id,
        system: def.system,
        name: def.name,
        icon: def.icon,
        specFields: fields,
        status: hasExtracted ? "extracted" : hasNotPublished ? "not_published" : "not_found",
        validationStatus: this.componentValidation(fields),
        lastUpdated: new Date().toISOString(),
        verified: false,
      });
    }

    this.db = {
      schemaVersion: 2,
      vehicle: { transmission: this.vehicle.transmission ?? "unknown" },
      components,
      parts: { entries: [] },
      maintenanceSchedule: [],
      diagnostics: [],
      lastExtracted: new Date().toISOString(),
      extractionSource: this.pdfName,
      coverage: {
        totalSlots,
        extracted,
        notFound,
        notPublished,
        decisionReady: this.countDecisionReady(components),
      },
    };
    return this.db;
  }

  private componentValidation(fields: SpecField[]): ValidationStatus {
    const vs = fields.flatMap((f) => f.values.map((v) => v.validationStatus));
    if (vs.some((v) => v === "verified")) return "verified";
    if (vs.some((v) => v === "plausible")) return "plausible";
    if (vs.some((v) => v === "conflict")) return "conflict";
    return "invalid";
  }

  private countDecisionReady(components: Record<SystemCategory, TechnicalComponentV2[]>): number {
    let n = 0;
    for (const comps of Object.values(components)) {
      for (const comp of comps) {
        const hasUsable = comp.specFields.some((f) =>
          f.values.some((v) => v.status === "extracted" && !v.conflict && v.confidence >= MIN_CONFIDENCE_FILL)
        );
        if (hasUsable) n++;
      }
    }
    return n;
  }
}
