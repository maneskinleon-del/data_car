import React, { useState, useRef, useCallback, useMemo } from "react";
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
  Check,
} from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import { VehicleSpecs } from "../types";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

const MAX_PDF_SIZE = 50 * 1024 * 1024;

interface ManualDataTabProps {
  specs: VehicleSpecs;
  onUpdateSpecs: (updated: Partial<VehicleSpecs>) => void;
  triggerToast: (msg: string) => void;
}

type Category =
  | "motor"
  | "fluidos"
  | "encendido"
  | "mantencion"
  | "frenos_chasis";

interface TechField {
  key: string;
  label: string;
  icon: string;
  category: Category;
  unitHint: string;
  keyword: RegExp;
  value: RegExp;
  windowBefore?: number;
  windowAfter?: number;
}

// Campos clásicos que siguen en VehicleSpecs
const LEGACY_FIELDS: {
  key: keyof VehicleSpecs;
  label: string;
  icon: string;
  category: Category;
  keyword: RegExp;
  value: RegExp;
}[] = [
  {
    key: "aceiteMotor",
    label: "Aceite Motor (capacidad + viscosidad)",
    icon: "🛢️",
    category: "fluidos",
    keyword: /aceite\s+(del\s+)?motor/i,
    value: /(\d[.,]\d)\s*[Ll].{0,40}?(5W-?\d{2}|10W-?\d{2}|0W-?\d{2}|SAE\s*\d{1,3})/i,
  },
  {
    key: "aceiteCaja",
    label: "Aceite Transmisión (capacidad + grado)",
    icon: "⚙️",
    category: "fluidos",
    keyword: /(transmisi[oó]n|caja)\s+(manual|de\s+cambios)/i,
    value: /(\d[.,]\d)\s*[Ll].{0,40}?(GL-?[45]|75W-?90|80W-?90)/i,
  },
  {
    key: "refrigerante",
    label: "Refrigerante (capacidad + tipo)",
    icon: "❄️",
    category: "fluidos",
    keyword: /(refrigera|anticongelante)/i,
    value: /(\d[.,]\d)\s*[Ll].{0,40}?(OAT|IAT|HOAT)?/i,
  },
  {
    key: "liquidoFrenos",
    label: "Líquido de Frenos",
    icon: "🛑",
    category: "fluidos",
    keyword: /l[ií]quido\s+de\s+frenos|fluido\s+de\s+frenos/i,
    value: /DOT\s*[345]/i,
  },
  {
    key: "capacidadEstanque",
    label: "Estanque + Octanaje",
    icon: "⛽",
    category: "fluidos",
    keyword: /dep[oó]sito\s+de\s+combustible|estanque/i,
    value: /(\d{2,3})\s*[Ll].{0,60}?(\d{2,3})\s*RON/i,
  },
];

