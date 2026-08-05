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
} from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import { VehicleSpecs } from "../types";
import {
  VehicleTechnicalDatabase,
  Component,
  SystemCategory,
} from "../types/technical";
import {
  TechnicalExtractor,
  normalizeText,
  formatDataPoint,
  getCoverageColor,
  countFilledFields,
  SYSTEM_RULE_COUNTS,
} from "../lib/technicalExtractor";
import { applySpecsSync } from "../lib/specsSync";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

const MAX_PDF_SIZE = 50 * 1024 * 1024;

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

// Card de componente individual
function ComponentCard({ component }: { component: Component; key?: string }) {
  const [expanded, setExpanded] = useState(false);
  
  const fields = [
    { label: "Especificación", value: formatDataPoint(component.specification) },
    { label: "Capacidad", value: formatDataPoint(component.capacity) },
    { label: "Viscosidad", value: formatDataPoint(component.viscosity) },
    { label: "Grado", value: formatDataPoint(component.grade) },
    { label: "Gap", value: formatDataPoint(component.gap) },
    { label: "Torque", value: formatDataPoint(component.torque) },
    { label: "Presión", value: formatDataPoint(component.pressure) },
    { label: "Espesor", value: formatDataPoint(component.thickness) },
    { label: "N° Parte", value: formatDataPoint(component.partNumber) },
    { label: "Cantidad", value: component.quantity ? String(component.quantity.value) : "—" },
  ].filter(f => f.value !== "—");
  
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
        <div className="mt-3 space-y-2">
          {fields.map((field) => (
            <div key={field.label} className="flex items-center gap-2 text-[10px]">
              <span className="font-mono text-white/40 uppercase w-20">{field.label}:</span>
              <span className="font-mono text-white/80">{field.value}</span>
            </div>
          ))}
          {component.procedure?.tools && (
            <div className="mt-2 pt-2 border-t border-white/5">
              <span className="font-mono text-[8px] text-white/30 uppercase">Herramientas:</span>
              <p className="font-mono text-[10px] text-white/60 mt-1">
                {component.procedure.tools.join(", ")}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Panel de cobertura técnica — % por sistema = componentes con dato real / reglas del sistema
function CoveragePanel({ database }: { database: VehicleTechnicalDatabase }) {
  const systems = Object.entries(database.components) as [SystemCategory, Component[]][];
  const totalComponents = systems.reduce((sum, [, comps]) => sum + comps.length, 0);
  
  return (
    <div className="glass-panel p-5 rounded-xl border border-white/10">
      <h3 className="font-mono text-[10px] text-white/50 uppercase font-bold tracking-widest mb-4">
        Cobertura Técnica
      </h3>
      
      <div className="space-y-3">
        {systems.map(([system, components]) => {
          const config = SYSTEM_CONFIG[system];
          const totalRules = SYSTEM_RULE_COUNTS[system] || 0;
          const filled = components.filter((c) => countFilledFields(c) > 0).length;
          const percent = totalRules > 0 ? Math.min(100, Math.round((filled / totalRules) * 100)) : 0;
          
          return (
            <div key={system} className="flex items-center gap-3">
              <span className="text-sm">{config.icon}</span>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-[9px] text-white/60">{config.label}</span>
                  <span className="font-mono text-[8px] text-white/40">{filled}/{totalRules}</span>
                </div>
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className={`h-full bg-gradient-to-r ${getCoverageColor(percent)} rounded-full transition-all`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="mt-4 pt-4 border-t border-white/10">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs text-white/60">Componentes con datos</span>
          <span className="font-mono text-sm text-white font-bold">{totalComponents}</span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="font-mono text-xs text-white/60">Cobertura (datos verificados)</span>
          <span className="font-mono text-sm text-emerald-400 font-bold">{database.coveragePercent}%</span>
        </div>
        <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mt-2">
          <div 
            className={`h-full bg-gradient-to-r ${getCoverageColor(database.coveragePercent)} rounded-full transition-all`}
            style={{ width: `${database.coveragePercent}%` }}
          />
        </div>
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

export default function TechnicalDatabaseTab({
  specs,
  onUpdateSpecs,
  triggerToast,
}: TechnicalDatabaseProps) {
  const [pdfText, setPdfText] = useState<string>("");
  const [pdfPages, setPdfPages] = useState<string[]>([]);
  const [pdfName, setPdfName] = useState<string>(specs.manualPdfNombre || "");
  const [loading, setLoading] = useState(false);
  const [database, setDatabase] = useState<VehicleTechnicalDatabase | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Component[]>([]);
  const [expandedSystems, setExpandedSystems] = useState<Set<SystemCategory>>(
    new Set(["motor", "fluidos", "encendido"])
  );
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const extractorRef = useRef<TechnicalExtractor | null>(null);
  
  // Persist database to localStorage
  useEffect(() => {
    if (database) {
      try {
        localStorage.setItem("mg350_technical_db", JSON.stringify(database));
      } catch (e) {
        console.error("Error saving technical database:", e);
      }
    }
  }, [database]);
  
  // Load persisted database on mount + auto-sync campos vacíos de la ficha.
  // Cubre bases construidas antes de que existiera la sincronización.
  useEffect(() => {
    if (specs.manualPdfNombre && !database) {
      try {
        const saved = localStorage.getItem("mg350_technical_db");
        if (saved) {
          const parsed = JSON.parse(saved) as VehicleTechnicalDatabase;
          if (parsed.extractionSource === specs.manualPdfNombre) {
            setDatabase(parsed);
            const { updates } = applySpecsSync(specs, parsed, false);
            if (Object.keys(updates).length > 0) {
              onUpdateSpecs(updates);
            }
          }
        }
      } catch (e) {
        console.error("Error loading technical database:", e);
      }
    }
  }, [specs.manualPdfNombre, database, specs, onUpdateSpecs]);
  
  const extractTextFromPdf = useCallback(
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
        
        let fullText = "";
        const pages: string[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          try {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item: any) => item.str).join(" ");
            pages.push(pageText);
            fullText += pageText + "\n";
          } catch (pageError) {
            console.warn(`Error en página ${i}:`, pageError);
          }
        }
        
        if (fullText.trim().length === 0) {
          triggerToast("El PDF no contiene texto extraíble (escaneado).");
        } else {
          fullText = normalizeText(fullText);
          triggerToast(`Manual cargado. ${fullText.length.toLocaleString()} caracteres.`);
        }
        
        setPdfText(fullText);
        setPdfPages(pages);
        setPdfName(file.name);
        setDatabase(null);
        extractorRef.current = null; // la base cacheada pertenece al PDF anterior
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
    if (!pdfText && pdfPages.length === 0) {
      triggerToast("Primero carga un manual PDF.");
      return;
    }
    
    const extractor = new TechnicalExtractor(pdfPages.length > 0 ? pdfPages : pdfText);
    extractorRef.current = extractor;
    const newDatabase = extractor.buildDatabase();
    newDatabase.extractionSource = pdfName;
    setDatabase(newDatabase);
    
    const totalComponents = Object.values(newDatabase.components)
      .flat()
      .length;
    
    // Auto-sync a la ficha: llena campos vacíos con los datos verificados
    // (no pisa datos que el usuario haya ingresado manualmente).
    const { updates, labels } = applySpecsSync(specs, newDatabase, false);
    if (Object.keys(updates).length > 0) {
      onUpdateSpecs(updates);
    }
    
    const syncNote =
      labels.length > 0 ? ` · Ficha: +${labels.join(", ")}` : "";
    
    triggerToast(
      `Base técnica construida: ${totalComponents} componentes con datos verificados (${newDatabase.coveragePercent}% cobertura)${syncNote}`
    );
  }, [pdfText, pdfPages, pdfName, specs, onUpdateSpecs, triggerToast]);

  // Sincronización forzada: sobreescribe los campos de la ficha con el manual
  const handleSyncToSpecs = useCallback(() => {
    if (!database) {
      triggerToast("Primero construye la base técnica.");
      return;
    }
    const { updates, labels } = applySpecsSync(specs, database, true);
    if (Object.keys(updates).length === 0) {
      triggerToast("La ficha ya está sincronizada con el manual.");
      return;
    }
    onUpdateSpecs(updates);
    triggerToast(`Ficha sincronizada: ${labels.join(", ")}`);
  }, [database, specs, onUpdateSpecs, triggerToast]);
  
  const handleSearch = useCallback(() => {
    if (!searchQuery.trim()) return;
    
    // Use cached extractor if available, otherwise create new one
    const extractor = extractorRef.current || new TechnicalExtractor(pdfPages.length > 0 ? pdfPages : pdfText);
    const results = extractor.searchComponent(searchQuery);
    setSearchResults(results);
  }, [searchQuery, pdfText, pdfPages]);
  
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      triggerToast("Solo se aceptan archivos PDF.");
      return;
    }
    extractTextFromPdf(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };
  
  const handleDelete = () => {
    setPdfText("");
    setPdfPages([]);
    setPdfName("");
    setDatabase(null);
    setSearchResults([]);
    extractorRef.current = null;
    localStorage.removeItem("mg350_technical_db");
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
    return Object.entries(database.components) as [SystemCategory, Component[]][];
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
            Componentes, especificaciones y datos accionables. 100% local.
          </p>
        </div>
        <div className="flex gap-2">
          {pdfText && !database && (
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
      
      {/* PDF Status */}
      {pdfName && (
        <div className="glass-panel p-4 rounded-xl border border-emerald-500/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <FileText className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="font-mono text-xs text-white font-bold">{pdfName}</p>
              <p className="font-mono text-[10px] text-white/40">
                {pdfText.length.toLocaleString()} caracteres extraídos
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
      
      {/* Loading */}
      {loading && (
        <div className="glass-panel p-6 rounded-xl border border-white/10 flex items-center justify-center gap-3">
          <Loader2 className="w-5 h-5 text-[#FF3D00] animate-spin" />
          <span className="font-mono text-xs text-white/60 uppercase">
            Extrayendo texto del PDF...
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
                <ComponentCard key={comp.id} component={comp} />
              ))}
            </div>
          )}
        </div>
      )}
      
      {/* Base Técnica */}
      {database && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Panel de cobertura */}
          <div className="lg:col-span-1">
            <CoveragePanel database={database} />
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
                        <ComponentCard key={comp.id} component={comp} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {/* OBD2 Reference — static, not extracted from manual */}
      {database && (
        <OBD2ReferenceSection />
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
            El sistema extraerá especificaciones, identificación de piezas y datos 
            accionables del manual de tu vehículo.
          </p>
        </div>
      )}
    </div>
  );
}
