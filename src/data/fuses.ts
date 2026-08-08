// ============================================================================
// fuses — Leyenda de fusibles del MG 350 (plataforma SAIC AP11)
// ============================================================================
// Fuente PRINCIPAL: MANUAL DEL PROPIETARIO MG 350 (datos proporcionados por
// el dueño, 2026-08-06): leyenda COMPLETA de ambas cajas con amperaje,
// función y código de colores por amperaje. Es la referencia correcta para
// REEMPLAZAR un fusible en ruta (posición física = número en la tapa).
//
// Fuente SECUNDARIA (cruce): MANUAL DE TALLER (mg350-manual-final.pdf) —
// confirma con página de trazabilidad algunos fusibles (F05 airbag, F12 luz
// interior, F21 lavaparabrisas, fusible del ventilador). El manual de taller
// usa su propia numeración interna dispersa por sistema; cuando coincide con
// la leyenda del propietario, se anota en serviceManualNote.
//
// Regla de oro: nada de datos inventados. Los colores se toman SOLO de la
// tabla publicada en el manual del propietario (7.5A→café … 30A→verde);
// los fusibles de 40 A del capó no tienen color publicado → sin color.
// ============================================================================

export type FuseBoxId = "engine" | "cabin";

export type FuseColor = "cafe" | "rojo" | "azul" | "amarillo" | "blanco" | "verde";

export interface FuseEntry {
  id: string;                  // posición física: "EF10", "F01"...
  box: FuseBoxId;
  amps: string;                // "7.5 A", "30 A", "40 A"...
  color?: FuseColor;           // color según tabla del propietario (solo 7.5-30 A)
  circuit: string;             // función según el manual del propietario
  status?: "unused" | "spare"; // F18/F19/F27 sin uso · F28-F31 repuesto
  replacedWith?: string;       // registro de reemplazo realizado (fecha + repuesto usado)
  serviceManualNote?: string;  // cruce verificado con el manual de taller
}

// Código de colores de fusibles (cuchilla estándar) según el manual del propietario
export const FUSE_COLORS: Record<FuseColor, { name: string; hex: string }> = {
  cafe: { name: "Café", hex: "#8B5A2B" },
  rojo: { name: "Rojo", hex: "#ef4444" },
  azul: { name: "Azul", hex: "#3b82f6" },
  amarillo: { name: "Amarillo", hex: "#facc15" },
  blanco: { name: "Blanco", hex: "#e5e7eb" },
  verde: { name: "Verde", hex: "#22c55e" },
};

// Ubicación física de cada caja (manual del propietario)
export const BOX_LOCATIONS: Record<FuseBoxId, string> = {
  engine: "Compartimiento del motor · valores impresos en la placa pegada al interior de la tapa",
  cabin: "Cabina de pasajeros · lado izquierdo del tablero de instrumentos",
};

const AMPS_TO_COLOR: Record<string, FuseColor> = {
  "7.5 A": "cafe",
  "10 A": "rojo",
  "15 A": "azul",
  "20 A": "amarillo",
  "25 A": "blanco",
  "30 A": "verde",
};

