// ============================================================================
// aiShare.test — PRUEBAS del flujo carrito → prompt de búsqueda de repuestos.
// ============================================================================
// Verifica los criterios de aceptación del flujo de compra:
//   • deduplicación correcta (identidad por componente + referencia, NO nombre)
//   • quantity = misma pieza física → max(), NO suma
//   • conservación de referencias verificadas como criterio de búsqueda
//   • ausencia de afirmaciones de compatibilidad VIN no demostradas
//   • contrato JSON de salida enriquecido sin romper el parse existente
//   • evidencia (url, compatibilidad, vin) preservada por findRepuesto
//
// Ejecución (mismo patrón que tests/regressionV2.ts):
//   ./node_modules/.bin/esbuild tests/aiShare.test.ts \
//     --bundle --platform=node --format=esm --outfile=.test-aiShare.mjs
//   node .test-aiShare.mjs
//   rm -f .test-aiShare.mjs
// ============================================================================

import {
  buildAISharePrompt,
  normalizeCartItems,
  findRepuesto,
  parseAIResponse,
  type AIShareItem,
} from "../src/lib/aiShare";

let failures = 0;
let passes = 0;

function check(name: string, ok: boolean, detail: string) {
  if (ok) {
    passes++;
    console.log(`  ✅ ${name} — ${detail}`);
  } else {
    failures++;
    console.log(`  ❌ ${name} — ${detail}`);
  }
}

const countLines = (prompt: string, needle: string): number =>
  prompt.split("\n").filter((l) => l.includes(needle)).length;

const spark: AIShareItem = {
  name: "Bujías",
  quantity: 4,
  reference: "NGK PFR6Y",
  hasReference: true,
  componentId: "spark_plug",
};

console.log(`\n=== PRUEBAS aiShare — carrito → prompt + evidencia ===\n`);

// ── 1. Mismo componente + misma referencia en dos packs ──────────────────────
// "Afinamiento" y "Encendido" ambos necesitan spark_plug ×4 (4 bujías del motor).
// Son la MISMA pieza física → consolidar a una línea ×4, NO ×8.
{
  const norm = normalizeCartItems([
    spark,
    { ...spark, note: "gap 0,9 mm" },
  ]);
  check(
    "CASO 1: mismo componente+ref → se consolida a 1 item, qty=max (4)",
    norm.length === 1 && norm[0].quantity === 4,
    `items=${norm.length} qty=${norm[0].quantity}`
  );
  check(
    "CASO 1: conserva la nota técnica del primer item",
    norm[0]?.note === "gap 0,9 mm",
    `note=${norm[0]?.note ?? "(vacía)"}`
  );
}

// ── 2. Mismo componente, DISTINTA referencia → productos distintos ───────────
{
  const norm = normalizeCartItems([
    spark,
    { ...spark, reference: "NGK BKR6E" },
  ]);
  check(
    "CASO 2: misma pieza con distinta ref → 2 items",
    norm.length === 2,
    `items=${norm.length}`
  );
}

// ── 3. Mismo nombre, DISTINTO componente → no falso dedup por nombre ─────────
{
  const norm = normalizeCartItems([
    { ...spark, componentId: "spark_plug_a", quantity: 1 },
    { ...spark, componentId: "spark_plug_b", quantity: 1, reference: "" },
  ]);
  check(
    "CASO 3: mismo nombre distinto componente → 2 items",
    norm.length === 2,
    `items=${norm.length}`
  );
}

