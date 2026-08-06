import React, { useRef, useState } from "react";
import {
  Upload,
  X,
  AlertTriangle,
  CheckCircle2,
  FileJson,
  FileSpreadsheet,
} from "lucide-react";
import { ServiceRecord } from "../types";

interface ServiceBackupProps {
  records: ServiceRecord[];
  onImport: (records: ServiceRecord[]) => void;
  triggerToast: (msg: string) => void;
}

const VALID_COLORS = ["primary", "secondary", "neutral"] as const;

function getIntervals(): Record<string, number> {
  try {
    const raw = localStorage.getItem("mg350_service_intervals");
    if (raw) return JSON.parse(raw) as Record<string, number>;
  } catch (e) {
    console.error(e);
  }
  return {};
}

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function sanitizeRecord(raw: unknown): ServiceRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const cost = typeof r.cost === "number" ? r.cost : parseFloat(String(r.cost ?? ""));
  const km = typeof r.km === "number" ? r.km : parseInt(String(r.km ?? ""), 10);
  const name = typeof r.name === "string" ? r.name.trim() : "";
  const date = typeof r.date === "string" ? r.date : "";
  if (!name || !Number.isFinite(cost) || !Number.isFinite(km)) return null;
  const colorType = VALID_COLORS.includes(r.colorType as (typeof VALID_COLORS)[number])
    ? (r.colorType as ServiceRecord["colorType"])
    : "neutral";
  return {
    id: typeof r.id === "string" && r.id ? r.id : Math.random().toString(36).substring(2, 9),
    name,
    cost,
    date,
    km,
    icon: typeof r.icon === "string" ? r.icon : "settings_suggest",
    colorType,
  };
}

