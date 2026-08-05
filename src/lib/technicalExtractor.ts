// ============================================================================
// TechnicalExtractor — Motor de extracción técnica del manual
// ============================================================================
// Pipeline: normalize → segment → extract → validate → build database
// ============================================================================
// v2 — Cobertura honesta:
//   • Cada candidato trackea página real + sección del manual (procedencia).
//   • La confianza parte en 0 y suma solo por evidencia real (unidad, cercanía
//     a la keyword, sección correcta, formato de especificación).
//   • Se descartan matches sin keyword cerca (falsos positivos tipo "Sensor",
//     "pad", "disco" con valores lejanos).
//   • La cobertura solo cuenta reglas con datos realmente llenados.
// ============================================================================

import {
  VehicleTechnicalDatabase,
  Component,
  DataPoint,
  ExtractionRule,
  ExtractionResult,
  CandidateValue,
  SystemCategory,
  MaintenanceItem,
} from "../types/technical";

// ── Umbrales de confianza ────────────────────────────────────────────────────
const MIN_CANDIDATE_CONFIDENCE = 0.3; // para aparecer en la lista de candidatos
const MIN_FILL_CONFIDENCE = 0.5; // para llenar un dato de la base
const MAX_KEYWORD_DISTANCE = 180; // distancia máxima keyword → valor (chars)

// ── Normalización de texto ───────────────────────────────────────────────────
export function normalizeText(text: string): string {
  return text
    .replace(/Û/g, "ó")
    .replace(/û/g, "ó")
    .replace(/Ï/g, "í")
    .replace(/ï(?=[a-z])/g, "í")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n");
}

// ── Segmentación por secciones ───────────────────────────────────────────────
interface TextSection {
  title: string;
  content: string;
  start: number; // offset del título en el texto normalizado
  pageStart?: number;
}

// Una línea es título de sección solo si: empieza con la keyword, es corta y
// NO parece una línea de datos (sin dos puntos, sin valores). Esto evita que
// "Engine oil:", "Capacity: 4.2 L" o "Oil filter: MAHLE..." se traten como
// secciones solo por empezar con ENGINE/CAPACITY/OIL.
const SECTION_KEYWORD_RE = /^(?:specifications?|especificaciones|engine|motor|mec[áa]nica|lubrication|lubricaci[oó]n|aceite|oil|cooling|refrigeraci[oó]n|refrigerante|coolant|ignition|encendido|spark\s*plug|chispa|fuel|combustible|brake|frenos|suspension|suspensi[oó]n|transmission|transmisi[oó]n|electrical|el[ée]ctrico|maintenance|mantenimiento|service|capacity|capacidad|fluid)/i;

function isSectionTitleLine(line: string): boolean {
  const t = line.trim();
  // Título real: corto (≤ 60 chars), sin dos puntos, sin dígitos de valores sueltos
  // (ej: "OIL 5W-30" es contenido, no un título de sección)
  if (t.length === 0 || t.length > 60) return false;
  if (t.includes(":")) return false;
  if (/\d/.test(t)) return false;
  SECTION_KEYWORD_RE.lastIndex = 0;
  return SECTION_KEYWORD_RE.test(t);
}

export function segmentBySections(text: string): TextSection[] {
  const sections: TextSection[] = [];

  // Dividir por líneas y buscar inicio de secciones
  const lines = text.split("\n");
  let currentSection: TextSection = { title: "General", content: "", start: 0 };
  let offset = 0;

  for (const line of lines) {
    const isSectionStart = isSectionTitleLine(line);

    if (isSectionStart) {
      // Guardar sección anterior
      if (currentSection.content.trim()) {
        sections.push(currentSection);
      }
      currentSection = { title: line.trim(), content: "", start: offset };
    } else {
      currentSection.content += line + "\n";
    }
    offset += line.length + 1;
  }

  // Última sección
  if (currentSection.content.trim()) {
    sections.push(currentSection);
  }

  return sections;
}

