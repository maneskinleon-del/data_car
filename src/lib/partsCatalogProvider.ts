// ============================================================================
// partsCatalogProvider — Fase 2: proveedor de catálogo de repuestos
// ============================================================================
// Implementa la interfaz PartsCatalogProvider definida en technicalV2.ts y
// conecta el catálogo local a la DB V2. La DB V2 queda así con DOS fuentes
// separadas (Prioridad 7):
//   • components  → extraídos del MANUAL (con su trazabilidad)
//   • parts       → catálogo OEM/equivalencias (externo, con su verificación)
// ============================================================================

import {
  PartsCatalogProvider,
  PartInfo,
  PartsDatabase,
  VehicleTechnicalDatabaseV2,
} from "../types/technicalV2";
import {
  PARTS_CATALOG,
  lookupCatalogParts,
  lookupVerifiedParts,
} from "../data/partsCatalog";

/** Proveedor estático local (catálogo embebido, sin red). */
export const staticPartsCatalog: PartsCatalogProvider = {
  id: "scuderia-catalog-local-v1",
  name: "Catálogo Scuderia Data (equivalencias verificadas)",
  async lookup({ componentId }) {
    return lookupCatalogParts(componentId);
  },
};

export { lookupCatalogParts, lookupVerifiedParts };

/**
 * Conecta el catálogo a la DB V2 (rellena `db.parts`).
 * Idempotente: siempre escribe la versión vigente del catálogo, por lo que
 * también refresca DBs cargadas desde localStorage de sesiones anteriores.
 */
export function attachPartsCatalog(db: VehicleTechnicalDatabaseV2): void {
  const entries: PartsDatabase["entries"] = PARTS_CATALOG.map((e) => ({
    componentId: e.componentId,
    parts: e.parts,
  }));
  db.parts = { entries };
}

/** Devuelve las piezas del catálogo de un componente dentro de la DB. */
export function getPartsFromDb(db: VehicleTechnicalDatabaseV2, componentId: string): PartInfo[] {
  return db.parts?.entries?.find((e) => e.componentId === componentId)?.parts ?? [];
}
