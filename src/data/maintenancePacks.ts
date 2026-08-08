// ============================================================================
// maintenancePacks — Packs de mantenimiento (Fase: "qué necesito comprar")
// ============================================================================
// Los packs son DECLARATIVOS: solo referencian componentes por `componentId`.
// La UI resuelve cada item contra el catálogo (getPartsFromDb) y la base
// técnica (mg350Base.json), de modo que si el catálogo se actualiza, el pack
// muestra automáticamente las referencias vigentes (OEM/aftermarket/verified)
// sin tocar el pack.
//
// Regla de oro: NADA de datos inventados. Cada item declara componentId y
// quantity; la referencia (OEM/aftermarket/estado) sale del catálogo real.
// Solo se incluyen componentes que EXISTEN en el catálogo o en la base
// técnica (componentes sin referencia aparecen como "Referencia disponible").
// ============================================================================

export interface MaintenancePackItem {
  componentId: string;   // id en domainModelV2 / mg350Base.json (ej: "spark_plug")
  quantity: number;      // cuántas unidades se necesitan
  note?: string;         // detalle de compra/instalación (p. ej. "hilo 13/16\"")
}

export interface MaintenancePack {
  id: string;            // "tune_up" | "oil_change" | ...
  name: string;          // "Afinamiento"
  icon: string;          // emoji del pack
  description: string;   // qué incluye / cuándo hacerlo
  items: MaintenancePackItem[];
}

export const MAINTENANCE_PACKS: MaintenancePack[] = [
  {
    id: "tune_up",
    name: "Afinamiento",
    icon: "🔧",
    description: "Puesta a punto del motor: encendido y admisión de aire.",
    items: [
      { componentId: "spark_plug", quantity: 4, note: "NGK PFR6Y · gap 0,9 mm · torque 20-30 Nm" },
      { componentId: "air_filter", quantity: 1, note: "Panel de la caja de aire · 26 × 9 cm" },
      { componentId: "cabin_filter", quantity: 1, note: "Filtro de polen / habitáculo" },
    ],
  },
  {
    id: "oil_change",
    name: "Cambio de aceite",
    icon: "🛢️",
    description: "Aceite de motor + filtro de aceite.",
    items: [
      { componentId: "engine_oil", quantity: 4.5, note: "5W/40 · ACEA A3/B3 · 4,5 L" },
      { componentId: "oil_filter", quantity: 1, note: "Hilo 13/16\" — verificar rosca al comprar" },
    ],
  },
  {
    id: "brakes_front",
    name: "Frenos delanteros",
    icon: "🛑",
    description: "Pastillas de freno delanteras (cambiar por juego completo de eje).",
    items: [
      { componentId: "brake_pad_front", quantity: 1, note: "Juego de eje · OEM SAIC 10026870" },
    ],
  },
  {
    id: "brakes_rear",
    name: "Frenos traseros",
    icon: "🛑",
    description: "Pastillas de freno traseras — verificar WVA 20961 (15/17 mm) antes de comprar.",
    items: [
      { componentId: "brake_pad_rear", quantity: 1, note: "OEM SAIC 10030811 · WVA 20961" },
    ],
  },
  {
    id: "cooling",
    name: "Refrigeración",
    icon: "❄️",
    description: "Reemplazo de refrigerante del circuito.",
    items: [
      { componentId: "coolant", quantity: 7.3, note: "Etileno glicol OAT · 7,3 L" },
    ],
  },
  {
    id: "ignition",
    name: "Encendido",
    icon: "⚡",
    description: "Bujías — reemplazo por set completo.",
    items: [
      { componentId: "spark_plug", quantity: 4, note: "NGK PFR6Y · gap 0,9 mm · torque 20-30 Nm" },
    ],
  },
  {
    id: "belt_alternator",
    name: "Correa del alternador",
    icon: "⛓️",
    description: "Correa Poly-V del alternador / accesorios — revisar por grietas.",
    items: [
      { componentId: "alternator_belt", quantity: 1, note: "OEM SAIC 10025044 · compartida con MG 3/MG 5/Roewe 350" },
    ],
  },
  {
    id: "full_service",
    name: "Mantención completa",
    icon: "🚗",
    description: "Mantenimiento mayor: combina afinamiento, aceite y frenos.",
    items: [
      { componentId: "spark_plug", quantity: 4, note: "NGK PFR6Y" },
      { componentId: "air_filter", quantity: 1 },
      { componentId: "cabin_filter", quantity: 1 },
      { componentId: "engine_oil", quantity: 4.5, note: "5W/40 · ACEA A3/B3" },
      { componentId: "oil_filter", quantity: 1, note: "Hilo 13/16\"" },
      { componentId: "coolant", quantity: 7.3, note: "Etileno glicol OAT" },
      { componentId: "brake_fluid", quantity: 0.75, note: "DOT4 · 0,75 L" },
    ],
  },
];

/** Devuelve un pack por id (undefined si no existe). */
export function getPack(id: string): MaintenancePack | undefined {
  return MAINTENANCE_PACKS.find((p) => p.id === id);
}
