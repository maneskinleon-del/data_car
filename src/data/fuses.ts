// ============================================================================
// fuses — Directorio de fusibles y relés del MG 350 (plataforma SAIC AP11)
// ============================================================================
// Extraído del MANUAL DE TALLER REAL (mg350-manual-final.pdf, 1018 páginas):
// el manual NO publica una leyenda consolidada de la caja de fusibles; las
// referencias están dispersas por sistema en los diagramas de control. Esta
// lista recopila CADA referencia documentada con su página (trazabilidad).
//
// Regla de oro: nada de datos inventados. Solo entradas con circuito y página
// verificables. El amperaje se incluye ÚNICAMENTE cuando el manual lo publica
// (ej. asiento eléctrico 30A). Si un circuito no aparece listado, la tapa de
// la caja del vehículo es la fuente autoritativa.
//
// Nomenclatura del manual: EF# = caja del compartimiento del motor (capó);
// F# / No.# = caja del habitáculo (lado pasajero). Los relés R# viven en la
// caja del capó.
// ============================================================================

export type FuseBoxId = "engine" | "cabin";

export interface FuseEntry {
  id: string;          // referencia del manual: "EF1", "No.13", "F05", "R3"...
  kind: "fuse" | "relay";
  box: FuseBoxId;
  circuit: string;     // qué protege / qué controla
  amps?: string;       // solo si el manual lo publica
  page: number;        // página del PDF donde se documenta
}

export const FUSES: FuseEntry[] = [
  // ── CAJA DEL COMPARTIMIENTO DEL MOTOR (capó) ─────────────────────────────
  { id: "EF1", kind: "fuse", box: "engine", circuit: "Limpiaparabrisas (velocidad baja/alta)", page: 764 },
  { id: "EF30", kind: "fuse", box: "engine", circuit: "Lavaparabrisas (junto a F21 del habitáculo)", page: 765 },
  { id: "EF7", kind: "fuse", box: "engine", circuit: "Asistente de estacionamiento (sensores PDC)", page: 969 },
  { id: "EF9", kind: "fuse", box: "engine", circuit: "Infoentretenimiento (radio / CD / navegación)", page: 980 },
  { id: "EF23", kind: "fuse", box: "engine", circuit: "ECM — alimentación directa del módulo del motor", page: 252 },
  { id: "No.13", kind: "fuse", box: "engine", circuit: "Ventilador de refrigeración (con relés R6/R7)", page: 211 },
  { id: "No.37", kind: "fuse", box: "engine", circuit: "Iluminación interior (alimentación batería)", page: 779 },
  { id: "R3", kind: "relay", box: "engine", circuit: "Relé principal (alimentación ECM/encendido)", page: 252 },
  { id: "R6", kind: "relay", box: "engine", circuit: "Relé ventilador de refrigeración — baja velocidad", page: 211 },
  { id: "R7", kind: "relay", box: "engine", circuit: "Relé ventilador de refrigeración — alta velocidad", page: 211 },
  { id: "No.10", kind: "relay", box: "engine", circuit: "Relé embrague del compresor del A/C", page: 490 },

  // ── CAJA DEL HABITÁCULO (interior, lado pasajero) ────────────────────────
  { id: "F05", kind: "fuse", box: "cabin", circuit: "Airbag SRS — luz de advertencia / pretensores", page: 954 },
  { id: "F21", kind: "fuse", box: "cabin", circuit: "Lavaparabrisas (junto a EF30 del capó)", page: 765 },
  { id: "No.12", kind: "fuse", box: "cabin", circuit: "Iluminación interior", page: 779 },
  { id: "No.25", kind: "fuse", box: "cabin", circuit: "Asiento del conductor eléctrico (ajuste)", amps: "30 A", page: 694 },
  { id: "No.2", kind: "fuse", box: "cabin", circuit: "Techo corredizo (motor/ECU)", page: 748 },
];

/** Entradas de una caja específica (capó o habitáculo). */
export function getFusesByBox(box: FuseBoxId): FuseEntry[] {
  return FUSES.filter((f) => f.box === box);
}