// ── Reglas de extracción por categoría ───────────────────────────────────────
const EXTRACTION_RULES: ExtractionRule[] = [
  // ── FLUIDOS ──
  {
    id: "engine_oil",
    system: "fluidos",
    componentName: "Aceite de Motor",
    icon: "🛢️",
    sectionKeywords: [/aceite|oil|lubricación|lubrication/i],
    fieldKeywords: [/aceite\s+(del\s+)?motor/i, /motor\s+oil/i, /engine\s+oil/i],
    valuePatterns: [
      { pattern: /(\d+[.,]?\d*)\s*[Ll]/, groupName: "capacity" },
      { pattern: /(5W-?\d{2}|10W-?\d{2}|0W-?\d{2}|SAE\s*\d+)/, groupName: "viscosity" },
      { pattern: /(ACEA\s*[AB]\d|API\s*[SLSPSN]+)/, groupName: "grade" },
    ],
    unitHint: "capacidad + viscosidad + norma",
    required: true,
  },
  {
    id: "transmission_oil",
    system: "fluidos",
    componentName: "Aceite de Transmisión",
    icon: "⚙️",
    sectionKeywords: [/transmisión|transmission|caja|gearbox/i],
    fieldKeywords: [/transmisión\s+manual/i, /manual\s+transmission/i, /aceite\s+de\s+caja/i],
    valuePatterns: [
      { pattern: /(\d+[.,]?\d*)\s*[Ll]/, groupName: "capacity" },
      { pattern: /(GL-?[45]|75W-?90|80W-?90)/, groupName: "grade" },
    ],
    unitHint: "capacidad + grado",
    required: true,
  },
  {
    id: "coolant",
    system: "fluidos",
    componentName: "Refrigerante",
    icon: "❄️",
    sectionKeywords: [/refrigeración|cooling|refrigerante|coolant|anticongelante/i],
    fieldKeywords: [/refrigerante|anticongelante|coolant/i],
    valuePatterns: [
      { pattern: /(\d+[.,]?\d*)\s*[Ll]/, groupName: "capacity" },
      { pattern: /(OAT|IAT|HOAT|etilenglicol)/, groupName: "type" },
    ],
    unitHint: "capacidad + tipo",
    required: true,
  },
  {
    id: "brake_fluid",
    system: "fluidos",
    componentName: "Líquido de Frenos",
    icon: "🛑",
    sectionKeywords: [/frenos|brake/i],
    fieldKeywords: [/l[ií]quido\s+de\s+frenos|fluido\s+de\s+frenos|brake\s+fluid/i],
    valuePatterns: [
      { pattern: /DOT\s*[345]/, groupName: "grade" },
    ],
    unitHint: "grado DOT",
    required: true,
  },
  {
    id: "fuel_tank",
    system: "fluidos",
    componentName: "Estanque de Combustible",
    icon: "⛽",
    sectionKeywords: [/combustible|fuel/i],
    fieldKeywords: [/estanque|dep[oó]sito|fuel\s+tank/i],
    valuePatterns: [
      { pattern: /(\d{2,3})\s*[Ll]/, groupName: "capacity" },
      { pattern: /(\d{2,3})\s*RON/, groupName: "octane" },
    ],
    unitHint: "capacidad + octanaje",
    required: true,
  },

  // ── ENCENDIDO ──
  {
    id: "spark_plug",
    system: "encendido",
    componentName: "Bujías",
    icon: "⚡",
    sectionKeywords: [/encendido|ignition|chispa|spark/i],
    fieldKeywords: [/buj[ií]a|spark\s+plug|chispa/i],
    valuePatterns: [
      { pattern: /(NGK\s*\w+|DENSO\s*\w+|Champion\s*\w+)/, groupName: "brand" },
      { pattern: /iridio|iridium|platino|platinum|cobre|copper/i, groupName: "type" },
      { pattern: /(\d[.,]\d{1,2})\s*mm/, groupName: "gap" },
    ],
    unitHint: "marca + tipo + gap",
    required: true,
  },

  // ── FILTROS ──
  {
    id: "oil_filter",
    system: "filtros",
    componentName: "Filtro de Aceite",
    icon: "🧰",
    sectionKeywords: [/filtro|filter/i],
    fieldKeywords: [/filtro\s+de\s+aceite|oil\s+filter/i],
    valuePatterns: [
      { pattern: /[A-Z]{1,4}[-\s]?\d{3,6}/, groupName: "partNumber" },
    ],
    unitHint: "referencia/código",
    required: false,
  },
  {
    id: "air_filter",
    system: "filtros",
    componentName: "Filtro de Aire",
    icon: "🌬️",
    sectionKeywords: [/filtro|filter/i],
    fieldKeywords: [/filtro\s+de\s+aire|air\s+filter/i],
    valuePatterns: [
      { pattern: /[A-Z]{1,4}[-\s]?\d{3,6}/, groupName: "partNumber" },
    ],
    unitHint: "referencia/código",
    required: false,
  },

  // ── FRENOS ──
  {
    id: "brake_disc_front",
    system: "frenos",
    componentName: "Disco Delantero",
    icon: "🛑",
    sectionKeywords: [/frenos|brake/i],
    fieldKeywords: [/disco\s+(delantero|frontal|front)/i, /front\s+disc/i],
    valuePatterns: [
      { pattern: /(\d{1,2}[.,]?\d*)\s*mm/, groupName: "thickness" },
    ],
    unitHint: "espesor mínimo (mm)",
    required: false,
  },
  {
    id: "brake_disc_rear",
    system: "frenos",
    componentName: "Disco Trasero",
    icon: "🛑",
    sectionKeywords: [/frenos|brake/i],
    fieldKeywords: [/disco\s+trasero|rear\s+disc/i],
    valuePatterns: [
      { pattern: /(\d{1,2}[.,]?\d*)\s*mm/, groupName: "thickness" },
    ],
    unitHint: "espesor mínimo (mm)",
    required: false,
  },
  {
    id: "brake_pad",
    system: "frenos",
    componentName: "Pastillas de Frenos",
    icon: "🛞",
    sectionKeywords: [/frenos|brake/i],
    fieldKeywords: [/pastilla|brake\s+pad/i],
    valuePatterns: [
      { pattern: /(\d[.,]?\d*)\s*mm/, groupName: "thickness" },
    ],
    unitHint: "espesor mínimo (mm)",
    required: false,
  },
  {
    id: "wheel_torque",
    system: "neumaticos",
    componentName: "Torque de Rueda",
    icon: "🔧",
    sectionKeywords: [/rueda|wheel|neumático|tire/i],
    fieldKeywords: [/(perno|tuerca|apriete)\s+(de\s+)?rueda/i, /wheel\s+nut/i],
    valuePatterns: [
      { pattern: /(\d{2,3})\s*[-–]?\s*(\d{2,3})?\s*Nm/, groupName: "torque" },
    ],
    unitHint: "Nm",
    required: false,
  },
  {
    id: "tire_pressure",
    system: "neumaticos",
    componentName: "Presión de Neumáticos",
    icon: "🛞",
    sectionKeywords: [/neumático|tire|rueda/i],
    fieldKeywords: [/presi[oó]n\s+de\s+(los\s+)?neum[aá]ticos/i, /tire\s+pressure/i],
    valuePatterns: [
      { pattern: /(\d{2})\s*[-–/]?\s*(\d{2})?\s*(psi|PSI)/, groupName: "pressure" },
    ],
    unitHint: "PSI",
    required: false,
  },
  {
    id: "tire_size",
    system: "neumaticos",
    componentName: "Medida de Neumáticos",
    icon: "🛞",
    sectionKeywords: [/neumático|tire|rueda/i],
    fieldKeywords: [/medida|size|dimensi[oó]n/i],
    valuePatterns: [
      { pattern: /(\d{3})\/(\d{2})\s*R(\d{2})/, groupName: "size" },
    ],
    unitHint: "ej: 205/55 R16",
    required: false,
  },

  // ── MOTOR ──
  {
    id: "compression",
    system: "motor",
    componentName: "Presión de Compresión",
    icon: "🔧",
    sectionKeywords: [/motor|engine/i],
    fieldKeywords: [/compresi[oó]n/i],
    valuePatterns: [
      { pattern: /(\d{2,3})\s*[-–a]\s*(\d{2,3})\s*(psi|kg\/cm|kpa|bar)/i, groupName: "range" },
    ],
    unitHint: "psi o kg/cm²",
    required: false,
  },
  {
    id: "oil_pressure",
    system: "motor",
    componentName: "Presión de Aceite",
    icon: "🌡️",
    sectionKeywords: [/motor|engine|aceite|oil/i],
    fieldKeywords: [/presi[oó]n\s+de\s+aceite/i],
    valuePatterns: [
      { pattern: /(\d{1,3}[.,]?\d*)\s*[-–]?\s*(\d{1,3}[.,]?\d*)?\s*(psi|kpa|bar)/i, groupName: "range" },
    ],
    unitHint: "psi o kPa",
    required: false,
  },
  {
    id: "valve_clearance",
    system: "motor",
    componentName: "Juego de Válvulas",
    icon: "🔩",
    sectionKeywords: [/motor|engine|válvula|valve/i],
    fieldKeywords: [/juego\s+de\s+v[aá]lvulas|holgura\s+de\s+v[aá]lvulas|valve\s+clearance/i],
    valuePatterns: [
      { pattern: /(\d[.,]\d{1,3})\s*mm/, groupName: "clearance" },
    ],
    unitHint: "mm",
    required: false,
  },
];