// Campos técnicos nuevos: accionables para compra/reparación
const TECH_FIELDS: TechField[] = [
  // ── MOTOR ──
  {
    key: "compresion",
    label: "Presión de Compresión",
    icon: "🔧",
    category: "motor",
    unitHint: "psi o kg/cm²",
    keyword: /compresi[oó]n/i,
    value: /(\d{2,3})\s*[-–a]\s*(\d{2,3})\s*(psi|kg\/cm|kpa|bar)/i,
    windowAfter: 120,
  },
  {
    key: "presionAceite",
    label: "Presión de Aceite (ralentí/caliente)",
    icon: "🌡️",
    category: "motor",
    unitHint: "psi o kPa",
    keyword: /presi[oó]n\s+de\s+aceite/i,
    value: /(\d{1,3}[.,]?\d*)\s*[-–]?\s*(\d{1,3}[.,]?\d*)?\s*(psi|kpa|bar)/i,
    windowAfter: 150,
  },
  {
    key: "juegoValvulas",
    label: "Juego de Válvulas",
    icon: "🔩",
    category: "motor",
    unitHint: "mm",
    keyword: /juego\s+de\s+v[aá]lvulas|holgura\s+de\s+v[aá]lvulas/i,
    value: /(\d[.,]\d{1,3})\s*mm/i,
  },
  {
    key: "tempTermostato",
    label: "Temperatura Termostato",
    icon: "♨️",
    category: "motor",
    unitHint: "°C",
    keyword: /termostato/i,
    value: /(\d{2,3})\s*[°ºC]/i,
    windowAfter: 100,
  },
  {
    key: "tempElectroventilador",
    label: "Temperatura Electroventilador (ON)",
    icon: "🌀",
    category: "motor",
    unitHint: "°C",
    keyword: /electroventilador|ventilador\s+el[eé]ctrico/i,
    value: /(\d{2,3})\s*[°ºC]/i,
    windowAfter: 100,
  },
  // ── ENCENDIDO / SENSORES ──
  {
    key: "gapBujia",
    label: "Calibre de Bujía (gap)",
    icon: "⚡",
    category: "encendido",
    unitHint: "mm",
    keyword: /buj[ií]a/i,
    value: /(\d[.,]\d{1,2})\s*mm/i,
    windowAfter: 150,
  },
  {
    key: "tipoBujia",
    label: "Tipo de Bujía",
    icon: "⚡",
    category: "encendido",
    unitHint: "iridio / platino / cobre",
    keyword: /buj[ií]a/i,
    value: /(iridio|platino|cobre|NGK\s*\w+|Denso\s*\w+)/i,
    windowAfter: 150,
  },
  {
    key: "sensorMAP",
    label: "Sensor MAP",
    icon: "📡",
    category: "encendido",
    unitHint: "presencia / ubicación",
    keyword: /\bMAP\b/,
    value: /.{0,80}/,
    windowAfter: 100,
  },
  {
    key: "sensorLambda",
    label: "Sonda Lambda / O2",
    icon: "📡",
    category: "encendido",
    unitHint: "presencia / ubicación",
    keyword: /lambda|sonda\s+o2|sensor\s+de\s+ox[ií]geno/i,
    value: /.{0,80}/,
    windowAfter: 100,
  },
  // ── MANTENIMIENTO ──
  {
    key: "filtroAceite",
    label: "Filtro de Aceite (ref.)",
    icon: "🧰",
    category: "mantencion",
    unitHint: "código/referencia",
    keyword: /filtro\s+de\s+aceite/i,
    value: /[A-Z]{1,4}[-\s]?\d{3,6}/,
    windowAfter: 100,
  },
  {
    key: "filtroAire",
    label: "Filtro de Aire (ref.)",
    icon: "🧰",
    category: "mantencion",
    unitHint: "código/referencia",
    keyword: /filtro\s+de\s+aire/i,
    value: /[A-Z]{1,4}[-\s]?\d{3,6}/,
    windowAfter: 100,
  },
  {
    key: "cadenaDistribucion",
    label: "Distribución",
    icon: "🔄",
    category: "mantencion",
    unitHint: "cadena / correa",
    keyword: /distribuci[oó]n/i,
    value: /(cadena|correa)\s+de\s+distribuci[oó]n/i,
    windowAfter: 80,
  },
  // ── FRENOS / CHASIS ──
  {
    key: "espesorDiscoDelantero",
    label: "Espesor Mín. Disco Delantero",
    icon: "🛑",
    category: "frenos_chasis",
    unitHint: "mm",
    keyword: /disco\s+(delantero|frontal)/i,
    value: /(\d{1,2}[.,]?\d*)\s*mm/i,
    windowAfter: 120,
  },
  {
    key: "espesorDiscoTrasero",
    label: "Espesor Mín. Disco Trasero",
    icon: "🛑",
    category: "frenos_chasis",
    unitHint: "mm",
    keyword: /disco\s+trasero/i,
    value: /(\d{1,2}[.,]?\d*)\s*mm/i,
    windowAfter: 120,
  },
  {
    key: "espesorPastilla",
    label: "Espesor Mín. Pastilla",
    icon: "🛞",
    category: "frenos_chasis",
    unitHint: "mm",
    keyword: /pastilla/i,
    value: /(\d[.,]?\d*)\s*mm/i,
    windowAfter: 120,
  },
  {
    key: "torqueRueda",
    label: "Torque de Rueda",
    icon: "🔧",
    category: "frenos_chasis",
    unitHint: "Nm",
    keyword: /(perno|tuerca|apriete)\s+(de\s+)?rueda/i,
    value: /(\d{2,3})\s*[-–]?\s*(\d{2,3})?\s*Nm/i,
    windowAfter: 100,
  },
  {
    key: "presionNeumaticos",
    label: "Presión de Neumáticos",
    icon: "🛞",
    category: "frenos_chasis",
    unitHint: "PSI",
    keyword: /presi[oó]n\s+de\s+(los\s+)?neum[aá]ticos/i,
    value: /(\d{2})\s*[-–/]?\s*(\d{2})?\s*(psi|PSI)/,
    windowAfter: 100,
  },
];

