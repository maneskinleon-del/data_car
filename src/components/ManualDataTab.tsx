import React, { useState, useRef, useCallback } from "react";
import {
  Upload,
  Search,
  FileText,
  CheckCircle2,
  Loader2,
  ChevronDown,
  ChevronUp,
  Trash2,
  Zap,
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
    placeholder: "4.5L 5W-40 ACEA A3",
    category: "motor",
    patterns: [
      /aceite\s+del\s+motor\s+y\s+del\s+filtro[:\s]+(\d+[,.]?\d*\s*[Ll])/i,
      /aceite\s+5W\s*[/-]\s*40/i,
      /Utilice\s+el\s+aceite\s+5W/i,
      /ACEA\s+A3/i,
      /(\d+[,.]?\d*)\s*[Ll]\s*(?:de\s+)?aceite/i,
    ],
  },
  {
    key: "aceiteCaja",
    label: "Aceite de Transmisión",
    icon: "⚙️",
    placeholder: "2L (llene) / 2.2L (seco)",
    category: "fluidos",
    patterns: [
      /Manual\s+Transmisión[:\s]+(\d+[,.]?\d*\s*[Ll])/i,
      /transmisión\s+manual[:\s]+(\d+[,.]?\d*\s*[Ll])/i,
      /LLene[:\s]+(\d+[,.]?\d*\s*[Ll])/i,
      /Aceite\s+de\s+la\s+transmisión/i,
    ],
  },
  {
    key: "refrigerante",
    label: "Refrigerante",
    icon: "❄️",
    placeholder: "7.3L OAT 50/50",
    category: "fluidos",
    patterns: [
      /Sistema\s+de\s+refrigeración[:\s-]+(\d+[,.]?\d*\s*[Ll])/i,
      /refrigeración[:\s]+(\d+[,.]?\d*\s*[Ll])/i,
      /OAT\s*50/i,
      /anticongelante[:\s]+(\d+[,.]?\d*\s*[Ll])/i,
      /(7\.3|7,3)\s*[Ll]/i,
    ],
  },
  {
    key: "liquidoFrenos",
    label: "Líquido de Frenos",
    icon: "🛑",
    placeholder: "0.75L DOT4",
    category: "frenos",
    patterns: [
      /fluido\s+del\s+sistema\s+de\s+frenos[:\s]+(\d+[,.]?\d*\s*[Ll])/i,
      /DOT\s*4/i,
      /l[ií]quido\s+de\s+frenos[:\s]+(\d+[,.]?\d*\s*[Ll])/i,
    ],
  },
  {
    key: "tipoCombustible",
    label: "Combustible",
    icon: "⛽",
    placeholder: "Gasolina 93 RON o superior",
    category: "fluidos",
    patterns: [
      /gasolina\s+sin\s+plomo\s+Número\s*(\d+)\s*RON/i,
      /(\d+)\s*RON/i,
      /93\s*RON/i,
      /Nº\s*93/i,
    ],
  },
  {
    key: "capacidadEstanque",
    label: "Capacidad Estanque",
    icon: "🪣",
    placeholder: "55 litros",
    category: "fluidos",
    patterns: [
      /Dep[oó]sito\s+de\s+combustible[:\s]*(\d+)\s*L/i,
      /combustible[:\s]*(\d+)\s*L/i,
      /(55|56)\s*L/i,
    ],
  },
  {
    key: "bujias",
    label: "Bujías",
    icon: "⚡",
    placeholder: "Chispa Plug (verificar modelo específico)",
    category: "encendido",
    patterns: [
      /Chispa\s+Plug/i,
      /Spark\s+Plug/i,
      /buj[ií]a/i,
      /NGK/i,
    ],
  },
  {
    key: "torqueTornillos",
    label: "Torque de Tornillos",
    icon: "🔧",
    placeholder: "Valores específicos por componente",
    category: "frenos",
    patterns: [
      /(\d+)[-–](\d+)\s*Nm/gi,
      /Esfuerzo\s+de\s+torsión/i,
      /torque/i,
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
    placeholder: "Cadena de distribución",
    category: "mantencion",
    patterns: [
      /cadena\s+de\s+distribuci[oó]n/i,
      /timing\s+chain/i,
      /sincronización\s+chain/i,
    ],
  },
  {
    key: "peso",
    label: "Peso",
    icon: "⚖️",
    placeholder: "1500 kg",
    category: "motor",
    patterns: [
      /(\d[\d,.]+)\s*kg/i,
      /peso/i,
      /weight/i,
    ],
  },
];