// Conteo de reglas por sistema (para cobertura por sistema en la UI)
export const SYSTEM_RULE_COUNTS: Record<SystemCategory, number> = (() => {
  const counts = {} as Record<SystemCategory, number>;
  for (const rule of EXTRACTION_RULES) {
    counts[rule.system] = (counts[rule.system] || 0) + 1;
  }
  return counts;
})();

// Cantidad de campos con dato llenado en un componente
export function countFilledFields(component: Component): number {
  const fields: (DataPoint<unknown> | undefined)[] = [
    component.specification,
    component.capacity,
    component.viscosity,
    component.grade,
    component.gap,
    component.torque,
    component.pressure,
    component.temperature,
    component.thickness,
    component.interval,
    component.partNumber,
    component.position,
    component.quantity,
    component.engine,
    component.year,
  ];
  return fields.filter((f) => f !== undefined).length;
}

// ── Motor de extracción ──────────────────────────────────────────────────────
export class TechnicalExtractor {
  private text: string;
  private sections: TextSection[];
  private pageStarts: number[] = []; // offset inicial de cada página en this.text
  private cachedDb: VehicleTechnicalDatabase | null = null;

  constructor(pdfPages: string[] | string) {
    if (typeof pdfPages === "string") {
      // Compat: texto plano sin páginas conocidas
      this.text = normalizeText(pdfPages);
      this.pageStarts = [0];
    } else {
      // Normalizar por página y concatenar conservando los límites
      const normalized = pdfPages.map((p) => normalizeText(p));
      const parts: string[] = [];
      let offset = 0;
      normalized.forEach((page, i) => {
        this.pageStarts.push(offset);
        parts.push(page);
        offset += page.length;
        if (i < normalized.length - 1) {
          parts.push("\n");
          offset += 1;
        }
      });
      this.text = parts.join("");
    }
    this.sections = segmentBySections(this.text);
  }

