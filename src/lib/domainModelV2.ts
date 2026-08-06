// ============================================================================
// domainModelV2 — P4/P5: dominio técnico del vehículo
// ============================================================================
// Define QUÉ buscar (conceptos), CÓMO validar (jerarquía de 7 niveles) y
// QUÉ puede publicar el manual (MANUAL_SCOPE).
//
// Jerarquía de validación (el rango NUNCA valida por sí solo):
//   1. Contexto estructural (fila de tabla / banda)
//   2. Etiqueta/concepto correcto
//   3. Unidad correcta
//   4. Variante correcta (MT/AT)
//   5. Rango de PLAUSIBILIDAD  ← descarta absurdos, no confirma exactitud
//   6. Fuente/página
//   7. Conflictos (candidatos rivales → conflict, no se muestra como válido)
// ============================================================================

import { SystemCategory, ValidationStatus } from "../types/technicalV2";

// ── Rango de plausibilidad: FILTRO, no validación ────────────────────────────
export interface PlausibilityRange {
  min: number;
  max: number;
  unit: string;
  note?: string;
}

export const PLAUSIBILITY: Record<string, PlausibilityRange> = {
  valve_clearance:      { min: 0.05, max: 0.6, unit: "mm", note: "juego de válvulas típico" },
  valve_lift:           { min: 1, max: 15, unit: "mm", note: "levantamiento de válvula" },
  plug_gap:             { min: 0.2, max: 3, unit: "mm", note: "separación de electrodos" },
  plug_torque:          { min: 1, max: 100, unit: "Nm", note: "par de apriete de bujía" },
  engine_oil_capacity:  { min: 1, max: 20, unit: "L", note: "capacidad de aceite motor" },
  transmission_capacity:{ min: 0.5, max: 15, unit: "L", note: "capacidad de caja" },
  coolant_capacity:     { min: 1, max: 20, unit: "L", note: "capacidad de refrigeración" },
  brake_capacity:       { min: 0.1, max: 2, unit: "L", note: "capacidad de líquido de frenos" },
  fuel_capacity:        { min: 20, max: 100, unit: "L", note: "capacidad del estanque" },
  wheel_torque:         { min: 10, max: 500, unit: "Nm", note: "par de apriete de rueda" },
  oil_pressure:         { min: 0.1, max: 10, unit: "bar", note: "presión de aceite" },
  tire_pressure:        { min: 1, max: 5, unit: "bar", note: "presión de neumático" },
  compression:          { min: 5, max: 20, unit: "ratio", note: "relación de compresión (X:1)" },
};

// ── Alcance del manual ──────────────────────────────────────────────────────
// "never-publishes" → slot marcado NO_PUBLICADO (el manual fue consultado y
// ese tipo de dato no existe en manuales de taller). Solo un catálogo externo
// puede cubrirlo — nunca se rellena con suposiciones.
export type ManualScope = "may-publish" | "never-publishes";

export interface SlotDef {
  id: string;                          // "capacity" | "grade" ...
  label: string;                       // "Capacidad" | "Grado" ...
  concept: RegExp;                     // qué palabras en la etiqueta identifican el slot
  valuePattern: RegExp;                // patrón del valor a capturar
  unit: string;                        // unidad esperada
  plausibility?: string;               // clave en PLAUSIBILITY (filtro)
  scope: ManualScope;
  exclude?: RegExp[];                  // etiquetas que EXCLUYEN (anti-falsos positivos)
  /** Exclusión de VALOR: se testea contra línea/etiqueta+valor. P.ej. evitar
   *  que la cilindrada "1,5 l" del motor se tome como capacidad del sistema. */
  valueExclude?: RegExp[];
  variantWhen?: { keyword: RegExp; variant: "mt" | "at" }[];  // variante por etiqueta
  transform?: (raw: string) => string; // normalización del valor crudo
  /** Extracción avanzada: recibe el texto de la ventana y devuelve el valor
   *  reconstruido (p.ej. ACEA A3/B3 partido entre dos líneas). */
  extract?: (window: string) => string | null;
}

export interface ComponentDef {
  id: string;                          // "spark_plug"
  system: SystemCategory;
  name: string;
  icon: string;
  slots: SlotDef[];
}

