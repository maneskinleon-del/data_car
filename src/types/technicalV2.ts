// ============================================================================
// technicalV2 — Modelo de datos V2: extracción estructurada del manual
// ============================================================================
// Diferencias clave vs V1:
//   • Se conservan coordenadas x/y del PDF (layout) — no se aplana a texto.
//   • validationStatus separa: EXTRACTED (encontré estructuralmente) ≠
//     VALIDATED (pasó comprobaciones) ≠ VERIFIED (demostrable de dónde salió).
//   • Los rangos son FILTROS DE PLAUSIBILIDAD (descartan absurdos), NUNCA
//     validación de exactitud: 0,40 mm puede estar en rango y ser incorrecto.
//   • status distingue: ✓ EXTRAÍDO / ⚪ NO ENCONTRADO / ⚠️ NO PUBLICADO.
//   • Variantes del vehículo (MT/AT) como valores separados, no mezclados.
//   • parts queda separado del manual: listo para catálogo OEM externo.
// ============================================================================

// ── Estados ──────────────────────────────────────────────────────────────────
/** Estado de extracción del dato vs el manual consultado. */
export type DataStatus = "extracted" | "not_found" | "not_published";

/**
 * Estado de validación — separa conceptualmente:
 *   verified  → además de pasar validación, el origen es demostrable
 *               (página + tabla + texto original conservados).
 *   plausible → pasó contexto estructural + etiqueta + unidad + rango.
 *   conflict  → hay candidatos rivales sin resolver → NO mostrar como válido.
 *   invalid   → descartado por rango de plausibilidad / unidad / etiqueta.
 */
export type ValidationStatus = "verified" | "plausible" | "conflict" | "invalid";

/** Procedencia de un dato: manual vs fuentes externas de piezas. */
export type PartSource = "manual" | "catalog" | "aftermarket" | "equivalence" | "user";

// ── Trazabilidad ────────────────────────────────────────────────────────────
export interface SourceRef {
  document: string;      // nombre del PDF
  pages: number[];       // páginas 1-based reales
  section?: string;      // título de sección detectado
  tableRef?: string;     // ej: "Tabla de fluidos"
  rawText?: string;      // texto original de la celda/línea (sin normalizar)
}

export interface VariantRef {
  kind: "transmission" | "engine" | "market";
  id: string;            // "mt" | "at"
  label: string;         // "Transmisión Manual (MT)"
}

// ── Valor técnico ───────────────────────────────────────────────────────────
export interface TechValue<T = string> {
  value: T;
  status: DataStatus;
  validationStatus: ValidationStatus;
  source?: SourceRef;              // solo si status === "extracted"
  confidence: number;              // 0-1, solo extracted
  variant?: VariantRef;
  conflict?: boolean;              // hubo candidatos rivales
  catalogRef?: string;             // id del proveedor de catálogo (futuro)
}

// ── Campo de especificación ─────────────────────────────────────────────────
export interface SpecField {
  id: string;                      // "capacity" | "viscosity" | "partNumber" ...
  label: string;                   // "Capacidad" | "Grado" ...
  values: TechValue[];             // uno o varios (variantes MT/AT)
  dependsOnVariant: boolean;       // true → la UI debe pedir MT/AT
  expectedUnit?: string;           // "L" | "mm" | "Nm" ...
}

// ── Componente ──────────────────────────────────────────────────────────────
export interface TechnicalComponentV2 {
  id: string;                      // "spark_plug"
  system: SystemCategory;
  name: string;
  icon: string;
  specFields: SpecField[];         // TODOS los slots definidos, con su estado
  status: DataStatus;              // estado global del componente
  validationStatus: ValidationStatus;
  source?: SourceRef;
  lastUpdated: string;
  verified: boolean;               // confirmado por usuario
}

// ── Catálogo de piezas (separado del manual — Fase 2) ───────────────────────
export interface PartInfo {
  oem?: string;
  aftermarket: { brand: string; partNumber: string }[];
  compatible: string[];
  source: PartSource;
  provenance?: SourceRef;          // si vino del manual
  verified: boolean;               // true → referencia confirmada; false → candidata
  note?: string;                   // nota de verificación / origen / advertencia
}

export interface PartsCatalogProvider {
  id: string;                      // "saic-oem" | "autodoc" ...
  name: string;
  lookup(p: { componentId: string; vehicle: VehicleIdentity; query?: string }): Promise<PartInfo[]>;
}

export interface PartsDatabase {
  entries: { componentId: string; parts: PartInfo[] }[];
}

// ── Identidad del vehículo ──────────────────────────────────────────────────
export interface VehicleIdentity {
  brand?: string;
  model?: string;
  year?: string;
  engine?: string;                 // ej: "1.5L"
  engineCode?: string;
  transmission?: "mt" | "at" | "unknown";
  vin?: string;
  market?: string;
}

// ── Base técnica V2 ─────────────────────────────────────────────────────────
export interface VehicleTechnicalDatabaseV2 {
  schemaVersion: 2;
  vehicle: VehicleIdentity;
  components: Record<SystemCategory, TechnicalComponentV2[]>;
  parts: PartsDatabase;            // vacío hasta conectar catálogo
  maintenanceSchedule: MaintenanceItem[];
  diagnostics: DiagnosticCode[];
  lastExtracted: string;
  extractionSource: string;
  coverage: {
    totalSlots: number;
    extracted: number;
    notFound: number;
    notPublished: number;
    decisionReady: number;         // componentes con ≥1 dato verified/plausible sin conflicto
  };
}

// ── Reutilizados de V1 ──────────────────────────────────────────────────────
export type SystemCategory =
  | "motor" | "fluidos" | "encendido" | "filtros" | "frenos"
  | "suspension" | "transmision" | "electrico" | "neumaticos" | "carroceria";

export interface MaintenanceItem {
  interval: DataPoint<string>;
  items: string[];
  description: string;
}

export interface DiagnosticCode {
  code: string;
  description: string;
  possibleCauses: string[];
  actions: string[];
  source: "SAE" | "manufacturer";
}

export interface DataPoint<T = string> {
  value: T;
  source: "manual" | "catalog" | "reference" | "user";
  page?: number;
  section?: string;
  confidence: number;
  rawText?: string;
}
