import React, { useState } from "react";
import { History, Wrench, Droplets, GaugeCircle, Zap, ShieldCheck, ChevronDown, ChevronUp } from "lucide-react";
import { ServiceRecord } from "../types";

interface HistoryListProps {
  records: ServiceRecord[];
}

export default function HistoryList({ records }: HistoryListProps) {
  const [showAll, setShowAll] = useState(false);

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
                className={`p-4 rounded bg-white/2 border border-white/5 flex items-center justify-between hover:bg-white/5 transition-colors duration-150 ${borderClass}`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded bg-[#0A0A0A] border border-white/10 flex items-center justify-center">
                    {getRecordIcon(record.icon)}
                  </div>
                  <div>
                    <h5 className="font-display font-bold text-xs text-white tracking-widest">
                      {record.name}
                    </h5>
                    <p className="font-mono text-[9px] text-white/50 mt-1 uppercase tracking-wider">
                      {record.date} • {record.km.toLocaleString()} KM
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-mono font-black text-sm text-[#FF3D00]">
                    ${record.cost.toFixed(2)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Decorative Brand watermark background */}
      <div className="mt-8 opacity-5 flex justify-center pointer-events-none select-none">
        <ShieldCheck className="w-16 h-16 text-white" />
      </div>
    </div>
  );
}