  // Página (1-based) a la que pertenece un offset del texto normalizado
  private pageForOffset(offset: number): number | undefined {
    if (this.pageStarts.length <= 1) return undefined;
    let page = this.pageStarts.length;
    for (let i = 0; i < this.pageStarts.length; i++) {
      if (this.pageStarts[i] > offset) {
        page = i; // page i empieza después del offset → pertenece a i-1 (1-based: i)
        break;
      }
    }
    return page;
  }

  // Título de sección al que pertenece un offset
  private sectionForOffset(offset: number): string {
    let title = "General";
    for (const s of this.sections) {
      if (s.start <= offset) title = s.title;
      else break;
    }
    return title;
  }

  // Encontrar el match más cercano a la keyword dentro de la ventana
  private findClosestMatch(
    window: string,
    pattern: RegExp,
    keywordPos: number
  ): { match: RegExpExecArray; distance: number } | null {
    const flags = pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g";
    const re = new RegExp(pattern.source, flags);
    let m: RegExpExecArray | null;
    let best: { match: RegExpExecArray; distance: number } | null = null;

    while ((m = re.exec(window)) !== null) {
      const distance = Math.abs(m.index - keywordPos);
      if (!best || distance < best.distance) {
        best = { match: m, distance };
      }
      if (re.lastIndex === m.index) re.lastIndex++;
    }
    return best;
  }

