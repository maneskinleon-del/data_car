// ============================================================================
// specsSyncV2 — Puente entre la Base Técnica V2 y la ficha del vehículo.
// ============================================================================
// Reglas de exactitud (Prioridad 1):
//   • SOLO se sincronizan valores con status === "extracted" y confianza
//     ≥ MIN_FILL_CONFIDENCE. Un valor ⚪ not_found o ⚠️ not_published NUNCA
//     se copia a la ficha (no es un error del extractor: es que el manual no
//     lo publica).
//   • Variantes MT/AT: si la ficha ya declara la transmisión, se elige el
//     valor de esa variante; si no la declara y el dato depende de la
//     variante, NO se elige arbitrariamente el primero — se omite (la UI
//     muestra "depende de la transmisión").
// ============================================================================

import { VehicleSpecs } from "../types";
import {
  VehicleTechnicalDatabaseV2,
  TechnicalComponentV2,
  SpecField,
  SystemCategory,
  PartInfo,
} from "../types/technicalV2";
import { lookupVerifiedParts } from "./partsCatalogProvider";

const MIN_FILL_CONFIDENCE = 0.5;

// ── Helpers ──────────────────────────────────────────────────────────────────
function findComponent(
  db: VehicleTechnicalDatabaseV2,
  system: SystemCategory,
  id: string
): TechnicalComponentV2 | undefined {
  return db.components[system]?.find((c) => c.id === id);
}

function findField(comp: TechnicalComponentV2, fieldId: string): SpecField | undefined {
  return comp.specFields.find((f) => f.id === fieldId);
}

/**
 * Valor extraído de un slot con la mejor confianza.
 * - variantId opcional: filtra por variante (mt/at).
 * - Si hay variantes y NO se especifica una, devuelve null (no elige el
 *   primero arbitrariamente) — solo si el slot depende de variante.
 * - Nunca devuelve valores conflict ni status != extracted.
 */
function bestValue(
  field: SpecField | undefined,
  variantId?: string
): { value: string; confidence: number; variant?: string } | null {
  if (!field) return null;
  const candidates = field.values
    .filter((v) => v.status === "extracted" && !v.conflict && v.confidence >= MIN_FILL_CONFIDENCE)
    .filter((v) => (variantId ? v.variant?.id === variantId : true));

  if (candidates.length === 0) return null;

  // El slot depende de variante y no se eligió una → no decidir por el usuario
  if (field.dependsOnVariant && !variantId) return null;

  // Preferir validated/verified sobre plausible a igualdad de confianza:
  // un valor verified pasó contexto estructural + etiqueta + unidad + fuente;
  // uno plausible es prosa sin estructura completa (puede ser ruido).
  const statusRank: Record<string, number> = { verified: 3, plausible: 2, conflict: 1, invalid: 0 };
  const best = [...candidates].sort((a, b) => {
    const rankDiff = (statusRank[b.validationStatus] ?? 0) - (statusRank[a.validationStatus] ?? 0);
    if (rankDiff !== 0) return rankDiff;
    return b.confidence - a.confidence;
  })[0];
  const v = best.value.trim();
  if (v.length === 0) return null;
  return { value: v, confidence: best.confidence, variant: best.variant?.id };
}

/** Une valores no nulos con " · " */
function join(...parts: (string | null | undefined)[]): string | null {
  const filtered = parts.filter((p): p is string => p !== null && p !== undefined && p.trim().length > 0);
  return filtered.length > 0 ? filtered.join(" · ") : null;
}

/**
 * Cadena de referencia de una pieza del catálogo.
 * - source "user" (instalada/medida por el dueño): la referencia es la que
 *   está físicamente en el vehículo.
 * - equivalencia/catálogo: OEM + primeras 2 marcas cruzadas.
 */
function partRefString(p: PartInfo): string | null {
  const refs = p.aftermarket.map((a) => `${a.brand} ${a.partNumber}`);
  if (p.source === "user") {
    return join(p.oem, ...refs);
  }
  return join(p.oem ? `OEM ${p.oem}` : null, ...refs.slice(0, 2));
}

/**
 * Sincroniza un componente del catálogo a la ficha: SOLO piezas verified
 * (Prioridad 1: un dato incorrecto es peor que uno ausente), y con
 * preferencia por la pieza instalada/medida por el dueño (source "user") —
 * la verdad de terreno para este vehículo.
 */
function syncCatalogPart(
  sync: Partial<VehicleSpecs>,
  key: keyof VehicleSpecs,
  componentId: string
): void {
  const verified = lookupVerifiedParts(componentId);
  if (verified.length === 0) return;
  const preferred = verified.find((p) => p.source === "user") ?? verified[0];
  const v = partRefString(preferred);
  if (v) (sync as Record<string, unknown>)[key] = v;
}

function detectTransmission(current: VehicleSpecs): "mt" | "at" | undefined {
  const t = (current.transmision || "").toLowerCase();
  if (/manual|mt\b/.test(t)) return "mt";
  if (/auto|at\b/.test(t)) return "at";
  return undefined;
}

