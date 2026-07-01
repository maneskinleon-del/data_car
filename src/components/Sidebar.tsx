import React from "react";
import { History, Settings, HelpCircle, X, Car, FileText } from "lucide-react";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onTabChange: (tab: string) => void;
}

export default function Sidebar({ isOpen, onClose, onTabChange }: SidebarProps) {
  return (
    <>
      {/* Background Overlay */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-[60] bg-black/80 backdrop-blur-md transition-opacity duration-350 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Slideout Container */}
      <div
        className={`fixed top-0 left-0 h-full w-80 bg-[#0A0A0A] border-r border-white/10 z-[70] shadow-[15px_0_50px_rgba(0,0,0,0.95)] p-8 flex flex-col justify-between transform transition-transform duration-350 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div>
          {/* Menu Title and Close Button */}
          <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-gradient-to-r from-[#FF3D00] to-[#FF8A00] rounded-full" />
              <span className="font-display font-black text-xl tracking-tighter text-white">MONOLITH.</span>
            </div>
            <button
              onClick={onClose}
              className="text-white/60 hover:text-[#FF3D00] transition-colors p-1 rounded-full hover:bg-white/5"
              aria-label="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Stats Overlay in Menu with brutalist slant line indicator */}
          <div className="carbon-texture p-5 border border-white/10 skew-box mb-8 text-xs relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-[#FF3D00]" />
            <div className="pl-2">
              <span className="text-[#FF3D00] font-mono text-[9px] uppercase tracking-widest font-black block mb-1">
                PROPIETARIO
              </span>
              <p className="text-white font-display font-bold text-lg select-text">Mangonz</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-2">
            <button
              onClick={() => {
                onTabChange("garage");
                onClose();
              }}
              className="w-full flex items-center gap-4 text-left p-3.5 border border-transparent hover:border-white/5 hover:bg-white/2 hover:text-[#FF3D00] text-white/70 transition-all cursor-pointer font-mono text-xs uppercase tracking-widest group"
            >
              <Car className="w-4.5 h-4.5 text-[#FF3D00] group-hover:scale-110 transition-transform" />
              <span>Ver Perfíl del Vehículo</span>
            </button>

            <button
              onClick={() => {
                onTabChange("service");
                onClose();
              }}
              className="w-full flex items-center gap-4 text-left p-3.5 border border-transparent hover:border-white/5 hover:bg-white/2 hover:text-[#FF3D00] text-white/70 transition-all cursor-pointer font-mono text-xs uppercase tracking-widest group"
            >
              <History className="w-4.5 h-4.5 text-[#FF3D00] group-hover:scale-110 transition-transform" />
              <span>Mantenciones & Citas</span>
            </button>

            <button
              onClick={() => {
                onTabChange("documents");
                onClose();
              }}
              className="w-full flex items-center gap-4 text-left p-3.5 border border-transparent hover:border-white/5 hover:bg-white/2 hover:text-[#FF3D00] text-white/70 transition-all cursor-pointer font-mono text-xs uppercase tracking-widest group"
            >
              <FileText className="w-4.5 h-4.5 text-[#FF3D00] group-hover:scale-110 transition-transform" />
              <span>Documentos (SOAP, Rev. Técnica...)</span>
            </button>

            <div className="h-px bg-white/10 my-6" />

            <button
              onClick={() => {
                onClose();
              }}
              className="w-full flex items-center gap-4 text-left p-3 rounded hover:bg-white/5 text-white/40 hover:text-white transition-all cursor-pointer font-mono text-xs tracking-wider"
            >
              <Settings className="w-4 h-4 text-[#FF8A00]" />
              <span>Ajustes de Carbono & ECU</span>
            </button>

            <button
              onClick={() => {
                onClose();
              }}
              className="w-full flex items-center gap-4 text-left p-3 rounded hover:bg-white/5 text-white/40 hover:text-white transition-all cursor-pointer font-mono text-xs tracking-wider"
            >
              <HelpCircle className="w-4 h-4 text-[#FF8A00]" />
              <span>Soporte de Equipo Técnico</span>
            </button>
          </nav>
        </div>

        {/* Footer info inside menu */}
        <div className="pt-6 border-t border-white/5 text-center">
          <p className="font-mono text-[9px] text-white/30 uppercase tracking-[0.25em]">
            AutoData MG 350
          </p>
        </div>
      </div>
    </>
  );
}