// ── 4. Componente sin referencia ──────────────────────────────────────────────
// engine_oil NO tiene entrada en partsCatalog → reference="" y hasReference=false.
// Dos packs lo mencionan con la misma cant.: consolidar a 1 línea, ref vacía.
{
  const engineOil: AIShareItem = {
    name: "Aceite de motor",
    quantity: 4.5,
    reference: "",
    hasReference: false,
    componentId: "engine_oil",
  };
  const norm = normalizeCartItems([
    engineOil,
    { ...engineOil, note: "5W/40 · ACEA A3/B3,B4 · 4,5 L" },
  ]);
  check(
    "CASO 4: componente sin referencia → se agrupa por componentId, qty=max (4.5)",
    norm.length === 1 && norm[0].quantity === 4.5 && norm[0].reference === "",
    `items=${norm.length} qty=${norm[0].quantity} ref='${norm[0].reference}'`
  );
  check(
    "CASO 4: conserva nota técnica del segundo item (first-no-empty)",
    norm[0]?.note === "5W/40 · ACEA A3/B3,B4 · 4,5 L",
    `note=${norm[0]?.note ?? "(vacía)"}`
  );
}

// ── 5. Cantidad fraccionaria 4.5 L → max no suma ────────────────────────────
{
  const norm = normalizeCartItems([
    { ...spark, componentId: "engine_oil", name: "Aceite", quantity: 4.5, reference: "5W/40", hasReference: true },
    { ...spark, componentId: "engine_oil", name: "Aceite", quantity: 4.5, reference: "5W/40", hasReference: true, note: "ACEA A3/B4" },
  ]);
  check(
    "CASO 5: 4.5 + 4.5 → max = 4.5 (no 9)",
    norm.length === 1 && norm[0].quantity === 4.5,
    `items=${norm.length} qty=${norm[0].quantity}`
  );
}

// ── 6. Un mismo componente añadido dos veces dentro de un solo pack ───────────
// El modelo NO lo previene (pack.items es un array; nada impide duplicados
// en los datos), así que normalizeCartItems debe manejarlo.
{
  const norm = normalizeCartItems([
    { ...spark, quantity: 2 },
    { ...spark, quantity: 2 },
  ]);
  check(
    "CASO 6: mismo componente dos veces en el mismo pack → 1 item, qty=max (2)",
    norm.length === 1 && norm[0].quantity === 2,
    `items=${norm.length} qty=${norm[0].quantity}`
  );
}

// ── 7. Prompt: una sola línea para spark_plug ×4 consolidada ─────────────────
{
  const prompt = buildAISharePrompt({
    vehicleLabel: "MG 350",
    serviceName: "Lista de compra de repuestos",
    km: 50000,
    vin: "LSJA16E37FG011194",
    items: [spark, spark, spark, { ...spark, quantity: 1 }],
  });
  const repSection = prompt.split("\nRepuestos")[1]?.split("\nInstrucciones")[0] ?? "";
  const bujiasLines = repSection.split("\n").filter((l) => l.includes("Bujías"));
  check(
    "Prompt: una sola línea 'Bujías' pese a 4 entradas ×4,×4,×4,×1",
    bujiasLines.length === 1,
    `líneas="${bujiasLines.length}"`
  );
  // max(4,4,4,1) = 4
  check(
    "Prompt: cantidad consolidada ×4, ref conservada",
    prompt.includes("Bujías ×4 (ref: NGK PFR6Y)"),
    `contiene '${prompt.match(/Bujías ×\d+/)?.[0] ?? "(no encontrado)"} (ref: NGK PFR6Y)'`
  );
}

// ── 8. Prompt: fluido — aceite + oil_change (mismo componente sin ref) ────────
{
  const prompt = buildAISharePrompt({
    vehicleLabel: "MG 350",
    serviceName: "Lista de compra de repuestos",
    km: 85000,
    vin: "LSJA16E37FG011194",
    items: [
      { name: "Aceite de motor", quantity: 4.5, reference: "", hasReference: false, componentId: "engine_oil" },
      { name: "Aceite de motor", quantity: 4.5, reference: "", hasReference: false, componentId: "engine_oil", note: "5W/40 · ACEA A3/B3,B4 · 4,5 L" },
    ],
  });
  // Buscar solo en la sección de repuestos (antes de "Instrucciones"), no en sampleJson
  const repSection = prompt.split("\nRepuestos")[1]?.split("\nInstrucciones")[0] ?? "";
  const aceiteRepLines = repSection.split("\n").filter((l) => l.includes("Aceite de motor"));
  check(
    "Prompt: aceite — una sola línea en sección repuestos ×4.5",
    aceiteRepLines.length === 1 && repSection.includes("Aceite de motor ×4.5"),
    `líneas rep=${aceiteRepLines.length} contenido='${repSection.match(/Aceite de motor ×[\d.,]+/)?.[0] ?? "(no encontrado)"}'`
  );
}

