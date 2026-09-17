import React, { useEffect, useState } from "react";
import {
  ShoppingCart,
  Check,
  ChevronDown,
  ChevronUp,
  Package,
  AlertTriangle,
  Trash2,
  Sparkles,
} from "lucide-react";
import { MAINTENANCE_PACKS, MaintenancePack } from "../data/maintenancePacks";
import { PartInfo } from "../types/technicalV2";
import {
  buildAISharePrompt,
  parseAIResponse,
  formatCLP,
  findRepuesto,
  type RepuestoEvidencia,
} from "../lib/aiShare";

const SHOPPING_STORAGE_KEY = "mg350_shopping_list";

// Un item de compra persistido: lo mínimo que el pack aporta + referencia
// resuelta en el momento de agregar (para no depender del catálogo al mostrar).
interface ShoppingItem {
  componentId: string;
  name: string;
  quantity: number;
  reference: string;
  verified: boolean;
  note?: string; // detalle técnico del pack (ej: "5W/40 · ACEA A3/B3,B4 · 4,5 L")
  price?: number; // precio unitario CLP asignado desde la respuesta de la IA (null → sin asignar)
  evidencia?: RepuestoEvidencia; // evidencia completa de la respuesta IA (url, compatibilidad, vin…)
}

interface ShoppingPack {
  packId: string;
  packName: string;
  packIcon: string;
  items: ShoppingItem[];
  addedAt: number;
}

function loadShoppingList(): ShoppingPack[] {
  try {
    const raw = localStorage.getItem(SHOPPING_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as ShoppingPack[];
    }
  } catch {
    /* ignorar */
  }
  return [];
}

