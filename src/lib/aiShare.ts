// ============================================================================
// aiShare — Compartir un requerimiento de mantención con una IA externa.
// ============================================================================
// La app es una PWA estática (sin backend), así que no llama a una API de LLM
// directamente. En su lugar:
//   1. buildAISharePrompt() arma un prompt con los repuestos REALES del
//      requerimiento (resueltos del catálogo) + contexto del vehículo.
//   2. El usuario copia el prompt y lo pega en cualquier IA (ChatGPT, Gemini,
//      Claude, etc.) — le pide buscar precios en tiendas chilenas y devolver
//      un JSON con formato CLP ($50.000, separador de miles).
//   3. La IA responde → el usuario pega la respuesta → parseAIResponse()
//      extrae el JSON y setea el total en el modal (formato chileno).
// Regla de oro: la app nunca inventa precios — los trae la IA de mercado real.
// ============================================================================

import { PartInfo } from "../types/technicalV2";

// Formatea un número como pesos chilenos: 50000 → "$50.000" (0 decimales).
export function formatCLP(n: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(n);
}

export interface AIShareItem {
  name: string;          // nombre del componente (ej: "Aceite de motor")
  quantity: number;      // cuántas unidades
  reference: string;     // referencia preferida (OEM/aftermarket) o ""
  hasReference: boolean; // false → "referencia disponible"
  note?: string;         // detalle técnico (ej: "5W/40 · ACEA A3/B3,B4 · 4,5 L")
  componentId?: string;  // id del catálogo (ej: "spark_plug") — identidad estable para dedup
}

export interface AISharePromptOptions {
  vehicleLabel: string;  // ej: "MG 350 · chasis LSJA16E37FG011194"
  serviceName: string;   // ej: "Cambio Aceite & Filtros"
  km: number;            // kilometraje actual
  items: AIShareItem[];
  vin?: string;          // VIN/chasis si se quiere reforzar en el prompt
}

// Resuelve la mejor referencia de un componente desde el catálogo.
// (Misma lógica que MaintenancePacks — se mantiene acá para reutilizar.)
export function resolveReference(parts: PartInfo[]): {
  text: string;
  verified: boolean;
  found: boolean;
} {
  if (!parts || parts.length === 0) return { text: "", verified: false, found: false };
  const user = parts.find((p) => p.source === "user");
  const verified = parts.filter((p) => p.verified);
  const preferred = user ?? verified[0] ?? parts[0];

  if (preferred.oem) {
    const text = preferred.oem.replace(/\(SAIC\)|\(.*\)/g, "").trim();
    return { text, verified: preferred.verified, found: true };
  }
  const am = preferred.aftermarket?.[0];
  if (am) {
    return { text: `${am.brand} ${am.partNumber}`, verified: preferred.verified, found: true };
  }
  return { text: "", verified: false, found: false };
}

// Evidencia que la IA puede aportar por repuesto en el JSON de respuesta.
// Los campos que la UI consume siguen siendo nombre/precio/tienda; el resto
// se conserva en el item del carrito para auditoría posterior.
export interface RepuestoEvidencia {
  nombre?: string;
  precio?: number;
  tienda?: string;
  referencia_solicitada?: string; // referencia que la app pidió buscar
  referencia_encontrada?: string; // referencia que la publicación declara
  url?: string;                   // publicación/anuncio identificable
  compatibilidad?: string;        // ver estados en el prompt
  vin?: string;                   // "no validado por la publicación" por defecto
  observacion?: string;           // ej: "equivalente usado, OEM exacto no publicado"
}