// ── 9. VIN: contraste, NO confirmación no demostrada ─────────────────────────
{
  const prompt = buildAISharePrompt({
    vehicleLabel: "MG 350",
    serviceName: "Lista",
    km: 0,
    vin: "LSJA16E37FG011194",
    items: [spark],
  });
  check(
    "VIN: claim antiguo 'confirmar compatibilidad exacta' eliminado",
    !prompt.includes("confirmar compatibilidad exacta al buscar"),
    "wording antiguo ausente"
  );
  check(
    "VIN: se exige evidencia de la fuente",
    prompt.includes("NO afirmes compatibilidad exacta por VIN"),
    "wording nuevo presente"
  );
  check(
    "VIN: instrucción 'no validado por la publicación'",
    prompt.includes("no validado por la publicación"),
    "instrucción presente"
  );
}

// ── 10. No inventar precios / contrato con evidencia / fluidos / refs ────────
{
  const prompt = buildAISharePrompt({
    vehicleLabel: "MG 350",
    serviceName: "Cambio Aceite & Filtros",
    km: 85000,
    items: [
      {
        name: "Aceite de motor",
        quantity: 4.5,
        reference: "5W/40",
        hasReference: true,
        componentId: "engine_oil",
        note: "5W/40 · ACEA A3/B3,B4 · 4,5 L",
      },
    ],
  });
  check(
    "Prompt: prohíbe inventar precios",
    prompt.includes("NUNCA inventes un precio"),
    "instrucción anti-invención"
  );
  check(
    "Prompt: contrato con campos de evidencia",
    ["referencia_solicitada", "referencia_encontrada", "compatibilidad", "vin", "observacion", "url"]
      .every((f) => prompt.includes(f)),
    "campos evidencia presentes"
  );
  check(
    "Prompt: conserva requisitos de fluido",
    prompt.includes("ACEA A3/B3,B4") && prompt.includes("4,5 L"),
    "spec de aceite intacta"
  );
  check(
    "Prompt: refs conocidas como criterio de búsqueda",
    prompt.includes("NGK PFR6Y") && prompt.includes("referencias de búsqueda verificadas"),
    "refs conocidas reforzadas"
  );
}

// ── 11. findRepuesto: evidencia completa ──────────────────────────────────────
{
  const repuestos = [
    {
      nombre: "Pastillas de freno delanteras",
      precio: 27970,
      tienda: "Mercado Libre Chile",
      url: "https://publicacion.example.com/auto/10026870",
      compatibilidad: "declarada por la publicacion",
      vin: "no validado por la publicacion",
      observacion: null,
    },
  ];
  const m = findRepuesto("Pastillas de freno delanteras", repuestos);
  check(
    "Evidencia: conserva url / compatibilidad / vin",
    !!m && m.url === "https://publicacion.example.com/auto/10026870" &&
      m.compatibilidad === "declarada por la publicacion" &&
      m.vin === "no validado por la publicacion",
    m ? `url=${m.url} · compat=${m.compatibilidad}` : "sin match"
  );
  const m2 = findRepuesto("Aceite de caja", repuestos);
  check("Evidencia: sin match → undefined", m2 === undefined, "undefined");
}

// ── 12. parseAIResponse: contrato enriquecido ────────────────────────────────
{
  const out = parseAIResponse(
    '```json\n{"repuestos": [{"nombre":"Bujías","precio":27970,"tienda":"ML","url":"https://x.cl/1","compatibilidad":"referencia coincidente"}],"total":27970}\n```'
  );
  check(
    "parseAIResponse: contrato enriquecido se parsea",
    !!out && out.total === 27970 && (out.repuestos[0] as { url?: string }).url === "https://x.cl/1",
    out ? `total=${out.total}` : "null"
  );
  check(
    "parseAIResponse: sin total válido → null",
    parseAIResponse('{"repuestos":[]}') === null,
    "null"
  );
}

