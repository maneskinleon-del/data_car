import React, { useState } from "react";
import {
  ShoppingCart,
  Check,
  ChevronDown,
  ChevronUp,
  Package,
  AlertTriangle,
} from "lucide-react";
import { MAINTENANCE_PACKS, MaintenancePack } from "../data/maintenancePacks";
import { PartInfo } from "../types/technicalV2";

interface MaintenancePacksProps {
  getParts: (componentId: string) => PartInfo[];
  getComponentName: (componentId: string) => string | undefined;
  triggerToast: (msg: string) => void;
}

interface PackItemView {
  componentId: string;
  quantity: number;
  note?: string;
  name: string;                       // nombre del componente (de la base técnica)
  reference: string;                  // referencia preferida (resuelta del catálogo)
  hasReference: boolean;              // false → "Referencia disponible" (sin dato inventado)
  verified: boolean;                  // true → referencia confirmada
}

// Resuelve la mejor referencia de un componente desde el catálogo.
// Orden: pieza del dueño (source "user") > verificada con OEM > OEM > 1er aftermarket.
function resolveReference(parts: PartInfo[]): { text: string; verified: boolean; found: boolean } {
  if (!parts || parts.length === 0) return { text: "", verified: false, found: false };
  const user = parts.find((p) => p.source === "user");
  const verified = parts.filter((p) => p.verified);
  const preferred = user ?? verified[0] ?? parts[0];

  if (preferred.oem) {
    // Ej: "UJ-1797" o "NGK PFR6Y" — mostrar solo el OEM si existe
    const text = preferred.oem.replace(/\(SAIC\)|\(.*\)/g, "").trim();
    return { text, verified: preferred.verified, found: true };
  }
  const am = preferred.aftermarket?.[0];
  if (am) {
    return { text: `${am.brand} ${am.partNumber}`, verified: preferred.verified, found: true };
  }
  return { text: "", verified: false, found: false };
}

interface PackCardProps {
  key?: string; // patrón del proyecto: key explícita para el map
  pack: MaintenancePack;
  getParts: (componentId: string) => PartInfo[];
  getComponentName: (componentId: string) => string | undefined;
  triggerToast: (msg: string) => void;
}

function PackCard({
  pack,
  getParts,
  getComponentName,
  triggerToast,
}: PackCardProps) {
  const [expanded, setExpanded] = useState(false);

  const items: PackItemView[] = pack.items.map((it) => {
    const parts = getParts(it.componentId);
    const ref = resolveReference(parts);
    return {
      componentId: it.componentId,
      quantity: it.quantity,
      note: it.note,
      name: getComponentName(it.componentId) ?? it.componentId,
      reference: ref.text,
      hasReference: ref.found,
      verified: ref.verified,
    };
  });

  const allVerified = items.every((i) => !i.hasReference || i.verified);

  const addToCart = () => {
    const list = items
      .map((i) => `${i.name} ×${i.quantity}${i.reference ? ` — ${i.reference}` : ""}`)
      .join("\n");
    triggerToast(`🛒 Pack "${pack.name}" agregado a compra:\n${list}`);
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3.5 hover:bg-white/2 transition-colors cursor-pointer text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#FF3D00] to-[#FF8A00] flex items-center justify-center shrink-0 text-lg">
            {pack.icon}
          </div>
          <div className="min-w-0">
            <p className="font-display font-bold text-white text-sm tracking-tight truncate">
              {pack.name}
            </p>
            <p className="font-mono text-[8px] text-white/40 truncate">
              {pack.items.length} item(s) · {pack.description}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {allVerified ? (
            <span className="px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-mono text-[8px] rounded">
              ✓ REFS OK
            </span>
          ) : (
            <span className="px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono text-[8px] rounded">
              ⚠ PARCIAL
            </span>
          )}
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-white/40" />
          ) : (
            <ChevronDown className="w-4 h-4 text-white/40" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-white/5 pt-3 space-y-2">
          <div className="space-y-1">
            {items.map((i) => (
              <div key={i.componentId} className="flex items-start justify-between gap-2 py-1">
                <div className="flex items-center gap-2 min-w-0">
                  <Check className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="font-mono text-[10px] text-white/80 truncate">
                      {i.name} <span className="text-white/40">×{i.quantity}</span>
                    </p>
                    {i.reference ? (
                      <p className={`font-mono text-[9px] ${i.verified ? "text-white/50" : "text-amber-300/70"}`}>
                        {i.reference}
                        {!i.verified && " ⚠ candidata"}
                      </p>
                    ) : (
                      <p className="font-mono text-[8px] text-white/30">Referencia disponible</p>
                    )}
                    {i.note && (
                      <p className="font-mono text-[8px] text-cyan-300/40">ℹ️ {i.note}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {!allVerified && (
            <p className="flex items-center gap-1.5 font-mono text-[8px] text-amber-300/60">
              <AlertTriangle className="w-3 h-3 shrink-0" />
              Algunos items no tienen referencia confirmada — revisa antes de comprar.
            </p>
          )}

          <button
            onClick={addToCart}
            className="w-full mt-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-[#FF3D00] to-[#FF8A00] hover:brightness-110 text-white font-mono text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all active:scale-[0.98] cursor-pointer"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            Agregar pack a compra
          </button>
        </div>
      )}
    </div>
  );
}

export default function MaintenancePacks({
  getParts,
  getComponentName,
  triggerToast,
}: MaintenancePacksProps) {
  return (
    <div className="glass-panel rounded-xl border border-white/10 overflow-hidden">
      <div className="p-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#FF3D00] to-[#FF8A00] flex items-center justify-center">
            <Package className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-display font-black text-white text-sm uppercase tracking-wider">
              Packs de mantenimiento
            </p>
            <p className="font-mono text-[8px] text-white/40">
              Qué necesitas comprar para cada trabajo · referencias del catálogo real
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {MAINTENANCE_PACKS.map((pack) => (
          <PackCard
            key={pack.id}
            pack={pack}
            getParts={getParts}
            getComponentName={getComponentName}
            triggerToast={triggerToast}
          />
        ))}
      </div>
    </div>
  );
}
