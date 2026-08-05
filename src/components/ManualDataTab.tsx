import React, { useState, useRef, useCallback } from "react";
import {
  BookOpen,
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
} from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import { VehicleSpecs } from "../types";

// Configure PDF.js worker - use unpkg (cdnjs doesn't have v6.x)
pdfjsLib.GlobalWorkerOptions.workerSrc = 
  `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

const MAX_PDF_SIZE = 50 * 1024 * 1024; // 50MB limit

interface ManualDataTabProps {
  specs: VehicleSpecs;
  onUpdateSpecs: (updated: Partial<VehicleSpecs>) => void;
  triggerToast: (msg: string) => void;
}

// Fields that can be extracted from the manual
interface ManualField {
  key: keyof VehicleSpecs;
  label: string;
  icon: string;
  placeholder: string;
  patterns: RegExp[]; // Auto-detection patterns
}

// Patterns optimized for MG 350 manual content
const MANUAL_FIELDS: ManualField[] = [
  {
    key: "aceiteMotor",
    label: "Aceite de Motor",
    icon: "🛢️",
    placeholder: "p. ej. SAE 5W-30 API SN Plus",
    patterns: [
      /aceite\s+(?:de\s+)?motor[:\s]+([^\n.]{3,80})/i,
      /motor\s+(?:oil|aceite)[:\s]+([^\n.]{3,80})/i,
      /SAE\s+\d+[WR]-\d+/i,
      /API\s+[SLSPSN]+\s*(?:Plus|CF)?/i,
      /oil\s+(?:type|spec|grade|capacity)[:\s]+([^\n.]{3,80})/i,
      /capacidad\s+(?:de\s+)?(?:aceite|oil)[:\s]+([^\n.]{3,40})/i,
      /\d+\.?\d*\s*(?:L|litros?)\s*(?:de\s+)?aceite/i,
    ],
  },
  {
    key: "aceiteCaja",
    label: "Aceite de Caja / Transmisión",
    icon: "⚙️",
    placeholder: "p. ej. SAE 75W-90 GL-4",
    patterns: [
      /aceite\s+(?:de\s+)?(?:caja|transmisi[oó]n)[:\s]+([^\n.]{3,80})/i,
      /transmisi[oó]n\s+(?:fluid|oil|aceite)[:\s]+([^\n.]{3,80})/i,
      /de\s+transmisi[oó]n\s*(?:\(\d+\))?/i,
      /GL-[345]\s*/i,
      /caja\s+(?:de\s+)?cambios[:\s]+([^\n.]{3,80})/i,
    ],
  },
  {
    key: "bujias",
    label: "Bujías",
    icon: "⚡",
    placeholder: "p. ej. NGK BPR6ES, gap 0.8mm",
    patterns: [
      /buj[ií]as?[:\s]+([^\n.]{3,80})/i,
      /NGK\s+[A-Z0-9]{2,10}/i,
      /DENSO\s+[A-Z0-9]{2,10}/i,
      /champion\s+[A-Z0-9]{2,10}/i,
      /spark\s+plug[s]?[:\s]+([^\n.]{3,80})/i,
      /brecha[:\s]+(\d+\.?\d*\s*(?:mm|pulgadas?)?)/i,
      /gap[:\s]+(\d+\.?\d*\s*mm)/i,
    ],
  },
  {
    key: "fusibles",
    label: "Fusibles",
    icon: "🔌",
    placeholder: "p. ej. No.13 - Caja de fusibles del motor",
    patterns: [
      /fusible[s]?[:\s]+([^\n]{5,150})/i,
      /No\.\d+\s+(?:en\s+la\s+)?caja\s+de\s+fusibles/i,
      /\d+[A]\s*\([^)]*\)/gi,
      /fuse\s+(?:box|panel)[:\s]+([^\n]{5,150})/i,
      /caja\s+de\s+fusibles[:\s]+([^\n]{5,150})/i,
    ],
  },
  {
    key: "refrigerante",
    label: "Refrigerante / Anticongelante",
    icon: "❄️",
    placeholder: "p. ej. Etilenglicol 50%",
    patterns: [
      /refrigerante[:\s]+([^\n.]{3,80})/i,
      /anticongelante[:\s]+([^\n.]{3,80})/i,
      /coolant[:\s]+([^\n.]{3,80})/i,
      /etilenglicol/i,
      /vaciar\s+y\s+refill[:\s]*(\d+\.?\d*\s*(?:L|ml)?)/i,
      /capacidad\s+(?:de\s+)?(?:refrigerante|coolant)[:\s]+([^\n.]{3,40})/i,
    ],
  },
  {
    key: "tipoCombustible",
    label: "Tipo de Combustible",
    icon: "⛽",
    placeholder: "p. ej. Gasolina 95 octanos",
    patterns: [
      /(?:gasolina|petrol|fuel|combustible)[:\s]+([^\n.]{3,60})/i,
      /\d{2,3}\s*octanos?/i,
      /RON\s*\d+/i,
      /AKI\s*\d+/i,
      /tipo\s+de\s+(?:combustible|gasolina)[:\s]+([^\n.]{3,60})/i,
      /capacidad\s+(?:del\s+)?(?:estanque|tanque)[:\s]+([^\n.]{3,40})/i,
    ],
  },
  {
    key: "liquidoFrenos",
    label: "Líquido de Frenos",
    icon: "🛑",
    placeholder: "p. ej. DOT 4",
    patterns: [
      /l[ií]quido\s+de\s+frenos?[:\s]+([^\n.]{3,40})/i,
      /brake\s+fluid[:\s]+([^\n.]{3,40})/i,
      /DOT\s*[3456]/i,
      /frenos?[:\s]+([^\n.]{3,40})/i,
    ],
  },
  {
    key: "correaDistribucion",
    label: "Correa de Distribución",
    icon: "🔄",
    placeholder: "p. ej. Cambio cada 60,000 km",
    patterns: [
      /correa\s+(?:de\s+)?distribuci[oó]n[:\s]+([^\n.]{3,80})/i,
      /timing\s+belt[:\s]+([^\n.]{3,80})/i,
      /distribuci[oó]n[:\s]+([^\n.]{3,80})/i,
    ],
  },
  {
    key: "capacidadEstanque",
    label: "Capacidad del Estanque",
    icon: "🪣",
    placeholder: "p. ej. 55 L",
    patterns: [
      /capacidad\s+(?:del\s+)?(?:estanque|tanque|combustible)[:\s]+([^\n.]{3,40})/i,
      /fuel\s+tank[:\s]+([^\n.]{3,40})/i,
      /(\d+\.?\d*)\s*(?:L|litros?)\s*(?:de\s+)?(?:gasolina|combustible|estanque|tanque)/i,
      /estanque[:\s]+(\d+\.?\d*\s*(?:L|litros?))/i,
    ],
  },
  {
    key: "torqueTornillos",
    label: "Torque de Tornillos",
    icon: "🔧",
    placeholder: "p. ej. 5-7 Nm",
    patterns: [
      /torque[:\s]+([^\n.]{3,100})/i,
      /apriete[:\s]+([^\n.]{3,100})/i,
      /(\d+\.?\d*)\s*[-–]\s*(\d+\.?\d*)\s*N\.?m/gi,
      /(\d+\.?\d*)\s*N\.?m/gi,
      /perno[s]?\s*[:\-–]\s*([^\n.]{3,80})/i,
    ],
  },
  {
    key: "peso",
    label: "Peso en Vacío",
    icon: "⚖️",
    placeholder: "p. ej. 1,500 kg",
    patterns: [
      /peso\s+(?:en\s+)?(?:vac[ií]o|seco|bruto)[:\s]+([^\n.]{3,40})/i,
      /curb\s+weight[:\s]+([^\n.]{3,40})/i,
      /(\d[\d,.]*)\s*kg/i,
      /peso[:\s]+(\d[\d,.]*\s*kg)/i,
    ],
  },
  {
    key: "dimensiones",
    label: "Dimensiones (L x A x Al)",
    icon: "📐",
    placeholder: "p. ej. 4,510 x 1,780 x 1,490 mm",
    patterns: [
      /dimensiones?[:\s]+([^\n.]{10,100})/i,
      /largo\s*x\s*ancho/i,
      /(\d{4})\s*x\s*(\d{3,4})\s*x\s*(\d{3,4})\s*mm/i,
      /las\s+dimensiones/i,
    ],
  },
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
    new Set(["aceiteMotor"])
  );
  const [autoExtracted, setAutoExtracted] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Extract text from PDF
  const extractTextFromPdf = useCallback(
    async (file: File) => {
      setLoading(true);
      try {
        // Check file size
        if (file.size > MAX_PDF_SIZE) {
          const sizeMB = (file.size / (1024 * 1024)).toFixed(0);
          triggerToast(`El archivo pesa ${sizeMB}MB. El máximo recomendado es 50MB. Intenta comprimir el PDF.`);
          setLoading(false);
          return;
        }

        const arrayBuffer = await file.arrayBuffer();
        
        // Load PDF with error handling
        let pdf;
        try {
          pdf = await pdfjsLib.getDocument({ data: arrayBuffer, verbosity: 0 }).promise;
        } catch (loadError: any) {
          console.error("PDF load error:", loadError);
          if (loadError.message?.includes("Invalid PDF")) {
            triggerToast("El archivo no es un PDF válido o está corrupto.");
          } else if (loadError.message?.includes("password")) {
            triggerToast("El PDF está protegido con contraseña. No se puede leer.");
          } else {
            triggerToast(`Error al abrir el PDF: ${loadError.message || "Formato no reconocido"}`);
          }
          setLoading(false);
          return;
        }

        let fullText = "";
        let totalPages = pdf.numPages;
        
        // Process pages with individual error handling
        for (let i = 1; i <= totalPages; i++) {
          try {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item: any) => item.str).join(" ");
            fullText += pageText + "\n";
          } catch (pageError) {
            console.warn(`Error en página ${i}:`, pageError);
            // Continue with other pages
          }
        }

        if (fullText.trim().length === 0) {
          triggerToast("El PDF no contiene texto extraíble. Puede ser un PDF escaneado (imágenes). Ingresa los datos manualmente.");
        } else {
          triggerToast(`Manual "${file.name}" cargado. ${fullText.length.toLocaleString()} caracteres extraídos de ${totalPages} páginas.`);
        }

        setPdfText(fullText);
        setPdfName(file.name);
        onUpdateSpecs({ manualPdfNombre: file.name });
      } catch (error: any) {
        console.error("Error extracting PDF:", error);
        triggerToast(`Error inesperado: ${error.message || "No se pudo procesar el PDF"}`);
      } finally {
        setLoading(false);
      }
    },
    [onUpdateSpecs, triggerToast]
  );

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      triggerToast("Solo se aceptan archivos PDF.");
      return;
    }
    extractTextFromPdf(file);
    // Reset input so same file can be re-uploaded
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

    for (const field of MANUAL_FIELDS) {
      for (const pattern of field.patterns) {
        const match = pdfText.match(pattern);
        if (match) {
          const value = match[1] || match[0];
          // Only update if the field is empty or user confirms
          if (!specs[field.key] || specs[field.key] === "") {
            (updates as any)[field.key] = value.trim();
            extracted.add(field.key);
          }
          break;
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      onUpdateSpecs(updates);
      setAutoExtracted(extracted);
      triggerToast(
        `${Object.keys(updates).length} campo(s) detectado(s) automáticamente.`
      );
    } else {
      triggerToast("No se detectaron nuevos campos. Puedes ingresarlos manualmente.");
    }
  };

  // Search in PDF text
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

    setSearchResults(results.slice(0, 20)); // Limit to 20 results
  };

  // Toggle section expansion
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

  // Delete stored manual PDF
  const handleDeleteManual = () => {
    setPdfText("");
    setPdfName("");
    onUpdateSpecs({ manualPdfNombre: "" });
    setAutoExtracted(new Set());
    triggerToast("Manual eliminado.");
  };

  return (
    <div className="space-y-6 select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display font-black text-white text-xl uppercase tracking-wider">
            Datos del Manual
          </h2>
          <p className="font-mono text-[10px] text-white/40 mt-1 uppercase tracking-widest">
            Extrae especificaciones del manual de tu vehículo. 100% local.
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

      {/* Loading indicator */}
      {loading && (
        <div className="glass-panel p-6 rounded-xl border border-white/10 flex items-center justify-center gap-3">
          <Loader2 className="w-5 h-5 text-[#FF3D00] animate-spin" />
          <span className="font-mono text-xs text-white/60 uppercase">
            Extrayendo texto del PDF...
          </span>
        </div>
      )}

      {/* Search in PDF */}
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

      {/* Manual Fields */}
      <div className="space-y-3">
        {MANUAL_FIELDS.map((field) => {
          const isExpanded = expandedSections.has(field.key);
          const value = specs[field.key] as string;
          const wasAutoExtracted = autoExtracted.has(field.key);

          return (
            <div
              key={field.key}
              className="glass-panel rounded-xl border border-white/10 overflow-hidden"
            >
              {/* Field Header */}
              <button
                onClick={() => toggleSection(field.key)}
                className="w-full flex items-center justify-between p-4 hover:bg-white/2 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{field.icon}</span>
                  <div className="text-left">
                    <span className="font-mono text-[10px] text-white/50 uppercase font-bold tracking-widest block">
                      {field.label}
                    </span>
                    {value && (
                      <span className="font-mono text-xs text-white/80 mt-0.5 block truncate max-w-[200px] sm:max-w-[400px]">
                        {value}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {wasAutoExtracted && (
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-[8px] font-bold uppercase rounded">
                      <CheckCircle2 className="w-3 h-3" />
                      AUTO
                    </span>
                  )}
                  {value ? (
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-white/20" />
                  )}
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-white/40" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-white/40" />
                  )}
                </div>
              </button>

              {/* Field Input */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-white/5 pt-3">
                  <input
                    type="text"
                    value={value}
                    onChange={(e) =>
                      onUpdateSpecs({ [field.key]: e.target.value })
                    }
                    placeholder={field.placeholder}
                    className="w-full input-field p-3 font-mono text-xs text-white rounded bg-black border border-white/10 outline-none"
                  />
                  {field.patterns.length > 0 && (
                    <p className="font-mono text-[8px] text-white/30 mt-2 uppercase">
                      Patrones de detección:{" "}
                      {field.patterns.length} configurados
                    </p>
                  )}
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
            Resumen
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="text-center p-3 bg-white/2 rounded">
            <div className="font-display text-2xl font-black text-[#FF3D00]">
              {MANUAL_FIELDS.filter((f) => specs[f.key]).length}
            </div>
            <div className="font-mono text-[9px] text-white/40 uppercase">
              Completados
            </div>
          </div>
          <div className="text-center p-3 bg-white/2 rounded">
            <div className="font-display text-2xl font-black text-white/40">
              {MANUAL_FIELDS.filter((f) => !specs[f.key]).length}
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
              {MANUAL_FIELDS.length}
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