// Additional informational fields
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
    patterns: [/sensor/i, /MAP/i, /IAT/i, /Lambda/i, /CKP/i],
  },
  {
    key: "discosFrenos",
    label: "Discos de Frenos",
    icon: "🛑",
    category: "frenos",
    patterns: [/disc?o/i, /front\s+disc/i, /rear\s+disc/i],
  },
  {
    key: "pastillasFrenos",
    label: "Pastillas de Frenos",
    icon: "🛞",
    category: "frenos",
    patterns: [/pad/i, /pastilla/i, /brake\s+pad/i],
  },
  {
    key: "presionNeumaticos",
    label: "Presión de Neumáticos",
    icon: "🛞",
    category: "frenos",
    patterns: [/PSI/i, /neumatico/i, /tire/i, /rueda/i],
  },
  {
    key: "codigosOBD2",
    label: "Códigos OBD2",
    icon: "🔍",
    category: "diagnostico",
    patterns: [/P0\d{3}/i, /OBD/i, /diagnostico/i],
  },
];

const CATEGORY_CONFIG: Record<string, { label: string; color: string; gradient: string }> = {
  motor: { label: "Motor", color: "#FF3D00", gradient: "from-orange-500 to-red-500" },
  fluidos: { label: "Fluidos", color: "#2196F3", gradient: "from-blue-500 to-cyan-500" },
  encendido: { label: "Encendido", color: "#FFC107", gradient: "from-yellow-500 to-orange-500" },
  frenos: { label: "Frenos", color: "#F44336", gradient: "from-red-500 to-pink-500" },
  mantencion: { label: "Mantenimiento", color: "#4CAF50", gradient: "from-green-500 to-emerald-500" },
  diagnostico: { label: "Diagnóstico", color: "#9C27B0", gradient: "from-purple-500 to-violet-500" },
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Ficha Técnica Card Component
function FichaTecnicaCard({ specs, autoExtracted }: { specs: VehicleSpecs; autoExtracted: Set<string> }) {
  const ficha = [
    { label: "Aceite Motor", value: specs.aceiteMotor, icon: "🛢️", color: "#FF3D00" },
    { label: "Aceite Caja", value: specs.aceiteCaja, icon: "⚙️", color: "#2196F3" },
    { label: "Refrigerante", value: specs.refrigerante, icon: "❄️", color: "#00BCD4" },
    { label: "Frenos", value: specs.liquidoFrenos, icon: "🛑", color: "#F44336" },
    { label: "Combustible", value: specs.tipoCombustible, icon: "⛽", color: "#FF9800" },
    { label: "Estanque", value: specs.capacidadEstanque, icon: "🪣", color: "#4CAF50" },
  ];

  const detectedCount = ficha.filter(f => f.value).length;

  return (
    <div className="glass-panel rounded-xl border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/10 bg-gradient-to-r from-[#FF3D00]/10 to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#FF3D00]/20 flex items-center justify-center">
              <span className="text-xl">📋</span>
            </div>
            <div>
              <h3 className="font-display font-bold text-white text-sm">FICHA TÉCNICA MG 350</h3>
              <p className="font-mono text-[9px] text-white/40 uppercase tracking-wider">
                Datos extraídos del manual
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-emerald-400 font-bold">
              {detectedCount}/{ficha.length}
            </span>
            <div className="w-16 h-2 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
                style={{ width: `${(detectedCount / ficha.length) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Data Grid */}
      <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
        {ficha.map((item) => (
          <div 
            key={item.label}
            className={`relative p-3 rounded-lg border transition-all ${
              item.value 
                ? 'bg-white/5 border-white/10 hover:border-white/20' 
                : 'bg-white/2 border-white/5'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{item.icon}</span>
              <span className="font-mono text-[8px] text-white/40 uppercase tracking-wider">
                {item.label}
              </span>
            </div>
            {item.value ? (
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-white font-bold truncate">
                  {item.value}
                </span>
                {autoExtracted.has(item.label.toLowerCase().replace(/\s/g, '')) && (
                  <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 font-mono text-[7px] rounded">
                    AUTO
                  </span>
                )}
              </div>
            ) : (
              <span className="font-mono text-[10px] text-white/20">—</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

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

  const handleAutoExtract = () => {
    if (!pdfText) {
      triggerToast("Primero carga un manual PDF.");
      return;
    }

    const extracted = new Set<string>();
    const updates: Partial<VehicleSpecs> = {};
    const newInfoFields: Record<string, string> = {};

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

  const detectedCount = MANUAL_FIELDS.filter((f) => specs[f.key]).length;
  const totalCount = MANUAL_FIELDS.length;

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

      {/* Ficha Técnica Card - Always visible when PDF is loaded */}
      {pdfText && <FichaTecnicaCard specs={specs} autoExtracted={autoExtracted} />}

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
        {(Object.keys(CATEGORY_CONFIG) as Array<keyof typeof CATEGORY_CONFIG>).map((catKey) => {
          const cat = CATEGORY_CONFIG[catKey];
          const fields = fieldsByCategory[catKey] || [];
          const infos = infoByCategory[catKey] || [];
          const isExpanded = expandedSections.has(catKey);
          const detectedInCategory = fields.filter(f => specs[f.key]).length;

          if (fields.length === 0 && infos.length === 0) return null;

          return (
            <div key={catKey} className="glass-panel rounded-xl border border-white/10 overflow-hidden">
              {/* Category Header */}
              <button
                onClick={() => toggleSection(catKey)}
                className="w-full flex items-center justify-between p-4 hover:bg-white/2 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div 
                    className={`w-10 h-10 rounded-lg bg-gradient-to-br ${cat.gradient} flex items-center justify-center`}
                  >
                    <span className="text-white font-bold text-sm">
                      {detectedInCategory}/{fields.length}
                    </span>
                  </div>
                  <div className="text-left">
                    <span className="font-mono text-xs text-white font-bold tracking-wider block">
                      {cat.label}
                    </span>
                    <span className="font-mono text-[9px] text-white/40">
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
                <div className="px-4 pb-4 border-t border-white/5 pt-3 space-y-2">
                  {fields.map((field) => {
                    const value = specs[field.key] as string;
                    const wasAutoExtracted = autoExtracted.has(field.key);

                    return (
                      <div 
                        key={field.key} 
                        className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                          value 
                            ? 'bg-white/5 border-white/10' 
                            : 'bg-white/2 border-white/5'
                        }`}
                      >
                        <span className="text-lg">{field.icon}</span>
                        <div className="flex-1 min-w-0">
                          <span className="font-mono text-[9px] text-white/50 uppercase font-bold tracking-widest block">
                            {field.label}
                          </span>
                          <input
                            type="text"
                            value={value}
                            onChange={(e) => onUpdateSpecs({ [field.key]: e.target.value })}
                            placeholder={field.placeholder}
                            className="w-full bg-transparent font-mono text-xs text-white outline-none placeholder:text-white/20"
                          />
                        </div>
                        {wasAutoExtracted && (
                          <span className="flex items-center gap-1 px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-[8px] font-bold uppercase rounded shrink-0">
                            <CheckCircle2 className="w-3 h-3" />
                            AUTO
                          </span>
                        )}
                      </div>
                    );
                  })}

                  {infos.map((field) => {
                    const value = infoFields[field.key];
                    const wasAutoExtracted = autoExtracted.has(field.key);

                    return (
                      <div 
                        key={field.key} 
                        className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                          value 
                            ? 'bg-white/5 border-white/10' 
                            : 'bg-white/2 border-white/5'
                        }`}
                      >
                        <span className="text-lg">{field.icon}</span>
                        <div className="flex-1 min-w-0">
                          <span className="font-mono text-[9px] text-white/50 uppercase font-bold tracking-widest block">
                            {field.label}
                          </span>
                          <span className="font-mono text-xs text-white/70">
                            {value || <span className="text-white/30">No detectado</span>}
                          </span>
                        </div>
                        {wasAutoExtracted && (
                          <span className="flex items-center gap-1 px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-[8px] font-bold uppercase rounded shrink-0">
                            <CheckCircle2 className="w-3 h-3" />
                            AUTO
                          </span>
                        )}
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
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#FF3D00] to-[#FF8A00] flex items-center justify-center">
            <span className="text-white font-bold text-sm">
              {detectedCount}/{totalCount}
            </span>
          </div>
          <div>
            <span className="font-mono text-xs text-white font-bold tracking-wider block">
              Progreso de Extracción
            </span>
            <span className="font-mono text-[9px] text-white/40">
              {detectedCount === totalCount ? "¡Completado!" : `${totalCount - detectedCount} campo(s) pendiente(s)`}
            </span>
          </div>
        </div>
        <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-[#FF3D00] to-[#FF8A00] rounded-full transition-all duration-500"
            style={{ width: `${(detectedCount / totalCount) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