// Diagnóstico OBD2: referencia estándar, no extraída del manual
const OBD2_REFERENCE = [
  { code: "P0101", desc: "Sensor MAF/MAP — rango o rendimiento fuera de lo esperado", accion: "Revisar conector, limpiar sensor, chequear fugas de vacío" },
  { code: "P0300", desc: "Fallo de encendido aleatorio/múltiple cilindro", accion: "Revisar bujías, bobinas, compresión" },
  { code: "P0301-P0304", desc: "Fallo de encendido en cilindro específico (1-4)", accion: "Intercambiar bobina/bujía entre cilindros para confirmar origen" },
  { code: "P0420", desc: "Eficiencia del catalizador bajo el umbral (Banco 1)", accion: "Revisar sonda lambda pre/post catalizador, fugas de escape" },
  { code: "P0130-P0135", desc: "Circuito de sonda de oxígeno (Banco 1, Sensor 1)", accion: "Revisar cableado, calentador de sonda, reemplazar si corresponde" },
  { code: "P0171 / P0174", desc: "Sistema demasiado pobre (Banco 1 / Banco 2)", accion: "Buscar fugas de admisión, revisar MAF/MAP, filtro de aire" },
  { code: "P0505", desc: "Sistema de control de ralentí (cuerpo de aceleración)", accion: "Limpiar cuerpo de aceleración, revisar válvula IAC" },
];

const CATEGORY_CONFIG: Record<Category, { label: string; gradient: string }> = {
  motor: { label: "Motor", gradient: "from-orange-500 to-red-500" },
  fluidos: { label: "Fluidos y Capacidades", gradient: "from-blue-500 to-cyan-500" },
  encendido: { label: "Encendido y Sensores", gradient: "from-yellow-500 to-orange-500" },
  mantencion: { label: "Mantenimiento y Filtros", gradient: "from-green-500 to-emerald-500" },
  frenos_chasis: { label: "Frenos y Chasis", gradient: "from-red-500 to-pink-500" },
};

interface Candidate {
  value: string;
  context: string;
}

// Normaliza artefactos de encoding
function normalizeText(text: string): string {
  return text
    .replace(/Û/g, "ó")
    .replace(/û/g, "ó")
    .replace(/Ï/g, "í")
    .replace(/ï(?=[a-z])/g, "í")
    .replace(/[ \t]+/g, " ");
}