// Etiquetas para el toast
const FIELD_LABELS: Record<string, string> = {
  aceiteMotor: "Aceite motor",
  aceiteCaja: "Aceite caja",
  refrigerante: "Refrigerante",
  liquidoFrenos: "Líquido frenos",
  bujias: "Bujías",
  dimensionNeumaticos: "Neumáticos",
  capacidadEstanque: "Estanque",
  tipoCombustible: "Combustible",
  torqueTornillos: "Torque tornillos",
  filtroAceite: "Filtro aceite (catálogo)",
  filtroAire: "Filtro aire (catálogo)",
  plumillaL: "Plumilla",
  iluminacionPrincipal: "Iluminación",
};

// ── Construcción del mapeo Base Técnica V2 → Ficha ─────────────────────────
export function buildSpecsSyncV2(
  db: VehicleTechnicalDatabaseV2,
  current: VehicleSpecs
): Partial<VehicleSpecs> {
  const sync: Partial<VehicleSpecs> = {};
  const transmission = detectTransmission(current);

  // Aceite de motor: viscosidad + capacidad (ej: "5W/40 · 4,5 l")
  const engineOil = findComponent(db, "fluidos", "engine_oil");
  if (engineOil) {
    const visc = bestValue(findField(engineOil, "viscosity"))?.value;
    const cap = bestValue(findField(engineOil, "capacity"))?.value;
    const v = join(visc, cap);
    if (v) sync.aceiteMotor = v;
  }

  // Aceite de caja: grado + capacidad — respeta la variante MT/AT declarada.
  // Si la ficha no declara transmisión y el dato depende de ella → se omite.
  const transOil = findComponent(db, "transmision", "transmission_oil")
    ?? findComponent(db, "fluidos", "transmission_oil");
  if (transOil) {
    const gradeField = findField(transOil, "grade");
    const capField = findField(transOil, "capacity");
    const grade = bestValue(gradeField, transmission)?.value;
    const cap = bestValue(capField, transmission)?.value;
    const v = join(grade, cap);
    if (v) sync.aceiteCaja = v;
  }

  // Refrigerante: tipo + capacidad (ej: "OAT · 7,3 L")
  const coolant = findComponent(db, "fluidos", "coolant");
  if (coolant) {
    const type = bestValue(findField(coolant, "type"))?.value;
    const cap = bestValue(findField(coolant, "capacity"))?.value;
    const v = join(type, cap);
    if (v) sync.refrigerante = v;
  }

  // Líquido de frenos: grado DOT
  const brakeFluid = findComponent(db, "fluidos", "brake_fluid");
  if (brakeFluid) {
    const v = bestValue(findField(brakeFluid, "grade"))?.value;
    if (v) sync.liquidoFrenos = v;
  }

  // Bujías: referencia + gap (ej: "NGK PFR6Y · 0,9 mm")
  const sparkPlug = findComponent(db, "encendido", "spark_plug");
  if (sparkPlug) {
    const ref = bestValue(findField(sparkPlug, "partNumber"))?.value;
    const gap = bestValue(findField(sparkPlug, "gap"))?.value;
    const v = join(ref, gap);
    if (v) sync.bujias = v;
  }

  // Neumáticos: medida
  const tireSize = findComponent(db, "neumaticos", "tire_size");
  if (tireSize) {
    const v = bestValue(findField(tireSize, "size"))?.value;
    if (v) sync.dimensionNeumaticos = v;
  }

  // Estanque: capacidad + octanaje
  const fuelTank = findComponent(db, "fluidos", "fuel_tank");
  if (fuelTank) {
    const cap = bestValue(findField(fuelTank, "capacity"))?.value;
    if (cap) sync.capacidadEstanque = cap;
    const oct = bestValue(findField(fuelTank, "octane"))?.value;
    if (oct) sync.tipoCombustible = oct;
  }

  // Torque de rueda
  const wheelTorque = findComponent(db, "neumaticos", "wheel_torque");
  if (wheelTorque) {
    const v = bestValue(findField(wheelTorque, "torque"))?.value;
    if (v) sync.torqueTornillos = v;
  }

  // ── Fase 2 (CATÁLOGO, no manual): solo piezas VERIFICADAS llegan a la
  // ficha; candidatas y no-disponibles NUNCA (Prioridad 1). Se prefiere la
  // pieza instalada/medida por el dueño (source "user").
  syncCatalogPart(sync, "filtroAceite", "oil_filter");
  syncCatalogPart(sync, "filtroAire", "air_filter");
  syncCatalogPart(sync, "plumillaL", "wiper_blade");
  syncCatalogPart(sync, "iluminacionPrincipal", "headlight");

  return sync;
}

// ── Aplicar la sincronización ───────────────────────────────────────────────
export function applySpecsSyncV2(
  current: VehicleSpecs,
  db: VehicleTechnicalDatabaseV2,
  force = false
): { updates: Partial<VehicleSpecs>; labels: string[] } {
  const sync = buildSpecsSyncV2(db, current);
  const updates: Partial<VehicleSpecs> = {};
  const labels: string[] = [];

  for (const [key, value] of Object.entries(sync) as [keyof VehicleSpecs, string][]) {
    const currentValue = current[key];
    const isEmpty = currentValue === undefined || currentValue === null || currentValue === "";
    if (force || isEmpty) {
      (updates as Record<string, unknown>)[key] = value;
      labels.push(FIELD_LABELS[key] ?? key);
    }
  }

  return { updates, labels };
}