// ── Definición del dominio MG 350 (1.5L) ─────────────────────────────────────
export const COMPONENT_DEFS: ComponentDef[] = [
  {
    id: "engine_oil",
    system: "fluidos",
    name: "Aceite de Motor",
    icon: "🛢️",
    slots: [
      {
        id: "capacity",
        label: "Capacidad",
        concept: /aceite\s+(del\s+)?motor/i,
        valuePattern: /(\d{1,2}[.,]\d{1,2})\s*[Ll]/,
        unit: "L",
        plausibility: "engine_oil_capacity",
        scope: "may-publish",
        // Cilindrada ≠ capacidad: "Motor - 1.5L" / "- 1,5 l Motor:" son la
        // cilindrada, NO la capacidad del aceite. OJO: NO excluir "motor" a
        // secas — la fila legítima es "Aceite del motor y del filtro 4,5 l".
        valueExclude: [
          /motor\s*[-–—]\s*\d[.,]?\d*\s*[Ll]/i,
          /\d[.,]\d\s*[Ll]\s*motor/i,
        ],
        transform: (r) => r.trim(),
      },
      {
        id: "viscosity",
        label: "Viscosidad",
        // El text-layer parte "5W / 40" (con espacios): el concepto debe hallar
        // la línea del aceite; el patrón captura el grado completo.
        concept: /aceite\s+(del\s+)?motor|aceite\s+5W|5W\s*[-/]\s*\d{1,2}|10W\s*[-/]\s*\d{1,2}|0W\s*[-/]\s*\d{1,2}/i,
        valuePattern: /(\d{1,2}\s*W\s*[-/]\s*\d{1,2})/,
        unit: "SAE",
        scope: "may-publish",
        transform: (r) => r.replace(/\s+/g, "").replace(/-/g, "/"),
      },
      {
        id: "grade",
        label: "Norma",
        concept: /aceite\s+(del\s+)?motor|especificaci[oó]n|ACEA|API/i,
        valuePattern: /(ACEA\s*A3\/B3|ACEA\s*A3\s*\/?\s*B3|API\s*\w+)/i,
        unit: "norma",
        scope: "may-publish",
        // El text-layer parte "ACEA A3/B3" entre líneas: "especificaciÛn / B3"
        // + "ACEA A3." → reconstruir buscando tokens A#/B# cerca de ACEA.
        extract: (win) => {
          const acea = win.match(/ACEA\s*([AB]\d)/i);
          if (!acea) return null;
          const tokens = new Set<string>();
          for (const m of win.matchAll(/([AB]\d)/g)) tokens.add(m[1].toUpperCase());
          const ordered = [...tokens].sort();
          return ordered.length > 0 ? `ACEA ${ordered.join("/")}` : `ACEA ${acea[1].toUpperCase()}`;
        },
      },
    ],
  },
  {
    id: "transmission_oil",
    system: "transmision",
    name: "Aceite de Transmisión",
    icon: "⚙️",
    slots: [
      {
        id: "capacity",
        label: "Capacidad",
        concept: /transmisi[oó]n/i,
        // decimal OPCIONAL: el manual usa "Llene 2 L" (entero) y "Relleno seca 2,2 L"
        valuePattern: /(\d{1,2}(?:[.,]\d{1,2})?)\s*[Ll]/,
        unit: "L",
        plausibility: "transmission_capacity",
        scope: "may-publish",
        valueExclude: [/Motor/i],
        // ANTI-FALSOS POSITIVOS: "Conjunto de la transmisión" (p.382, lista de
        // partes del despiece → el "1,5 l" es la cilindrada, no una capacidad)
        // y "Contorno de transmisión máxima Tamaño" (p.381, dimensión externa;
        // los valores 2,0/2,2 L de esa fila son del MT pero sin variante → se
        // descartan para no mostrar "transmisión genérica" engañoso).
        exclude: [
          /conjunto\s+de\s+la\s+transmisi[oó]n/i,
          /contorno\s+de\s+transmisi[oó]n/i,
        ],
        variantWhen: [
          { keyword: /manual|MT/i, variant: "mt" },
          { keyword: /autom[aá]tica|AT\b/i, variant: "at" },
        ],
        transform: (r) => r.trim(),
      },
      {
        id: "grade",
        label: "Grado",
        concept: /transmisi[oó]n/i,
        valuePattern: /(MTF\s*\d+|JW\s*-?\s*\d+|\d+\s*-\s*\d+\s*aceite|GL-?[45])/i,
        unit: "norma",
        scope: "may-publish",
        variantWhen: [
          { keyword: /manual|MT/i, variant: "mt" },
          { keyword: /autom[aá]tica|AT\b/i, variant: "at" },
        ],
        transform: (r) => r.trim(),
      },
    ],
  },
  {
    id: "coolant",
    system: "fluidos",
    name: "Refrigerante",
    icon: "❄️",
    slots: [
      {
        id: "capacity",
        label: "Capacidad",
        concept: /sistema\s+de\s+refrigeraci[oó]n|refrigerante|anticongelante/i,
        valuePattern: /(\d{1,2}[.,]\d{1,2})\s*[Ll]/,
        unit: "L",
        plausibility: "coolant_capacity",
        scope: "may-publish",
        // "Sistema de refrigeración - 1,5 l Motor:" → la cilindrada NO es la capacidad
        valueExclude: [/Motor/i],
        transform: (r) => r.trim(),
      },
      {
        id: "type",
        label: "Tipo",
        concept: /anticongelante|refrigerante/i,
        // \b evita falsos positivos por substring: "IAT" matcheaba dentro de
        // "inmediatamente" (p.25-64) — la Prioridad 1 dice que un dato
        // incorrecto es peor que uno ausente. El manual p.75 dice "50% OAT
        // (ácido orgánico)" y "anticongelante a base de etileno glicol".
        valuePattern: /(\bOAT\b|\bIAT\b|\bHOAT\b|etileno\s*glicol)/i,
        unit: "tipo",
        scope: "may-publish",
        transform: (r) => r.trim(),
      },
    ],
  },
  {
    id: "brake_fluid",
    system: "fluidos",
    name: "Líquido de Frenos",
    icon: "🛑",
    slots: [
      {
        id: "grade",
        label: "Grado",
        concept: /l[ií]quido\s+de\s+frenos|fluido\s+de\s+frenos|frenos/i,
        valuePattern: /(DOT\s*[345])/i,
        unit: "DOT",
        scope: "may-publish",
        // El DOT4 aplica al sistema frenos/embrague (depósito compartido)
        transform: (r) => r.replace(/\s+/g, "").toUpperCase(),
      },
      {
        id: "capacity",
        label: "Capacidad",
        concept: /frenos/i,
        valuePattern: /(\d{1,2}[.,]\d{1,2})\s*[Ll]/,
        unit: "L",
        plausibility: "brake_capacity",
        scope: "may-publish",
        variantWhen: [
          { keyword: /\bMT\b/i, variant: "mt" },
          { keyword: /\bAT\b/i, variant: "at" },
        ],
        transform: (r) => r.trim(),
      },
    ],
  },
  {
    // Pastillas de freno DELANTERAS — el manual NO publica la referencia
    // (solo procedimientos de cambio, p.601-625). El catálogo (Fase 2) la
    // aporta: OEM SAIC 10026870 + equivalencias TRW/Ferodo/Brembo/Delphi.
    id: "brake_pad_front",
    system: "frenos",
    name: "Pastillas de Freno Delanteras",
    icon: "🛑",
    slots: [
      {
        id: "partNumber",
        label: "Referencia",
        concept: /pastill.*delanter|brake\s*pad.*front|freno.*delanter/i,
        valuePattern: /\d{8}|[A-Z]{1,4}\s?\d{3,6}/,
        unit: "ref",
        scope: "never-publishes",
        transform: (r) => r.trim(),
      },
    ],
  },
  {
    // Pastillas de freno TRASERAS — el manual NO publica la referencia.
    // El catálogo aporta OEM SAIC 10030811 + equivalencias (Brembo P 85 017).
    id: "brake_pad_rear",
    system: "frenos",
    name: "Pastillas de Freno Traseras",
    icon: "🛑",
    slots: [
      {
        id: "partNumber",
        label: "Referencia",
        concept: /pastill.*traser|brake\s*pad.*rear|freno.*traser/i,
        valuePattern: /\d{8}|[A-Z]{1,4}\s?\d{3,6}/,
        unit: "ref",
        scope: "never-publishes",
        transform: (r) => r.trim(),
      },
    ],
  },
  {
    id: "fuel_tank",
    system: "fluidos",
    name: "Estanque de Combustible",
    icon: "⛽",
    slots: [
      {
        id: "capacity",
        label: "Capacidad",
        concept: /dep[oó]sito|estanque|combusti ble?/i,
        valuePattern: /(\d{2,3})\s*[Ll]/,
        unit: "L",
        plausibility: "fuel_capacity",
        scope: "may-publish",
        // ANTI-FALSO POSITIVO: el caudal de la bomba de combustible (p.245)
        // "0,65 L / min" NO es la capacidad del estanque (55 L / 56 L).
        valueExclude: [
          /bomba\s+de\s+suministro/i,
          /[Ll]\s*\/\s*min/i,
          /caudal/i,
        ],
        transform: (r) => r.trim(),
      },
      {
        id: "octane",
        label: "Octanaje",
        concept: /gasolina|combustible/i,
        valuePattern: /(\d{2,3})\s*RON/i,
        unit: "RON",
        scope: "may-publish",
        transform: (r) => r.replace(/\s+/g, "").toUpperCase(),
      },
    ],
  },
  {
    id: "spark_plug",
    system: "encendido",
    name: "Bujías",
    icon: "⚡",
    slots: [
      {
        id: "partNumber",
        label: "Referencia",
        concept: /buj[ií]a|spark|NGK|PFR/i,
        // captura marca + código, evitando "Brecha"/"gap" como parte del código
        valuePattern: /(NGK\s*[A-Z0-9]{4,}|DENSO\s*[A-Z0-9]+|CHAMPION\s*[A-Z0-9]+)/i,
        unit: "ref",
        scope: "may-publish",
        exclude: [/brecha/i, /\bgap\b/i],
        transform: (r) => {
          // "NGKPFR6Y" (text-layer pegado) → "NGK PFR6Y"
          const m = r.match(/^(NGK|DENSO|CHAMPION)\s*([A-Z0-9]+)$/i);
          return m ? `${m[1].toUpperCase()} ${m[2].toUpperCase()}` : r.trim();
        },
      },
      {
        id: "gap",
        label: "Gap",
        // ANCLADO A BUJÍA: "Brecha" a secas es ambiguo (p.81 lo usa para la
        // holgura vástago-guía de válvulas, p.324 para el convertidor de par).
        // En p.243 el manual escribe "Bujía:" → "Brecha0,9 mm": el concepto
        // bujía + la fila "Brecha" de la misma fila entregan el gap real.
        concept: /buj[ií]a/i,
        valuePattern: /(\d[.,]\d)\s*[-–—]?\s*(\d[.,]\d)?\s*mm/,
        unit: "mm",
        plausibility: "plug_gap",
        scope: "may-publish",
        exclude: [/v[aá]lvula|asiento|v[aá]stago/i],
        transform: (r) => r.trim(),
      },
      {
        id: "torque",
        label: "Torque",
        concept: /buj[ií]a/i,
        valuePattern: /(\d{2})\s*[-–—]\s*(\d{2})\s*Nm/,
        unit: "Nm",
        plausibility: "plug_torque",
        scope: "may-publish",
        exclude: [/v[aá]lvula/i],
        transform: (r) => r.trim(),
      },
    ],
  },
  {
    id: "valve",
    system: "motor",
    name: "Válvulas",
    icon: "🔩",
    slots: [
      {
        id: "clearance",
        label: "Juego de Válvulas",
        concept: /gap\s*v[aá]lvula|juego\s+(de\s+)?v[aá]lvulas|holgura|brecha\s+entre/i,
        valuePattern: /(\d[.,]\d{2})\s*[-–—]\s*(\d[.,]\d{2})\s*mm/,
        unit: "mm",
        plausibility: "valve_clearance",
        scope: "may-publish",
        // ANTI-FALSO POSITIVO CLAVE: "Ascensor máximo" = LEVANTAMIENTO, no juego
        exclude: [/ascensor|levantamiento|lift|m[aá]ximo\s+de\s+elevaci[oó]n/i],
        transform: (r) => r.trim(),
      },
      {
        id: "lift",
        label: "Levantamiento",
        // Solo "Ascensor máximo" (p.83): NUNCA el gap de válvulas (p.84)
        concept: /ascensor\s+m[aá]ximo|levantamiento/i,
        valuePattern: /(\d[.,]\d)\s*mm/,
        unit: "mm",
        plausibility: "valve_lift",
        scope: "may-publish",
        exclude: [/brecha|juego|holgura|gap\s*v[aá]lvula/i],
        transform: (r) => r.trim(),
      },
    ],
  },
  {
    id: "oil_filter",
    system: "filtros",
    name: "Filtro de Aceite",
    icon: "🧰",
    slots: [
      {
        id: "partNumber",
        label: "Referencia",
        concept: /filtro\s+de\s+aceite|oil\s+filter/i,
        valuePattern: /[A-Z]{1,5}\s?[-]?\s?\d{3,6}/,
        unit: "ref",
        scope: "never-publishes",
        transform: (r) => r.trim(),
      },
    ],
  },
  {
    id: "air_filter",
    system: "filtros",
    name: "Filtro de Aire",
    icon: "🌬️",
    slots: [
      {
        id: "partNumber",
        label: "Referencia",
        concept: /filtro\s+de\s+aire|air\s+filter/i,
        valuePattern: /[A-Z]{1,5}\s?[-]?\s?\d{3,6}/,
        unit: "ref",
        scope: "never-publishes",
        transform: (r) => r.trim(),
      },
    ],
  },
  {
    id: "cabin_filter",
    system: "filtros",
    name: "Filtro de Polen / Habitáculo",
    icon: "🏠",
    slots: [
      {
        id: "partNumber",
        label: "Referencia",
        concept: /filtro\s+(de\s+)?(polen|polvo|cabina|habit[aá]culo|aire\s+acondicionado)/i,
        valuePattern: /[A-Z]{1,5}\s?[-]?\s?\d{3,6}/,
        unit: "ref",
        scope: "never-publishes",
        transform: (r) => r.trim(),
      },
    ],
  },
  {
    id: "wheel_torque",
    system: "neumaticos",
    name: "Torque de Rueda",
    icon: "🔧",
    slots: [
      {
        id: "torque",
        label: "Torque",
        concept: /tornillos?\s+de\s+rueda|pernos?\s+de\s+rueda|tuercas?\s+de\s+rueda|wheel\s+(nut|bolt)/i,
        valuePattern: /(\d{2,3})\s*[-–—]?\s*(\d{2,3})?\s*Nm/,
        unit: "Nm",
        plausibility: "wheel_torque",
        scope: "may-publish",
        exclude: [/dentada/i],  // "rueda dentada" = sprocket, no rueda del vehículo
        transform: (r) => r.trim(),
      },
    ],
  },
  {
    id: "tire_size",
    system: "neumaticos",
    name: "Medida de Neumáticos",
    icon: "🛞",
    slots: [
      {
        id: "size",
        label: "Medida",
        concept: /neum[aá]tico|rueda|tire|205\/55/i,
        valuePattern: /(\d{3})\/(\d{2})\s*R\s*(\d{2})/,
        unit: "medida",
        scope: "may-publish",
        transform: (r) => r.trim(),
      },
      {
        // Presión de los neumáticos — p.598 del manual ("Presión de los
        // neumáticos - Normal: Frente 2,1 bar Posterior 2,1 bar"). Datos
        // reales del manual; no confundir con la tapa del radiador (93-123 kPa).
        id: "pressure",
        label: "Presión",
        concept: /presi[oó]n\s+de\s+(los\s+)?neum[aá]ticos|tire\s+pressure/i,
        valuePattern: /(\d[.,]\d)\s*bar/,
        unit: "bar",
        plausibility: "tire_pressure",
        scope: "may-publish",
        exclude: [/radiador|tapa\s+del\s+radiador|kpa/i],
        transform: (r) => r.trim(),
      },
    ],
  },
  {
    // Plumilla / limpiaparabrisas — el manual no publica la referencia; el
    // catálogo (Fase 2) la aporta con los datos instalados por el dueño
    // (conductor 23" y pasajero 16", ambas tipo J).
    id: "wiper_blade",
    system: "carroceria",
    name: "Plumillas Delanteras",
    icon: "🌧️",
    slots: [
      {
        id: "partNumber",
        label: "Referencia",
        concept: /plumilla|limpiaparabrisas/i,
        valuePattern: /\d{2}\s*[“”"]|\d{2,3}\s*cm/i,
        unit: "ref",
        scope: "never-publishes",
        transform: (r) => r.trim(),
      },
    ],
  },
  {
    // Plumilla trasera — NO APLICA en el MG 350S (sedán). El componente
    // existe para declararlo explícitamente en la UI (mejor que un silencio).
    id: "wiper_rear",
    system: "carroceria",
    name: "Plumilla Trasera",
    icon: "🌧️",
    slots: [
      {
        id: "partNumber",
        label: "Referencia",
        concept: /plumilla\s+trasera|limpiaparabrisas\s+trasero/i,
        valuePattern: /\d{2}\s*[“”"]|\d{2,3}\s*cm/i,
        unit: "ref",
        scope: "never-publishes",
        transform: (r) => r.trim(),
      },
    ],
  },
  {
    // Iluminación principal — el manual no publica la referencia; el catálogo
    // la aporta (LED H4 instalados por el dueño).
    id: "headlight",
    system: "electrico",
    name: "Iluminación Principal",
    icon: "💡",
    slots: [
      {
        id: "partNumber",
        label: "Referencia",
        concept: /iluminaci[oó]n|faro|headlight/i,
        valuePattern: /H\d|LED|\d+\s*W/i,
        unit: "ref",
        scope: "never-publishes",
        transform: (r) => r.trim(),
      },
    ],
  },
  {
    // Batería — el manual de taller NO publica su especificación (solo
    // procedimientos de desconexión, p.49-58). El catálogo (Fase 2) la aporta:
    // grupo DIN L1 (50-54 Ah, 450-530 CCA EN, 207×175×190 mm, R+).
    id: "battery",
    system: "electrico",
    name: "Batería",
    icon: "🔋",
    slots: [
      {
        id: "capacity",
        label: "Capacidad",
        concept: /bater[ií]a|battery/i,
        valuePattern: /(\d{2})\s*Ah/,
        unit: "Ah",
        scope: "never-publishes",
        transform: (r) => r.trim(),
      },
      {
        id: "group",
        label: "Grupo / Medida",
        concept: /bater[ií]a|battery|DIN|grupo/i,
        valuePattern: /(DIN\s*L1|\d{3}\s*[×x]\s*\d{3}\s*[×x]\s*\d{3})/i,
        unit: "grupo",
        scope: "never-publishes",
        transform: (r) => r.trim(),
      },
    ],
  },
];

export function getComponentDef(id: string): ComponentDef | undefined {
  return COMPONENT_DEFS.find((c) => c.id === id);
}

// ── Validación: jerarquía de 7 niveles → ValidationStatus ───────────────────
export interface ValidationInput {
  structural: boolean;      // (1) vino de una fila de tabla / banda estructurada
  labelMatched: boolean;    // (2) etiqueta/concepto correcto
  unitMatched: boolean;     // (3) unidad correcta
  variantResolved: boolean; // (4) variante resuelta o no aplica
  plausibilityOk: boolean;  // (5) rango de plausibilidad (filtro)
  hasSource: boolean;       // (6) página/fuente conocida
  conflict: boolean;        // (7) candidatos rivales
  confidence: number;
}

/**
 * Decide el ValidationStatus según la jerarquía. El rango de plausibilidad
 * NUNCA valida por sí solo: solo descarta (invalid) si está fuera de rango.
 * Para "verified" se exige estructura + etiqueta + unidad + variante + fuente
 * + confianza alta y sin conflicto. "plausible" pasó los filtros con evidencia
 * de prosa (no estructural).
 */
export function validateValue(input: ValidationInput): ValidationStatus {
  // (5) filtro de plausibilidad: fuera de rango → invalid (descartar absurdos)
  if (!input.plausibilityOk) return "invalid";

  // (7) conflicto sin resolver → nunca mostrar como válido
  if (input.conflict) return "conflict";

  // requisitos mínimos para ser siquiera plausible
  if (!input.labelMatched || !input.unitMatched) return "invalid";

  // verified: evidencia estructural completa y demostrable
  if (
    input.structural &&
    input.labelMatched &&
    input.unitMatched &&
    input.variantResolved &&
    input.hasSource &&
    input.confidence >= 0.8 &&
    !input.conflict
  ) {
    return "verified";
  }

  // plausible: pasó filtros pero sin evidencia estructural completa
  if (input.hasSource && input.confidence >= 0.5) return "plausible";

  return "invalid";
}
