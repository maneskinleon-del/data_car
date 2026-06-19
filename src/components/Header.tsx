import React from "react";
import { Menu, Radio } from "lucide-react";

interface HeaderProps {
  onMenuToggle: () => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function Header({ onMenuToggle, activeTab, onTabChange }: HeaderProps) {
  return (
    <header className="fixed top-0 z-50 w-full h-24 bg-[#0A0A0A]/90 backdrop-blur-xl border-b border-white/10 flex justify-between items-center px-6 md:px-12 transition-all">
      <div className="flex items-center gap-6">
        <button
          onClick={onMenuToggle}
          className="text-white hover:text-[#FF3D00] transition-colors cursor-pointer focus:outline-none p-1 rounded hover:bg-white/5 active:scale-95 duration-150"
          id="hamburger-btn"
          aria-label="Abrir Menú"
        >
          <Menu className="w-6 h-6" />
        </button>
        
        <div 
          onClick={() => onTabChange("garage")}
          className="flex flex-col cursor-pointer select-none active:scale-[0.98] transition-all group justify-center"
        >
          <span className="font-display text-lg md:text-xl font-extrabold tracking-[0.05em] text-white leading-none">
            AUTODATA
          </span>
          <span className="font-mono text-[9px] text-[#FF3D00] font-extrabold tracking-[0.1px] lowercase text-right pr-0.5 select-none leading-none mt-1 select-none">
            live_data
          </span>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <nav className="hidden md:flex items-center gap-8 mr-4">
          <button
            onClick={() => onTabChange("garage")}
            className={`font-mono text-[11px] font-bold tracking-[0.2em] uppercase transition-all duration-200 cursor-pointer pb-1 ${
              activeTab === "garage" 
                ? "text-white border-b-2 border-[#FF3D00]" 
                : "text-white/50 hover:text-white"
            }`}
          >
            Garaje
          </button>
          <button
            onClick={() => onTabChange("service")}
            className={`font-mono text-[11px] font-bold tracking-[0.2em] uppercase transition-all duration-200 cursor-pointer pb-1 ${
              activeTab === "service" 
                ? "text-white border-b-2 border-[#FF3D00]" 
                : "text-white/50 hover:text-white"
            }`}
          >
            Servicio
          </button>
          <button
            onClick={() => onTabChange("ai-assist")}
            className={`font-mono text-[11px] font-bold tracking-[0.2em] uppercase transition-all duration-200 cursor-pointer pb-1 ${
              activeTab === "ai-assist" 
                ? "text-white border-b-2 border-[#FF3D00]" 
                : "text-white/50 hover:text-white"
            }`}
          >
            Telemetría IA
          </button>
          <button
            onClick={() => onTabChange("metrics")}
            className={`font-mono text-[11px] font-bold tracking-[0.2em] uppercase transition-all duration-200 cursor-pointer pb-1 ${
              activeTab === "metrics" 
                ? "text-white border-b-2 border-[#FF3D00]" 
                : "text-white/50 hover:text-white"
            }`}
          >
            Métricas
          </button>
        </nav>

        {/* Live Active Satellite Link indicator */}
        <div className="flex items-center gap-2 px-4 py-1.5 bg-white/5 border border-white/10 skew-box select-none">
          <Radio className="w-3.5 h-3.5 text-[#FF3D00] animate-pulse" />
          <span className="font-mono text-[9px] text-[#F0F0F0] font-bold tracking-widest">MONITOR ACTIVO</span>
        </div>

        {/* Driver profile avatar with design border */}
        <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-[#FF3D00] shadow-[0_0_15px_rgba(255,61,0,0.3)] active:scale-95 transition-all">
          <img
            alt="Usuario"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuB0v-gXVQhIYsvH9eQM9MIN-uycF5vL-nIZOWGZlY5eR06f1URL1v1n31FUC_xhTwcZvmZPSnt1Cp2B1jWl3yIDz1BElRfxLjL5Uz3_wzATE0l4azJVoHK9y2coxJjeulY-XES6ByZBFc5bPRTxPPnLvBYlldI4WFLHtbYFQNeD_cwGKGe5_1R7AXVTYtxftlLVbRQrCqE9jJZOLAl3eUic0OcwAL8rf2TxrrEI6jun9NHA60VYtJqaxv5B51qabwnyoLt3Ds40pOQ"
          />
        </div>
      </div>
    </header>
  );
}
