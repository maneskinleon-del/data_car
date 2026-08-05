// ============================================================================
// partsCatalog — Fase 2: catálogo de repuestos (segunda fuente, externa al manual)
// ============================================================================
// Prioridad 7 de la auditoría: el manual de taller NO publica referencias de
// filtros. Esta segunda fuente las aporta, SIN mezclarse con la extracción
// del manual (manual ≠ catálogo OEM ≠ equivalencia aftermarket).
//
// Regla de oro: NINGÚN dato se inventa. Cada entrada declara:
//   verified: true  → referencia confirmada en catálogo con vehículo/motor
//                     en su lista de compatibilidad (fuente anotada).
//   verified: false → candidata o ambiguo: se MUESTRA con advertencia pero
//                     NUNCA se sincroniza a la ficha como dato definitivo.
//
// Fuente consultada: catálogos europeos MANN-FILTER / MAHLE / BOSCH vía
// Autodoc (2026-08-05). Los catálogos europeos NO listan oficialmente el
// MG 350 / Roewe 350; por eso solo el filtro de aceite quedó verificado
// (su página de producto incluye el motor 1.5 VTi en compatibilidad).
// ============================================================================

import { PartInfo } from "../types/technicalV2";

export interface CatalogEntry {
  componentId: string;   // id del componente en domainModelV2 (ej: "oil_filter")
  parts: PartInfo[];
}

export const PARTS_CATALOG: CatalogEntry[] = [
  // ── Filtro de aceite — VERIFICADO ─────────────────────────────────────────
  // Autodoc (página de producto MANN-FILTER W 713/28): compatibilidad incluye
  // MG/SAIC/HUIZHONG 1.5 VTi; OE publicados: LPW 100180, 10073599, 10276597,
  // 710000263. Cruces de marca tomados del mismo catálogo cruzado.
  {
    componentId: "oil_filter",
    parts: [
      {
        oem: "LPW 100180",
        aftermarket: [
          { brand: "MANN-FILTER", partNumber: "W 713/28" },
          { brand: "MAHLE", partNumber: "OC 237/1" },
          { brand: "BOSCH", partNumber: "0 451 104 026" },
        ],
        compatible: [
          "MG 350 1.5 VTi (SAIC 15S4U, 2010-2015)",
          "Roewe 350 1.5 (2010-2015)",
        ],
        source: "equivalence",
        verified: true,
        note: "Verificado contra catálogo MANN-FILTER vía Autodoc: el W 713/28 lista el motor 1.5 VTi en su compatibilidad. OE alternativos publicados: 10073599, 10276597, 710000263.",
      },
    ],
  },

  // ── Filtro de aire — CANDIDATO (sin verificar) ────────────────────────────
  // La categoría MG 350 en Autodoc mezcla DOS tipos de filtro de aire (panel
  // plano y cartucho cilíndrico) porque agrupa motores distintos. Para el
  // 1.5 VTi con caja de aire de plástico el panel plano es lo más probable,
  // pero NO está confirmado → verified: false.
  {
    componentId: "air_filter",
    parts: [
      {
        aftermarket: [
          { brand: "MANN-FILTER", partNumber: "C 2774" },
          { brand: "MAHLE", partNumber: "LX 719" },
          { brand: "BOSCH", partNumber: "1 457 433 781" },
        ],
        compatible: ["Candidato panel plano ≈ 268 × 108 × 57 mm"],
        source: "equivalence",
        verified: false,
        note: "SIN VERIFICAR para el 1.5 VTi: los catálogos europeos no listan oficialmente el MG 350 y la categoría mezcla panel plano y cartucho cilíndrico. Mide el filtro actual antes de comprar.",
      },
    ],
  },

  // ── Filtro de habitáculo/polen — NO DISPONIBLE ────────────────────────────
  // Los catálogos europeos consultados no publican referencia para este
  // vehículo. Se declara explícitamente (mejor que un campo vacío silencioso).
  {
    componentId: "cabin_filter",
    parts: [
      {
        aftermarket: [],
        compatible: [],
        source: "catalog",
        verified: false,
        note: "No disponible: los catálogos europeos consultados (MANN/MAHLE/BOSCH) no publican referencia para el MG 350 / Roewe 350. Buscar por medida o consultar un catálogo SAIC local.",
      },
    ],
  },
];

/** Piezas del catálogo para un componente (vacío si el catálogo no lo cubre). */
export function lookupCatalogParts(componentId: string): PartInfo[] {
  return PARTS_CATALOG.find((e) => e.componentId === componentId)?.parts ?? [];
}

/** Piezas VERIFICADAS de un componente (las únicas sincronizables a la ficha). */
export function lookupVerifiedParts(componentId: string): PartInfo[] {
  return lookupCatalogParts(componentId).filter((p) => p.verified);
}