  // Buscar en contexto: keyword → ventana → valor más cercano
  findCandidates(
    rule: ExtractionRule,
    maxResults = 4
  ): ExtractionResult[] {
    const results: ExtractionResult[] = [];

    for (const valuePattern of rule.valuePatterns) {
      const candidates: CandidateValue[] = [];
      const seen = new Set<string>();

      // Buscar keyword en todo el texto
      for (const keyword of rule.fieldKeywords) {
        const flags = keyword.flags.includes("g")
          ? keyword.flags
          : keyword.flags + "g";
        const keywordRe = new RegExp(keyword.source, flags);
        let match: RegExpExecArray | null;

        while ((match = keywordRe.exec(this.text)) !== null) {
          // Ventana de contexto: ±200 caracteres
          const start = Math.max(0, match.index - 200);
          const end = Math.min(this.text.length, match.index + match[0].length + 300);
          const window = this.text.slice(start, end);

          // Posición de la keyword dentro de la ventana
          const keywordPos = match.index - start + match[0].length;
          const closest = this.findClosestMatch(window, valuePattern.pattern, keywordPos);

          if (closest && closest.distance <= MAX_KEYWORD_DISTANCE) {
            const raw = closest.match[0].trim();
            const key = raw.toLowerCase();

            if (raw) {
              const fullMatchIndex = start + closest.match.index;
              const page = this.pageForOffset(match.index);
              const section = this.sectionForOffset(match.index);
              const confidence = this.calculateConfidence(
                raw,
                window,
                rule,
                closest.distance,
                section
              );

              // Solo se deduplica si el candidato es realmente válido: una
              // ocurrencia de baja confianza no debe bloquear una posterior
              // de alta confianza con el mismo valor.
              if (confidence >= MIN_CANDIDATE_CONFIDENCE && !seen.has(key)) {
                seen.add(key);
                candidates.push({
                  value: valuePattern.transform
                    ? valuePattern.transform(raw)
                    : raw,
                  context: window.replace(/\s+/g, " ").trim().substring(0, 200),
                  page,
                  section,
                  confidence,
                  rawText: raw,
                });
              }
            }
          }

          if (candidates.length >= maxResults) break;
          if (keywordRe.lastIndex === match.index) keywordRe.lastIndex++;
        }

        if (candidates.length >= maxResults) break;
      }

      // Ordenar por confianza desc (el mejor candidato primero)
      candidates.sort((a, b) => b.confidence - a.confidence);

      if (candidates.length > 0) {
        results.push({
          componentId: rule.id,
          field: valuePattern.groupName || rule.id,
          candidates,
        });
      }
    }

    return results;
  }

  // Calcular confianza basada en evidencia real (parte en 0)
  private calculateConfidence(
    value: string,
    window: string,
    rule: ExtractionRule,
    distance: number,
    sectionTitle: string
  ): number {
    let confidence = 0;

    // Unidad de medida presente → fuerte señal
    if (/\d+\s*(mm|nm|psi|kpa|bar|l|kg|°c|°f|ron)/i.test(value)) {
      confidence += 0.3;
    }

    // Cercanía a la keyword
    if (distance <= 60) confidence += 0.25;
    else if (distance <= 120) confidence += 0.15;
    else if (distance <= MAX_KEYWORD_DISTANCE) confidence += 0.1;

    // La sección donde apareció coincide con las keywords de la regla
    for (const sk of rule.sectionKeywords) {
      sk.lastIndex = 0;
      if (sk.test(sectionTitle)) {
        confidence += 0.2;
        break;
      }
    }

    // Formato típico de especificación (número + unidad letra)
    if (/^\d+[.,]?\d*\s*[A-Za-z]/.test(value)) {
      confidence += 0.15;
    }

    // Formato de referencia de pieza (letras + separador + dígitos, ej: OC-1234)
    if (/^[A-Z]{1,5}[-\s]?\d{3,6}$/i.test(value)) {
      confidence += 0.2;
    }

    // Formato de medida de neumático (ej: 205/55 R16) — inconfundible
    if (/^\d{3}\/\d{2}\s*R\d{2}$/i.test(value)) {
      confidence += 0.35;
    }

    // La keyword del campo aparece en la ventana de contexto
    for (const fk of rule.fieldKeywords) {
      fk.lastIndex = 0;
      if (fk.test(window)) {
        confidence += 0.1;
        break;
      }
    }

    return Math.min(confidence, 1);
  }

