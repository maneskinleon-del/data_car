import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  Search,
  Upload,
  FileText,
  Loader2,
  ChevronDown,
  ChevronUp,
  Trash2,
  Zap,
  Info,
  Link2,
  Database,
  Copy,
  ExternalLink,
} from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
// Worker de pdf.js empaquetado LOCALMENTE por Vite (?url) en vez de cargarlo
// desde CDN (unpkg): el CDN falla con red restringida / CORS / offline.
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { VehicleSpecs } from "../types";
import {
  VehicleTechnicalDatabaseV2,
  TechnicalComponentV2,
  SpecField,
  SystemCategory,
  PartInfo,
} from "../types/technicalV2";
import { extractDocumentLayout, DocumentLayout } from "../lib/pdfLayout";
import { TechnicalExtractorV2 } from "../lib/technicalExtractorV2";
// Base técnica PRECARGADA del MG 350 (generada desde el manual real con
// scripts/build-base-json.mjs): cualquier dispositivo carga la misma
// información sin necesitar subir el PDF de 28 MB.
import mg350Base from "../data/mg350Base.json";
import { applySpecsSyncV2 } from "../lib/specsSyncV2";
import {
  attachPartsCatalog,
  getPartsFromDb,
  lookupCatalogParts,
} from "../lib/partsCatalogProvider";
import { FUSES, getFusesByBox } from "../data/fuses";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const MAX_PDF_SIZE = 50 * 1024 * 1024;
const DB_STORAGE_KEY = "mg350_technical_db_v2";
// Clave de la base precargada embebida (sin manual subido).
const PRELOADED_SOURCE = "mg350-base-preloaded";

interface TechnicalDatabaseProps {
  specs: VehicleSpecs;
  onUpdateSpecs: (updated: Partial<VehicleSpecs>) => void;
  triggerToast: (msg: string) => void;
}

const SYSTEM_CONFIG: Record<SystemCategory, { label: string; icon: string; gradient: string }> = {
  motor: { label: "Motor", icon: "🔧", gradient: "from-orange-500 to-red-500" },
  fluidos: { label: "Fluidos", icon: "💧", gradient: "from-blue-500 to-cyan-500" },
  encendido: { label: "Encendido", icon: "⚡", gradient: "from-yellow-500 to-orange-500" },
  filtros: { label: "Filtros", icon: "🧰", gradient: "from-green-500 to-emerald-500" },
  frenos: { label: "Frenos", icon: "🛑", gradient: "from-red-500 to-pink-500" },
  suspension: { label: "Suspensión", icon: "🔩", gradient: "from-purple-500 to-violet-500" },
  transmision: { label: "Transmisión", icon: "⚙️", gradient: "from-indigo-500 to-blue-500" },
  electrico: { label: "Eléctrico", icon: "🔌", gradient: "from-yellow-500 to-amber-500" },
  neumaticos: { label: "Neumáticos", icon: "🛞", gradient: "from-gray-500 to-slate-500" },
  carroceria: { label: "Carrocería", icon: "🚗", gradient: "from-pink-500 to-rose-500" },
};

// Estados visuales: los badges se renderizan inline en FieldRow (✓/⚪/⚠️)
const VALIDATION_BADGE: Record<string, { text: string; cls: string }> = {
  verified: { text: "VERIFIED", cls: "text-emerald-400" },
  plausible: { text: "PLAUSIBLE", cls: "text-cyan-400" },
  conflict: { text: "CONFLICTO", cls: "text-red-400" },
  invalid: { text: "INVÁLIDO", cls: "text-white/30" },
};

// Etiquetas de origen de la pieza (manual ≠ catálogo ≠ dueño)
const PART_SOURCE_LABEL: Record<string, string> = {
  equivalence: "equivalencia",
  catalog: "catálogo",
  aftermarket: "aftermarket",
  manual: "manual",
  user: "instalado por el dueño",
};

// Lado de la pieza (plumillas)
const PART_SIDE_LABEL: Record<string, string> = {
  driver: "conductor",
  passenger: "pasajero",
};

// Copia una referencia al portapapeles (con fallback para contextos sin
// Clipboard API) y avisa con toast.
function copyReference(ref: string, triggerToast: (msg: string) => void) {
  const done = () => triggerToast(`COPIADO: ${ref}`);
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(ref).then(done).catch(() => {
      fallbackCopy(ref);
      done();
    });
  } else {
    fallbackCopy(ref);
    done();
  }
}

function fallbackCopy(text: string) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand("copy");
  } catch (e) {
    console.error(e);
  }
  document.body.removeChild(ta);
}

// Abre el buscador con la referencia (nueva pestaña).
function searchReference(ref: string) {
  window.open(`https://www.google.com/search?q=${encodeURIComponent(ref)}`, "_blank", "noopener");
}