// ── 13. Precio actual: regla temporal ─────────────────────────────────────────
{
  const prompt = buildAISharePrompt({
    vehicleLabel: "MG 350", serviceName: "Lista", km: 0, items: [spark],
  });
  check(
    "Precio actual: prohíbe precios históricos / snippets / cachés / agotados",
    prompt.includes("Solo considera precio actual aquel que sea visible y verificable") &&
    prompt.includes("NO uses precios históricos, snippets de buscador, cachés"),
    "regla temporal presente"
  );
}

// ── 14. Jerarquía de evidencia ───────────────────────────────────────────────
{
  const prompt = buildAISharePrompt({
    vehicleLabel: "MG 350", serviceName: "Lista", km: 0, items: [spark],
  });
  check(
    "Evidencia: jerarquía de 5 niveles presente",
    prompt.includes("Jerarquía de evidencia") &&
    prompt.includes("referencia solicitada") &&
    prompt.includes("declara explícitamente aplicación al vehículo") &&
    prompt.includes("valida mediante VIN") &&
    prompt.includes("equivalente de marca reconocida") &&
    prompt.includes("coincidencia únicamente por nombre/modelo"),
    "5 niveles"
  );
  check(
    "Evidencia: no elevar nivel inferior a superior",
    prompt.includes("Nunca eleves una coincidencia de nivel inferior a uno superior"),
    "regla anti-elevación"
  );
}

// ── 15. Fluido: capacidad vs envases ─────────────────────────────────────────
{
  const prompt = buildAISharePrompt({
    vehicleLabel: "MG 350", serviceName: "Lista", km: 0, items: [spark],
  });
  check(
    "Fluido: distingue capacidad del vehículo vs cantidad de envases",
    prompt.includes("cantidad mínima de envases necesarios") &&
    prompt.includes("No reduzcas la capacidad técnica solicitada a la capacidad de un solo envase"),
    "regla envases"
  );
  check(
    "Fluido: ejemplo de refrigerante 7,3 L → 2 envases",
    prompt.includes("refrigerante 7,3 L → 2 envases de 4 L"),
    "ejemplo envases"
  );
}

// ── 16. Total: suma exclusiva de precios numéricos (null excluido) ────────────
{
  const prompt = buildAISharePrompt({
    vehicleLabel: "MG 350", serviceName: "Lista", km: 0, items: [spark],
  });
  check(
    "Total: instrucción que null NO se suma y total = suma de subtotales",
    prompt.includes("suma exclusiva de los subtotales numéricos verificados") &&
    prompt.includes("los subtotales null NO se suman") &&
    prompt.includes("NUNCA calcules 'total' como la suma de 'precio' ni de 'precio_unitario'"),
    "regla total"
  );
}

// ── 17. sampleJson contiene ejemplo de precio null ───────────────────────────
{
  const prompt = buildAISharePrompt({
    vehicleLabel: "MG 350", serviceName: "Lista", km: 0, items: [spark],
  });
  check(
    "SampleJson: incluye ejemplo de precio null con observación",
    prompt.includes("\"precio\": null") &&
    prompt.includes("no cumple 5W/40 A3/B4"),
    "ejemplo null presente"
  );
}

// ── 18. parseAIResponse: total excluye null ──────────────────────────────────
{
  const out = parseAIResponse(
    '{"repuestos":[{"nombre":"A","precio":10000},{"nombre":"B","precio":null}],"total":10000}'
  );
  check(
    "parseAIResponse: precio null no rompe parse y total=10000",
    !!out && out.total === 10000,
    out ? `total=${out.total}` : "null"
  );
}

// ── 19. URL directa obligatoria para precio numérico ─────────────────────────
{
  const prompt = buildAISharePrompt({
    vehicleLabel: "MG 350", serviceName: "Lista", km: 0, items: [spark],
  });
  check(
    "URL directa: precio numérico requiere URL que identifique la publicación específica",
    prompt.includes("\"url\" debe identificar directamente la publicación, ficha de producto o página específica"),
    "regla URL directa"
  );
}