  // Construir base técnica completa
  buildDatabase(): VehicleTechnicalDatabase {
    if (this.cachedDb) return this.cachedDb;

    const components: Record<SystemCategory, Component[]> = {
      motor: [],
      fluidos: [],
      encendido: [],
      filtros: [],
      frenos: [],
      suspension: [],
      transmision: [],
      electrico: [],
      neumaticos: [],
      carroceria: [],
    };

    // Extraer componentes según reglas
    for (const rule of EXTRACTION_RULES) {
      const results = this.findCandidates(rule);

      if (results.length > 0) {
        const component: Component = {
          id: rule.id,
          system: rule.system,
          name: rule.componentName,
          icon: rule.icon,
          lastUpdated: new Date().toISOString(),
          verified: false,
        };

        // Asignar valores a campos del componente (solo confianza ≥ umbral)
        for (const result of results) {
          const bestCandidate = result.candidates[0];
          if (bestCandidate && bestCandidate.confidence >= MIN_FILL_CONFIDENCE) {
            const dataPoint: DataPoint<string> = {
              value: bestCandidate.value,
              source: "manual",
              page: bestCandidate.page,
              section: bestCandidate.section,
              confidence: bestCandidate.confidence,
              rawText: bestCandidate.rawText,
            };

            switch (result.field) {
              case "capacity": component.capacity = dataPoint; break;
              case "viscosity": component.viscosity = dataPoint; break;
              case "grade": component.grade = dataPoint; break;
              case "type":
                // "brand" y "type" comparten specification: la marca (referencia
                // OEM) tiene prioridad sobre el material/tipo (ej: NGK BKR6E > iridium)
                if (!component.specification) component.specification = dataPoint;
                break;
              case "gap": component.gap = dataPoint; break;
              case "torque": component.torque = dataPoint; break;
              case "thickness": component.thickness = dataPoint; break;
              case "pressure": component.pressure = dataPoint; break;
              case "partNumber": component.partNumber = dataPoint; break;
              case "brand": component.specification = dataPoint; break;
              case "size": component.specification = dataPoint; break;
              case "range": component.pressure = dataPoint; break;
              case "clearance": component.gap = dataPoint; break;
              default: component.specification = dataPoint;
            }
          }
        }

        // Solo se agrega el componente si logró llenar al menos un dato
        if (countFilledFields(component) > 0) {
          components[rule.system].push(component);
        }
      }
    }

    // Cobertura honesta: reglas requeridas con ≥1 dato llenado de verdad
    const requiredRules = EXTRACTION_RULES.filter((r) => r.required);
    const filledRequired = requiredRules.filter((rule) => {
      const comp = components[rule.system].find((c) => c.id === rule.id);
      return comp !== undefined && countFilledFields(comp) > 0;
    }).length;

    const coveragePercent =
      requiredRules.length > 0
        ? Math.round((filledRequired / requiredRules.length) * 100)
        : 0;

    const db: VehicleTechnicalDatabase = {
      vehicle: {
        brand: { value: "MG", source: "reference", confidence: 1 },
        model: { value: "350", source: "reference", confidence: 1 },
      },
      components,
      maintenanceSchedule: [],
      diagnostics: [],
      lastExtracted: new Date().toISOString(),
      extractionSource: "",
      coveragePercent,
    };

    this.cachedDb = db;
    return db;
  }

  // Buscar componente por nombre (usa la base cacheada)
  searchComponent(query: string): Component[] {
    const db = this.buildDatabase();
    const results: Component[] = [];
    const queryLower = query.toLowerCase();

    for (const components of Object.values(db.components)) {
      for (const comp of components) {
        if (
          comp.name.toLowerCase().includes(queryLower) ||
          comp.id.toLowerCase().includes(queryLower)
        ) {
          results.push(comp);
        }
      }
    }

    return results;
  }
}

// ── Funciones de utilidad ────────────────────────────────────────────────────
export function formatDataPoint(dp: DataPoint<string> | undefined): string {
  if (!dp) return "—";
  return dp.value;
}

export function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) return "text-emerald-400";
  if (confidence >= 0.5) return "text-yellow-400";
  return "text-red-400";
}

export function getCoverageColor(percent: number): string {
  if (percent >= 80) return "from-emerald-500 to-green-500";
  if (percent >= 50) return "from-yellow-500 to-orange-500";
  return "from-red-500 to-pink-500";
}
