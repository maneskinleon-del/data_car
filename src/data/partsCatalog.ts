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
//   • Bujías: el MANUAL de taller especifica NGK PFR6Y (p.243) — verificación
//     directa; equivalencias BOSCH/DENSO por tablas de cruzamiento NGK
//     (PFR6Y = stock 9331, Laser Platinum doble platino, M14×1.25, 19 mm).
//   • Neumáticos: el MANUAL (p.598) publica 205/55 R16 91V, llanta 6.5J×16,
//     presión 2,1 bar — verificación directa.
//   • Batería (2026-08-06): grupo DIN L1 (50-54 Ah, 450-530 CCA EN,
//     207×175×190 mm, positivo derecho) según catálogos de baterías para el
//     MG 350 / Roewe 350 (plataforma SAIC AP11). SIN verificación por página
//     con compatibilidad explícita → candidata (verified:false).
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
  //    que actualmente está en el motor. El DUEÑO confirma que el HILO
  //    (13/16") es la especificación crítica al comprar: si la rosca no
  //    calza, el filtro no sirve aunque el cuerpo coincida.
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
        note: "Filtro instalado por el dueño. Lo que importa al comprar es el HILO: 13/16\" (rosca) — el cuerpo del filtro puede verse similar pero el hilo debe calzar. Último filtro de aceite puesto en el vehículo.",
      },
    ],
  },

  // ── Filtro de aire ────────────────────────────────────────────────────────
  // RECONCILIACIÓN CONFIRMADA POR EL DUEÑO (2026-08-06): el filtro real del
  // capó mide 26 × 9 cm (elemento filtrante). El candidato europeo de panel
  // plano MANN C 2774 declara 26,8 × 10,8 cm — el dueño CONFIRMA que ambas
  // medidas concuerdan: la diferencia (~2 cm) es el borde/marco de goma del
  // filtro → C 2774 queda VERIFICADO por reconciliación de medida (source
  // user es la verdad de terreno). STP 30005099 (37,7 × 18 cm) y SAIC
  // 50016901 (25,5 × 19,2 cm) NO coinciden en ancho (~18-19 vs ~10 cm) y
  // siguen como candidatas con advertencia.
  {
    componentId: "air_filter",
    parts: [
      {
        oem: "26 × 9 cm (panel, medido)",
        aftermarket: [],
        compatible: ["MG 350S 1.5 — filtro del capó, medido por el dueño"],
        source: "user",
        verified: true,
        note: "Filtro de aire del capó (caja de aire): elemento filtrante de 26 × 9 cm medido por el dueño. El dueño CONFIRMA (2026-08-06) que el candidato MANN C 2774 (26,8 × 10,8 cm) concuerda: la diferencia de ~2 cm es el marco/borde de goma. STP 30005099 y SAIC 50016901 (ancho ~18-19 cm) NO coinciden con la medida real.",
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
        compatible: ["MG 350S 1.5 — panel 26,8 × 10,8 cm (marco); elemento 26 × 9 cm confirmado por el dueño"],
        source: "equivalence",
        verified: true,
        note: "Candidato de catálogos europeos (Autodoc): panel plano 26,8 × 10,8 × 5,7 cm. VERIFICADO por reconciliación del dueño (2026-08-06): el elemento real del capó mide 26 × 9 cm y la diferencia de ~2 cm corresponde al marco/borde de goma. Equivalencias: MANN C 2774, MAHLE LX 719, BOSCH 1 457 433 781.",
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

  // ── Bujías ────────────────────────────────────────────────────────────────
  // El MANUAL de taller especifica la bujía exacta (p.243): "Bujía: NGK PFR6Y
  // Brecha 0,8-0,9 mm". Es la verificación más fuerte (fuente manual).
  // PFR6Y = NGK stock 9331, Laser Platinum (doble platino), M14×1.25, rosca
  // 19 mm, hex 16 mm. Equivalencias directas por cruzamiento NGK.
  {
    componentId: "spark_plug",
    parts: [
      {
        oem: "NGK PFR6Y",
        aftermarket: [
          { brand: "BOSCH", partNumber: "FR7DC+ (0 242 235 666)" },
          { brand: "DENSO", partNumber: "K20PR-U" },
        ],
        compatible: [
          "MG 350 1.5 VTi (SAIC 15S4U, 2010-2015)",
          "Roewe 350 1.5 (2010-2015)",
        ],
        source: "manual",
        verified: true,
        note: "Bujía especificada en el manual de taller p.243 (NGK PFR6Y, brecha 0,8-0,9 mm). NGK Laser Platinum (doble platino), stock 9331: M14×1.25, rosca 19 mm, hex 16 mm. BOSCH FR7DC+ y DENSO K20PR-U son equivalentes directos por cruzamiento NGK.",
      },
    ],
  },

  // ── Neumáticos ────────────────────────────────────────────────────────────
  // El MANUAL publica la medida real (p.598): 205/55 R16 91V, llanta 6.5J×16
  // (aleación y acerado), repuesto 205/55 R16 91V, presión 2,1 bar delante y
  // detrás (normal y alta velocidad). Verificación directa del manual.
  {
    componentId: "tire_size",
    parts: [
      {
        oem: "205/55 R16 91V",
        aftermarket: [],
        compatible: ["MG 350 1.5 (2010-2015)", "Roewe 350 1.5 (2010-2015)"],
        source: "manual",
        verified: true,
        note: "Medida real del manual p.598: neumático 205/55 R16 91V sobre llanta 6.5J×16 (aleación y acerado); repuesto del mismo tamaño. Presión recomendada 2,1 bar (delante y detrás, normal y alta velocidad). Índice de carga 91, velocidad V.",
      },
    ],
  },

  // ── Batería ───────────────────────────────────────────────────────────────
  // El manual NO publica la batería (solo procedimientos de desconexión).
  // Grupo DIN L1 según catálogos de baterías para la plataforma SAIC AP11
  // (MG 350 / Roewe 350). SIN página con compatibilidad explícita verificada
  // → candidata (verified:false). Se muestra con advertencia: verifica la
  // medida de la batería actual antes de comprar.
  {
    componentId: "battery",
    parts: [
      {
        oem: "DIN L1 (207 × 175 × 190 mm)",
        aftermarket: [
          { brand: "BOSCH", partNumber: "S4 / S5 (L1, 50-54 Ah)" },
          { brand: "LTH", partNumber: "DIN 50/54 (L1)" },
          { brand: "MOURA", partNumber: "DIN 50/55 (L1)" },
          { brand: "VARTA", partNumber: "C30 (54 Ah, L1)" },
        ],
        compatible: ["MG 350 1.5 (2010-2015)", "Roewe 350 1.5 (plataforma SAIC AP11)"],
        source: "catalog",
        verified: false,
        note: "Grupo DIN L1: 50-54 Ah, 450-530 CCA (EN), 207×175×190 mm, positivo derecho (R+), fijación B13. ⚠️ Candidata por catálogo (sin página con compatibilidad explícita): verifica la medida y polaridad de la batería actual antes de comprar. El manual de taller no publica la batería.",
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
