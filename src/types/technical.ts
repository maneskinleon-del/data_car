// ============================================================================
// VehicleTechnicalDatabase — Schema para la base técnica del vehículo
// ============================================================================
// Cada componente tiene: especificación + identificación de pieza + procedimiento
// Cada dato conserva su procedencia (source, page, section, confidence)
// ============================================================================

export interface DataPoint<T = string> {
  value: T;
  source: "manual" | "catalog" | "reference" | "user";
  page?: number;
  section?: string;
  confidence: number; // 0-1
  rawText?: string; // texto original del PDF
}

// ── Componente base ──────────────────────────────────────────────────────────
export interface Component {
  id: string; // ej: "spark_plug_1"
  system: SystemCategory;
  name: string;
  icon: string;
  
  // Especificación técnica
  specification?: DataPoint<string>;
  capacity?: DataPoint<string>; // capacidad (litros, etc.)
  viscosity?: DataPoint<string>; // viscosidad del aceite
  grade?: DataPoint<string>; // grado (GL-4, DOT4, etc.)
  gap?: DataPoint<string>; // separación (bujías)
  torque?: DataPoint<string>; // par de apriete
  pressure?: DataPoint<string>; // presión
  temperature?: DataPoint<string>; // temperatura
  thickness?: DataPoint<string>; // espesor mínimo
  interval?: DataPoint<string>; // intervalo de servicio
  
  // Identificación de pieza
  partNumber?: DataPoint<string>; // número de pieza OEM
  alternateParts?: AlternatePart[]; // referencias cruzadas
  position?: DataPoint<string>; // ubicación (delantero/trasero/etc.)
  quantity?: DataPoint<number>; // cantidad por vehículo
  engine?: DataPoint<string>; // motor aplicable
  year?: DataPoint<string>; // año aplicable
  
  // Procedimiento
  procedure?: {
    steps?: string[];
    tools?: string[];
    warnings?: string[];
    notes?: string[];
  };
  
  // Metadatos
  lastUpdated: string;
  verified: boolean; // confirmado por usuario
}

export interface AlternatePart {
  brand: string;
  partNumber: string;
  compatible: boolean;
}

export type SystemCategory = 
  | "motor"
  | "fluidos"
  | "encendido"
  | "filtros"
  | "frenos"
  | "suspension"
  | "transmision"
  | "electrico"
  | "neumaticos"
  | "carroceria";

// ── Base técnica completa ────────────────────────────────────────────────────
export interface VehicleTechnicalDatabase {
  // Identificación del vehículo
  vehicle: {
    brand: DataPoint<string>;
    model: DataPoint<string>;
    year?: DataPoint<string>;
    engine?: DataPoint<string>;
    engineCode?: DataPoint<string>;
    transmission?: DataPoint<string>;
    vin?: DataPoint<string>;
    market?: DataPoint<string>; // mercado (Latam, China, etc.)
  };
  
  // Componentes organizados por sistema
  components: Record<SystemCategory, Component[]>;
  
  // Mantenimiento programado
  maintenanceSchedule: MaintenanceItem[];
  
  // Diagnóstico
  diagnostics: DiagnosticCode[];
  
  // Metadatos
  lastExtracted: string;
  extractionSource: string; // nombre del PDF
  coveragePercent: number; // cobertura técnica calculada
}

export interface MaintenanceItem {
  interval: DataPoint<string>; // ej: "10,000 km"
  items: string[]; // IDs de componentes a revisar/cambiar
  description: string;
}

export interface DiagnosticCode {
  code: string;
  description: string;
  possibleCauses: string[];
  actions: string[];
  source: "SAE" | "manufacturer";
}

// ── Configuración de extracción ──────────────────────────────────────────────
export interface ExtractionRule {
  id: string;
  system: SystemCategory;
  componentName: string;
  icon: string;
  
  // Paso 1: dónde buscar
  sectionKeywords: RegExp[]; // secciones del manual
  fieldKeywords: RegExp[]; // palabras clave del campo
  
  // Paso 2: qué extraer
  valuePatterns: ValuePattern[];
  
  // Paso 3: validación
  validator?: (value: string) => boolean;
  
  // Metadatos
  unitHint: string;
  required: boolean;
}

export interface ValuePattern {
  pattern: RegExp;
  groupName?: string; // nombre del grupo de captura
  transform?: (match: string) => string; // transformación post-match
}

// ── Resultado de extracción ──────────────────────────────────────────────────
export interface ExtractionResult {
  componentId: string;
  field: string;
  candidates: CandidateValue[];
  selected?: CandidateValue;
}

export interface CandidateValue {
  value: string;
  context: string;
  page?: number;
  section?: string;
  confidence: number;
  rawText: string;
}

// ── Estado de la UI ──────────────────────────────────────────────────────────
export interface TechnicalDatabaseState {
  database: VehicleTechnicalDatabase | null;
  isExtracting: boolean;
  extractionProgress: number;
  currentStep: string;
  errors: string[];
}
