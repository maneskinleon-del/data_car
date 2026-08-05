// ============================================================================
// specsSync — Puente entre la Base Técnica (extraída del manual) y la ficha
// del vehículo (tab Garage).
// ============================================================================
// Cada componente de la base técnica tiene DataPoints con `confidence`. Solo se
// sincronizan datos con confianza ≥ MIN_FILL_CONFIDENCE (misma regla que usa el
// extractor para llenar la base) — nunca se copia basura de baja confianza.
// ============================================================================

import { VehicleSpecs } from "../types";
import { VehicleTechnicalDatabase, Component, DataPoint, SystemCategory } from "../types/technical";

const MIN_FILL_CONFIDENCE = 0.5;

// ── Helpers ──────────────────────────────────────────────────────────────────
function findComponent(
  db: VehicleTechnicalDatabase,
  system: SystemCategory,
  id: string
): Component | undefined {
  return db.components[system]?.find((c) => c.id === id);
}

// Valor de un DataPoint solo si supera el umbral de confianza
function val(dp: DataPoint<string> | undefined): string | null {
  if (!dp || dp.confidence < MIN_FILL_CONFIDENCE) return null;
  const v = dp.value.trim();
  return v.length > 0 ? v : null;
}

// Une valores no nulos con " · " (ej: "5W-30 · 4.2 L")
function join(...parts: (string | null)[]): string | null {
  const filtered = parts.filter((p): p is string => p !== null && p.trim().length > 0);
  return filtered.length > 0 ? filtered.join(" · ") : null;
}

// Etiqueta legible de cada campo de la ficha (para el toast)
const FIELD_LABELS: Record<keyof VehicleSpecs, string> = {
  aceiteMotor: "Aceite motor",
  filtroAceite: "Filtro aceite",
  aceiteCaja: "Aceite caja",
  refrigerante: "Refrigerante",
  liquidoFrenos: "Líquido frenos",
  bujias: "Bujías",
  filtroAire: "Filtro aire",
  dimensionNeumaticos: "Neumáticos",
  capacidadEstanque: "Estanque",
  chassis: "Chasis",
  marca: "Marca",
  propietario: "Propietario",
  estadoActivo: "Estado",
  transmision: "Transmisión",
  iluminacionPrincipal: "Iluminación",
  plumillaL: "Plumilla",
  ultimoCambioKm: "Último cambio",
  fusibles: "Fusibles",
  tipoCombustible: "Combustible",
  correaDistribucion: "Correa distribución",
  tensionCorrea: "Tensión correa",
  torqueTornillos: "Torque tornillos",
  peso: "Peso",
  dimensiones: "Dimensiones",
  manualPdfNombre: "Manual",
};

// ── Construcción del mapeo Base Técnica → Ficha ─────────────────────────────
// Devuelve solo los campos con datos verificados (confianza ≥ umbral).
export function buildSpecsSync(db: VehicleTechnicalDatabase): Partial<VehicleSpecs> {
  const sync: Partial<VehicleSpecs> = {};

  // Aceite de motor: viscosidad + capacidad (ej: "5W-30 · 4.2 L")
  const engineOil = findComponent(db, "fluidos", "engine_oil");
  if (engineOil) {
    const v = join(val(engineOil.viscosity), val(engineOil.capacity));
    if (v) sync.aceiteMotor = v;
  }

  // Filtro de aceite: número de parte
  const oilFilter = findComponent(db, "filtros", "oil_filter");
  if (oilFilter) {
    const v = val(oilFilter.partNumber);
    if (v) sync.filtroAceite = v;
  }

  // Aceite de caja: grado + capacidad (ej: "GL-4 · 1.8 L")
  const transmissionOil = findComponent(db, "fluidos", "transmission_oil");
  if (transmissionOil) {
    const v = join(val(transmissionOil.grade), val(transmissionOil.capacity));
    if (v) sync.aceiteCaja = v;
  }

  // Refrigerante: tipo + capacidad (ej: "OAT · 6.0 L")
  const coolant = findComponent(db, "fluidos", "coolant");
  if (coolant) {
    const v = join(val(coolant.specification), val(coolant.capacity));
    if (v) sync.refrigerante = v;
  }

  // Líquido de frenos: grado DOT
  const brakeFluid = findComponent(db, "fluidos", "brake_fluid");
  if (brakeFluid) {
    const v = val(brakeFluid.grade);
    if (v) sync.liquidoFrenos = v;
  }

  // Bujías: marca/tipo + gap (ej: "NGK BKR6E · 0.8 mm")
  const sparkPlug = findComponent(db, "encendido", "spark_plug");
  if (sparkPlug) {
    const v = join(val(sparkPlug.specification), val(sparkPlug.gap));
    if (v) sync.bujias = v;
  }

  // Filtro de aire: número de parte
  const airFilter = findComponent(db, "filtros", "air_filter");
  if (airFilter) {
    const v = val(airFilter.partNumber);
    if (v) sync.filtroAire = v;
  }

  // Neumáticos: medida (ej: "205/55 R16")
  const tireSize = findComponent(db, "neumaticos", "tire_size");
  if (tireSize) {
    const v = val(tireSize.specification);
    if (v) sync.dimensionNeumaticos = v;
  }

  // Estanque: capacidad (ej: "45 L")
  const fuelTank = findComponent(db, "fluidos", "fuel_tank");
  if (fuelTank) {
    const v = val(fuelTank.capacity);
    if (v) sync.capacidadEstanque = v;
  }

  return sync;
}

// ── Aplicar la sincronización ────────────────────────────────────────────────
// `force=false` (auto-sync): solo llena campos vacíos, respeta datos manuales.
// `force=true` (botón): sobreescribe con los datos del manual.
// Devuelve las etiquetas de los campos que se actualizaron (para el toast).
export function applySpecsSync(
  current: VehicleSpecs,
  db: VehicleTechnicalDatabase,
  force = false
): { updates: Partial<VehicleSpecs>; labels: string[] } {
  const sync = buildSpecsSync(db);
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