// ── 20. Prohibidos como respaldo de precio ───────────────────────────────────
{
  const prompt = buildAISharePrompt({
    vehicleLabel: "MG 350", serviceName: "Lista", km: 0, items: [spark],
  });
  check(
    "URL directa: prohíbe dominios raíz/categoría/listado/resultados/buscador/agregador",
    prompt.includes("No uses dominios raíz, categorías, resultados de búsqueda, listados generales, buscadores ni páginas agregadoras"),
    "lista de prohibidos"
  );
}

// ── 21. Listado sin publicación concreta → precio null ────────────────────────
{
  const prompt = buildAISharePrompt({
    vehicleLabel: "MG 350", serviceName: "Lista", km: 0, items: [spark],
  });
  check(
    "URL directa: listado sin publicación concreta → precio null",
    prompt.includes("precio solo puede verificarse mediante una página de listado y no puedes identificar la publicación/producto concreto, devuelve \"precio\": null"),
    "fallback null"
  );
}

// ── 22. URL puede conservarse con precio null ─────────────────────────────────
{
  const prompt = buildAISharePrompt({
    vehicleLabel: "MG 350", serviceName: "Lista", km: 0, items: [spark],
  });
  check(
    "URL directa: URL válida como evidencia aunque precio sea null",
    prompt.includes("Una URL puede conservarse como evidencia de un producto encontrado aunque \"precio\" sea null"),
    "URL nullable"
  );
}

// ── 23. Cantidad requerida vs precio unitario/envase ─────────────────────────
{
  const prompt = buildAISharePrompt({
    vehicleLabel: "MG 350", serviceName: "Lista", km: 0, items: [spark],
  });
  check(
    "Cantidad: distingue precio de presentación vs costo de la compra",
    prompt.includes("precio de la presentación/publicación consultada") &&
    prompt.includes("NO es el costo total del requerimiento"),
    "semántica precio_unitario"
  );
  check(
    "Cantidad: define cantidad_requerida / cantidad_comercial / subtotal",
    prompt.includes("'cantidad_requerida' es la cantidad que pide la línea") &&
    prompt.includes("'cantidad_comercial' es el número de piezas/envases") &&
    prompt.includes("'subtotal' es el costo real"),
    "campos de cantidad"
  );
  check(
    "Cantidad: subtotal = precio_unitario × cantidad_comercial",
    prompt.includes("precio_unitario' × 'cantidad_comercial"),
    "fórmula subtotal"
  );
  check(
    "Cantidad: no tomar precio publicado como si cubriera la cantidad",
    prompt.includes("Nunca tomes el precio de una publicación como si ya cubriera la cantidad solicitada"),
    "anti-interpretación errónea"
  );
}

// ── 24. Ejemplo de envases en sampleJson ────────────────────────────────────
{
  const prompt = buildAISharePrompt({
    vehicleLabel: "MG 350", serviceName: "Lista", km: 0, items: [spark],
  });
  check(
    "SampleJson: ejemplo bujías ×4 con subtotal 56.000",
    prompt.includes("\"cantidad_requerida\": 4") && prompt.includes("\"cantidad_comercial\": 4") && prompt.includes("\"subtotal\": 56000"),
    "bujías subtotal"
  );
  check(
    "SampleJson: ejemplo aceite envase 4L → 2 envases, subtotal 112.000",
    prompt.includes("\"cantidad_requerida\": 4.5") && prompt.includes("\"cantidad_comercial\": 2") && prompt.includes("\"subtotal\": 112000"),
    "aceite envases"
  );
  check(
    "SampleJson: total = suma de subtotales (168.000)",
    prompt.includes("\"total\": 168000"),
    "total subtotales"
  );
}

