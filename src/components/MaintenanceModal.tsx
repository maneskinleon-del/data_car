import React, { useState } from "react";
import { X, Calendar, DollarSign, PenTool, CheckCircle2 } from "lucide-react";
import { ServiceRecord } from "../types";

interface MaintenanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddRecord: (record: ServiceRecord) => void;
  currentKm: number;
}

export default function MaintenanceModal({ isOpen, onClose, onAddRecord, currentKm }: MaintenanceModalProps) {
  const [name, setName] = useState("Cambio Aceite & Filtros");
  const [cost, setCost] = useState("130.00");
  const [date, setDate] = useState("");
  const [km, setKm] = useState(currentKm.toString());
  const [category, setCategory] = useState<"primary" | "secondary" | "neutral">("primary");
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Auto-fill today if empty
    const finalDate = new Date(date || Date.now()).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).toUpperCase();

    const newRecord: ServiceRecord = {
      id: Math.random().toString(36).substring(2, 9),
      name: name,
      cost: parseFloat(cost) || 120.00,
      date: finalDate,
      km: parseInt(km) || currentKm,
      icon: category === "primary" ? "oil_barrel" : category === "secondary" ? "settings_suggest" : "tire_repair",
      colorType: category
    };

    onAddRecord(newRecord);
    setSuccess(true);
    setTimeout(() => {
      setSuccess(false);
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Overlay backdrop */}
      <div 
        onClick={onClose}
        className="absolute inset-0 bg-black/90 backdrop-blur-md"
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-md bg-[#0A0A0A] border border-white/10 rounded-xl overflow-hidden shadow-[0_0_50px_rgba(255,61,0,0.30)] duration-300">
        
        {/* Shimmer header effect */}
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#FF3D00] via-[#FF8A00] to-[#FF3D00]" />

        {/* Success screen overlay */}
        {success ? (
          <div className="flex flex-col items-center justify-center p-12 text-center bg-[#0A0A0A]/95 absolute inset-0 z-10 duration-200">
            <CheckCircle2 className="w-16 h-16 text-[#FF8A00] animate-bounce mb-4" />
            <h3 className="font-display font-black text-2xl text-white uppercase tracking-wider">REGISTRO COMPLETADO</h3>
            <p className="font-mono text-xs text-white/50 mt-2 tracking-wider">El mantenimiento ha sido añadido a tu historial personal.</p>
          </div>
        ) : null}

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10 bg-white/2">
          <div className="flex items-center gap-3">
            <PenTool className="w-5 h-5 text-[#FF3D00]" />
            <h3 className="font-display font-black text-white text-md tracking-wider">REGISTRAR MANTENIMIENTO</h3>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors p-1 rounded-full hover:bg-white/5"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 font-mono text-xs">
          
          {/* Service Name */}
          <div>
            <label className="block text-white/50 uppercase font-bold tracking-widest text-[9px] mb-2">TIPO DE SERVICIO TÉCNICO</label>
            <select
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                // Auto set some placeholder prices
                if (e.target.value.includes("Aceite")) {
                  setCost("120.00");
                  setCategory("secondary");
                } else if (e.target.value.includes("Mayor")) {
                  setCost("450.00");
                  setCategory("primary");
                } else if (e.target.value.includes("Alineación") || e.target.value.includes("Neumáticos")) {
                  setCost("85.00");
                  setCategory("neutral");
                } else {
                  setCost("150.00");
                  setCategory("neutral");
                }
              }}
              className="w-full input-field p-3 text-white rounded bg-black border border-white/10 outline-none text-xs"
            >
              <option value="Cambio Aceite & Filtros">Cambio de Aceite & Filtros Premium</option>
              <option value="Mantenimiento Mayor">Mantenimiento Mayor (Puesta a Punto)</option>
              <option value="Alineación y Balanceo">Alineación, Balanceo & Suspensión</option>
              <option value="Revisión Eléctrica ECU">Revisión Eléctrica</option>
              <option value="Otro">Otro servicio</option>
            </select>
          </div>

          {/* Pricing & Odometer */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-white/50 uppercase font-bold tracking-widest text-[9px] mb-2">COSTO ESTIMADO ($)</label>
              <div className="relative">
                <span className="absolute left-3 top-3 text-white/40 font-bold">$</span>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  className="w-full input-field p-3 pl-7 text-white rounded bg-black border border-white/10 outline-none"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div>
              <label className="block text-white/50 uppercase font-bold tracking-widest text-[9px] mb-2">KILOMETRAJE ACTUAL</label>
              <input
                type="number"
                required
                value={km}
                onChange={(e) => setKm(e.target.value)}
                className="w-full input-field p-3 text-white rounded bg-black border border-white/10 outline-none"
                placeholder="Km"
              />
            </div>
          </div>

          {/* Date Picker */}
          <div>
            <label className="block text-white/50 uppercase font-bold tracking-widest text-[9px] mb-2">FECHA REALIZADA</label>
            <div className="relative">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full input-field p-3 text-white rounded bg-black border border-white/10 outline-none cursor-pointer"
              />
            </div>
          </div>

          {/* Color Code / Category Indicator */}
          <div>
            <label className="block text-white/50 uppercase font-bold tracking-widest text-[9px] mb-2">CATEGORÍA</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setCategory("primary")}
                className={`py-2 text-[10px] text-center border rounded font-bold tracking-wider transition-all skew-box ${
                  category === "primary" 
                    ? "bg-[#FF3D00] border-[#FF3D00] text-white shadow-[0_0_15px_rgba(255,61,0,0.4)]" 
                    : "bg-black border-white/10 text-white/60 hover:border-white/25"
                }`}
              >
                Mayor
              </button>
              <button
                type="button"
                onClick={() => setCategory("secondary")}
                className={`py-2 text-[10px] text-center border rounded font-bold tracking-wider transition-all skew-box ${
                  category === "secondary" 
                    ? "bg-[#FF8A00] border-[#FF8A00] text-white shadow-[0_0_15px_rgba(255,138,0,0.4)]" 
                    : "bg-black border-white/10 text-white/60 hover:border-white/25"
                }`}
              >
                Rutinario
              </button>
              <button
                type="button"
                onClick={() => setCategory("neutral")}
                className={`py-2 text-[10px] text-center border rounded font-bold tracking-wider transition-all skew-box ${
                  category === "neutral" 
                    ? "bg-white/15 border-white/15 text-white" 
                    : "bg-black border-white/10 text-white/60 hover:border-white/25"
                }`}
              >
                Otro
              </button>
            </div>
          </div>

          <div className="h-px bg-white/10 my-4" />

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3.5 bg-white/5 hover:bg-white/10 text-white font-bold rounded transition-colors active:scale-95 duration-100 uppercase tracking-widest text-[10px]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-grow py-3.5 bg-gradient-to-r from-[#FF3D00] to-[#FF8A00] text-white font-bold rounded transition-transform active:scale-[0.98] duration-100 uppercase tracking-widest text-[10px] shadow-[0_4px_20px_rgba(255,61,0,0.3)]"
            >
              Registrar Servicio
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
