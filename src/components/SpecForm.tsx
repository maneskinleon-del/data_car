import React from "react";
import { Droplets, Sliders, Lightbulb, Save } from "lucide-react";
import { VehicleSpecs } from "../types";

interface SpecFormProps {
  specs: VehicleSpecs;
  onUpdateSpecs: (newSpecs: Partial<VehicleSpecs>) => void;
  onSave: () => void;
  isSaving: boolean;
}

export default function SpecForm({ specs, onUpdateSpecs, onSave, isSaving }: SpecFormProps) {
  
  const handleChange = (field: keyof VehicleSpecs, value: any) => {
    onUpdateSpecs({ [field]: value });
  };

  return (
    <div className="space-y-6 select-none">
      
      {/* Forms Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Unit 1: Engine & Lubricants */}
        <div className="glass-panel p-6 rounded-xl border border-white/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-[#FF3D00]/5 to-transparent pointer-events-none" />
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/10">
            <Droplets className="w-5 h-5 text-[#FF3D00]" />
            <h3 className="font-display text-xs text-[#FF3D00] font-black tracking-widest uppercase">
              POTENCIA Y LUBRICACIÓN
            </h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block font-mono text-[9px] text-white/50 uppercase font-bold tracking-widest mb-1.5">
                ACEITE MOTOR
              </label>
              <input
                type="text"
                value={specs.aceiteMotor}
                onChange={(e) => handleChange("aceiteMotor", e.target.value)}
                className="w-full input-field p-3 font-mono text-xs text-white rounded bg-black outline-none border border-white/10"
                placeholder="p. ej. Aceite 5w/30"
              />
            </div>
            <div>
              <label className="block font-mono text-[9px] text-white/50 uppercase font-bold tracking-widest mb-1.5">
                FILTRO ACEITE
              </label>
              <input
                type="text"
                value={specs.filtroAceite}
                onChange={(e) => handleChange("filtroAceite", e.target.value)}
                className="w-full input-field p-3 font-mono text-xs text-white rounded bg-black outline-none border border-white/10"
                placeholder="p. ej. Filtro Aceite UJ-1797"
              />
            </div>
          </div>
        </div>

        {/* Unit 2: Chassis & Transmission */}
        <div className="glass-panel p-6 rounded-xl border border-white/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-[#FF8A00]/5 to-transparent pointer-events-none" />
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/10">
            <Sliders className="w-5 h-5 text-[#FF3D00]" />
            <h3 className="font-display text-xs text-[#FF3D00] font-black tracking-widest uppercase">
              CHASIS Y TRANSMISIÓN
            </h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block font-mono text-[9px] text-white/50 uppercase font-bold tracking-widest mb-1.5">
                TRANSMISIÓN
              </label>
              <select
                value={specs.transmision}
                onChange={(e) => handleChange("transmision", e.target.value)}
                className="w-full input-field p-3 font-mono text-xs text-white rounded bg-black outline-none border border-white/10 cursor-pointer"
              >
                <option value="Mecánica">Mecánica</option>
                <option value="Automática">Automática</option>
                <option value="DCT Performance">DCT Performance</option>
              </select>
            </div>
            <div>
              <label className="block font-mono text-[9px] text-white/50 uppercase font-bold tracking-widest mb-1.5">
                DIMENSIÓN NEUMÁTICOS
              </label>
              <input
                type="text"
                value={specs.dimensionNeumaticos}
                onChange={(e) => handleChange("dimensionNeumaticos", e.target.value)}
                className="w-full input-field p-3 font-mono text-xs text-white rounded bg-black outline-none border border-white/10"
                placeholder="p. ej. 205/55/16"
              />
            </div>
          </div>
        </div>

        {/* Unit 3: Electronics & Lighting */}
        <div className="glass-panel p-6 rounded-xl border border-white/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-[#FF3D00]/5 to-transparent pointer-events-none" />
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/10">
            <Lightbulb className="w-5 h-5 text-[#FF3D00]" />
            <h3 className="font-display text-xs text-[#FF3D00] font-black tracking-widest uppercase">
              ELECTRÓNICA & LUZ
            </h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block font-mono text-[9px] text-white/50 uppercase font-bold tracking-widest mb-1.5">
                ILUMINACIÓN PRINCIPAL
              </label>
              <input
                type="text"
                value={specs.iluminacionPrincipal}
                onChange={(e) => handleChange("iluminacionPrincipal", e.target.value)}
                className="w-full input-field p-3 font-mono text-xs text-white rounded bg-black outline-none border border-white/10"
                placeholder="p. ej. LED H4"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-mono text-[9px] text-white/50 uppercase font-bold tracking-widest mb-1.5">
                  PLUMILLA
                </label>
                <textarea
                  rows={2}
                  value={specs.plumillaL}
                  onChange={(e) => handleChange("plumillaL", e.target.value)}
                  className="w-full input-field p-3 font-mono text-xs text-white rounded bg-black outline-none border border-white/10 resize-none leading-normal"
                  placeholder='23"'
                />
              </div>
              <div>
                <label className="block font-mono text-[9px] text-white/50 uppercase font-bold tracking-widest mb-1.5">
                  ALFOMBRA
                </label>
                <textarea
                  rows={2}
                  value={specs.alfombra}
                  onChange={(e) => handleChange("alfombra", e.target.value)}
                  className="w-full input-field p-3 font-mono text-xs text-white rounded bg-black outline-none border border-white/10 resize-none leading-normal"
                  placeholder="Medidas"
                />
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Parts & Save Buttons Layout Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        
        {/* Air filter block */}
        <div className="glass-panel p-6 rounded-xl border border-white/10 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-1 bg-[#FF3D00]" />
          <div>
            <span className="font-mono text-[9px] text-white/50 uppercase font-bold block mb-1">
              FILTRO DE AIRE
            </span>
            <p className="font-mono text-[8px] text-white/30 uppercase block mb-3">Dimensión de Pit lane</p>
            <input
              type="text"
              value={specs.filtroAire}
              onChange={(e) => handleChange("filtroAire", e.target.value)}
              className="w-full input-field p-3 font-mono text-xs text-white rounded bg-black outline-none border border-white/10"
              placeholder="p. ej. 9x26cm"
            />
          </div>
        </div>

        {/* Mileage log block carbon theme */}
        <div className="glass-panel p-6 rounded-xl border border-white/10 carbon-texture flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-1 bg-[#FF8A00]" />
          <div>
            <span className="font-mono text-[9px] text-white/50 uppercase font-bold block mb-1">
              ÚLTIMO CAMBIO REGISTRADO
            </span>
            <div className="text-3xl font-display font-black text-[#FF8A00] mt-2 italic select-all">
              {specs.ultimoCambioKm.toLocaleString()} KM
            </div>
          </div>
          <div className="h-1 bg-white/10 mt-4 rounded-full overflow-hidden">
            <div className="h-full bg-[#FF8A00] rounded-full" style={{ width: "80%" }} />
          </div>
        </div>

        {/* Save action */}
        <div className="md:col-span-2 flex flex-col sm:flex-row gap-4">
          <button
            onClick={onSave}
            disabled={isSaving}
            className="flex-grow bg-gradient-to-r from-[#FF3D00] to-[#FF8A00] hover:brightness-110 text-white font-display text-md font-bold px-8 py-5 flex items-center justify-center gap-3 transition-transform active:scale-[0.98] cursor-pointer shadow-[0_10px_30px_rgba(255,61,0,0.3)] rounded-xl uppercase tracking-tighter disabled:opacity-50"
          >
            <Save className="w-5 h-5 text-white" />
            {isSaving ? "GUARDANDO..." : "GUARDAR CAMBIOS"}
          </button>
        </div>

      </div>

    </div>
  );
}
