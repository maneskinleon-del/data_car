// ============================================================================
// partsCatalog — Fase 2: catálogo de repuestos (segunda fuente, externa al manual)
// ============================================================================
// Prioridad 7 de la auditoría: el manual de taller NO publica referencias de
// filtros. Esta segunda fuente las aporta, SIN mezclarse con la extracción
// del manual (manual ≠ catálogo OEM ≠ equivalencia aftermarket ≠ dato del
// dueño).
//
// Regla de oro: NINGÚN dato se inventa. Cada entrada declara:
//   verified: true  → referencia confirmada (catálogo con vehículo/motor en
//                     su compatibilidad, O pieza instalada/medida por el dueño).
//   verified: false → candidata o ambiguo: se MUESTRA con advertencia pero
//                     NUNCA se sincroniza a la ficha como dato definitivo.
//
// Fuentes:
//   • Catálogos europeos MANN-FILTER / MAHLE / BOSCH vía Autodoc (2026-08-05).
//     Los catálogos europeos NO listan oficialmente el MG 350 / Roewe 350;
//     por eso solo el filtro de aceite quedó verificado por catálogo (su
//     página de producto incluye el motor 1.5 VTi en compatibilidad).
//   • Datos del DUEÑO (source: "user"): piezas instaladas/medidas en el
//     MG 350S real — la verificación más fuerte que existe para este vehículo.
// ============================================================================

import { PartInfo } from "../types/technicalV2";

export interface CatalogEntry {
  componentId: string;   // id del componente en domainModelV2 (ej: "oil_filter")
  parts: PartInfo[];
}

export const PARTS_CATALOG: CatalogEntry[] = [
  // ── Filtro de aceite ──────────────────────────────────────────────────────
  // 1) Equivalencia VERIFICADA por catálogo (Autodoc, página del W 713/28:
  //    compatibilidad incluye MG/SAIC 1.5 VTi; OE publicados LPW 100180,
  //    10073599, 10276597, 710000263).
  // 2) Pieza instalada por el DUEÑO (UJ-1797, hilo 13/16") — la referencia
  //    que actualmente está en el motor.
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
      {
        oem: "UJ-1797",
        aftermarket: [],
        compatible: ["MG 350S 1.5 — instalado por el dueño"],
        source: "user",
        verified: true,
        note: "Filtro instalado por el dueño. Hilo 13/16\". Último filtro de aceite puesto en el vehículo.",
      },
    ],
  },

  // ── Filtro de aire ────────────────────────────────────────────────────────
  // IMPORTANTE (discrepancia sin resolver): el dueño midió el filtro real del
  // capó en 26 × 9 cm. TODOS los catálogos consultados para MG 350/Roewe 350
  // declaran un filtro de ~18-19 cm de ancho (STP 30005099 = 377×180×35 mm;
  // OEM SAIC 50016901 = 255×192×50 mm). Ninguna referencia coincide con la
  // medida física → NINGUNA se marca verified por catálogo. La medida del
  // dueño es la verdad de terreno (source user); las referencias de tienda se
  // muestran como candidatas con su medida declarada y la advertencia.
  {
    componentId: "air_filter",
    parts: [
      {
        oem: "26 × 9 cm (panel, medido)",
        aftermarket: [],
        compatible: ["MG 350S 1.5 — filtro del capó, medido por el dueño"],
        source: "user",
        verified: true,
        note: "Filtro de aire del capó (caja de aire): panel de 26 × 9 cm medido por el dueño. ⚠️ NINGÚN catálogo coincide con esta medida (todos declaran ~18-19 cm de ancho). Verifica el número impreso en el filtro actual o mide el marco completo (borde de goma incluido) antes de comprar.",
      },
      {
        aftermarket: [
          { brand: "STP", partNumber: "30005099" },
        ],
        compatible: ["MG 350 1.5 2011-2018 / MG 3 — según vendedores chilenos"],
        source: "catalog",
        verified: false,
        note: "Referencia que se vende en CHILE para MG 350 1.5 (Lider.cl $11.100 CLP; ulti.cl; filtroshlc.net). Medidas declaradas por vendedores: 377 × 180 × 35 mm — NO coinciden con el filtro medido (26 × 9 cm). Antes de comprar, compara con tu filtro real.",
      },
      {
        aftermarket: [
          { brand: "SAIC OEM", partNumber: "50016901" },
        ],
        compatible: ["Roewe 350 1.5 / MG 5 1.5 (15S4U/15S4C)"],
        source: "catalog",
        verified: false,
        note: "OEM SAIC del grupo 1.5L. Medidas declaradas: 255 × 192 × 50 mm (Unifil, Cautop) — NO coinciden con el filtro medido (26 × 9 cm).",
      },
      {
        aftermarket: [
          { brand: "MANN-FILTER", partNumber: "C 2774" },
          { brand: "MAHLE", partNumber: "LX 719" },
          { brand: "BOSCH", partNumber: "1 457 433 781" },
        ],
        compatible: ["Candidato panel plano ≈ 26,8 × 10,8 × 5,7 cm"],
        source: "equivalence",
        verified: false,
        note: "Candidato de catálogos europeos (Autodoc). Medidas: 26,8 × 10,8 cm — largo similar a la medida del dueño pero ancho distinto (10,8 vs 9 cm). No confirmado.",
      },
    ],
  },

  // ── Plumillas / Limpiaparabrisas delanteras ───────────────────────────────
  // Instaladas por el dueño: conductor 23" (59 cm) y pasajero 16" (40 cm),
  // ambas con gancho tipo J. El MG 350S es un SEDÁN → NO tiene plumilla
  // trasera (verificado en catálogos: los kits del Roewe 350 se venden como
  // juego frontal de 2 piezas, sin trasera).
  {
    componentId: "wiper_blade",
    parts: [
      {
        oem: "23\" (59 cm) · tipo J",
        aftermarket: [],
        compatible: ["MG 350S — plumilla instalada por el dueño"],
        source: "user",
        verified: true,
        side: "driver",
        note: "Plumilla del CONDUCTOR instalada por el dueño: 59 cm (23\"), gancho tipo J. El dueño también anotó \"H4 (20mm)\" junto a la plumilla — posible ancho/adaptador, sin confirmar.",
      },
      {
        oem: "16\" (40 cm) · tipo J",
        aftermarket: [],
        compatible: ["MG 350S — plumilla del pasajero, medida por el dueño"],
        source: "user",
        verified: true,
        side: "passenger",
        note: "Plumilla del PASAJERO: 16\" (40 cm), gancho tipo J, según el dueño.",
      },
    ],
  },

  // ── Plumilla trasera — NO APLICA ──────────────────────────────────────────
  // El MG 350S es un sedán de 3 volúmenes: no lleva limpiaparabrisas trasero
  // (elemento reservado a hatchback/SUV). Se declara explícitamente para que
  // el usuario no busque una pieza que el vehículo no tiene.
  {
    componentId: "wiper_rear",
    parts: [
      {
        aftermarket: [],
        compatible: [],
        source: "catalog",
        verified: false,
        note: "No aplica: el MG 350S es un sedán y NO tiene plumilla trasera. Los juegos del Roewe 350 se venden como kit frontal de 2 piezas.",
      },
    ],
  },

  // ── Iluminación principal ─────────────────────────────────────────────────
  // LEDs H4 instalados por el dueño.
  {
    componentId: "headlight",
    parts: [
      {
        oem: "H4 LED",
        aftermarket: [],
        compatible: ["MG 350S — iluminación principal instalada por el dueño"],
        source: "user",
        verified: true,
        note: "Focos LED H4 instalados por el dueño en la iluminación principal.",
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
