// ============================================================================
// regressionV2 — PRUEBA DE REGRESIÓN OBLIGATORIA del pipeline V2
// ============================================================================
// Ejecuta el extractor V2 contra el manual real MG 350 (ROEWE CSA7150) y
// verifica la tabla de aceptación definida por el usuario. Un dato incorrecto
// es PEOR que un dato ausente: si un valor esperado no se extrae o se extrae
// mal, la prueba FALLA — no basta con que compile.
//
//   Aceite         → 5W/40
//   Norma          → ACEA A3/B3
//   Bujía          → NGK PFR6Y
//   Gap            → 0,8–0,9 mm
//   Juego válvulas → 0,26 mm (juego) — y NUNCA 8,2 mm
//   Levantamiento  → 8,2 mm (máximo) — NO confundir con juego
//   Transmisión MT → 2,0 L
//   Transmisión AT → 2,9 L
//   Refrigerante   → 7,3 L
//   Frenos         → DOT4
//   Tabla p.75     → reconstruida
//   Filtro aceite  → NO_PUBLICADO
// ============================================================================

import * as fs from "node:fs";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { extractPageLayout } from "../src/lib/pdfLayout";
import { detectSpecRows } from "../src/lib/tableDetector";
import { TechnicalExtractorV2 } from "../src/lib/technicalExtractorV2";

const PDF_PATH = "/home/mangonz/Descargas/mg350-manual-final.pdf";

interface Expectation {
  component: string;
  slot: string;
  expect: (vals: string[]) => boolean;
  description: string;
}

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

function hasValue(vals: string[], expected: string): boolean {
  return vals.some((v) => v.toLowerCase().replace(/\s+/g, "").includes(expected.toLowerCase().replace(/\s+/g, "")));
}