// Normaliza una cadena para comparación tolerante: minúsculas, sin acentos,
// sin contenido entre paréntesis (refs), solo alfanumérico.
function normKey(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Consolida los items del carrito ANTES de construir el prompt.
// Identidad: componente (componentId) + referencia solicitada. Dos items
// representan el MISMO repuesto solo si comparten esa identidad; si tienen el
// mismo nombre pero distinto componente o distinta referencia, se conservan
// separados (son productos distintos). Solo cuando no hay ni componente ni
// referencia se cae al nombre para no colapsar productos ignorables.
//
// Semántica de quantity: cada pack declara las unidades físicas que el
// vehículo necesita para ese trabajo (p. ej. 4 bujías = 4 cilindros).
// Packs distintos pueden mencionar el mismo componente con la misma
// cantidad (p. ej. "Afinamiento" y "Encendido" ambas ×4 spark_plug)
// porque representan la MISMA pieza física del vehículo vista desde
// trabajos distintos — NO son cantidades independientes sumables.
// Consolidamos con Math.max(): toma la mayor cantidad declarada por el
// usuario sin inventar unidades adicionales.
export function normalizeCartItems(items: AIShareItem[]): AIShareItem[] {
  const merged = new Map<string, AIShareItem>();
  for (const it of items) {
    const compId = (it.componentId ?? "").trim();
    const ref = (it.reference ?? "").trim();
    const key = compId || ref ? `${compId}::${ref.toUpperCase()}` : normKey(it.name);
    const cur = merged.get(key);
    if (!cur) {
      merged.set(key, { ...it });
      continue;
    }
    // max, no suma: mismo componente = misma pieza física del vehículo
    cur.quantity = Math.max(cur.quantity, it.quantity);
    if (!cur.note && it.note) cur.note = it.note;
    if (!cur.reference && it.reference) cur.reference = it.reference;
    if (!cur.hasReference && it.hasReference) cur.hasReference = it.hasReference;
  }
  return Array.from(merged.values());
}

// Busca el repuesto de la respuesta de la IA correspondiente a un item del
// carrito (match tolerante bidireccional por nombre). Devuelve la evidencia
// COMPLETA del repuesto (o undefined si no hay match con precio numérico).
export function findRepuesto(
  itemName: string,
  repuestos: RepuestoEvidencia[]
): RepuestoEvidencia | undefined {
  const norm = normKey(itemName);
  if (!norm) return undefined;
  for (const r of repuestos) {
    const nr = normKey(r.nombre ?? "");
    if (!nr || typeof r.precio !== "number") continue;
    if (norm.includes(nr) || nr.includes(norm)) return r;
  }
  return undefined;
}

// Arma el prompt listo para pegar en cualquier IA. Pide explícitamente:
//  - precios de mercado chileno en tiendas reales con publicación identificable
//  - NO inventar precios ni equivalentes no demostrados
//  - distinguir compatibilidad declarada vs. inferida vs. confirmada por VIN
//  - formato CLP + JSON para poder setear el total automáticamente
// Normaliza los items (dedup por componente+referencia) antes de armar las líneas.
export function buildAISharePrompt(opts: AISharePromptOptions): string {
  const lines = normalizeCartItems(opts.items).map((it) => {
    const ref = it.hasReference ? ` (ref: ${it.reference})` : " (referencia: buscar compatible)";
    const note = it.note ? ` · ${it.note}` : "";
    return `  - ${it.name} ×${it.quantity}${ref}${note}`;
  });

  const vinLine = opts.vin
    ? `VIN / chasis: ${opts.vin}. Usa el VIN como dato de identificación/contraste al filtrar resultados, pero NO afirmes compatibilidad exacta por VIN salvo que la publicación realice esa validación: cualquier afirmación de compatibilidad requiere la evidencia de la fuente.`
    : null;

  const sampleJson = `{
  "repuestos": [
    {
      "nombre": "Pastillas de freno delanteras",
      "referencia_solicitada": "10026870",
      "referencia_encontrada": "10026870",
      "precio": 27970,
      "tienda": "Mercado Libre Chile",
      "url": "https://publicacion.example.com/auto/10026870",
      "compatibilidad": "declarada por la publicacion",
      "vin": "no validado por la publicacion",
      "observacion": null
    },
    {
      "nombre": "Aceite de motor",
      "referencia_solicitada": "5W/40 ACEA A3/B4",
      "referencia_encontrada": "5W-30 ACEA C3",
      "precio": null,
      "tienda": "Mercado Libre Chile",
      "url": "https://publicacion.example.com/aceite",
      "compatibilidad": "no verificada",
      "vin": "no validado por la publicacion",
      "observacion": "Encontrado 5W-30 C3, no cumple 5W/40 A3/B4"
    }
  ],
  "total": 27970
}`;

  return [
    `Busca el precio actual en Chile de los siguientes repuestos para un ${opts.vehicleLabel}.`,
    vinLine,
    `Trabajo: ${opts.serviceName}. Kilometraje: ${opts.km.toLocaleString("es-CL")} km.`,
    "",
    "Repuestos (referencias provistas por la app, verificadas en el catálogo):",
    ...lines,
    "",
    "Instrucciones:",
    "1. Busca precios REALES Y ACTUALES en tiendas chilenas (Mercado Libre Chile, Sodimac Auto, Autoparts, Construmart, etc.). Cada precio debe estar respaldado por una publicación identificable (incluye su 'url'). Solo considera precio actual aquel que sea visible y verificable en la publicación consultada en esta búsqueda: NO uses precios históricos, snippets de buscador, cachés, páginas indexadas pero no comprobables ni publicaciones agotadas como precio actual. NUNCA inventes un precio ni lo estimes: si no puedes verificar uno visible, devuelve \"precio\": null y explica el motivo en \"observacion\". No rellenes precios ausentes.",
    "2. Las referencias indicadas en cada línea (p. ej. UJ-1797, NGK PFR6Y, LPW 100180, 10026870, 10030811, 10025044) son referencias de búsqueda verificadas por la app. Úsalas como criterio de búsqueda; no las reemplaces por otra referencia que encuentres sin declararlo en \"observacion\".",
    "3. Si el OEM exacto no aparece, puedes buscar equivalentes de marcas reconocidas (MANN, MAHLE, BOSCH, NGK, DENSO...) y debes declararlo en \"observacion\". Una coincidencia de nombre/modelo NO equivale a compatibilidad.",
    "4. Clasifica cada repuesto en \"compatibilidad\" con UNO de estos estados: \"referencia coincidente con la solicitada\", \"declarada por la publicación/tienda\", \"inferida por modelo/año/motor\", \"confirmada por VIN\" o \"no verificada\".",
    "5. Jerarquía de evidencia — prioriza así la confiabilidad del precio y la compatibilidad: (1) publicación que coincide con la referencia solicitada, (2) publicación que declara explícitamente aplicación al vehículo/motor/año, (3) publicación que valida mediante VIN/chasis, (4) equivalente de marca reconocida con especificaciones verificables, (5) coincidencia únicamente por nombre/modelo: no verificada. Nunca eleves una coincidencia de nivel inferior a uno superior.",
    "6. En \"vin\" indica \"no validado por la publicación\" salvo que la publicación demuestre una validación real del VIN. Tener el VIN del vehículo NO demuestra compatibilidad exacta.",
    "7. Fluidos: conserva los requisitos técnicos de la nota (viscosidad, norma ACEA/API, tipo de refrigerante, capacidad en litros — p. ej. 5W/40 · ACEA A3/B3,B4 · 4,5 L). No cambies silenciosamente un fluido: si una variante no cumple la especificación, no la presentes como compatible. Para productos vendidos en envases, conserva la capacidad requerida del vehículo como referencia técnica y calcula la cantidad mínima de envases necesarios para cubrirla. No reduzcas la capacidad técnica solicitada a la capacidad de un solo envase (p. ej. refrigerante 7,3 L → 2 envases de 4 L, no un solo envase de 4 L).",
    "8. Devuelve EXCLUSIVAMENTE un objeto JSON válido (sin texto alrededor, sin markdown) con esta forma:",
    sampleJson,
    "9. 'nombre', 'precio' y 'tienda' son obligatorios siempre. 'referencia_solicitada', 'referencia_encontrada', 'url', 'compatibilidad', 'vin' y 'observacion': complétalos cuando puedas determinarlos con evidencia — nunca los inventes.",
    "10. 'precio' y 'total' deben ser números enteros en CLP (sin puntos ni signo $). Si un repuesto tiene \"precio\": null, NO debe sumarse al total. 'total' es la suma exclusiva de los precios numéricos verificados.",
  ]
    .filter((line): line is string => line != null)
    .join("\n");
}

// Mapea cada tipo de servicio del modal (SERVICE_OPTIONS) a los componentIds
// de la base técnica que ese trabajo consume. Se usa para armar el prompt de
// repuestos. Servicios de labor/diagnóstico (sin repuestos definidos) dejan
// la lista vacía → el prompt pide precio del servicio en sí.
export const SERVICE_COMPONENT_IDS: Record<string, string[]> = {
  "Cambio Aceite & Filtros": ["engine_oil", "oil_filter", "air_filter", "cabin_filter"],
  "Mantenimiento Mayor": [
    "spark_plug", "air_filter", "cabin_filter", "engine_oil", "oil_filter",
    "coolant", "brake_fluid", "brake_pad_front", "brake_pad_rear", "alternator_belt",
  ],
  "Alineación y Balanceo": [],
  "Revisión Eléctrica ECU": [],
  Otro: [],
};

// Extrae el objeto JSON de la respuesta de la IA y devuelve { repuestos, total }.
// Tolerante: busca el primer bloque { ... } válido aunque la IA haya agregado
// texto alrededor (markdown, frases). Devuelve null si no encontró total.
export function parseAIResponse(text: string): { total: number; repuestos: unknown[] } | null {
  if (!text) return null;
  // Quitar bloques de código markdown ```json ... ```
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  // Buscar el primer objeto JSON completo (llaves balanceadas)
  let start = -1;
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] === "{") { start = i; break; }
  }
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < cleaned.length; i++) {
    if (cleaned[i] === "{") depth++;
    else if (cleaned[i] === "}") {
      depth--;
      if (depth === 0) {
        const candidate = cleaned.slice(start, i + 1);
        try {
          const parsed = JSON.parse(candidate);
          if (typeof parsed.total === "number" && parsed.total > 0) {
            return { total: parsed.total, repuestos: Array.isArray(parsed.repuestos) ? parsed.repuestos : [] };
          }
        } catch {
          // malformed → seguir buscando
        }
        break;
      }
    }
  }
  return null;
}
