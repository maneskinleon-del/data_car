import React, { useState, useRef, useCallback } from "react";
import {
  Upload,
  Search,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Trash2,
  Zap,
  Gauge,
  Droplets,
  Zap as ZapIcon,
  Disc,
  Wrench,
  AlertTriangle,
} from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import { VehicleSpecs } from "../types";

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 
  `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

const MAX_PDF_SIZE = 50 * 1024 * 1024;

interface ManualDataTabProps {
  specs: VehicleSpecs;
  onUpdateSpecs: (updated: Partial<VehicleSpecs>) => void;
  triggerToast: (msg: string) => void;
}

interface ManualField {
  key: keyof VehicleSpecs;
  label: string;
  icon: string;
  placeholder: string;
  patterns: RegExp[];
  category: "motor" | "fluidos" | "encendido" | "frenos" | "mantencion" | "diagnostico";
}

// MG 350 specific fields - optimized for actual manual content
const MANUAL_FIELDS: ManualField[] = [
  {
    key: "aceiteMotor",
    label: "Aceite de Motor",
    icon: "🛢️",
    placeholder: "4.0L SAE 5W-30 / 10W-40",
    category: "motor",
    patterns: [
      /SAE\s+5W-30/i,
      /SAE\s+10W-40/i,
      /aceite\s+de\s+motor[:\s]+([^\n.]{3,60})/i,
      /motor\s+oil[:\s]+([^\n.]{3,60})/i,
      /(\d+\.?\d*)\s*L\s+SAE/i,
    ],
  },
  {
    key: "aceiteCaja",
    label: "Aceite de Transmisión",
    icon: "⚙️",
    placeholder: "2.1L GL-4 75W-90",
    category: "fluidos",
    patterns: [
      /GL-4\s+75W-90/i,
      /transmisi[oó]n\s+manual[:\s]+([^\n.]{3,60})/i,
      /GL-[345]\s+\d+[WR]-\d+/i,
    ],
  },
  {
    key: "refrigerante",
    label: "Refrigerante",
    icon: "❄️",
    placeholder: "6.5L orgánico OAT",
    category: "fluidos",
    patterns: [
      /refrigerante[:\s]+([^\n.]{3,60})/i,
      /OAT/i,
      /coolant[:\s]+([^\n.]{3,60})/i,
    ],
  },
  {
    key: "liquidoFrenos",
    label: "Líquido de Frenos",
    icon: "🛑",
    placeholder: "DOT 4",
    category: "frenos",
    patterns: [
      /DOT\s*4/i,
      /l[ií]quido\s+de\s+frenos/i,
      /brake\s+fluid/i,
    ],
  },
  {
    key: "tipoCombustible",
    label: "Combustible",
    icon: "⛽",
    placeholder: "55L / 93 octanos",
    category: "fluidos",
    patterns: [
      /(\d+)\s+octanos?/i,
      /RON\s*(\d+)/i,
      /gasolina/i,
      /fuel/i,
    ],
  },
  {
    key: "capacidadEstanque",
    label: "Capacidad Estanque",
    icon: "🪣",
    placeholder: "55 litros",
    category: "fluidos",
    patterns: [
      /(\d+)\s*L\s*(?:fuel|gasolina|bencina)/i,
      /fuel\s+tank[:\s]+(\d+)/i,
      /tank[:\s]+(\d+)/i,
      /Dep[oó]sito\s+de\s+combustible[:\s]+(\d+)/i,
      /(55|56)\s*L/i,
    ],
  },
  {
    key: "bujias",
    label: "Bujías",
    icon: "⚡",
    placeholder: "Iridio/Platino, 0.85mm",
    category: "encendido",
    patterns: [
      /chispa\s+plug/i,
      /spark\s+plug/i,
      /buj[ií]a/i,
      /NGK/i,
      /iridio/i,
      /platino/i,
    ],
  },
  {
    key: "torqueTornillos",
    label: "Torque de Tornillos",
    icon: "🔧",
    placeholder: "Rueda: 110-120 Nm",
    category: "frenos",
    patterns: [
      /(\d+)[-–](\d+)\s*Nm/i,
      /torque/i,
      /esfuerzo\s+de\s+torsion/i,
    ],
  },
  {
    key: "fusibles",
    label: "Fusibles",
    icon: "🔌",
    placeholder: "Caja de fusibles del motor",
    category: "diagnostico",
    patterns: [
      /fusible/i,
      /fuse/i,
    ],
  },
  {
    key: "correaDistribucion",
    label: "Distribución",
    icon: "🔄",
    placeholder: "Cadena metálica",
    category: "mantencion",
    patterns: [
      /cadena\s+de\s+distribuci[oó]n/i,
      /timing\s+chain/i,
      /sincronizaci[oó]n\s+chain/i,
    ],
  },
  {
    key: "peso",
    label: "Peso",
    icon: "⚖️",
    placeholder: "1,185 kg",
    category: "motor",
    patterns: [
      /(\d[\d,.]+)\s*kg/i,
      /peso/i,
      /weight/i,
    ],
  },
];

// Additional informational fields (not in VehicleSpecs, displayed as reference)
interface InfoField {
  key: string;
  label: string;
  icon: string;
  patterns: RegExp[];
  category: "motor" | "fluidos" | "encendido" | "frenos" | "mantencion" | "diagnostico";
}

const INFO_FIELDS: InfoField[] = [
  {
    key: "sensores",
    label: "Sensores",
    icon: "📡",
    category: "encendido",
    patterns: [
      /sensor/i,
      /MAP/i,
      /IAT/i,
      /Lambda/i,
      /CKP/i,
      /oxigeno/i,
      /oxygen/i,
    ],
  },
  {
    key: "discosFrenos",
    label: "Discos de Frenos",
    icon: "🛑",
    category: "frenos",
    patterns: [
      /disc?o/i,
      /front\s+disc/i,
      /rear\s+disc/i,
      /delantero/i,
      /trasero/i,
    ],
  },
  {
    key: "pastillasFrenos",
    label: "Pastillas de Frenos",
    icon: "🛞",
    category: "frenos",
    patterns: [
      /pad/i,
      /pastilla/i,
      /brake\s+pad/i,
    ],
  },
  {
    key: "presionNeumaticos",
    label: "Presión de Neumáticos",
    icon: "🛞",
    category: "frenos",
    patterns: [
      /PSI/i,
      /neumatico/i,
      /tire/i,
      /rueda/i,
    ],
  },
  {
    key: "codigosOBD2",
    label: "Códigos OBD2",
    icon: "🔍",
    category: "diagnostico",
    patterns: [
      /P0\d{3}/i,
      /OBD/i,
      /diagnostico/i,
    ],
  },
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const CATEGORY_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  motor: { label: "Motor", icon: <Gauge className="w-4 h-4" />, color: "#FF3D00" },
  fluidos: { label: "Fluidos y Capacidades", icon: <Droplets className="w-4 h-4" />, color: "#2196F3" },
  encendido: { label: "Encendido y Sensores", icon: <ZapIcon className="w-4 h-4" />, color: "#FFC107" },
  frenos: { label: "Frenos y Chasis", icon: <Disc className="w-4 h-4" />, color: "#F44336" },
  mantencion: { label: "Mantenimiento", icon: <Wrench className="w-4 h-4" />, color: "#4CAF50" },
  diagnostico: { label: "Diagnósticos OBD2", icon: <AlertTriangle className="w-4 h-4" />, color: "#9C27B0" },
};

export default function ManualDataTab({
  specs,
  onUpdateSpecs,
  triggerToast,
}: ManualDataTabProps) {
  const [pdfText, setPdfText] = useState<string>("");
  const [pdfName, setPdfName] = useState<string>(specs.manualPdfNombre || "");
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["motor"])
  );
  const [autoExtracted, setAutoExtracted] = useState<Set<string>>(new Set());
  const [infoFields, setInfoFields] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Extract text from PDF
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
          if (loadError.message?.includes("Invalid PDF")) {
            triggerToast("El archivo no es un PDF válido.");
          } else if (loadError.message?.includes("password")) {
            triggerToast("El PDF está protegido con contraseña.");
          } else {
            triggerToast(`Error al abrir el PDF: ${loadError.message || "Formato no reconocido"}`);
          }
          setLoading(false);
          return;
        }

        let fullText = "";
        let totalPages = pdf.numPages;
        
        for (let i = 1; i <= totalPages; i++) {
          try {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item: any) => item.str).join(" ");
            fullText += pageText + "\n";
          } catch (pageError) {
            console.warn(`Error en página ${i}:`, pageError);
          }
        }

        if (fullText.trim().length === 0) {
          triggerToast("El PDF no contiene texto extraíble. Ingresa los datos manualmente.");
        } else {
          triggerToast(`Manual cargado. ${fullText.length.toLocaleString()} caracteres de ${totalPages} páginas.`);
        }

        setPdfText(fullText);
        setPdfName(file.name);
        onUpdateSpecs({ manualPdfNombre: file.name });
      } catch (error: any) {
        triggerToast(`Error: ${error.message || "No se pudo procesar el PDF"}`);
      } finally {
        setLoading(false);
      }
    },
    [onUpdateSpecs, triggerToast]
  );

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

  // Auto-detect values from PDF text
  const handleAutoExtract = () => {
    if (!pdfText) {
      triggerToast("Primero carga un manual PDF.");
      return;
    }

    const extracted = new Set<string>();
    const updates: Partial<VehicleSpecs> = {};
    const newInfoFields: Record<string, string> = {};

    // Extract VehicleSpecs fields
    for (const field of MANUAL_FIELDS) {
      for (const pattern of field.patterns) {
        const match = pdfText.match(pattern);
        if (match) {
          const value = match[1] || match[0];
          if (!specs[field.key] || specs[field.key] === "") {
            (updates as any)[field.key] = value.trim();
            extracted.add(field.key);
          }
          break;
        }
      }
    }

    // Extract informational fields
    for (const field of INFO_FIELDS) {
      for (const pattern of field.patterns) {
        const match = pdfText.match(pattern);
        if (match) {
          const value = match[1] || match[0];
          newInfoFields[field.key] = value.trim();
          extracted.add(field.key);
          break;
        }
      }
    }

    if (Object.keys(updates).length > 0 || Object.keys(newInfoFields).length > 0) {
      if (Object.keys(updates).length > 0) {
        onUpdateSpecs(updates);
      }
      setInfoFields((prev) => ({ ...prev, ...newInfoFields }));
      setAutoExtracted(extracted);
      const total = Object.keys(updates).length + Object.keys(newInfoFields).length;
      triggerToast(`${total} campo(s) detectado(s) automáticamente.`);
    } else {
      triggerToast("No se detectaron nuevos campos. Puedes ingresarlos manualmente.");
    }
  };

  const handleSearch = () => {
    if (!searchQuery.trim() || !pdfText) return;

    const query = searchQuery.toLowerCase();
    const lines = pdfText.split("\n");
    const results: string[] = [];

    for (const line of lines) {
      if (line.toLowerCase().includes(query)) {
        results.push(line.trim());
      }
    }

    setSearchResults(results.slice(0, 20));
  };

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleDeleteManual = () => {
    setPdfText("");
    setPdfName("");
    onUpdateSpecs({ manualPdfNombre: "" });
    setAutoExtracted(new Set());
    setInfoFields({});
    triggerToast("Manual eliminado.");
  };

  // Group fields by category
  const fieldsByCategory = MANUAL_FIELDS.reduce((acc, field) => {
    if (!acc[field.category]) acc[field.category] = [];
    acc[field.category].push(field);
    return acc;
  }, {} as Record<string, ManualField[]>);

  const infoByCategory = INFO_FIELDS.reduce((acc, field) => {
    if (!acc[field.category]) acc[field.category] = [];
    acc[field.category].push(field);
    return acc;
  }, {} as Record<string, InfoField[]>);

  return (
    <div className="space-y-6 select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display font-black text-white text-xl uppercase tracking-wider">
            Datos del Manual MG 350
          </h2>
          <p className="font-mono text-[10px] text-white/40 mt-1 uppercase tracking-widest">
            Especificaciones reales del manual de taller. 100% local.
          </p>
        </div>
        <div className="flex gap-2">
          {pdfText && (
            <button
              onClick={handleAutoExtract}
              className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:brightness-110 text-white font-display text-sm font-bold px-4 py-2.5 flex items-center justify-center gap-2 transition-transform active:scale-[0.98] cursor-pointer shadow-[0_4px_15px_rgba(16,185,129,0.3)] rounded-xl uppercase tracking-tighter"
            >
              <Zap className="w-4 h-4" />
              Auto-detectar
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
            onClick={handleDeleteManual}
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
      {pdfText && (
        <div className="glass-panel p-5 rounded-xl border border-white/10">
          <div className="flex items-center gap-3 mb-3">
            <Search className="w-4 h-4 text-[#FF3D00]" />
            <span className="font-mono text-[10px] text-white/50 uppercase font-bold tracking-widest">
              Buscar en el manual
            </span>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder='p. ej. "aceite", "bujía", "fusible"...'
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
            <div className="mt-3 space-y-1 max-h-48 overflow-y-auto">
              <p className="font-mono text-[9px] text-white/40 mb-2">
                {searchResults.length} resultado(s):
              </p>
              {searchResults.map((result, i) => (
                <div
                  key={i}
                  className="font-mono text-[10px] text-white/70 bg-black/50 p-2 rounded border border-white/5"
                >
                  {result}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Categories */}
      <div className="space-y-4">
        {(Object.keys(CATEGORY_LABELS) as Array<keyof typeof CATEGORY_LABELS>).map((catKey) => {
          const cat = CATEGORY_LABELS[catKey];
          const fields = fieldsByCategory[catKey] || [];
          const infos = infoByCategory[catKey] || [];
          const isExpanded = expandedSections.has(catKey);

          if (fields.length === 0 && infos.length === 0) return null;

          return (
            <div key={catKey} className="glass-panel rounded-xl border border-white/10 overflow-hidden">
              {/* Category Header */}
              <button
                onClick={() => toggleSection(catKey)}
                className="w-full flex items-center justify-between p-4 hover:bg-white/2 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded flex items-center justify-center" style={{ backgroundColor: `${cat.color}20` }}>
                    <span style={{ color: cat.color }}>{cat.icon}</span>
                  </div>
                  <div className="text-left">
                    <span className="font-mono text-[10px] text-white/50 uppercase font-bold tracking-widest block">
                      {cat.label}
                    </span>
                    <span className="font-mono text-[9px] text-white/30">
                      {fields.length + infos.length} campo(s)
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-white/40" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-white/40" />
                  )}
                </div>
              </button>

              {/* Fields */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-white/5 pt-3 space-y-3">
                  {/* Editable fields */}
                  {fields.map((field) => {
                    const value = specs[field.key] as string;
                    const wasAutoExtracted = autoExtracted.has(field.key);

                    return (
                      <div key={field.key} className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{field.icon}</span>
                          <span className="font-mono text-[9px] text-white/50 uppercase font-bold tracking-widest">
                            {field.label}
                          </span>
                          {wasAutoExtracted && (
                            <span className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-[7px] font-bold uppercase rounded">
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              AUTO
                            </span>
                          )}
                        </div>
                        <input
                          type="text"
                          value={value}
                          onChange={(e) => onUpdateSpecs({ [field.key]: e.target.value })}
                          placeholder={field.placeholder}
                          className="w-full input-field p-2.5 font-mono text-xs text-white rounded bg-black border border-white/10 outline-none"
                        />
                      </div>
                    );
                  })}

                  {/* Info fields (read-only from PDF) */}
                  {infos.map((field) => {
                    const value = infoFields[field.key];
                    const wasAutoExtracted = autoExtracted.has(field.key);

                    return (
                      <div key={field.key} className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{field.icon}</span>
                          <span className="font-mono text-[9px] text-white/50 uppercase font-bold tracking-widest">
                            {field.label}
                          </span>
                          {wasAutoExtracted && (
                            <span className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-[7px] font-bold uppercase rounded">
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              AUTO
                            </span>
                          )}
                        </div>
                        <div className="w-full p-2.5 font-mono text-xs text-white/70 rounded bg-white/5 border border-white/5">
                          {value || <span className="text-white/30">No detectado - ingresa manualmente</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="glass-panel p-5 rounded-xl border border-white/10">
        <div className="flex items-center gap-3 mb-3">
          <AlertCircle className="w-4 h-4 text-[#FF8A00]" />
          <span className="font-mono text-[10px] text-white/50 uppercase font-bold tracking-widest">
            Resumen MG 350
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="text-center p-3 bg-white/2 rounded">
            <div className="font-display text-2xl font-black text-[#FF3D00]">
              {MANUAL_FIELDS.filter((f) => specs[f.key]).length + Object.keys(infoFields).length}
            </div>
            <div className="font-mono text-[9px] text-white/40 uppercase">
              Detectados
            </div>
          </div>
          <div className="text-center p-3 bg-white/2 rounded">
            <div className="font-display text-2xl font-black text-white/40">
              {MANUAL_FIELDS.filter((f) => !specs[f.key]).length + INFO_FIELDS.length - Object.keys(infoFields).length}
            </div>
            <div className="font-mono text-[9px] text-white/40 uppercase">
              Pendientes
            </div>
          </div>
          <div className="text-center p-3 bg-white/2 rounded">
            <div className="font-display text-2xl font-black text-emerald-400">
              {autoExtracted.size}
            </div>
            <div className="font-mono text-[9px] text-white/40 uppercase">
              Auto-detectados
            </div>
          </div>
          <div className="text-center p-3 bg-white/2 rounded">
            <div className="font-display text-2xl font-black text-[#FF8A00]">
              {MANUAL_FIELDS.length + INFO_FIELDS.length}
            </div>
            <div className="font-mono text-[9px] text-white/40 uppercase">
              Total campos
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
