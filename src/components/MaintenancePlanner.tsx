import React, { useEffect, useMemo, useState } from "react";
import {
  Droplets,
  Wrench,
  GaugeCircle,
  Zap,
  Settings,
  Gauge,
  AlertTriangle,
  RefreshCcw,
  CalendarClock,
  CheckCircle2,
  Car,
} from "lucide-react";
import { ServiceRecord } from "../types";

interface MaintenancePlannerProps {
  records: ServiceRecord[];
  lastServiceKm: number; // specs.ultimoCambioKm (km del último servicio registrado)
  odometer: number; // specs.odometroActual (lectura real del odómetro)
  onOdometerChange: (km: number) => void;
  triggerToast: (msg: string) => void;
  refreshToken?: number; // cambia al restaurar intervalos por backup → recarga
}

interface ServiceType {
  key: string;
  name: string;
  defaultKm: number;
  icon: React.ReactNode;
  matchNames?: string[]; // alias con los que puede llegar el nombre desde el historial
}

const STORAGE_KEY = "mg350_service_intervals";

// Intervalos SUGERIDOS por tipo de servicio (editable en la UI).
// No son datos del manual: son valores de referencia que el dueño ajusta
// según su plan de mantención real (regla de oro: nada de datos inventados).
const SERVICE_TYPES: ServiceType[] = [
  { key: "oil", name: "Cambio Aceite & Filtros", defaultKm: 10000, icon: <Droplets className="w-4 h-4" /> },
  { key: "major", name: "Mantenimiento Mayor", defaultKm: 30000, icon: <Wrench className="w-4 h-4" /> },
  { key: "alignment", name: "Alineación y Balanceo", defaultKm: 15000, icon: <GaugeCircle className="w-4 h-4" /> },
  { key: "electric", name: "Revisión Eléctrica ECU", defaultKm: 20000, icon: <Zap className="w-4 h-4" /> },
  { key: "other", name: "Otro servicio", defaultKm: 10000, icon: <Settings className="w-4 h-4" />, matchNames: ["Otro"] },
];

function loadIntervals(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed as Record<string, number>;
    }
  } catch (e) {
    console.error(e);
  }
  return {};
}

const fmt = (n: number) => n.toLocaleString("es-CL");