export default function ServiceBackup({ records, onImport, triggerToast }: ServiceBackupProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingImport, setPendingImport] = useState<ServiceRecord[] | null>(null);
  const [pendingIntervals, setPendingIntervals] = useState<Record<string, number> | null>(null);

  const exportJson = () => {
    const payload = {
      app: "AutoData MG 350",
      version: 1,
      exportedAt: new Date().toISOString(),
      serviceIntervals: getIntervals(),
      records,
    };
    const stamp = new Date().toISOString().slice(0, 10);
    download(`mg350-historial-${stamp}.json`, JSON.stringify(payload, null, 2), "application/json");
    triggerToast("HISTORIAL EXPORTADO (JSON).");
  };

  const exportCsv = () => {
    const header = ["Tipo", "Fecha", "Kilometraje", "Costo", "Categoría"];
    const rows = records.map((r) => [
      `"${r.name.replace(/"/g, '""')}"`,
      `"${r.date.replace(/"/g, '""')}"`,
      String(r.km),
      r.cost.toFixed(2).replace(".", ","),
      r.colorType,
    ]);
    const csv = "\uFEFF" + [header.join(";"), ...rows.map((row) => row.join(";"))].join("\r\n");
    const stamp = new Date().toISOString().slice(0, 10);
    download(`mg350-historial-${stamp}.csv`, csv, "text/csv;charset=utf-8");
    triggerToast("HISTORIAL EXPORTADO (CSV).");
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const list = Array.isArray(parsed) ? parsed : parsed.records;
        if (!Array.isArray(list)) throw new Error("formato");
        const cleaned = list.map(sanitizeRecord).filter((r): r is ServiceRecord => r !== null);
        if (cleaned.length === 0) throw new Error("vacio");
        // Los intervalos incluidos en el export también se restauran (backup completo)
        const intervals =
          !Array.isArray(parsed) &&
          parsed.serviceIntervals &&
          typeof parsed.serviceIntervals === "object"
            ? (parsed.serviceIntervals as Record<string, number>)
            : null;
        setPendingImport(cleaned);
        setPendingIntervals(intervals);
      } catch (e) {
        console.error(e);
        triggerToast("ARCHIVO INVÁLIDO — USA UN JSON EXPORTADO.");
      }
    };
    reader.readAsText(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  const confirmImport = () => {
    if (!pendingImport) return;
    // Restaura los intervalos del backup ANTES de que el planificador se remonte
    if (pendingIntervals) {
      try {
        localStorage.setItem("mg350_service_intervals", JSON.stringify(pendingIntervals));
      } catch (e) {
        console.error(e);
      }
    }
    onImport(pendingImport);
    setPendingImport(null);
    setPendingIntervals(null);
  };

  return (
    <div className="flex items-center gap-2">
      {/* Exportar JSON */}
      <button
        onClick={exportJson}
        title="Exportar historial como JSON"
        className="flex items-center gap-1.5 px-3 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-mono text-[9px] uppercase font-bold tracking-widest rounded-lg transition-colors active:scale-95 cursor-pointer"
      >
        <FileJson className="w-3.5 h-3.5 text-[#FF8A00]" />
        JSON
      </button>

      {/* Exportar CSV */}
      <button
        onClick={exportCsv}
        title="Exportar historial como CSV (Excel)"
        className="flex items-center gap-1.5 px-3 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-mono text-[9px] uppercase font-bold tracking-widest rounded-lg transition-colors active:scale-95 cursor-pointer"
      >
        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
        CSV
      </button>

      {/* Importar */}
      <button
        onClick={() => fileRef.current?.click()}
        title="Importar historial desde un JSON exportado"
        className="flex items-center gap-1.5 px-3 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-mono text-[9px] uppercase font-bold tracking-widest rounded-lg transition-colors active:scale-95 cursor-pointer"
      >
        <Upload className="w-3.5 h-3.5 text-[#FF3D00]" />
        Importar
      </button>

      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />

      {/* Modal de confirmación de import */}
      {pendingImport && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div onClick={() => setPendingImport(null)} className="absolute inset-0 bg-black/90 backdrop-blur-md" />
          <div className="relative w-full max-w-md bg-[#0A0A0A] border border-white/10 rounded-xl overflow-hidden shadow-[0_0_50px_rgba(255,61,0,0.25)]">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#FF3D00] via-[#FF8A00] to-[#FF3D00]" />
            <div className="flex items-center justify-between p-6 border-b border-white/10 bg-white/2">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-[#FF3D00]" />
                <h3 className="font-display font-black text-white text-md tracking-wider">IMPORTAR HISTORIAL</h3>
              </div>
              <button
                type="button"
                onClick={() => setPendingImport(null)}
                className="text-white/60 hover:text-white transition-colors p-1 rounded-full hover:bg-white/5 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 font-mono text-xs">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-[#FF8A00]/5 border border-[#FF8A00]/20">
                <CheckCircle2 className="w-5 h-5 text-[#FF8A00] shrink-0 mt-0.5" />
                <p className="text-white/70 leading-relaxed">
                  Se importarán{" "}
                  <span className="text-white font-black">{pendingImport.length}</span> registro(s){" "}
                  {pendingIntervals ? (
                    <>
                      y se <span className="text-white font-black">restaurarán los intervalos</span> del backup.{" "}
                    </>
                  ) : null}
                  El historial actual (<span className="text-white font-black">{records.length}</span>) será{" "}
                  <span className="text-[#FF3D00] font-black">reemplazado</span>. Esta acción no se puede deshacer.
                </p>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setPendingImport(null)}
                  className="flex-1 py-3.5 bg-white/5 hover:bg-white/10 text-white font-bold rounded transition-colors active:scale-95 duration-100 uppercase tracking-widest text-[10px] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmImport}
                  className="flex-grow py-3.5 bg-gradient-to-r from-[#FF3D00] to-[#FF8A00] text-white font-bold rounded transition-transform active:scale-[0.98] duration-100 uppercase tracking-widest text-[10px] shadow-[0_4px_20px_rgba(255,61,0,0.3)] cursor-pointer"
                >
                  Importar y reemplazar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
