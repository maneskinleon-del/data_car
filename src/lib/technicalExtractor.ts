// ============================================================================
// TechnicalExtractor — Motor de extracción técnica del manual
// ============================================================================
// Pipeline: normalize → segment → extract → validate → build database
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
  pageStart?: number;
}

export function segmentBySections(text: string): TextSection[] {
  const sections: TextSection[] = [];
  
  // Patrones de secciones comunes en manuales de taller
  const sectionPatterns = [
    /(?:^|\n)(?:ENGINE|ENGINE MECHANICAL|Motor|MOTOR|Specifications|Especificaciones)/gi,
    /(?:^|\n)(?:LUBRICATION|Lubricación|ACEITE|OIL)/gi,
    /(?:^|\n)(?:COOLING|Refrigeración|REFRIGERACIÓN|COOLANT)/gi,
    /(?:^|\n)(?:IGNITION|Encendido|ENCENDIDO|SPARK PLUG|CHISPA)/gi,
    /(?:^|\n)(?:FUEL|Combustible|COMBUSTIBLE|FUEL SYSTEM)/gi,
    /(?:^|\n)(?:BRAKE|Frenos|FRENOS|BRAKE SYSTEM)/gi,
    /(?:^|\n)(?:SUSPENSION|Suspensión|SUSPENSIÓN)/gi,
    /(?:^|\n)(?:TRANSMISSION|Transmisión|TRANSMISIÓN|MANUAL TRANSMISSION)/gi,
    /(?:^|\n)(?:ELECTRICAL|Eléctrico|ELÉCTRICO|ELECTRICAL SYSTEM)/gi,
    /(?:^|\n)(?:MAINTENANCE|Mantenimiento|MANTENIMIENTO|SERVICE)/gi,
    /(?:^|\n)(?:CAPACITY|Capacidad|CAPACIDAD|FLUID)/gi,
  ];
  
  // Dividir por líneas y buscar inicio de secciones
  const lines = text.split("\n");
  let currentSection: TextSection = { title: "General", content: "" };
  
  for (const line of lines) {
    let isSectionStart = false;
    for (const pattern of sectionPatterns) {
      pattern.lastIndex = 0;
      if (pattern.test(line.trim())) {
        // Guardar sección anterior
        if (currentSection.content.trim()) {
          sections.push(currentSection);
        }
        currentSection = { title: line.trim(), content: "" };
        isSectionStart = true;
        break;
      }
    }
    if (!isSectionStart) {
      currentSection.content += line + "\n";
    }
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
    fieldKeywords: [/aceite\s+(del\s+)?motor/i, /motor\s+oil/i],
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
    fieldKeywords: [/disco\s+(delantero|frontal|front)/i],
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
    fieldKeywords: [/presi[oó]n\s+de\s+(los\s+)?neum[aá]ticos/i],
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

// ── Motor de extracción ──────────────────────────────────────────────────────
export class TechnicalExtractor {
  private text: string;
  private sections: TextSection[];
  
  constructor(pdfText: string) {
    this.text = normalizeText(pdfText);
    this.sections = segmentBySections(this.text);
  }
  
  // Buscar en contexto: keyword → ventana → valor
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
          
          // Buscar patrón de valor en la ventana
          const valueMatch = window.match(valuePattern.pattern);
          if (valueMatch) {
            const raw = valueMatch[0].trim();
            const key = raw.toLowerCase();
            
            if (raw && !seen.has(key)) {
              seen.add(key);
              candidates.push({
                value: valuePattern.transform 
                  ? valuePattern.transform(raw) 
                  : raw,
                context: window.replace(/\s+/g, " ").trim().substring(0, 200),
                confidence: this.calculateConfidence(raw, window),
                rawText: raw,
              });
            }
          }
          
          if (candidates.length >= maxResults) break;
          if (keywordRe.lastIndex === match.index) keywordRe.lastIndex++;
        }
        
        if (candidates.length >= maxResults) break;
      }
      
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
  
  // Calcular confianza basada en contexto
  private calculateConfidence(value: string, context: string): number {
    let confidence = 0.5;
    
    // Si hay unidad de medida, +0.2
    if (/\d+\s*(mm|nm|psi|kpa|bar|l|kg|°c)/i.test(value)) {
      confidence += 0.2;
    }
    
    // Si está cerca de la keyword, +0.1
    if (context.length < 200) {
      confidence += 0.1;
    }
    
    // Si tiene formato típico de especificación, +0.1
    if (/\d+[.,]?\d*\s*[A-Z]/.test(value)) {
      confidence += 0.1;
    }
    
    return Math.min(confidence, 1);
  }
  
  // Construir base técnica completa
  buildDatabase(): VehicleTechnicalDatabase {
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
        
        // Asignar valores a campos del componente
        for (const result of results) {
          const bestCandidate = result.candidates[0];
          if (bestCandidate) {
            const dataPoint: DataPoint<string> = {
              value: bestCandidate.value,
              source: "manual",
              confidence: bestCandidate.confidence,
              rawText: bestCandidate.rawText,
            };
            
            switch (result.field) {
              case "capacity": component.capacity = dataPoint; break;
              case "viscosity": component.viscosity = dataPoint; break;
              case "grade": component.grade = dataPoint; break;
              case "type": component.specification = dataPoint; break;
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
        
        components[rule.system].push(component);
      }
    }
    
    // Calcular cobertura
    const totalRequired = EXTRACTION_RULES.filter(r => r.required).length;
    const filledRequired = Object.values(components)
      .flat()
      .filter(c => EXTRACTION_RULES.find(r => r.id === c.id)?.required && c.specification)
      .length;
    
    const coveragePercent = totalRequired > 0 
      ? Math.round((filledRequired / totalRequired) * 100) 
      : 0;
    
    return {
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
  }
  
  // Buscar componente por nombre
  searchComponent(query: string): Component[] {
    const results: Component[] = [];
    const queryLower = query.toLowerCase();
    
    for (const components of Object.values(this.findComponentsByQuery(queryLower))) {
      results.push(...components);
    }
    
    return results;
  }
  
  private findComponentsByQuery(query: string): Record<SystemCategory, Component[]> {
    const db = this.buildDatabase();
    const results: Record<SystemCategory, Component[]> = {
      motor: [], fluidos: [], encendido: [], filtros: [], frenos: [],
      suspension: [], transmision: [], electrico: [], neumaticos: [], carroceria: [],
    };
    
    for (const [system, components] of Object.entries(db.components) as [SystemCategory, Component[]][]) {
      for (const comp of components) {
        if (
          comp.name.toLowerCase().includes(query) ||
          comp.id.toLowerCase().includes(query)
        ) {
          results[system].push(comp);
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
