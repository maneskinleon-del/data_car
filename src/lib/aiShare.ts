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
}

export interface AISharePromptOptions {
  vehicleLabel: string;  // ej: "MG 350S · chasis LSJA16E37FG011194"
  serviceName: string;   // ej: "Cambio Aceite & Filtros"
  km: number;            // kilometraje actual
  items: AIShareItem[];
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

// Arma el prompt listo para pegar en cualquier IA. Pide explícitamente:
//  - precios de mercado chileno en tiendas reales (Mercado Libre CL, Sodimac Auto,
//    Autoparts, etc.)
//  - formato CLP chileno con separador de miles ($50.000)
//  - respuesta en JSON para poder setear el total automáticamente.
export function buildAISharePrompt(opts: AISharePromptOptions): string {
  const lines = opts.items.map((it) => {
    const ref = it.hasReference ? ` (ref: ${it.reference})` : " (referencia: buscar compatible)";
    return `  - ${it.name} ×${it.quantity}${ref}`;
  });

  return [
    `Busca el precio actual en Chile de los siguientes repuestos para un ${opts.vehicleLabel}.`,
    `Trabajo: ${opts.serviceName}. Kilometraje: ${opts.km.toLocaleString("es-CL")} km.`,
    "",
    "Repuestos:",
    ...lines,
    "",
    "Instrucciones:",
    "1. Busca precios reales en tiendas chilenas (Mercado Libre Chile, Sodimac Auto, Autoparts, Construmart, etc.).",
    "2. Si una referencia OEM exacta no aparece, usa la equivalente más cercana y acláralo.",
    "3. Devuelve EXCLUSIVAMENTE un objeto JSON válido (sin texto alrededor, sin markdown) con esta forma:",
    '{"repuestos": [{"nombre": "Aceite de motor", "precio": 50000, "tienda": "Mercado Libre Chile"}], "total": 150000}',
    "4. El campo 'precio' y 'total' deben ser números enteros en CLP (sin puntos ni signo $).",
    "5. Formatea el total en tu respuesta con formato chileno: $150.000",
  ].join("\n");
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
