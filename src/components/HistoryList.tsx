import React, { useState } from "react";
import {
  History,
  Wrench,
  Droplets,
  GaugeCircle,
  Zap,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Pencil,
  Trash2,
  AlertTriangle,
  X,
} from "lucide-react";
import { ServiceRecord } from "../types";

interface HistoryListProps {
  records: ServiceRecord[];
  onEdit?: (record: ServiceRecord) => void;
  onDelete?: (id: string) => void;
}

export default function HistoryList({ records, onEdit, onDelete }: HistoryListProps) {
  const [showAll, setShowAll] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<ServiceRecord | null>(null);

  // Render responsive Lucide Icon for service records
  const getRecordIcon = (iconName: string) => {
    switch (iconName) {
      case "oil_barrel":
        return <Droplets className="w-5 h-5 text-[#FF8A00]" />;
      case "settings_suggest":
        return <Wrench className="w-5 h-5 text-[#FF3D00]" />;
      case "tire_repair":
        return <GaugeCircle className="w-5 h-5 text-blue-400" />;
      default:
        return <Zap className="w-5 h-5 text-[#FF8A00]" />;
    }
  };

  const visibleRecords = showAll ? records : records.slice(0, 4);

  return (
    <div className="glass-panel rounded-xl p-6 border border-white/10 h-full relative">
      {/* Title */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <History className="w-5 h-5 text-[#FF3D00]" />
          <h3 className="font-display font-black text-white text-md tracking-wider">HISTORIAL</h3>
        </div>

        {records.length > 4 && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-[#FF3D00] font-mono text-[9px] hover:underline uppercase font-bold flex items-center gap-1 cursor-pointer tracking-widest"
          >
            {showAll ? (
              <>
                REDUCIR <ChevronUp className="w-3 h-3" />
              </>
            ) : (
              <>
                VER TODO ({records.length}) <ChevronDown className="w-3 h-3" />
              </>
            )}
          </button>
        )}
      </div>

      {records.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-white/10 rounded-lg">
          <Wrench className="w-8 h-8 text-white/20 mx-auto mb-2 animate-spin" />
          <p className="font-mono text-xs text-white/40 uppercase">Sin registros en el garaje.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {visibleRecords.map((record) => {
            // Pick left indicator border color
            let borderClass = "border-l-4 border-gray-600";
            if (record.colorType === "primary") {
              borderClass = "border-l-4 border-[#FF3D00] shadow-[0_0_15px_rgba(255,61,0,0.1)]";
            } else if (record.colorType === "secondary") {
              borderClass = "border-l-4 border-[#FF8A00] shadow-[0_0_15px_rgba(255,138,0,0.1)]";
            } else if (record.colorType === "neutral") {
              borderClass = "border-l-4 border-indigo-400";
            }

            return (
              <div
                key={record.id}
                className={`group p-4 rounded bg-white/2 border border-white/5 flex items-center justify-between hover:bg-white/5 transition-colors duration-150 ${borderClass}`}
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 rounded bg-[#0A0A0A] border border-white/10 flex items-center justify-center shrink-0">
                    {getRecordIcon(record.icon)}
                  </div>
                  <div className="min-w-0">
                    <h5 className="font-display font-bold text-xs text-white tracking-widest truncate">
                      {record.name}
                    </h5>
                    <p className="font-mono text-[9px] text-white/50 mt-1 uppercase tracking-wider">
                      {record.date} • {record.km.toLocaleString()} KM
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <p className="font-mono font-black text-sm text-[#FF3D00]">
                      ${record.cost.toFixed(2)}
                    </p>
                  </div>

                  {/* Acciones: visibles en móvil, al hover en desktop */}
                  {onEdit && onDelete && (
                    <div className="flex gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-150">
                      <button
                        onClick={() => onEdit(record)}
                        title="Editar registro"
                        className="p-1.5 rounded bg-white/5 hover:bg-[#FF8A00]/20 text-white/40 hover:text-[#FF8A00] transition-colors cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setRecordToDelete(record)}
                        title="Eliminar registro"
                        className="p-1.5 rounded bg-white/5 hover:bg-[#FF3D00]/20 text-white/40 hover:text-[#FF3D00] transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de confirmación de eliminación */}
      {recordToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            onClick={() => setRecordToDelete(null)}
            className="absolute inset-0 bg-black/90 backdrop-blur-md"
          />
          <div className="relative w-full max-w-md bg-[#0A0A0A] border border-white/10 rounded-xl overflow-hidden shadow-[0_0_50px_rgba(255,61,0,0.25)]">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#FF3D00] via-[#FF8A00] to-[#FF3D00]" />
            <div className="flex items-center justify-between p-6 border-b border-white/10 bg-white/2">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-[#FF3D00]" />
                <h3 className="font-display font-black text-white text-md tracking-wider">ELIMINAR REGISTRO</h3>
              </div>
              <button
                type="button"
                onClick={() => setRecordToDelete(null)}
                className="text-white/60 hover:text-white transition-colors p-1 rounded-full hover:bg-white/5 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 font-mono text-xs">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-[#FF3D00]/5 border border-[#FF3D00]/20">
                <AlertTriangle className="w-5 h-5 text-[#FF3D00] shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-white/80 leading-relaxed">
                    ¿Seguro que quieres eliminar{" "}
                    <span className="text-white font-black uppercase tracking-wider">"{recordToDelete.name}"</span>?
                  </p>
                  <p className="text-white/40 text-[10px] uppercase tracking-wider">
                    {recordToDelete.date} • {recordToDelete.km.toLocaleString()} KM • $
                    {recordToDelete.cost.toFixed(2)}
                  </p>
                </div>
              </div>
              <p className="text-[#FF3D00]/80 text-[10px] uppercase tracking-widest">
                Esta acción no se puede deshacer.
              </p>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setRecordToDelete(null)}
                  className="flex-1 py-3.5 bg-white/5 hover:bg-white/10 text-white font-bold rounded transition-colors active:scale-95 duration-100 uppercase tracking-widest text-[10px] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (onDelete) onDelete(recordToDelete.id);
                    setRecordToDelete(null);
                  }}
                  className="flex-grow py-3.5 bg-gradient-to-r from-[#FF3D00] to-[#FF8A00] text-white font-bold rounded transition-transform active:scale-[0.98] duration-100 uppercase tracking-widest text-[10px] shadow-[0_4px_20px_rgba(255,61,0,0.3)] cursor-pointer"
                >
                  Sí, eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Decorative Brand watermark background */}
      <div className="mt-8 opacity-5 flex justify-center pointer-events-none select-none">
        <ShieldCheck className="w-16 h-16 text-white" />
      </div>
    </div>
  );
}