export default function MaintenancePlanner({
  records,
  lastServiceKm,
  odometer,
  onOdometerChange,
  triggerToast,
  refreshToken,
}: MaintenancePlannerProps) {
  const [intervals, setIntervals] = useState<Record<string, number>>(loadIntervals);

  // Al importar un backup con intervalos, se escriben en localStorage DESPUÉS del
  // montaje del componente → hay que recargarlos explícitamente.
  useEffect(() => {
    setIntervals(loadIntervals());
  }, [refreshToken]);

  const saveIntervals = (next: Record<string, number>) => {
    setIntervals(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      console.error(e);
    }
  };

  const updateInterval = (name: string, value: number) => {
    // Ignora valores vacíos/inválidos: nunca se persiste un intervalo 0,
    // que rompería los cálculos (porcentaje y "km de más" contradictorios).
    if (!Number.isFinite(value) || value <= 0) return;
    saveIntervals({ ...intervals, [name]: Math.round(value) });
  };

  const resetIntervals = () => {
    const defaults: Record<string, number> = {};
    for (const t of SERVICE_TYPES) defaults[t.name] = t.defaultKm;
    saveIntervals(defaults);
    triggerToast("INTERVALOS RESTAURADOS A SUGERIDOS.");
  };

  const kmSinceLast = Math.max(0, odometer - lastServiceKm);

  // Último km registrado POR TIPO de servicio (para medir el desgaste de cada uno)
  const lastKmByType = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of SERVICE_TYPES) {
      const aliases = [t.name, ...(t.matchNames ?? [])];
      const match = [...records].reverse().find((r) => aliases.includes(r.name));
      if (match) map[t.name] = match.km;
    }
    return map;
  }, [records]);

  type PlanStatus = "none" | "ok" | "soon" | "due";

  const plan = SERVICE_TYPES.map((t) => {
    // Fallback al sugerido si el guardado es 0/inválido (nunca rompe los cálculos)
    const stored = intervals[t.name];
    const interval = stored && stored > 0 ? stored : t.defaultKm;
    const atLast = lastKmByType[t.name];
    const hasRecord = atLast !== undefined;
    const kmSince = hasRecord ? Math.max(0, odometer - atLast) : null;
    const pct = hasRecord && interval > 0 ? Math.min(100, (kmSince! / interval) * 100) : 0;
    const remaining = interval - (kmSince ?? 0);
    const status: PlanStatus = !hasRecord ? "none" : pct >= 100 ? "due" : pct >= 70 ? "soon" : "ok";
    return { ...t, interval, atLast, kmSince, pct, remaining, status };
  });

  const nextService = plan
    .filter((p) => p.status !== "none")
    .sort((a, b) => a.remaining - b.remaining)[0];

  const statusStyles: Record<PlanStatus, { bar: string; text: string; chip: string }> = {
    ok: {
      bar: "bg-emerald-400",
      text: "text-emerald-400",
      chip: "bg-emerald-400/10 border-emerald-400/30 text-emerald-400",
    },
    soon: {
      bar: "bg-[#FF8A00]",
      text: "text-[#FF8A00]",
      chip: "bg-[#FF8A00]/10 border-[#FF8A00]/30 text-[#FF8A00]",
    },
    due: {
      bar: "bg-[#FF3D00]",
      text: "text-[#FF3D00]",
      chip: "bg-[#FF3D00]/10 border-[#FF3D00]/40 text-[#FF3D00]",
    },
    none: {
      bar: "bg-white/15",
      text: "text-white/40",
      chip: "bg-white/5 border-white/10 text-white/40",
    },
  };

  return (
    <div className="space-y-4">
      {/* ── Resumen: odómetro + estado general ─────────────────────────── */}
      <div className="glass-panel carbon-texture rounded-xl p-6 border border-white/10 relative overflow-hidden">
        <div className="absolute -top-8 -right-8 w-36 h-36 bg-gradient-to-br from-[#FF3D00]/10 to-transparent rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row gap-6 lg:items-center justify-between relative z-10">
          {/* Odómetro editable */}
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded bg-[#0A0A0A] border border-white/10 flex items-center justify-center shrink-0">
              <Gauge className="w-6 h-6 text-[#FF3D00]" />
            </div>
            <div>
              <label className="block font-mono text-[9px] text-white/50 uppercase font-bold tracking-widest mb-1">
                ODÓMETRO ACTUAL
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  value={odometer || ""}
                  onChange={(e) => onOdometerChange(Math.max(0, parseInt(e.target.value) || 0))}
                  placeholder="0"
                  className="w-36 input-field p-2 px-3 font-mono text-xl font-black text-white rounded bg-black outline-none border border-white/10"
                />
                <span className="font-mono text-[10px] text-white/40 uppercase font-bold">km</span>
              </div>
            </div>
          </div>

          {/* Km desde último servicio */}
          <div className="flex-1 max-w-sm">
            <p className="font-mono text-[9px] text-white/50 uppercase font-bold tracking-widest mb-2">
              KM DESDE EL ÚLTIMO SERVICIO
            </p>
            <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#FF3D00] to-[#FF8A00] rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, (kmSinceLast / (nextService?.interval && nextService.interval > 0 ? nextService.interval : 20000)) * 100)}%` }}
              />
            </div>
            <p className="font-mono text-xs text-white/70 mt-2">
              <span className="font-black text-white text-base">{fmt(kmSinceLast)} km</span>
              {" "}desde el último cambio
            </p>
          </div>

          {/* Próximo servicio sugerido */}
          <div className={`px-4 py-3 rounded-lg border bg-[#0A0A0A] ${
            nextService && nextService.status === "due"
              ? "border-[#FF3D00]/50 shadow-[0_0_20px_rgba(255,61,0,0.15)]"
              : "border-white/10"
          }`}>
            <p className="font-mono text-[9px] text-white/50 uppercase font-bold tracking-widest mb-1.5 flex items-center gap-1.5">
              <CalendarClock className="w-3.5 h-3.5 text-[#FF8A00]" />
              PRÓXIMO SERVICIO SUGERIDO
            </p>
            {nextService ? (
              <>
                <p className="font-display text-sm text-white font-black leading-tight">{nextService.name}</p>
                <p className={`font-mono text-xs font-black mt-1 ${statusStyles[nextService.status].text}`}>
                  {nextService.remaining >= 0
                    ? `en ${fmt(nextService.remaining)} km`
                    : `excedido ${fmt(Math.abs(nextService.remaining))} km`}
                </p>
              </>
            ) : (
              <p className="font-mono text-[10px] text-white/40 uppercase">
                Registra una mantención para activar el plan
              </p>
            )}
          </div>
        </div>

        {records.length === 0 && (
          <p className="relative z-10 mt-5 font-mono text-[10px] text-[#FF8A00]/80 uppercase tracking-widest flex items-center gap-2">
            <Car className="w-4 h-4" />
            Sin historial todavía — el planificador se activa al registrar tu primera mantención.
          </p>
        )}
      </div>

      {/* ── Tarjetas por tipo de servicio ───────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h3 className="font-mono text-[10px] text-white/60 uppercase font-bold tracking-widest flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-[#FF3D00]" />
          PLAN DE MANTENIMIENTO POR TIPO
        </h3>
        <button
          onClick={resetIntervals}
          className="flex items-center gap-1.5 text-[#FF8A00] hover:text-[#FF3D00] font-mono text-[9px] uppercase font-bold tracking-widest transition-colors cursor-pointer"
        >
          <RefreshCcw className="w-3 h-3" />
          Restaurar sugeridos
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {plan.map((p) => {
          const st = statusStyles[p.status];
          return (
            <div
              key={p.key}
              className="glass-panel rounded-xl p-5 border border-white/10 relative overflow-hidden hover:border-white/20 transition-colors"
            >
              <div className="absolute top-0 right-0 w-16 h-1 bg-gradient-to-r from-[#FF3D00] to-[#FF8A00] opacity-60" />

              {/* Header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded bg-[#0A0A0A] border border-white/10 flex items-center justify-center text-[#FF8A00] shrink-0">
                  {p.icon}
                </div>
                <div className="min-w-0">
                  <p className="font-display text-[11px] text-white font-black tracking-wider uppercase truncate">
                    {p.name}
                  </p>
                  <span className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded border font-mono text-[8px] uppercase font-bold tracking-widest ${st.chip}`}>
                    {p.status === "due" && <AlertTriangle className="w-3 h-3" />}
                    {p.status === "ok" && <CheckCircle2 className="w-3 h-3" />}
                    {p.status === "none" ? "Sin registro" : p.status === "due" ? "Vencido" : p.status === "soon" ? "Próximo" : "Al día"}
                  </span>
                </div>
              </div>

              {/* Intervalo editable */}
              <div className="flex items-center justify-between gap-3 mb-3">
                <label className="font-mono text-[8px] text-white/40 uppercase font-bold tracking-widest">
                  Intervalo (km)
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={500}
                    step={500}
                    value={p.interval || ""}
                    onChange={(e) => updateInterval(p.name, parseInt(e.target.value) || 0)}
                    className="w-24 input-field p-1.5 px-2 font-mono text-[11px] font-bold text-white rounded bg-black outline-none border border-white/10 text-right"
                  />
                  <span className="font-mono text-[9px] text-white/40 uppercase">km</span>
                </div>
              </div>

              {/* Progreso */}
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full ${st.bar} rounded-full transition-all duration-500`}
                  style={{ width: `${p.pct}%` }}
                />
              </div>

              {/* Estado */}
              <div className="mt-3 flex items-center justify-between">
                {p.status === "none" ? (
                  <p className="font-mono text-[9px] text-white/40 uppercase tracking-wider">
                    Sin medición aún
                  </p>
                ) : (
                  <>
                    <p className="font-mono text-[9px] text-white/50 uppercase tracking-wider">
                      Último: {fmt(p.atLast!)} km
                    </p>
                    <p className={`font-mono text-[10px] font-black uppercase ${st.text}`}>
                      {p.remaining >= 0
                        ? `Restan ${fmt(p.remaining)} km`
                        : `${fmt(Math.abs(p.remaining))} km de más`}
                    </p>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="font-mono text-[8px] text-white/30 uppercase tracking-widest">
        Intervalos sugeridos — ajústalos al plan de mantención de tu manual. No son datos extraídos del PDF.
      </p>
    </div>
  );
}