// Botón compacto de acción para una referencia (copiar / buscar).
// `ref` es lo que se copia (número puro); `searchQuery` es lo que se busca
// (marca + número para resultados más precisos).
function RefActions({
  ref,
  searchQuery,
  triggerToast,
}: {
  ref: string;
  searchQuery?: string;
  triggerToast: (msg: string) => void;
}) {
  const q = searchQuery ?? ref;
  return (
    <span className="flex items-center gap-1 shrink-0">
      <button
        onClick={(e) => {
          e.stopPropagation();
          copyReference(ref, triggerToast);
        }}
        title={`Copiar ${ref}`}
        className="p-1 rounded bg-white/5 hover:bg-cyan-500/20 text-white/40 hover:text-cyan-300 transition-colors cursor-pointer"
      >
        <Copy className="w-3 h-3" />
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          searchReference(q);
        }}
        title={`Buscar ${q}`}
        className="p-1 rounded bg-white/5 hover:bg-cyan-500/20 text-white/40 hover:text-cyan-300 transition-colors cursor-pointer"
      >
        <ExternalLink className="w-3 h-3" />
      </button>
    </span>
  );
}

// Sección de catálogo (Fase 2): referencias externas al manual, con su nivel
// de verificación. verified:true → ✓ comprable con confianza;
// verified:false → ⚠️ candidata, verificar antes de comprar.
function CatalogSection({ parts, triggerToast }: { parts: PartInfo[]; triggerToast: (msg: string) => void }) {
  if (parts.length === 0) return null;
  return (
    <div className="mt-3 pt-3 border-t border-white/10">
      <div className="flex items-center gap-2 mb-2">
        <span className="font-mono text-[9px] text-cyan-400 uppercase tracking-widest font-bold">
          Catálogo de repuestos
        </span>
        <span className="px-1.5 py-0.5 bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 font-mono text-[7px] rounded">
          CATÁLOGO
        </span>
      </div>
      <div className="space-y-2">
        {parts.map((p, i) => (
          <div
            key={i}
            className={`rounded-lg border p-2.5 ${
              p.verified
                ? "border-emerald-500/25 bg-emerald-500/5"
                : "border-amber-500/25 bg-amber-500/5"
            }`}
          >
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              {p.verified ? (
                <span className="font-mono text-[8px] text-emerald-400">✓ VERIFICADO</span>
              ) : (
                <span className="font-mono text-[8px] text-amber-400">⚠️ SIN VERIFICAR</span>
              )}
              <span className="font-mono text-[8px] text-white/30">
                {PART_SOURCE_LABEL[p.source] ?? p.source}
              </span>
              {p.side && (
                <span className="px-1 py-0.5 bg-white/5 border border-white/10 text-white/50 font-mono text-[7px] rounded">
                  {PART_SIDE_LABEL[p.side] ?? p.side}
                </span>
              )}
            </div>
            {p.oem && (
              <div className="flex items-center justify-between gap-2">
                <p className="font-mono text-[10px] text-white/90">
                  {p.source === "user" ? "Instalado" : "OEM"}{" "}
                  <span className="text-cyan-300 font-bold">{p.oem}</span>
                </p>
                <RefActions ref={p.oem} triggerToast={triggerToast} />
              </div>
            )}
            <div className="grid grid-cols-1 gap-1 mt-1.5">
              {p.aftermarket.map((a) => (
                <div key={a.brand} className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[9px] text-white/50">{a.brand}</span>
                  <span className="font-mono text-[10px] text-white font-bold">{a.partNumber}</span>
                  <RefActions ref={a.partNumber} searchQuery={`${a.brand} ${a.partNumber}`} triggerToast={triggerToast} />
                </div>
              ))}
            </div>
            {p.compatible.length > 0 && (
              <p className="font-mono text-[8px] text-white/40 mt-1.5">
                Aplica a: {p.compatible.join(" · ")}
              </p>
            )}
            {p.note && (
              <p className="font-mono text-[8px] leading-relaxed mt-1.5 text-white/40">
                {p.note}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Card de componente V2 — muestra cada specField con estado, variante y trazabilidad
function ComponentCardV2({
  component,
  parts,
  triggerToast,
}: {
  component: TechnicalComponentV2;
  parts?: PartInfo[];
  triggerToast: (msg: string) => void;
  key?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasData = component.specFields.some((f) =>
    f.values.some((v) => v.status === "extracted" && !v.conflict)
  );

  return (
    <div className="p-3 rounded-lg border bg-white/5 border-white/10">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">{component.icon}</span>
          <span className="font-mono text-xs text-white font-bold">{component.name}</span>
          {component.verified && (
            <span className="px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-[7px] rounded">
              ✓ VERIFICADO
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-white/40" />
        ) : (
          <ChevronDown className="w-4 h-4 text-white/40" />
        )}
      </button>

      {expanded && (
        <div className="mt-3 space-y-3">
          {component.specFields.map((field) => (
            <FieldRow key={field.id} field={field} />
          ))}
          {!hasData && component.specFields.length === 0 && (
            <p className="font-mono text-[10px] text-white/30">
              Sin especificaciones definidas para este componente.
            </p>
          )}
          <CatalogSection parts={parts ?? []} triggerToast={triggerToast} />
        </div>
      )}
    </div>
  );
}

function FieldRow({ field }: { field: SpecField; key?: string }) {
  return (
    <div className="text-[10px]">
      <div className="flex items-center justify-between mb-1">
        <span className="font-mono text-white/40 uppercase tracking-wider">
          {field.label}
          {field.expectedUnit ? ` (${field.expectedUnit})` : ""}
        </span>
        {field.dependsOnVariant && (
          <span className="font-mono text-[8px] text-white/30">depende de la transmisión</span>
        )}
      </div>
      <div className="space-y-1.5">
        {field.values.map((v, i) => {
          if (v.status === "not_found") {
            return (
              <div key={i} className="flex items-center gap-2 font-mono text-white/30">
                <span>⚪</span> No encontrado en el manual
              </div>
            );
          }
          if (v.status === "not_published") {
            return (
              <div key={i} className="flex items-center gap-2 font-mono text-amber-400/80">
                <span>⚠️</span> El manual de taller no publica este dato
              </div>
            );
          }
          // status === "extracted"
          return (
            <div key={i} className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-emerald-400">✓</span>
                <span className={`font-mono text-white/90 ${v.conflict ? "line-through text-red-400" : ""}`}>
                  {v.value}
                </span>
                {v.variant && (
                  <span className="px-1 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 font-mono text-[8px] rounded">
                    {v.variant.label}
                  </span>
                )}
                <span className={`font-mono text-[8px] ${VALIDATION_BADGE[v.validationStatus]?.cls ?? "text-white/30"}`}>
                  {VALIDATION_BADGE[v.validationStatus]?.text ?? v.validationStatus}
                </span>
              </div>
              {v.source && (
                <div className="flex items-center gap-2 font-mono text-[8px] text-white/30 ml-5">
                  <span>📄 p.{(v.source.pages ?? []).join(", ")}</span>
                  {v.source.section && <span>· {v.source.section.slice(0, 40)}</span>}
                  <span>· confianza {(v.confidence * 100).toFixed(0)}%</span>
                </div>
              )}
              {v.conflict && (
                <div className="ml-5 font-mono text-[8px] text-red-400">
                  Conflicto sin resolver: hay valores rivales de distintas páginas. No usar para decidir.
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Panel de cobertura V2 — métrica decisionReady (datos utilizables, no campos llenos)
function CoveragePanelV2({ database }: { database: VehicleTechnicalDatabaseV2 }) {
  const systems = Object.entries(database.components) as [SystemCategory, TechnicalComponentV2[]][];
  const totalComponents = systems.reduce((sum, [, comps]) => sum + comps.length, 0);
  const c = database.coverage;

  const perSystem = systems.map(([system, comps]) => {
    const compsWithData = comps.filter((comp) =>
      comp.specFields.some((f) => f.values.some((v) => v.status === "extracted" && !v.conflict))
    ).length;
    const percent = comps.length > 0 ? Math.round((compsWithData / comps.length) * 100) : 0;
    return { system, comps, compsWithData, percent };
  });

  // Piezas con referencia real (OEM o aftermarket); sin contar candidatas vacías
  const catalogCount =
    database.parts?.entries?.reduce(
      (s, e) => s + e.parts.filter((p) => p.oem || p.aftermarket.length > 0).length,
      0
    ) ?? 0;
  const decisionPercent = c.totalSlots > 0 ? Math.round((c.decisionReady / c.totalSlots) * 100) : 0;

  return (
    <div className="glass-panel p-5 rounded-xl border border-white/10">
      <h3 className="font-mono text-[10px] text-white/50 uppercase font-bold tracking-widest mb-4">
        Cobertura Técnica
      </h3>

      <div className="space-y-3">
        {perSystem.map(({ system, comps, compsWithData, percent }) => {
          const config = SYSTEM_CONFIG[system];
          return (
            <div key={system} className="flex items-center gap-3">
              <span className="text-sm">{config.icon}</span>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-[9px] text-white/60">{config.label}</span>
                  <span className="font-mono text-[8px] text-white/40">{compsWithData}/{comps.length}</span>
                </div>
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full bg-gradient-to-r ${
                      percent >= 60 ? "from-emerald-500 to-green-500" : percent >= 30 ? "from-yellow-500 to-amber-500" : "from-white/30 to-white/10"
                    } rounded-full transition-all`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-4 border-t border-white/10 space-y-1">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs text-white/60">Componentes</span>
          <span className="font-mono text-sm text-white font-bold">{totalComponents}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs text-white/60">Valores extraídos (✓)</span>
          <span className="font-mono text-sm text-emerald-400 font-bold">{c.extracted}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs text-white/60">No encontrados (⚪)</span>
          <span className="font-mono text-sm text-white/50 font-bold">{c.notFound}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs text-white/60">No publicados en manual (⚠️)</span>
          <span className="font-mono text-sm text-amber-400 font-bold">{c.notPublished}</span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="font-mono text-xs text-white/60">Decision-ready</span>
          <span className="font-mono text-sm text-cyan-400 font-bold">{c.decisionReady}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs text-white/60">Piezas en catálogo (F2)</span>
          <span className="font-mono text-sm text-cyan-400 font-bold">{catalogCount}</span>
        </div>
        <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mt-2">
          <div
            className={`h-full bg-gradient-to-r ${
              decisionPercent >= 60 ? "from-cyan-500 to-blue-500" : decisionPercent >= 30 ? "from-yellow-500 to-amber-500" : "from-white/30 to-white/10"
            } rounded-full transition-all`}
            style={{ width: `${Math.min(100, decisionPercent)}%` }}
          />
        </div>
        <p className="font-mono text-[8px] text-white/30 mt-1 leading-relaxed">
          "Decision-ready" = valores extraídos sin conflicto con confianza suficiente para decidir una compra.
        </p>
      </div>
    </div>
  );
}

// ── OBD2 Reference (static SAE codes, not from manual) ──────────────────────
const OBD2_CODES = [
  { code: "P0101", desc: "Sensor MAF/MAP — rango fuera de lo esperado", accion: "Revisar conector, limpiar sensor, chequear fugas de vacío" },
  { code: "P0300", desc: "Fallo de encendido aleatorio/múltiple cilindro", accion: "Revisar bujías, bobinas, compresión" },
  { code: "P0301-P0304", desc: "Fallo de encendido en cilindro específico (1-4)", accion: "Intercambiar bobina/bujía entre cilindros para confirmar origen" },
  { code: "P0420", desc: "Eficiencia del catalizador bajo el umbral (Banco 1)", accion: "Revisar sonda lambda pre/post catalizador, fugas de escape" },
  { code: "P0130-P0135", desc: "Circuito de sonda de oxígeno (Banco 1, Sensor 1)", accion: "Revisar cableado, calentador de sonda, reemplazar si corresponde" },
  { code: "P0171/P0174", desc: "Sistema demasiado pobre (Banco 1 / Banco 2)", accion: "Buscar fugas de admisión, revisar MAF/MAP, filtro de aire" },
  { code: "P0505", desc: "Sistema de control de ralentí (cuerpo de aceleración)", accion: "Limpiar cuerpo de aceleración, revisar válvula IAC" },
];

function OBD2ReferenceSection() {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="glass-panel rounded-xl border border-white/10 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-white/2 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-violet-500 flex items-center justify-center">
            <span className="text-lg">📖</span>
          </div>
          <div className="text-left">
            <span className="font-mono text-xs text-white font-bold tracking-wider block">
              Diagnóstico OBD2
            </span>
            <span className="font-mono text-[9px] text-white/40">
              Referencia estándar SAE — {OBD2_CODES.length} códigos
            </span>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-white/40" />
        ) : (
          <ChevronDown className="w-4 h-4 text-white/40" />
        )}
      </button>
      {expanded && (
        <div className="px-4 pb-4 border-t border-white/5 pt-3 space-y-2">
          {OBD2_CODES.map((item) => (
            <div key={item.code} className="p-3 rounded-lg border bg-white/5 border-white/10">
              <span className="font-mono text-xs text-purple-400 font-bold">{item.code}</span>
              <p className="font-mono text-[10px] text-white/70 mt-1">{item.desc}</p>
              <p className="font-mono text-[9px] text-white/40 mt-1">→ {item.accion}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Fusibles y relés (referencia del manual de taller) ─────────────────────
function FusesSection() {
  const [expanded, setExpanded] = useState(false);
  const engine = getFusesByBox("engine");
  const cabin = getFusesByBox("cabin");

  const boxCard = (boxId: "engine" | "cabin") => {
    const entries = boxId === "engine" ? engine : cabin;
    const isEngine = boxId === "engine";
    return (
      <div className="rounded-lg border border-white/10 bg-white/5 p-3">
        <div className="flex items-center gap-2 mb-2.5">
          <div className={`w-7 h-7 rounded bg-gradient-to-br ${isEngine ? "from-amber-500 to-orange-600" : "from-orange-500 to-red-600"} flex items-center justify-center shrink-0`}>
            <Zap className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <p className="font-mono text-[10px] text-white font-bold tracking-wider uppercase">
              {isEngine ? "Caja del capó" : "Caja del habitáculo"}
            </p>
            <p className="font-mono text-[8px] text-white/40 uppercase tracking-wider">
              {isEngine ? "Compartimiento del motor" : "Interior · lado pasajero"}
            </p>
          </div>
        </div>
        <div className="space-y-1.5">
          {entries.map((f) => (
            <div key={f.id} className="flex items-center justify-between gap-2 py-1 px-1.5 rounded hover:bg-white/5">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`px-1.5 py-0.5 rounded font-mono text-[9px] font-bold shrink-0 ${
                    f.kind === "relay"
                      ? "bg-cyan-500/10 border border-cyan-500/30 text-cyan-300"
                      : "bg-amber-500/10 border border-amber-500/30 text-amber-300"
                  }`}
                >
                  {f.id}
                </span>
                <span className="font-mono text-[9px] text-white/70 truncate">{f.circuit}</span>
              </div>
              <span className="flex items-center gap-1.5 shrink-0">
                {f.amps && (
                  <span className="px-1 py-0.5 bg-white/5 border border-white/10 text-white/50 font-mono text-[8px] rounded">
                    {f.amps}
                  </span>
                )}
                <span className="font-mono text-[8px] text-white/30">p.{f.page}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="glass-panel rounded-xl border border-white/10 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-white/2 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
            <span className="text-lg">⚡</span>
          </div>
          <div className="text-left">
            <span className="font-mono text-xs text-white font-bold tracking-wider block">
              Fusibles y relés
            </span>
            <span className="font-mono text-[9px] text-white/40">
              Caja interior + capó — {FUSES.length} referencias del manual
            </span>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-white/40" />
        ) : (
          <ChevronDown className="w-4 h-4 text-white/40" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-white/5 pt-3 space-y-3">
          {/* Advertencia de seguridad */}
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-500/5 border border-red-500/20">
            <Info className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <p className="font-mono text-[9px] leading-relaxed text-white/60">
              <span className="text-red-400 font-bold uppercase">Seguridad:</span> antes de tocar la caja de
              fusibles, apaga el motor y desconecta el terminal negativo de la batería. Nunca reemplaces un
              fusible por otro de mayor amperaje ni puentes con alambre: riesgo de incendio. Un fusible que se
              quema repetidamente indica un cortocircuito, no lo "arregles" con uno más grande.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {boxCard("engine")}
            {boxCard("cabin")}
          </div>

          <p className="font-mono text-[8px] leading-relaxed text-white/30">
            El manual de taller no publica una leyenda completa de la caja de fusibles: esta lista recopila las
            referencias documentadas por sistema con su página de trazabilidad. Si un circuito no aparece,
            revisa la tapa de la caja de tu vehículo (habitáculo: panel lado pasajero; capó: junto a la batería).
          </p>
        </div>
      )}
    </div>
  );
}

// ── Búsqueda en la DB V2 ────────────────────────────────────────────────────
function searchDatabaseV2(db: VehicleTechnicalDatabaseV2, query: string): TechnicalComponentV2[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const results: TechnicalComponentV2[] = [];
  for (const comps of Object.values(db.components)) {
    for (const comp of comps) {
      const catalogParts = lookupCatalogParts(comp.id)
        .flatMap((p) => [p.oem, ...p.aftermarket.map((a) => `${a.brand} ${a.partNumber}`)])
        .filter(Boolean)
        .join(" ");
      const haystack = [
        comp.name,
        ...comp.specFields.flatMap((f) => f.values.map((v) => v.value)),
        ...comp.specFields.map((f) => f.label),
        catalogParts,
      ].join(" ").toLowerCase();
      if (haystack.includes(q)) results.push(comp);
    }
  }
  return results;
}

export default function TechnicalDatabaseTab({
  specs,
  onUpdateSpecs,
  triggerToast,
}: TechnicalDatabaseProps) {
  const [pdfPages, setPdfPages] = useState<number>(0);
  const [pdfChars, setPdfChars] = useState<number>(0);
  const [pdfName, setPdfName] = useState<string>(specs.manualPdfNombre || "");
  const [loading, setLoading] = useState(false);
  const [database, setDatabase] = useState<VehicleTechnicalDatabaseV2 | null>(null);
  // true → la base cargada es la PRECARGADA embebida (no un manual subido)
  const [sourceIsPreloaded, setSourceIsPreloaded] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<TechnicalComponentV2[]>([]);
  const [expandedSystems, setExpandedSystems] = useState<Set<SystemCategory>>(
    new Set(["motor", "fluidos", "encendido", "transmision", "carroceria", "electrico"])
  );
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const layoutRef = useRef<DocumentLayout | null>(null);

  // Persist database to localStorage (schema V2). La base PRECARGADA no se
  // persiste: siempre se recarga del módulo embebido y no debe ensuciar el
  // storage (si se sube un manual después, esa entrada no se usaría).
  useEffect(() => {
    if (database && !sourceIsPreloaded) {
      try {
        localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(database));
      } catch (e) {
        console.error("Error saving technical database:", e);
      }
    }
  }, [database, sourceIsPreloaded]);

  // Load persisted database on mount + auto-sync campos vacíos de la ficha.
  // Si NO hay manual cargado, usa la base PRECARGADA embebida (mg350Base.json):
  // cualquier dispositivo carga la misma información del MG 350 sin el PDF.
  useEffect(() => {
    if (database) return;

    // (a) Hay un manual cargado → buscar la base extraída de ESE manual.
    if (specs.manualPdfNombre) {
      try {
        const saved = localStorage.getItem(DB_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as VehicleTechnicalDatabaseV2 & { preloaded?: boolean };
          if (
            parsed.schemaVersion === 2 &&
            !parsed.preloaded &&
            parsed.extractionSource === specs.manualPdfNombre
          ) {
            // Refrescar el catálogo vigente en DBs persistidas de sesiones viejas
            attachPartsCatalog(parsed);
            setDatabase(parsed);
            setSourceIsPreloaded(false);
            const { updates } = applySpecsSyncV2(specs, parsed, false);
            if (Object.keys(updates).length > 0) {
              onUpdateSpecs(updates);
            }
          }
        }
      } catch (e) {
        console.error("Error loading technical database:", e);
      }
      return;
    }

    // (b) Sin manual → base precargada embebida (misma info en cualquier
    // dispositivo). Se clona para no mutar el módulo importado.
    const base = JSON.parse(JSON.stringify(mg350Base)) as VehicleTechnicalDatabaseV2;
    base.extractionSource = PRELOADED_SOURCE;
    attachPartsCatalog(base);
    setDatabase(base);
    setSourceIsPreloaded(true);
    const { updates } = applySpecsSyncV2(specs, base, false);
    if (Object.keys(updates).length > 0) {
      onUpdateSpecs(updates);
    }
  }, [specs.manualPdfNombre, database, specs, onUpdateSpecs]);

  const extractLayoutFromPdf = useCallback(
    async (file: File) => {
      setLoading(true);
      try {
        if (file.size > MAX_PDF_SIZE) {
          const sizeMB = (file.size / (1024 * 1024)).toFixed(0);
          triggerToast(`El archivo pesa ${sizeMB}MB. El máximo es 50MB.`);
          setLoading(false);
          return;
        }

        const arrayBuffer = await file.arrayBuffer();
        let pdf;
        try {
          pdf = await pdfjsLib.getDocument({ data: arrayBuffer, verbosity: 0 }).promise;
        } catch (loadError: any) {
          triggerToast(`Error al abrir el PDF: ${loadError.message || "Formato no reconocido"}`);
          setLoading(false);
          return;
        }

        // Extraer LAYOUT (coordenadas x/y) — la base del pipeline V2.
        // pdf.js entrega cada fragmento con su posición real; esto permite
        // distinguir tablas de párrafos y evitar falsos positivos.
        const layout = await extractDocumentLayout(pdf, pdf.numPages);
        let totalChars = 0;
        for (const page of layout.pages) {
          for (const band of page.bands) totalChars += band.text.length;
        }

        if (totalChars === 0) {
          triggerToast("El PDF no contiene texto extraíble (escaneado).");
        } else {
          triggerToast(`Manual cargado. ${totalChars.toLocaleString()} caracteres.`);
        }

        layoutRef.current = layout;
        setPdfPages(pdf.numPages);
        setPdfChars(totalChars);
        setPdfName(file.name);
        setDatabase(null);
        setSourceIsPreloaded(false);
        onUpdateSpecs({ manualPdfNombre: file.name });
      } catch (error: any) {
        triggerToast(`Error: ${error.message || "No se pudo procesar el PDF"}`);
      } finally {
        setLoading(false);
      }
    },
    [onUpdateSpecs, triggerToast]
  );

  const handleExtract = useCallback(() => {
    if (!layoutRef.current) {
      triggerToast("Primero carga un manual PDF.");
      return;
    }

    const extractor = new TechnicalExtractorV2(layoutRef.current, pdfName);
    const newDatabase = extractor.buildDatabase();
    newDatabase.extractionSource = pdfName;
    // Fase 2: conectar el catálogo de repuestos (fuente externa, separada del manual)
    attachPartsCatalog(newDatabase);
    setDatabase(newDatabase);
    setSourceIsPreloaded(false);

    const c = newDatabase.coverage;

    // Auto-sync a la ficha: solo llena campos vacíos con datos ✓ extraídos
    // (respeta variantes MT/AT y nunca pisa datos manuales).
    const { updates, labels } = applySpecsSyncV2(specs, newDatabase, false);
    if (Object.keys(updates).length > 0) {
      onUpdateSpecs(updates);
    }

    const syncNote = labels.length > 0 ? ` · Ficha: +${labels.join(", ")}` : "";

    triggerToast(
      `Base técnica construida: ${c.extracted} valores extraídos, ${c.decisionReady} decision-ready (${c.notPublished} no publicados en el manual)${syncNote}`
    );
  }, [pdfName, specs, onUpdateSpecs, triggerToast]);

  // Sincronización forzada: sobreescribe los campos de la ficha con el manual
  const handleSyncToSpecs = useCallback(() => {
    if (!database) {
      triggerToast("Primero construye la base técnica.");
      return;
    }
    const { updates, labels } = applySpecsSyncV2(specs, database, true);
    if (Object.keys(updates).length === 0) {
      triggerToast("La ficha ya está sincronizada con el manual.");
      return;
    }
    onUpdateSpecs(updates);
    triggerToast(`Ficha sincronizada: ${labels.join(", ")}`);
  }, [database, specs, onUpdateSpecs, triggerToast]);

  const handleSearch = useCallback(() => {
    if (!database) return;
    setSearchResults(searchDatabaseV2(database, searchQuery));
  }, [database, searchQuery]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      triggerToast("Solo se aceptan archivos PDF.");
      return;
    }
    extractLayoutFromPdf(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDelete = () => {
    layoutRef.current = null;
    setPdfPages(0);
    setPdfChars(0);
    setPdfName("");
    setDatabase(null);
    setSearchResults([]);
    setSourceIsPreloaded(false);
    localStorage.removeItem(DB_STORAGE_KEY);
    onUpdateSpecs({ manualPdfNombre: "" });
    triggerToast("Manual eliminado.");
  };

  const toggleSystem = (system: SystemCategory) => {
    setExpandedSystems((prev) => {
      const next = new Set(prev);
      if (next.has(system)) next.delete(system);
      else next.add(system);
      return next;
    });
  };

  const systems = useMemo(() => {
    if (!database) return [];
    return Object.entries(database.components) as [SystemCategory, TechnicalComponentV2[]][];
  }, [database]);

  return (
    <div className="space-y-6 select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display font-black text-white text-xl uppercase tracking-wider">
            Base Técnica MG 350
          </h2>
          <p className="font-mono text-[10px] text-white/40 mt-1 uppercase tracking-widest">
            Pipeline V2: extracción por layout con estados verificados. 100% local.
          </p>
        </div>
        <div className="flex gap-2">
          {pdfPages > 0 && !database && (
            <button
              onClick={handleExtract}
              className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:brightness-110 text-white font-display text-sm font-bold px-4 py-2.5 flex items-center justify-center gap-2 transition-transform active:scale-[0.98] cursor-pointer shadow-[0_4px_15px_rgba(16,185,129,0.3)] rounded-xl uppercase tracking-tighter"
            >
              <Zap className="w-4 h-4" />
              Construir Base Técnica
            </button>
          )}
          {database && (
            <button
              onClick={handleSyncToSpecs}
              className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:brightness-110 text-white font-display text-sm font-bold px-4 py-2.5 flex items-center justify-center gap-2 transition-transform active:scale-[0.98] cursor-pointer shadow-[0_4px_15px_rgba(6,182,212,0.3)] rounded-xl uppercase tracking-tighter"
            >
              <Link2 className="w-4 h-4" />
              Sincronizar ficha
            </button>
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="bg-gradient-to-r from-[#FF3D00] to-[#FF8A00] hover:brightness-110 text-white font-display text-sm font-bold px-6 py-2.5 flex items-center justify-center gap-2 transition-transform active:scale-[0.98] cursor-pointer shadow-[0_6px_20px_rgba(255,61,0,0.3)] rounded-xl uppercase tracking-tighter"
          >
            <Upload className="w-4 h-4" />
            {pdfName ? "Reemplazar PDF" : "Subir Manual PDF"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      </div>

      {/* PDF Status (manual subido) */}
      {pdfName && (
        <div className="glass-panel p-4 rounded-xl border border-emerald-500/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <FileText className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="font-mono text-xs text-white font-bold">{pdfName}</p>
              <p className="font-mono text-[10px] text-white/40">
                {pdfChars.toLocaleString()} caracteres · {pdfPages} páginas · layout con coordenadas
              </p>
            </div>
          </div>
          <button
            onClick={handleDelete}
            className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Base PRECARGADA (sin manual) — misma info del MG 350 en cualquier dispositivo */}
      {sourceIsPreloaded && database && (
        <div className="glass-panel p-4 rounded-xl border border-cyan-500/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <Database className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <p className="font-mono text-xs text-white font-bold">
                Base técnica precargada MG 350
                <span className="ml-2 px-1.5 py-0.5 bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 font-mono text-[8px] rounded">
                  SIN PDF
                </span>
              </p>
              <p className="font-mono text-[10px] text-white/40">
                Misma información en cualquier dispositivo (extraída del manual real).
                Puedes subir tu propio manual PDF para re-extraer con trazabilidad completa.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="glass-panel p-6 rounded-xl border border-white/10 flex items-center justify-center gap-3">
          <Loader2 className="w-5 h-5 text-[#FF3D00] animate-spin" />
          <span className="font-mono text-xs text-white/60 uppercase">
            Extrayendo layout del PDF (coordenadas x/y)...
          </span>
        </div>
      )}

      {/* Search */}
      {database && (
        <div className="glass-panel p-5 rounded-xl border border-white/10">
          <div className="flex items-center gap-3 mb-3">
            <Search className="w-4 h-4 text-[#FF3D00]" />
            <span className="font-mono text-[10px] text-white/50 uppercase font-bold tracking-widest">
              Buscar pieza o componente
            </span>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder='p. ej. "bujía", "filtro aceite", "disco freno"...'
              className="flex-1 input-field p-3 font-mono text-xs text-white rounded bg-black border border-white/10 outline-none"
            />
            <button
              onClick={handleSearch}
              className="px-4 py-3 bg-white/5 hover:bg-white/10 text-white font-mono text-[10px] font-bold uppercase tracking-widest rounded transition-colors"
            >
              Buscar
            </button>
          </div>
          {searchResults.length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="font-mono text-[9px] text-white/40">
                {searchResults.length} resultado(s):
              </p>
              {searchResults.map((comp) => (
                <ComponentCardV2
                  key={comp.id}
                  component={comp}
                  parts={getPartsFromDb(database, comp.id)}
                  triggerToast={triggerToast}
                />
              ))}
            </div>
          )}
          {searchQuery && searchResults.length === 0 && (
            <p className="mt-3 font-mono text-[10px] text-white/30">
              Sin resultados para "{searchQuery}".
            </p>
          )}
        </div>
      )}

      {/* Base Técnica */}
      {database && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Panel de cobertura */}
          <div className="lg:col-span-1">
            <CoveragePanelV2 database={database} />
          </div>

          {/* Sistemas */}
          <div className="lg:col-span-2 space-y-4">
            {systems.map(([system, components]) => {
              const config = SYSTEM_CONFIG[system];
              const isExpanded = expandedSystems.has(system);

              if (components.length === 0) return null;

              return (
                <div key={system} className="glass-panel rounded-xl border border-white/10 overflow-hidden">
                  <button
                    onClick={() => toggleSystem(system)}
                    className="w-full flex items-center justify-between p-4 hover:bg-white/2 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${config.gradient} flex items-center justify-center`}>
                        <span className="text-lg">{config.icon}</span>
                      </div>
                      <div className="text-left">
                        <span className="font-mono text-xs text-white font-bold tracking-wider block">
                          {config.label}
                        </span>
                        <span className="font-mono text-[9px] text-white/40">
                          {components.length} componente(s)
                        </span>
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-white/40" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-white/40" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-white/5 pt-3 space-y-2">
                      {components.map((comp) => (
                        <ComponentCardV2
                          key={comp.id}
                          component={comp}
                          parts={getPartsFromDb(database, comp.id)}
                          triggerToast={triggerToast}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Referencias estáticas: OBD2 + fusibles (extraídos del manual real) */}
      {database && (
        <div className="space-y-4">
          <OBD2ReferenceSection />
          <FusesSection />
        </div>
      )}

      {/* Empty state */}
      {!database && !loading && (
        <div className="glass-panel p-12 rounded-xl border border-white/10 text-center">
          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
            <Info className="w-8 h-8 text-white/20" />
          </div>
          <h3 className="font-mono text-sm text-white/60 uppercase tracking-wider mb-2">
            Sube un manual para construir la base técnica
          </h3>
          <p className="font-mono text-[10px] text-white/30 max-w-md mx-auto">
            El sistema extraerá especificaciones con estados verificados: ✓ extraído del manual,
            ⚪ no encontrado o ⚠️ no publicado. Cada dato conserva su página y confianza.
          </p>
        </div>
      )}
    </div>
  );
}