function saveShoppingList(list: ShoppingPack[]) {
  try {
    localStorage.setItem(SHOPPING_STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* ignorar */
  }
}

interface MaintenancePacksProps {
  getParts: (componentId: string) => PartInfo[];
  getComponentName: (componentId: string) => string | undefined;
  triggerToast: (msg: string) => void;
  vehicleLabel?: string; // ej: "MG 350 · chasis LSJA16E37FG011194"
  vin?: string;          // chasis/VIN del vehículo para reforzar compatibilidad
  km?: number;           // kilometraje actual del vehículo
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
  onAddToCart: (pack: MaintenancePack, items: PackItemView[]) => void;
  added: boolean;
}

function PackCard({
  pack,
  getParts,
  getComponentName,
  triggerToast,
  onAddToCart,
  added,
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

  const handleAdd = () => {
    if (added) {
      triggerToast(`"${pack.name}" ya está en tu compra`);
      return;
    }
    onAddToCart(pack, items);
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
            onClick={handleAdd}
            className={`w-full mt-1 flex items-center justify-center gap-2 py-2.5 font-mono text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all active:scale-[0.98] cursor-pointer ${
              added
                ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-300"
                : "bg-gradient-to-r from-[#FF3D00] to-[#FF8A00] hover:brightness-110 text-white"
            }`}
          >
            {added ? <Check className="w-3.5 h-3.5" /> : <ShoppingCart className="w-3.5 h-3.5" />}
            {added ? "En tu compra" : "Agregar pack a compra"}
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
  vehicleLabel = "MG 350",
  vin,
  km = 0,
}: MaintenancePacksProps) {
  const [shoppingList, setShoppingList] = useState<ShoppingPack[]>(loadShoppingList);
  const [showCart, setShowCart] = useState(false);
  const [aiPasteText, setAiPasteText] = useState("");

  useEffect(() => {
    saveShoppingList(shoppingList);
  }, [shoppingList]);

  const totalPacks = shoppingList.length;

  const handleAddToCart = (pack: MaintenancePack, items: PackItemView[]) => {
    const packItems: ShoppingItem[] = items.map((i) => ({
      componentId: i.componentId,
      name: i.name,
      quantity: i.quantity,
      reference: i.reference,
      verified: i.verified,
      note: i.note,
    }));
    setShoppingList((prev) => [
      ...prev,
      { packId: pack.id, packName: pack.name, packIcon: pack.icon, items: packItems, addedAt: Date.now() },
    ]);
    triggerToast(`🛒 "${pack.name}" agregado a tu compra (${totalPacks + 1} pack(s) en total)`);
  };

  const handleRemovePack = (packId: string) => {
    setShoppingList((prev) => prev.filter((p) => p.packId !== packId));
    triggerToast("🗑️ Pack quitado de la compra");
  };

  const handleClearCart = () => {
    setShoppingList([]);
    triggerToast("🧹 Compra vaciada");
  };

  // Arma el prompt para pedirle a una IA los precios de TODO lo agregado.
  // Asigna los precios de la respuesta de la IA a los items de la compra.
  const handleAssignPrices = () => {
    const parsed = parseAIResponse(aiPasteText);
    if (!parsed || parsed.repuestos.length === 0) {
      triggerToast("⚠️ No encontré el JSON de precios — pegá la respuesta de la IA");
      return;
    }
    const repuestos = parsed.repuestos as RepuestoEvidencia[];
    let assigned = 0;
    let missing = 0;
    const updated: ShoppingPack[] = shoppingList.map((p) => ({
      ...p,
      items: p.items.map((i) => {
        const match = findRepuesto(i.name, repuestos);
        if (match && typeof match.precio === "number" && match.precio > 0) {
          assigned++;
          return { ...i, price: match.precio, evidencia: match };
        }
        if (i.price == null) missing++;
        return i;
      }),
    }));
    setShoppingList(updated);
    const totalCLP = formatCLP(computeTotal(updated));
    if (missing > 0) {
      triggerToast(`💸 Precios asignados (${assigned}) — ${missing} item(s) sin precio en la respuesta`);
    } else {
      triggerToast(`💸 Precios asignados — total ${totalCLP}`);
    }
    setAiPasteText("");
  };

  // Total de la compra en CLP: suma de precio × cantidad de cada item con precio.
  const computeTotal = (list: ShoppingPack[]): number =>
    list.reduce(
      (acc, p) =>
        acc +
        p.items.reduce((a, i) => a + (i.price != null ? i.price * i.quantity : 0), 0),
      0
    );

  const cartTotal = computeTotal(shoppingList);
  const pricedItems = shoppingList.flatMap((p) => p.items).filter((i) => i.price != null).length;
  const totalItems = shoppingList.flatMap((p) => p.items).length;

  const handleShareCart = () => {
    const items = shoppingList.flatMap((p) =>
      p.items.map((i) => ({
        componentId: i.componentId,
        name: i.name,
        quantity: i.quantity,
        reference: i.reference,
        hasReference: !!i.reference,
        note: i.note,
      }))
    );
    const prompt = buildAISharePrompt({
      vehicleLabel,
      serviceName: "Lista de compra de repuestos",
      km,
      vin,
      items,
    });
    navigator.clipboard.writeText(prompt).then(() => {
      triggerToast("📋 Prompt de compra copiado — pegá en tu IA");
    });
  };

  return (
    <div className="glass-panel rounded-xl border border-white/10 overflow-hidden">
      <div className="p-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#FF3D00] to-[#FF8A00] flex items-center justify-center">
            <Package className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-display font-black text-white text-sm uppercase tracking-wider">
              Packs de mantenimiento
            </p>
            <p className="font-mono text-[8px] text-white/40">
              Qué necesitas comprar para cada trabajo · referencias del catálogo real
            </p>
          </div>
          <button
            onClick={() => setShowCart(!showCart)}
            className={`relative flex items-center gap-2 px-3 py-2 rounded font-mono text-[9px] font-bold uppercase tracking-widest border transition-all cursor-pointer ${
              showCart
                ? "bg-[#FF3D00] border-[#FF3D00] text-white"
                : "bg-white/5 hover:bg-white/10 border-white/10 text-white/80"
            }`}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            Mi compra
            {totalPacks > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#FF3D00] text-white text-[9px] font-bold flex items-center justify-center">
                {totalPacks}
              </span>
            )}
          </button>
        </div>
      </div>

      {showCart && (
        <div className="p-4 border-b border-white/5 bg-white/2">
          <div className="flex items-center justify-between mb-2">
            <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-white/70">
              🛒 Mi compra {totalPacks > 0 && `(${totalPacks} pack${totalPacks === 1 ? "" : "s"})`}
            </p>
            {shoppingList.length > 0 && (
              <button
                onClick={handleClearCart}
                className="flex items-center gap-1 px-2 py-1 text-[9px] font-mono uppercase tracking-widest rounded bg-white/5 hover:bg-red-500/20 border border-white/10 text-white/60 hover:text-red-300 transition-all cursor-pointer"
              >
                <Trash2 className="w-3 h-3" /> Vaciar
              </button>
            )}
          </div>

          {shoppingList.length === 0 ? (
            <p className="font-mono text-[9px] text-white/40 py-3 text-center">
              Todavía no agregaste packs — tocá "Agregar pack a compra" en cualquiera.
            </p>
          ) : (
            <div className="space-y-2">
              {shoppingList.map((p) => (
                <div key={p.packId} className="flex items-start justify-between gap-2 p-2.5 rounded bg-black/40 border border-white/10">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[10px] font-bold text-white/90">
                      {p.packIcon} {p.packName}
                    </p>
                    <div className="mt-1 space-y-0.5">
                      {p.items.map((i) => (
                        <p key={i.componentId} className="font-mono text-[8px] text-white/50 truncate">
                          {i.name} ×{i.quantity}
                          {i.reference ? ` — ${i.reference}` : " — ref. disponible"}
                          {i.price != null && (
                            <span className="text-emerald-300/80"> — {formatCLP(i.price)}</span>
                          )}
                        </p>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemovePack(p.packId)}
                    className="p-1.5 rounded text-white/40 hover:text-red-300 hover:bg-red-500/10 transition-all cursor-pointer"
                    title="Quitar de la compra"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              <button
                onClick={handleShareCart}
                className="w-full flex items-center justify-center gap-2 py-2.5 mt-1 bg-gradient-to-r from-[#FF3D00] to-[#FF8A00] hover:brightness-110 text-white font-mono text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all active:scale-[0.98] cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Compartir compra con IA (precios CLP)
              </button>

              {/* ── Precios desde la respuesta de la IA ── */}
              <div className="mt-2 p-2.5 rounded bg-black/40 border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-white/60">
                    💸 Precios desde la IA
                  </p>
                  {pricedItems > 0 && (
                    <span className="font-mono text-[8px] text-emerald-300/80">
                      {pricedItems}/{totalItems} con precio
                    </span>
                  )}
                </div>
                <textarea
                  value={aiPasteText}
                  onChange={(e) => setAiPasteText(e.target.value)}
                  placeholder={"Pegá acá la respuesta JSON de la IA…"}
                  rows={3}
                  className="w-full input-field p-2 font-mono text-[10px] text-white rounded bg-black outline-none border border-white/10 resize-y placeholder:text-white/25"
                />
                <button
                  onClick={handleAssignPrices}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white font-mono text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all active:scale-[0.98] cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#FF8A00]" />
                  Asignar precios
                </button>
                {cartTotal > 0 && (
                  <div className="flex items-center justify-between pt-1 border-t border-white/10">
                    <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-white/60">
                      Total
                    </p>
                    <p className="font-mono text-sm font-black text-emerald-300">
                      {formatCLP(cartTotal)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {MAINTENANCE_PACKS.map((pack) => (
          <PackCard
            key={pack.id}
            pack={pack}
            getParts={getParts}
            getComponentName={getComponentName}
            triggerToast={triggerToast}
            onAddToCart={handleAddToCart}
            added={shoppingList.some((p) => p.packId === pack.id)}
          />
        ))}
      </div>
    </div>
  );
}