// ── 25. SampleJson: cada objeto incluye los 13 campos en orden ───────────────
{
  const prompt = buildAISharePrompt({
    vehicleLabel: "MG 350", serviceName: "Lista", km: 0, items: [spark],
  });
  const before9 = prompt.split("\n9. ")[0];
  const start = before9.indexOf("{");
  const parsed = JSON.parse(before9.slice(start));
  const fields = [
    "nombre", "referencia_solicitada", "referencia_encontrada",
    "precio", "precio_unitario", "cantidad_requerida",
    "cantidad_comercial", "subtotal", "tienda", "url",
    "compatibilidad", "vin", "observacion",
  ];
  const allHaveAllFields = parsed.repuestos.every((r: Record<string, unknown>) =>
    fields.every((f) => Object.prototype.hasOwnProperty.call(r, f)) &&
    JSON.stringify(Object.keys(r)) === JSON.stringify(fields)
  );
  check(
    "SampleJson: 3 repuestos, cada uno con los 13 campos en orden exacto",
    parsed.repuestos.length === 3 && allHaveAllFields,
    `repuestos=${parsed.repuestos.length} orden=${allHaveAllFields ? "ok" : "falla"}`
  );
  check(
    "SampleJson: ejemplo bujías precio 14000 × 4 → subtotal 56000",
    parsed.repuestos[0].cantidad_requerida === 4 &&
      parsed.repuestos[0].cantidad_comercial === 4 &&
      parsed.repuestos[0].subtotal === 56000,
    `subtotal=${parsed.repuestos[0].subtotal}`
  );
  check(
    "SampleJson: ejemplo aceite envase 4L precio 56000 × 2 envases → subtotal 112000",
    parsed.repuestos[1].cantidad_requerida === 4.5 &&
      parsed.repuestos[1].cantidad_comercial === 2 &&
      parsed.repuestos[1].subtotal === 112000,
    `subtotal=${parsed.repuestos[1].subtotal}`
  );
  check(
    "SampleJson: total = suma de subtotales ≠ suma de precios unitarios",
    parsed.total === 168000,
    `total=${parsed.total}`
  );
  check(
    "SampleJson: precio no verificable → null en precio_unitario/cantidad_comercial/subtotal",
    parsed.repuestos[2].precio === null &&
      parsed.repuestos[2].precio_unitario === null &&
      parsed.repuestos[2].cantidad_comercial === null &&
      parsed.repuestos[2].subtotal === null &&
      parsed.repuestos[2].cantidad_requerida === 4.5,
    "objeto null ok"
  );
}

// ── 26. Nunca calcular precio del envase × litros ────────────────────────────
{
  const prompt = buildAISharePrompt({
    vehicleLabel: "MG 350", serviceName: "Lista", km: 0, items: [spark],
  });
  check(
    "Cantidad: prohibe multiplicar precio del envase por litros (nunca 56000 × 4,5)",
    prompt.includes("nunca 56000 × 4,5") &&
    prompt.includes("multiplica el precio del envase solo por la cantidad real de envases"),
    "anti 56000×4,5"
  );
}

// ── 27. Instrucción 9: 13 campos obligatorios en cada objeto ─────────────────
{
  const prompt = buildAISharePrompt({
    vehicleLabel: "MG 350", serviceName: "Lista", km: 0, items: [spark],
  });
  check(
    "Schema: instrucción 9 exige los 13 campos en todos los repuestos",
    prompt.includes("Cada objeto de 'repuestos' debe incluir SIEMPRE los campos del ejemplo, en este orden") &&
    prompt.includes("precio, precio_unitario, cantidad_requerida, cantidad_comercial, subtotal, tienda, url, compatibilidad, vin, observacion"),
    "13 campos"
  );
  check(
    "Schema: null en no verificable conserva cantidad_requerida",
    prompt.includes("devuelve null en 'precio', 'precio_unitario', 'cantidad_comercial' y 'subtotal'") &&
    prompt.includes("conserva 'cantidad_requerida' cuando se conozca"),
    "regla null"
  );
}

console.log(`\n=== RESULTADO: ${passes} ✅ / ${failures} ❌ ===\n`);
process.exit(failures > 0 ? 1 : 0);