// Búsqueda por contexto: keyword → ventana de texto → valor+unidad
function findCandidates(
  text: string,
  field: TechField,
  maxResults = 4
): Candidate[] {
  const before = field.windowBefore ?? 15;
  const after = field.windowAfter ?? 100;
  const candidates: Candidate[] = [];
  const seen = new Set<string>();
  const flags = field.keyword.flags.includes("g")
    ? field.keyword.flags
    : field.keyword.flags + "g";
  const keywordRe = new RegExp(field.keyword.source, flags);
  let match: RegExpExecArray | null;

  while ((match = keywordRe.exec(text)) !== null) {
    const start = Math.max(0, match.index - before);
    const end = Math.min(text.length, match.index + match[0].length + after);
    const window = text.slice(start, end);
    const valueMatch = window.match(field.value);
    if (valueMatch) {
      const raw = (valueMatch[0] || "").trim();
      const key = raw.toLowerCase();
      if (raw && !seen.has(key)) {
        seen.add(key);
        candidates.push({
          value: raw,
          context: window.replace(/\s+/g, " ").trim(),
        });
      }
    }
    if (candidates.length >= maxResults) break;
    if (keywordRe.lastIndex === match.index) keywordRe.lastIndex++;
  }
  return candidates;
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
  const [candidatesByField, setCandidatesByField] = useState<
    Record<string, Candidate[]>
  >({});
  const [techValues, setTechValues] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        for (let i = 1; i <= pdf.numPages; i++) {
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
          triggerToast("El PDF no contiene texto extraíble (probablemente escaneado). Necesitas OCR primero.");
        } else {
          fullText = normalizeText(fullText);
          triggerToast(`Manual cargado. ${fullText.length.toLocaleString()} caracteres de ${pdf.numPages} páginas.`);
        }

        setPdfText(fullText);
        setPdfName(file.name);
        setCandidatesByField({});
        setTechValues({});
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

    // Campos clásicos → van directo a VehicleSpecs si no había valor
    const legacyUpdates: Partial<VehicleSpecs> = {};
    for (const field of LEGACY_FIELDS) {
      const found = findCandidates(
        pdfText,
        { ...field, windowAfter: 100 } as TechField,
        1
      );
      if (found.length > 0 && !specs[field.key]) {
        (legacyUpdates as any)[field.key] = found[0].value;
      }
    }
    if (Object.keys(legacyUpdates).length > 0) onUpdateSpecs(legacyUpdates);

    // Campos técnicos nuevos → candidatos para confirmar
    const newCandidates: Record<string, Candidate[]> = {};
    let totalCandidates = 0;
    for (const field of TECH_FIELDS) {
      const found = findCandidates(pdfText, field);
      if (found.length > 0) {
        newCandidates[field.key] = found;
        totalCandidates += found.length;
      }
    }
    setCandidatesByField(newCandidates);

    if (totalCandidates > 0 || Object.keys(legacyUpdates).length > 0) {
      triggerToast(
        `${Object.keys(legacyUpdates).length} campo(s) básicos rellenados. ${totalCandidates} sugerencia(s) técnica(s) para revisar.`
      );
    } else {
      triggerToast("No se encontraron coincidencias. Revisa 'Buscar en el manual'.");
    }
  };

  const confirmCandidate = (fieldKey: string, value: string) => {
    setTechValues((prev) => ({ ...prev, [fieldKey]: value }));
    triggerToast("Valor confirmado.");
  };

  const handleSearch = () => {
    if (!searchQuery.trim() || !pdfText) return;
    const query = searchQuery.toLowerCase();
    const lines = pdfText.split("\n");
    const results: string[] = [];
    for (const line of lines) {
      if (line.toLowerCase().includes(query)) results.push(line.trim());
    }
    setSearchResults(results.slice(0, 20));
  };

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleDeleteManual = () => {
    setPdfText("");
    setPdfName("");
    onUpdateSpecs({ manualPdfNombre: "" });
    setCandidatesByField({});
    setTechValues({});
    triggerToast("Manual eliminado.");
  };

  const techByCategory = useMemo(() => {
    return TECH_FIELDS.reduce((acc, field) => {
      if (!acc[field.category]) acc[field.category] = [];
      acc[field.category].push(field);
      return acc;
    }, {} as Record<Category, TechField[]>);
  }, []);

  const legacyByCategory = useMemo(() => {
    return LEGACY_FIELDS.reduce((acc, field) => {
      if (!acc[field.category]) acc[field.category] = [];
      acc[field.category].push(field);
      return acc;
    }, {} as Record<Category, typeof LEGACY_FIELDS>);
  }, []);

  const confirmedCount = TECH_FIELDS.filter((f) => techValues[f.key]).length;

  return (
    <div className="space-y-6 select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display font-black text-white text-xl uppercase tracking-wider">
            Datos del Manual MG 350
          </h2>
          <p className="font-mono text-[10px] text-white/40 mt-1 uppercase tracking-widest">
            Especificaciones accionables: compra, reparación, ajuste. 100% local.
          </p>
        </div>
        <div className="flex gap-2">
          {pdfText && (
            <button
              onClick={handleAutoExtract}
              className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:brightness-110 text-white font-display text-sm font-bold px-4 py-2.5 flex items-center justify-center gap-2 transition-transform active:scale-[0.98] cursor-pointer shadow-[0_4px_15px_rgba(16,185,129,0.3)] rounded-xl uppercase tracking-tighter"
            >
              <Zap className="w-4 h-4" />
              Buscar coincidencias
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
              placeholder='p. ej. "torque rueda", "bujía", "P0300"...'
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

      {/* Categorías técnicas */}
      <div className="space-y-4">
        {(Object.keys(CATEGORY_CONFIG) as Category[]).map((catKey) => {
          const cat = CATEGORY_CONFIG[catKey];
          const techFields = techByCategory[catKey] || [];
          const legacyFields = legacyByCategory[catKey] || [];
          const isExpanded = expandedSections.has(catKey);
          const confirmedInCat = techFields.filter((f) => techValues[f.key]).length;
          const legacyFilledInCat = legacyFields.filter((f) => specs[f.key]).length;
          const totalInCat = techFields.length + legacyFields.length;
          const filledInCat = confirmedInCat + legacyFilledInCat;

          return (
            <div key={catKey} className="glass-panel rounded-xl border border-white/10 overflow-hidden">
              <button
                onClick={() => toggleSection(catKey)}
                className="w-full flex items-center justify-between p-4 hover:bg-white/2 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${cat.gradient} flex items-center justify-center`}>
                    <span className="text-white font-bold text-sm">
                      {filledInCat}/{totalInCat}
                    </span>
                  </div>
                  <div className="text-left">
                    <span className="font-mono text-xs text-white font-bold tracking-wider block">
                      {cat.label}
                    </span>
                    <span className="font-mono text-[9px] text-white/40">
                      {totalInCat} campo(s)
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
                <div className="px-4 pb-4 border-t border-white/5 pt-3 space-y-3">
                  {/* Campos clásicos */}
                  {legacyFields.map((field) => (
                    <div key={field.key} className="flex items-center gap-3 p-3 rounded-lg border bg-white/5 border-white/10">
                      <span className="text-lg">{field.icon}</span>
                      <div className="flex-1 min-w-0">
                        <span className="font-mono text-[9px] text-white/50 uppercase font-bold tracking-widest block">
                          {field.label}
                        </span>
                        <input
                          type="text"
                          value={(specs[field.key] as string) || ""}
                          onChange={(e) => onUpdateSpecs({ [field.key]: e.target.value })}
                          placeholder="No detectado — ingresa manualmente"
                          className="w-full bg-transparent font-mono text-xs text-white outline-none placeholder:text-white/20"
                        />
                      </div>
                    </div>
                  ))}

                  {/* Campos técnicos con candidatos */}
                  {techFields.map((field) => {
                    const candidates = candidatesByField[field.key] || [];
                    const confirmed = techValues[field.key];
                    return (
                      <div key={field.key} className="p-3 rounded-lg border bg-white/5 border-white/10 space-y-2">
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{field.icon}</span>
                          <div className="flex-1 min-w-0">
                            <span className="font-mono text-[9px] text-white/50 uppercase font-bold tracking-widest block">
                              {field.label} <span className="text-white/30 normal-case">({field.unitHint})</span>
                            </span>
                            <input
                              type="text"
                              value={confirmed || ""}
                              onChange={(e) =>
                                setTechValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                              }
                              placeholder="Sin confirmar — revisa sugerencias abajo o ingresa manual"
                              className="w-full bg-transparent font-mono text-xs text-white outline-none placeholder:text-white/20"
                            />
                          </div>
                          {confirmed && (
                            <span className="flex items-center gap-1 px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-[8px] font-bold uppercase rounded shrink-0">
                              <CheckCircle2 className="w-3 h-3" />
                              OK
                            </span>
                          )}
                        </div>
                        {candidates.length > 0 && (
                          <div className="pl-9 space-y-1">
                            <span className="font-mono text-[8px] text-white/30 uppercase tracking-widest">
                              Sugerencias detectadas — verifica antes de usar:
                            </span>
                            {candidates.map((c, i) => (
                              <div
                                key={i}
                                className="flex items-start gap-2 bg-black/40 border border-white/5 rounded p-2"
                              >
                                <button
                                  onClick={() => confirmCandidate(field.key, c.value)}
                                  className="shrink-0 p-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded"
                                  title="Usar este valor"
                                >
                                  <Check className="w-3 h-3" />
                                </button>
                                <div className="min-w-0">
                                  <span className="font-mono text-[10px] text-white font-bold">{c.value}</span>
                                  <p className="font-mono text-[9px] text-white/40 truncate">"...{c.context}..."</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Diagnóstico OBD2 — referencia estática */}
        <div className="glass-panel rounded-xl border border-white/10 overflow-hidden">
          <button
            onClick={() => toggleSection("diagnostico")}
            className="w-full flex items-center justify-between p-4 hover:bg-white/2 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-violet-500 flex items-center justify-center">
                <span className="text-white font-bold text-sm">📖</span>
              </div>
              <div className="text-left">
                <span className="font-mono text-xs text-white font-bold tracking-wider block">
                  Diagnóstico OBD2
                </span>
                <span className="font-mono text-[9px] text-white/40">
                  Referencia estándar (no depende del manual)
                </span>
              </div>
            </div>
            {expandedSections.has("diagnostico") ? (
              <ChevronUp className="w-4 h-4 text-white/40" />
            ) : (
              <ChevronDown className="w-4 h-4 text-white/40" />
            )}
          </button>
          {expandedSections.has("diagnostico") && (
            <div className="px-4 pb-4 border-t border-white/5 pt-3 space-y-2">
              {OBD2_REFERENCE.map((item) => (
                <div key={item.code} className="p-3 rounded-lg border bg-white/5 border-white/10">
                  <span className="font-mono text-xs text-purple-400 font-bold">{item.code}</span>
                  <p className="font-mono text-[10px] text-white/70 mt-1">{item.desc}</p>
                  <p className="font-mono text-[9px] text-white/40 mt-1">→ {item.accion}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="glass-panel p-5 rounded-xl border border-white/10">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#FF3D00] to-[#FF8A00] flex items-center justify-center">
            <span className="text-white font-bold text-sm">
              {confirmedCount}/{TECH_FIELDS.length}
            </span>
          </div>
          <div>
            <span className="font-mono text-xs text-white font-bold tracking-wider block">
              Campos Técnicos Confirmados
            </span>
            <span className="font-mono text-[9px] text-white/40">
              Los valores "sin confirmar" no se guardan hasta que los apruebes
            </span>
          </div>
        </div>
        <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#FF3D00] to-[#FF8A00] rounded-full transition-all duration-500"
            style={{ width: `${(confirmedCount / TECH_FIELDS.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