export const FUSES: FuseEntry[] = [
  // ── CAJA DEL COMPARTIMIENTO DEL MOTOR (capó) ─────────────────────────────
  { id: "EF10", box: "engine", amps: "30 A", circuit: "Ventiladores de enfriamiento" },
  { id: "EF11", box: "engine", amps: "40 A", circuit: "Ventiladores de enfriamiento" },
  { id: "EF12", box: "engine", amps: "30 A", circuit: "Techo eléctrico" },
  {
    id: "EF13", box: "engine", amps: "40 A", circuit: "Ventiladores de enfriamiento",
    serviceManualNote: "El manual de taller asocia el ventilador con el fusible No.13 de esta caja, controlado por los relés R6 (baja) y R7 (alta) — p.211.",
  },
  { id: "EF14", box: "engine", amps: "20 A", circuit: "Ventana eléctrica trasera izquierda" },
  { id: "EF15", box: "engine", amps: "30 A", circuit: "Ventana eléctrica derecha" },
  { id: "EF16", box: "engine", amps: "15 A", circuit: "Ventana eléctrica trasera izquierda" },
  { id: "EF17", box: "engine", amps: "30 A", circuit: "Ventana eléctrica trasera derecha" },
  { id: "EF18", box: "engine", amps: "15 A", circuit: "Unidad de control del motor (ECU)" },
  { id: "EF19", box: "engine", amps: "10 A", circuit: "Bocina" },
  { id: "EF20", box: "engine", amps: "30 A", circuit: "Relé principal" },

  // ── CAJA DE LA CABINA DE PASAJEROS (interior) ────────────────────────────
  { id: "F01", box: "cabin", amps: "7.5 A", circuit: "Módulo de control (interruptor de contacto, posición 1)" },
  {
    id: "F02", box: "cabin", amps: "15 A", circuit: "Encendedor de cigarrillos",
    replacedWith: "Repuesto de 15 A (F28–F31) instalado el 2026-08-08; el fusible original estaba averiado.",
  },
  { id: "F03", box: "cabin", amps: "10 A", circuit: "Navegación / fuente de poder CD" },
  { id: "F04", box: "cabin", amps: "10 A", circuit: "Techo eléctrico, interruptor espejo" },
  {
    id: "F05", box: "cabin", amps: "10 A", circuit: "Airbag",
    serviceManualNote: "Coincide con el fusible 5 de la caja del habitáculo del manual de taller (airbag SRS) — p.954.",
  },
  { id: "F06", box: "cabin", amps: "15 A", circuit: "ECU del motor, ABS/DSC ECU" },
  { id: "F07", box: "cabin", amps: "10 A", circuit: "Conjunto instrumentos, módulo control carrocería (posición 2)" },
  { id: "F08", box: "cabin", amps: "10 A", circuit: "Módulo control transmisión, selector de marchas, velocidad, luz de retroceso" },
  { id: "F09", box: "cabin", amps: "15 A", circuit: "Tomacorriente" },
  { id: "F10", box: "cabin", amps: "10 A", circuit: "Relé ventilador" },
  { id: "F11", box: "cabin", amps: "10 A", circuit: "Control electrónico del aire acondicionado" },
  {
    id: "F12", box: "cabin", amps: "7.5 A", circuit: "Luz interior",
    serviceManualNote: "Coincide con el fusible No.12 del manual de taller (iluminación interior) — p.779.",
  },
  { id: "F13", box: "cabin", amps: "10 A", circuit: "Ajuste de luces principales, luces izquierda/derecha" },
  { id: "F14", box: "cabin", amps: "10 A", circuit: "Módulo de control (intermitentes, neblinero trasero)" },
  { id: "F15", box: "cabin", amps: "20 A", circuit: "Módulo de control (bloqueo de puertas)" },
  { id: "F16", box: "cabin", amps: "25 A", circuit: "Módulo de control (intermitentes, techo eléctrico, luces bajas, retardo)" },
  { id: "F17", box: "cabin", amps: "7.5 A", circuit: "Diagnóstico" },
  { id: "F18", box: "cabin", amps: "—", circuit: "Sin uso", status: "unused" },
  { id: "F19", box: "cabin", amps: "—", circuit: "Sin uso", status: "unused" },
  { id: "F20", box: "cabin", amps: "10 A", circuit: "Interruptor de las luces de freno" },
  {
    id: "F21", box: "cabin", amps: "20 A", circuit: "Módulo de control (limpiaparabrisas delanteros)",
    serviceManualNote: "El manual de taller menciona F21 (lavaparabrisas) junto al EF30 del capó — p.765.",
  },
  { id: "F22", box: "cabin", amps: "10 A", circuit: "Relé de bloqueo del cambio" },
  { id: "F23", box: "cabin", amps: "10 A", circuit: "Fuente de poder del módulo de control de la transmisión" },
  { id: "F24", box: "cabin", amps: "10 A", circuit: "Función anti-robo, grupo de instrumentos, A/C electrónico" },
  { id: "F25", box: "cabin", amps: "7.5 A", circuit: "Módulo de control (posición de partida), relé del motor de partida" },
  { id: "F26", box: "cabin", amps: "20 A", circuit: "Navegador / CD — fuente de energía normal" },
  { id: "F27", box: "cabin", amps: "—", circuit: "Sin uso", status: "unused" },
  { id: "F28", box: "cabin", amps: "7.5 A", circuit: "Repuesto", status: "spare" },
  { id: "F29", box: "cabin", amps: "10 A", circuit: "Repuesto", status: "spare" },
  { id: "F30", box: "cabin", amps: "15 A", circuit: "Repuesto", status: "spare" },
  { id: "F31", box: "cabin", amps: "20 A", circuit: "Repuesto", status: "spare" },
];

/** Entradas de una caja específica (capó o cabina). */
export function getFusesByBox(box: FuseBoxId): FuseEntry[] {
  return FUSES.filter((f) => f.box === box);
}

/** Color publicado en la tabla del propietario para un amperaje (si existe). */
export function colorForAmps(amps: string): FuseColor | undefined {
  return AMPS_TO_COLOR[amps];
}