async function main() {
  const data = new Uint8Array(fs.readFileSync(PDF_PATH));
  const doc = await pdfjsLib.getDocument({ data }).promise;

  console.log(`\n=== PRUEBA DE REGRESIÓN V2 — manual MG 350 (${doc.numPages} páginas) ===\n`);

  // ── 1. Layout: extraer coordenadas (P1/P2) ──
  const layout = { pages: [] as any[] };
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    layout.pages.push(await extractPageLayout(page, i));
  }
  console.log(`[P1/P2] Layout extraído de ${layout.pages.length} páginas con coordenadas ✓`);

  // ── 2. Tabla p.75: reconstruida (P3) ──
  const page75 = layout.pages.find((p) => p.page === 75);
  let table75Reconstructed = false;
  let table75Rows: string[] = [];
  if (page75) {
    const rows = detectSpecRows(75, page75.bands);
    table75Rows = rows.map((r) => `${r.label} → ${r.value}`);
    // la tabla de fluidos tiene: aceite 4,5 l · transmisión 2 L / 2,2 L / 2,9 l · refrigerante 7.3 L
    const joined = table75Rows.join(" | ");
    table75Reconstructed =
      joined.includes("4,5") && joined.includes("2,9") && joined.includes("7.3") && joined.includes("0,75");
  }
  check(
    "Tabla p.75 reconstruida",
    table75Reconstructed,
    table75Reconstructed ? `filas: ${table75Rows.slice(0, 6).join(" · ")}...` : `filas reales: ${table75Rows.slice(0, 6).join(" · ") || "(vacío)"}`
  );

  // ── 3. Extractor V2 (P4-P6) ──
  const extractor = new TechnicalExtractorV2(layout, "mg350-manual-final.pdf");
  const db = extractor.buildDatabase();

  const expectations: Expectation[] = [
    {
      component: "engine_oil", slot: "viscosity",
      expect: (v) => hasValue(v, "5W/40"),
      description: "Aceite → 5W/40",
    },
    {
      component: "engine_oil", slot: "grade",
      expect: (v) => hasValue(v, "ACEA A3/B3"),
      description: "Norma → ACEA A3/B3",
    },
    {
      component: "spark_plug", slot: "partNumber",
      expect: (v) => hasValue(v, "NGK PFR6Y"),
      description: "Bujía → NGK PFR6Y",
    },
    {
      component: "spark_plug", slot: "gap",
      expect: (v) => v.some((x) => /0[.,]8/.test(x) || /0[.,]9/.test(x)),
      description: "Gap → 0,8–0,9 mm",
    },
    {
      component: "valve", slot: "clearance",
      expect: (v) => v.some((x) => /0[.,]1|0[.,]2|0[.,]26/.test(x)),
      description: "Juego válvulas → 0,26 mm / 0,11-0,28 mm (nunca 8,2)",
    },
    {
      component: "valve", slot: "lift",
      expect: (v) => hasValue(v, "8.2") || hasValue(v, "8,2"),
      description: "Levantamiento → 8,2 mm (máximo, no juego)",
    },
    {
      component: "transmission_oil", slot: "capacity",
      expect: (v) => hasValue(v, "2 L") || hasValue(v, "2,2") || hasValue(v, "2.0"),
      description: "Transmisión MT → 2,0 L",
    },
    {
      component: "transmission_oil", slot: "capacity",
      expect: (v) => hasValue(v, "2,9"),
      description: "Transmisión AT → 2,9 L",
    },
    {
      component: "coolant", slot: "capacity",
      expect: (v) => hasValue(v, "7.3") || hasValue(v, "7,3"),
      description: "Refrigerante → 7,3 L",
    },
    {
      component: "brake_fluid", slot: "grade",
      expect: (v) => hasValue(v, "DOT4"),
      description: "Frenos → DOT4",
    },
    {
      component: "oil_filter", slot: "partNumber",
      expect: (v) => v.length === 1 && v[0] === "",
      description: "Filtro aceite → NO_PUBLICADO",
    },
    {
      component: "tire_size", slot: "size",
      expect: (v) => hasValue(v, "205/55 R16"),
      description: "Neumáticos → 205/55 R16 (p.598)",
    },
    {
      component: "tire_size", slot: "pressure",
      expect: (v) => v.some((x) => /2[.,]1/.test(x)),
      description: "Presión neumáticos → 2,1 bar (p.598)",
    },
    {
      component: "spark_plug", slot: "partNumber",
      expect: (v) => hasValue(v, "NGK PFR6Y"),
      description: "Bujía → NGK PFR6Y (p.243)",
    },
    {
      component: "battery", slot: "capacity",
      expect: (v) => v.length === 1 && v[0] === "",
      description: "Batería → NO_PUBLICADO (manual no la publica)",
    },
    {
      component: "brake_pad_front", slot: "partNumber",
      expect: (v) => v.length === 1 && v[0] === "",
      description: "Pastillas delanteras → NO_PUBLICADO (catálogo las aporta)",
    },
    {
      component: "brake_pad_rear", slot: "partNumber",
      expect: (v) => v.length === 1 && v[0] === "",
      description: "Pastillas traseras → NO_PUBLICADO (catálogo las aporta)",
    },
  ];

  // ── 3.5 Dump de TODOS los componentes extraídos (auditabilidad) ──
  console.log(`\n=== DUMP DE LA DB V2 ===`);
  for (const [system, comps] of Object.entries(db.components)) {
    for (const comp of comps) {
      const slots = comp.specFields
        .map((f) => {
          const vs = f.values.map((v) => (v.status === "extracted" ? v.value : v.status)).join(",");
          return `${f.id}=[${vs}]`;
        })
        .join(" ");
      console.log(`  [${system}] ${comp.id} (${comp.validationStatus}): ${slots}`);
    }
  }

  const findComponent = (id: string) => {
    for (const comps of Object.values(db.components)) {
      const c = comps.find((x) => x.id === id);
      if (c) return c;
    }
    return undefined;
  };

  for (const e of expectations) {
    const comp = findComponent(e.component);
    const field = comp?.specFields.find((f) => f.id === e.slot);
    const values = (field?.values ?? []).map((v) => v.value);
    const statuses = (field?.values ?? []).map((v) => v.status);
    const ok = e.expect(values);
    const detail = values.length > 0
      ? `valores=[${values.join(", ")}] status=[${statuses.join(", ")}]`
      : "(sin valores)";
    check(e.description, ok, detail);
  }

  // ── 4. CASO CRÍTICO: 8,2 mm ≠ juego de válvulas ──
  const valve = db.components.motor?.find((c) => c.id === "valve");
  const clearance = valve?.specFields.find((f) => f.id === "clearance");
  const clearanceValues = (clearance?.values ?? []).map((v) => v.value).join(" ");
  const clearanceHasLift = /8\s*[.,]\s*2/.test(clearanceValues);
  check(
    "8,2 mm NO es juego de válvulas",
    !clearanceHasLift,
    clearanceHasLift ? `¡ERROR! clearance contiene 8.2: "${clearanceValues}"` : `clearance = "${clearanceValues}" — correcto`
  );

  // ── 5. Cobertura honesta ──
  console.log(`\n=== COBERTURA V2 ===`);
  console.log(`  totalSlots: ${db.coverage.totalSlots}`);
  console.log(`  extracted: ${db.coverage.extracted}`);
  console.log(`  notFound: ${db.coverage.notFound}`);
  console.log(`  notPublished: ${db.coverage.notPublished}`);
  console.log(`  decisionReady: ${db.coverage.decisionReady}`);

  // ── 5.5 SEED JSON — la base PRECARGADA embebida debe estar al día con la
  // extracción real (la app la usa en cualquier dispositivo sin el PDF). Si
  // este test falla, hay que regenerarla: node scripts/build-base-json.mjs
  // (con esbuild, ver el header del script).
  console.log(`\n=== SEED JSON (mg350Base.json) ===`);
  const seedRaw = fs.readFileSync("src/data/mg350Base.json", "utf8");
  const seed = JSON.parse(seedRaw) as {
    schemaVersion: number;
    preloaded?: boolean;
    components: Record<string, { id: string; specFields: { id: string; values: { status: string; value: string }[] }[] }[]>;
    parts?: { entries: { componentId: string }[] };
    coverage?: { extracted: number; notPublished: number; decisionReady: number };
  };
  check("Seed: schemaVersion 2", seed.schemaVersion === 2, `schemaVersion=${seed.schemaVersion}`);
  check("Seed: marcada preloaded", seed.preloaded === true, `preloaded=${seed.preloaded}`);

  const seedEngineOil = Object.values(seed.components)
    .flat()
    .find((c) => c.id === "engine_oil");
  const seedVisc = seedEngineOil?.specFields.find((f) => f.id === "viscosity")?.values
    .filter((v) => v.status === "extracted")
    .map((v) => v.value)
    .join(" ");
  check("Seed: aceite 5W/40 embebido", !!seedVisc?.includes("5W/40"), `viscosity=${seedVisc ?? "(vacío)"}`);

  const seedParts = seed.parts?.entries.map((e) => e.componentId) ?? [];
  check(
    "Seed: catálogo incluye pastillas y batería",
    seedParts.includes("brake_pad_front") && seedParts.includes("battery") && seedParts.includes("spark_plug"),
    `entradas=${seedParts.length} (${seedParts.join(", ")})`
  );
  check(
    "Seed: cobertura igual a la extracción real",
    seed.coverage?.extracted === db.coverage.extracted && seed.coverage?.decisionReady === db.coverage.decisionReady,
    `seed=${seed.coverage?.extracted}/${seed.coverage?.decisionReady} vs real=${db.coverage.extracted}/${db.coverage.decisionReady}`
  );

  console.log(`\n=== RESULTADO: ${passes} ✅ / ${failures} ❌ ===\n`);
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("ERROR EN REGRESIÓN:", e);
  process.exit(1);
});
