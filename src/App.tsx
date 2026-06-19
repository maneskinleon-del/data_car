import React, { useState, useEffect, useRef } from "react";
import { 
  Car, 
  Wrench, 
  Cpu, 
  Settings2, 
  Zap, 
  AlertTriangle, 
  Send, 
  Paperclip, 
  Layers, 
  CheckCircle,
  Clock,
  Sparkles,
  Info,
  Sliders,
  ChevronDown,
  Download,
  Flame,
  FileSpreadsheet,
  User
} from "lucide-react";

import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import SpecForm from "./components/SpecForm";
import Tachometer from "./components/Tachometer";
import HistoryList from "./components/HistoryList";
import MaintenanceModal from "./components/MaintenanceModal";

import { VehicleSpecs, MaintenanceStatus, ServiceRecord, ChatMessage, TelemetryStats } from "./types";

export default function App() {
  const [activeTab, setActiveTab] = useState<string>("garage");
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  // 1. Core Vehicle Specs State
  const [specs, setSpecs] = useState<VehicleSpecs>({
    chassis: "#8829-XP",
    estadoActivo: true,
    aceiteMotor: "Aceite 5w/30 Premium Synthetic",
    filtroAceite: "Filtro Aceite Premium UJ-1797-X",
    transmision: "Mecánica",
    dimensionNeumaticos: "205/55 R16 Semi-Slicks",
    iluminacionPrincipal: "LED H4 Xenon White",
    plumillaL: '23" Silicon-Flex Premium (20mm)',
    alfombra: "Competición Custom 17x25",
    filtroAire: "Filtro de Alto Flujo 9x26cm",
    ultimoCambioKm: 79960
  });

  // 2. Telemetry and live metrics values
  const [telemetry, setTelemetry] = useState<TelemetryStats>({
    rpm: 6.4,
    maxRpm: 8.0,
    picoRpm: 6.4,
    marcha: 4,
    velocidad: 142,
    fuerzaG: 1.2,
    tempMotor: 92,
    consumoProm: 8.4,
    voltajeBateria: 14.2
  });

  // 3. Service Records with persistent LocalStorage
  const [records, setRecords] = useState<ServiceRecord[]>(() => {
    const saved = localStorage.getItem("scuderia_services");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return [
      {
        id: "rec_1",
        name: "Mantenimiento Mayor Pitlane",
        cost: 450.00,
        date: "12 NOV 2025",
        km: 45000,
        icon: "settings_suggest",
        colorType: "primary"
      },
      {
        id: "rec_2",
        name: "Cambio Aceite & Filtros",
        cost: 120.00,
        date: "05 SEP 2025",
        km: 40200,
        icon: "oil_barrel",
        colorType: "secondary"
      },
      {
        id: "rec_3",
        name: "Alineación y Balanceo Trackday",
        cost: 85.00,
        date: "22 JUN 2025",
        km: 35500,
        icon: "tire_repair",
        colorType: "neutral"
      },
      {
        id: "rec_4",
        name: "Revisión Eléctrica Completa ECU",
        cost: 150.00,
        date: "10 MAR 2025",
        km: 32000,
        icon: "settings_suggest",
        colorType: "neutral"
      }
    ];
  });

  useEffect(() => {
    localStorage.setItem("scuderia_services", JSON.stringify(records));
  }, [records]);

  // 4. Chat Thread logs / Conversational state for Asistente Copiloto IA
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "msg_init_sys",
      sender: "system",
      text: "[SYSTEM] Bienvenido, Racer One. He analizado la telemetría actual de tu MG 350s. Con 79,960 km, estamos entrando en una ventana de mantenimiento crítico. ¿En qué puedo asistirte hoy?",
      timestamp: "14:42:01"
    },
    {
      id: "msg_init_usr",
      sender: "user",
      text: "Analiza el código de error P0300 que apareció esta mañana en el panel.",
      timestamp: "14:42:15"
    },
    {
      id: "msg_init_diag",
      sender: "diagnosis",
      text: "[DIAGNÓSTICO_RÁPIDO]",
      timestamp: "14:42:20",
      diagnosticData: {
        code: "P0300",
        criticality: "Crítico",
        description: "Fallo de encendido en uno o más cilindros detectado. Esto puede provocar una pérdida notable de potencia, detonaciones e inestabilidad.",
        causes: ["Bujías y electrodos desgastados por pista", "Falla en bobinas de encendido", "Baja presión del riel de inyección"],
        action: "Evita conducir a altas revoluciones permanentes. Recomiendo que agendes una inspección correctiva en Pit Lane antes del siguiente trackday."
      }
    }
  ]);

  const [promptInput, setPromptInput] = useState<string>("");
  const [isAiTyping, setIsAiTyping] = useState<boolean>(false);
  const [autofillExplanation, setAutofillExplanation] = useState<string>("");
  const [isFormScanning, setIsFormScanning] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll terminal chat to bottom whenever a new message lands
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isAiTyping]);

  const triggerToast = (text: string) => {
    setToastMessage(text);
    setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

  // Helper adding scheduled records
  const handleAddRecord = (newRecord: ServiceRecord) => {
    setRecords([newRecord, ...records]);
    // update specs km log if the newly entered appointment km is larger
    if (newRecord.km > specs.ultimoCambioKm) {
      setSpecs(prev => ({
        ...prev,
        ultimoCambioKm: newRecord.km
      }));
    }
    triggerToast(`CITA "PITS - ${newRecord.name.toUpperCase()}" REGISTRADA CON ÉXITO.`);
  };

  const handleUpdateTelemetry = (updated: Partial<TelemetryStats>) => {
    setTelemetry(prev => ({ ...prev, ...updated }));
  };

  // Manual configuration save button click
  const [isSavingSpecs, setIsSavingSpecs] = useState(false);
  const handleSaveSpecs = () => {
    setIsSavingSpecs(true);
    setTimeout(() => {
      setIsSavingSpecs(false);
      triggerToast("FICHA TÉCNICA SINCRONIZADA E IMPORTADA SATISFACTORIAMENTE EN MÓDULO ECU.");
    }, 800);
  };

  // call server-side Gemini API on chat submit
  const handleSendPrompt = async (textToSend?: string) => {
    const rawText = textToSend || promptInput;
    if (!rawText.trim() || isAiTyping) return;

    if (!textToSend) setPromptInput("");

    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];

    const userMessage: ChatMessage = {
      id: "usr_" + Date.now(),
      sender: "user",
      text: rawText,
      timestamp: timeStr
    };

    setMessages(prev => [...prev, userMessage]);
    setIsAiTyping(true);

    try {
      // Build a minimalist history formatted for Gemini SDK Chat function parameters
      const apiHistory = messages.map(m => {
        // map diagnostic block to normal string as text summary
        let mText = m.text;
        if (m.sender === "diagnosis" && m.diagnosticData) {
          mText = `[DIAGNÓSTICO ${m.diagnosticData.code}] ${m.diagnosticData.description}. Recomendación: ${m.diagnosticData.action}`;
        }
        return {
          role: m.sender === "user" ? "user" : "model",
          parts: [{ text: mText }]
        };
      });

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: rawText,
          chatHistory: apiHistory
        })
      });

      if (!res.ok) throw new Error("Fallo en red de telemetría de IA.");

      const data = await res.json();
      
      const responseMessage: ChatMessage = {
        id: "ai_" + Date.now(),
        sender: "system",
        text: data.text,
        timestamp: new Date().toTimeString().split(' ')[0]
      };

      setMessages(prev => [...prev, responseMessage]);
    } catch (e: any) {
      console.error(e);
      // fallback simulation response on network error or offline mode
      const fallbackMsg: ChatMessage = {
        id: "ai_err_" + Date.now(),
        sender: "system",
        text: `[PIT_ASSIST_OFFLINE]: Copiloto en stand-by. Se analizaron bujías y encendido para tu auto MG 350s de 79,960 km. Se sugiere cambiar a aceite 5W-30 sintético de alto desempeño en el próximo taller de pista.`,
        timestamp: new Date().toTimeString().split(' ')[0]
      };
      setMessages(prev => [...prev, fallbackMsg]);
    } finally {
      setIsAiTyping(false);
    }
  };

  // trigger scanner backend simulation for auto-complete
  const handleAutofillSpecs = async (type: "invoice" | "manual") => {
    setIsFormScanning(true);
    setAutofillExplanation("");
    triggerToast(`ESCANEARDO COMPONENTES EN PIT LANE (${type === 'invoice' ? 'FACTURA' : 'AUTO-COMPLEMENTACIÓN'})`);

    try {
      const res = await fetch("/api/autofill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docType: type })
      });

      if (!res.ok) throw new Error("Error en autofill API");

      const serverRes = await res.json();
      if (serverRes.success && serverRes.data) {
        setSpecs(prev => ({
          ...prev,
          ...serverRes.data
        }));
        setAutofillExplanation(serverRes.explanation);
        triggerToast("ESPECIFICACIONES DE CARRERA DESBLOQUEADAS DE MANERA AUTOMÁTICA.");
      }
    } catch (e) {
      console.error(e);
      triggerToast("Fallo en enlace satelital. Ficha técnica restaurada de memoria caché.");
    } finally {
      setIsFormScanning(false);
    }
  };

  // Download simulation records as dynamic CSV file!
  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Tiempo,Evento,Valor\r\n";
    csvContent += `14:42:01,Pico de Presión de Turbo,1.8 bar\r\n`;
    csvContent += `14:38:55,Temperatura de Frenos (Del.),340°C\r\n`;
    csvContent += `14:35:12,Cambio de Marcha (Downshift),3rd -> 2nd\r\n`;
    csvContent += `14:31:05,Re-mapeo Turbocompresor Activo (Stage 2),${telemetry.picoRpm.toFixed(1)}K RPM alcanzados\r\n`;
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `telemetria_MG_chasis_8829_XP.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerToast("REGISTROS DE TELEMETRÍA EXPORTADOS CON ÉXITO.");
  };

  return (
    <div className="bg-[#0A0A0A] min-h-screen relative text-[#F0F0F0] pb-24 md:pb-8">
      
      {/* Dynamic Top Navigator Header bar */}
      <Header 
        onMenuToggle={() => setIsSidebarOpen(true)} 
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          // Auto-trigger smooth scroll reset
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />

      {/* Slide Navigation Drawer */}
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
        onTabChange={(tab) => {
          setActiveTab(tab);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />

      {/* Toast Alert overlay */}
      {toastMessage && (
        <div className="fixed top-24 right-6 z-[120] accent-gradient text-white p-4.5 font-mono text-xs font-extrabold skew-box shadow-[0_12px_40px_rgba(255,61,0,0.4)] border border-white/10 flex items-center gap-3 animate-[slideIn_0.3s_ease]">
          <Sparkles className="w-4 h-4 text-white animate-spin" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Panel view canvas frame */}
      <main className="pt-24 px-4 md:px-8 max-w-7xl mx-auto">
        
        {/* TAB 1: GARAJE / VEHICLE SPECIFICATIONS */}
        {activeTab === "garage" && (
          <div className="space-y-8 animate-[fadeIn_0.3s_ease]">
            
            {/* Upper profile identity section */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Profile Card block */}
              <div className="lg:col-span-8 glass-panel carbon-texture p-6 md:p-8 rounded-xl flex flex-col md:flex-row items-center gap-6 md:gap-8 border-l-4 border-[#FF3D00] relative overflow-hidden">
                
                {/* Visual Accent Overlay */}
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-gradient-to-br from-[#FF3D00]/10 to-transparent rounded-full blur-xl pointer-events-none" />

                <div className="relative w-full md:w-80 aspect-[16/9] flex-shrink-0 bg-[#0C0C0C] ring-4 ring-white/5 rounded-xl overflow-hidden shadow-inner skew-box flex flex-col items-center justify-center border border-white/5 group">
                  {/* Subtle Technical Grid Lines */}
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:16px_16px]" />
                  
                  {/* Car SVG Blueprint */}
                  <svg viewBox="0 0 200 100" className="w-full h-4/5 p-2 text-white/30 group-hover:text-white/45 transition-colors relative z-10" fill="none" stroke="currentColor" strokeWidth="1.2">
                    {/* Sleek sedan body */}
                    <path d="M15 62 h22 a13 13 0 0 1 26 0 h74 a13 13 0 0 1 26 0 h22 v-12 c0-5-5-10-15-12 l-22-9 c-5-2-15-5-25-5 h-38 c-10 0-25 3-30 6 L23 48 c-10 4-10 10-10 14 z" className="stroke-white/20 group-hover:stroke-white/40 transition-colors" />
                    {/* Windshield / Windows */}
                    <path d="M85 30 L115 30 L132 45 L85 45 Z" className="fill-white/5 stroke-white/20" />
                    <path d="M80 30 L54 45 H80 Z" className="fill-white/5 stroke-white/20" />
                    {/* Ground reference line */}
                    <line x1="5" y1="75" x2="195" y2="75" stroke="rgba(255,255,255,0.07)" strokeDasharray="3 3" />
                    
                    {/* Glow indicators for active parts */}
                    {/* Wheel Delantero */}
                    <circle cx="48" cy="62" r="13" className="stroke-[#FF3D00] fill-black/80" />
                    <circle cx="48" cy="62" r="5" className="fill-[#FF3D00]/80 animate-ping" />
                    <circle cx="48" cy="62" r="3" className="fill-[#FF3D00]" />
                    
                    {/* Wheel Trasero */}
                    <circle cx="148" cy="62" r="13" className="stroke-[#FF3D00] fill-black/80" />
                    <circle cx="148" cy="62" r="3" className="fill-[#FF3D00]" />
                    
                    {/* Motor bay sensor */}
                    <circle cx="28" cy="46" r="3" className="fill-[#FF8A00] animate-pulse" />
                    
                    {/* Spoiler / Air intake */}
                    <path d="M180 38 h10 v4 h-10 z" className="stroke-white/30" />
                  </svg>

                  {/* Tech schematic labels overlay */}
                  <div className="absolute inset-0 flex flex-col justify-between p-2 z-20 pointer-events-none select-none">
                    <div className="flex justify-between font-mono text-[8px] text-[#FF8A00] tracking-widest uppercase">
                      <span>[DIAGNÓSTICO_ACTIVO]</span>
                      <span className="animate-pulse">SYS_READY_V2</span>
                    </div>
                    
                    {/* Interactive label buttons to trigger toast info */}
                    <div className="flex justify-around w-full pointer-events-auto mt-auto mb-1">
                      <button 
                        type="button"
                        onClick={() => triggerToast("MOTOR: Bloque 1.5L L4 VTi // Competición STG 2 completada")}
                        className="px-1.5 py-0.5 bg-black/90 hover:bg-[#FF3D00]/20 hover:text-white transition-all text-white/50 border border-white/10 rounded font-mono text-[7px] font-black uppercase tracking-widest cursor-pointer"
                      >
                        [MOTOR]
                      </button>
                      <button 
                        type="button"
                        onClick={() => triggerToast("FRENOS: Delanteros 45% Vida sugerida // Alta fricción de pista")}
                        className="px-1.5 py-0.5 bg-black/90 hover:bg-[#FF3D00]/20 hover:text-white transition-all text-white/50 border border-white/10 rounded font-mono text-[7px] font-black uppercase tracking-widest cursor-pointer"
                      >
                        [FRENOS]
                      </button>
                      <button 
                        type="button"
                        onClick={() => triggerToast("SENSORES: Plumilla 23\" Silicon-Flex // Enlace nominal OBD-II")}
                        className="px-1.5 py-0.5 bg-black/90 hover:bg-[#FF3D00]/20 hover:text-white transition-all text-white/50 border border-white/10 rounded font-mono text-[7px] font-black uppercase tracking-widest cursor-pointer"
                      >
                        [SISTEMA]
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex-grow text-center md:text-left specify-grid select-none z-10">
                  <div className="inline-flex items-center space-x-2 text-[#FF3D00] font-mono text-[9px] uppercase tracking-[0.3em] font-extrabold mb-1">
                    <span className="w-5 h-[1px] bg-[#FF3D00]"></span>
                    <span>GARAGE ACTIVO</span>
                  </div>
                  <h1 className="font-display text-4xl md:text-5xl font-black text-white leading-none tracking-tighter mt-1 mb-4 uppercase">
                    MG 350s<span className="text-transparent" style={{ webkitTextStroke: "1px #F0F0F0" }}> Sedan.</span>
                  </h1>
                  
                  <div className="flex flex-wrap justify-center md:justify-start gap-3">
                    <span className="px-3.5 py-1.5 bg-[#FF3D00] text-white font-mono text-[10px] font-extrabold flex items-center gap-1.5 rounded-sm skew-box shadow-[0_4px_15px_rgba(255,61,0,0.3)]">
                      <Layers className="w-3.5 h-3.5" /> 
                      CHASIS: {specs.chassis}
                    </span>
                    <span className="px-3.5 py-1.5 bg-gradient-to-r from-[#FF3D00] to-[#FF8A00] text-white font-mono text-[10px] font-extrabold flex items-center gap-1.5 rounded-sm skew-box shadow-[0_4px_15px_rgba(255,138,0,0.3)]">
                      <Zap className="w-3.5 h-3.5 animate-pulse" /> 
                      ESTADO NOMINAL
                    </span>
                  </div>
                  <p className="font-mono text-[10px] text-white/50 mt-6 uppercase tracking-[0.25em] font-black">
                    FICHA TÉCNICA DE ALTO RENDIMIENTO (STG 2)
                  </p>
                </div>
              </div>

              {/* AI Quick actions side panel */}
              <div className="lg:col-span-4 glass-panel p-6 rounded-xl bg-gradient-to-br from-[#121212] to-[#0A0A0A] border-r-4 border-[#FF8A00] flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-[#FF8A00]/5 to-transparent pointer-events-none" />
                
                <div className="flex items-center gap-3 mb-4 select-none">
                  <div className="w-10 h-10 rounded-full bg-[#FF8A00]/10 flex items-center justify-center border border-[#FF8A00]/20">
                    <Cpu className="w-5 h-5 text-[#FF8A00]" />
                  </div>
                  <div>
                    <h2 className="font-display font-black text-white text-md uppercase tracking-wider">Copiloto AI</h2>
                    <span className="font-mono text-[9px] text-[#FF8A00] tracking-widest block font-bold leading-none mt-0.5">MG ENGINE NOMINAL</span>
                  </div>
                </div>

                <div className="space-y-3 relative z-10">
                  <button 
                    type="button"
                    onClick={() => handleAutofillSpecs("invoice")}
                    disabled={isFormScanning}
                    className="w-full text-left p-4.5 bg-white/2 hover:bg-white/5 border border-white/5 hover:border-[#FF3D00] transition-all flex items-center justify-between group active:scale-[0.98] cursor-pointer disabled:opacity-50"
                  >
                    <div className="font-mono text-[9.5px] font-bold tracking-wider text-white/70 group-hover:text-white uppercase">
                      {isFormScanning ? "PROCESANDO PIT PASS..." : "ESCANEAR FACTURA AUTOMOCIÓN"}
                    </div>
                    <Sliders className="w-4 h-4 text-[#FF3D00] group-hover:rotate-45 transition-transform" />
                  </button>

                  <button 
                    type="button"
                    onClick={() => handleAutofillSpecs("manual")}
                    disabled={isFormScanning}
                    className="w-full text-left p-4.5 bg-white/2 hover:bg-white/5 border border-white/5 hover:border-[#FF3D00] transition-all flex items-center justify-between group active:scale-[0.98] cursor-pointer disabled:opacity-50"
                  >
                    <div className="font-mono text-[9.5px] font-bold tracking-wider text-white/70 group-hover:text-white uppercase">
                      {isFormScanning ? "PROCESANDO DATOS..." : "AUTOCOMPLETAR FICHA MÓDULO"}
                    </div>
                    <Sparkles className="w-4 h-4 text-[#FF8A00] animate-bounce" />
                  </button>
                </div>

                {autofillExplanation && (
                  <div className="mt-4 p-3 bg-black border border-[#FF3D00]/20 rounded text-[10px] font-mono text-white/60">
                    <p className="text-[#FF3D00] font-black uppercase tracking-wider mb-1">MÓDULO EXPLICACIÓN:</p>
                    {autofillExplanation}
                  </div>
                )}
              </div>

            </div>

            {/* Specefication Forms and fields components */}
            <SpecForm 
              specs={specs} 
              onUpdateSpecs={(newSpecs) => setSpecs(prev => ({ ...prev, ...newSpecs }))}
              onSave={handleSaveSpecs}
              onNavigateToAi={() => {
                setActiveTab("ai-assist");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              isSaving={isSavingSpecs}
            />

            {/* Decorative satellite background spinning graphic */}
            <div className="fixed bottom-24 right-8 opacity-10 hidden lg:block pointer-events-none select-none">
              <div className="flex flex-col gap-4 items-center">
                <div className="w-24 h-24 rounded-full border-4 border-dashed border-[#FF3D00] animate-[spin_30s_linear_infinite]" />
                <div className="font-mono text-[9px] text-[#FF3D00] tracking-[0.4em] uppercase font-black">ENLACE NOMINAL</div>
              </div>
            </div>

          </div>
        )}

        {/* TAB 2: SERVICIO / PIT-STOP LOGS */}
        {activeTab === "service" && (
          <div className="space-y-8 animate-[fadeIn_0.3s_ease]">
            
            {/* Upper overlap banner screen 2 */}
            <section className="glass-panel rounded-xl overflow-hidden relative min-h-[250px] flex flex-col justify-end p-6 md:p-8 shadow-[0_10px_35px_rgba(0,0,0,0.8)]">
              <div className="absolute inset-0 z-0">
                <img 
                  alt="Track Sedan"
                  className="w-full h-full object-cover opacity-45 filter scale-105 contrast-125"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuCZA_6SCq0CPqeDQycFtuncFGAIZkeFs-9422MzZcw8DlPkpPheyxWb4mSFrfa3AwIWyDJsvaAkBbM8Ku1EyGb44Y0w_wxnZdkaYP3GFXTs7SG6fEvC8ORaVGYRS6SSVIDTFg02T9_98EyRER80c_EiE7XHUHyv5dxa8ju1aRX0ruAZx3Utb9z-bkMEFWyjXAx1aBi0QdYWogFVj7Oxbbacogu5fcU9z-pOPiUi6arb1rkXrJ56bPA7CUNJJ6Iusm0wWNjdrNs1WhA"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0e0e0e] via-transparent to-transparent" />
              </div>

              <div className="relative z-10 select-none">
                <div className="flex items-center gap-2 mb-2">
                  <span className="accent-gradient text-white text-[9px] font-mono font-extrabold px-3 py-0.5 rounded tracking-widest uppercase shadow-[0_2px_15px_rgba(255,61,0,0.4)] skew-box">
                    ESTATUS: OPTIMIZADO
                  </span>
                </div>
                <h2 className="font-display text-4xl md:text-5xl font-black text-white mb-2 tracking-tighter uppercase whitespace-pre-wrap">
                  MG 350s<span className="text-transparent" style={{ WebkitTextStroke: "1px #F0F0F0", webkitTextStroke: "1px #F0F0F0" }}> Configurado.</span>
                </h2>
                <p className="font-mono text-xs text-gray-300 font-bold uppercase tracking-widest">
                  CONFIGURACIÓN DE COMPETICIÓN DISPONIBLE (STAGE 2)
                </p>
              </div>
            </section>

            {/* Core statistics cards */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Telemetry maintenance health bars */}
              <div className="lg:col-span-7 space-y-6">
                
                <div className="glass-panel p-6 rounded-xl border border-white/10 relative">
                  
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-2">
                      <Wrench className="w-5 h-5 text-[#FF3D00]" />
                      <h3 className="font-display font-black text-[#FF3D00] text-xs md:text-sm tracking-wider uppercase">
                        PRÓXIMOS MANTENIMIENTOS
                      </h3>
                    </div>
                    <span className="font-mono text-[10px] text-[#FF8A00] font-bold tracking-widest">
                      4,250 KM RESTANTES EN PISTA
                    </span>
                  </div>

                  <div className="space-y-6">
                    {/* Aceite Sintético progress bar */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-end font-mono">
                        <span className="text-gray-200 text-xs uppercase font-extrabold tracking-wider">
                          Vida del Aceite Sintético de Carreras
                        </span>
                        <span className="text-[#FF3D00] font-black text-xs">82%</span>
                      </div>
                      <div className="h-3 bg-black/50 rounded-full p-[1px] border border-white/5">
                        <div className="h-full bg-gradient-to-r from-[#FF3D00] to-red-700 rounded-full shadow-[0_0_10px_rgba(255,61,0,0.4)]" style={{ width: "82%" }} />
                      </div>
                    </div>

                    {/* Desgaste de Pastillas progress bar */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-end font-mono">
                        <span className="text-gray-200 text-xs uppercase font-extrabold tracking-wider">
                          Vida Util de Pastillas de Freno (Del.)
                        </span>
                        <span className="text-[#FF8A00] font-black text-xs">45%</span>
                      </div>
                      <div className="h-3 bg-black/50 rounded-full p-[1px] border border-white/5">
                        <div className="h-full bg-gradient-to-r from-[#FF8A00] to-yellow-600 rounded-full shadow-[0_0_10px_rgba(255,138,0,0.4)]" style={{ width: "45%" }} />
                      </div>
                    </div>

                    {/* Presión crítica alert */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-end font-mono">
                        <span className="text-gray-200 text-xs uppercase font-extrabold tracking-wider flex items-center gap-1.5 text-red-400">
                          <AlertTriangle className="w-4.5 h-4.5 text-red-500 animate-bounce" />
                          Presión y Rotación Neumáticos (COMP)
                        </span>
                        <span className="text-red-500 font-black text-xs animate-pulse">12%</span>
                      </div>
                      <div className="h-3 bg-black/50 rounded-full p-[1px] border border-white/5">
                        <div className="h-full bg-red-600 rounded-full animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]" style={{ width: "12%" }} />
                      </div>
                      <p className="font-mono text-[9px] text-red-400 tracking-wider font-black uppercase mt-1">
                        REVISIÓN CRÍTICA DE PIT DE CARACTER URGENTE
                      </p>
                    </div>

                  </div>
                </div>
              </div>


              {/* History list component */}
              <div className="lg:col-span-5">
                <HistoryList records={records} />
              </div>

            </div>

          </div>
        )}

        {/* TAB 3: ASISTENTE AI TERMINAL */}
        {activeTab === "ai-assist" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-[fadeIn_0.3s_ease]">
            
            {/* Recommendations sidebar */}
            <aside className="lg:col-span-4 space-y-6">
              
              <section className="glass-panel p-6 rounded-xl border border-white/10 relative overflow-hidden shadow-[0_0_35px_rgba(255,61,0,0.18)]">
                
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/10">
                  <Sparkles className="w-5 h-5 text-[#FF8A00] animate-pulse" />
                  <h2 className="font-display font-black text-white text-sm uppercase tracking-wider">AI Recomendaciones</h2>
                </div>

                <div className="space-y-4 font-mono text-xs">
                  
                  {/* Rec 1 */}
                  <div className="p-4 bg-white/2 border-l-4 border-[#FF3D00] rounded space-y-1.5 hover:bg-white/5 transition-all">
                    <div className="flex justify-between font-black uppercase text-[10px]">
                      <span className="text-[#FF3D00]">Servicio Mayor</span>
                      <span className="text-white/40">79,960 Kms</span>
                    </div>
                    <p className="text-white/70 text-xs">Próximo cambio de correa de distribución sugerido a las 80,000km. Agende inspección preventiva hoy en pits.</p>
                  </div>

                  {/* Rec 2 */}
                  <div className="p-4 bg-white/2 border-l-4 border-[#FF8A00] rounded space-y-1.5 hover:bg-white/5 transition-all">
                    <div className="flex justify-between font-black uppercase text-[10px]">
                      <span className="text-[#FF8A00]">EFICIENCIA DE FRENADO</span>
                      <span className="text-white/40 font-bold">12% Presión</span>
                    </div>
                    <p className="text-white/70 text-xs">Pastillas delanteras comprometidas. Desgaste detectado superior al promedio por conducción deportiva.</p>
                  </div>

                  {/* Rec 3 */}
                  <div className="p-4 bg-white/2 border-l-4 border-indigo-400 rounded space-y-1.5 hover:bg-white/5 transition-all">
                    <div className="flex justify-between font-black uppercase text-[10px]">
                      <span className="text-indigo-400">OPTIMIZACIÓN STAGE 2</span>
                      <span className="text-white/40 font-bold">Cilindros</span>
                    </div>
                    <p className="text-white/70 text-xs">Nivel de refrigerante detectado bajo. Rellene para mantener temperatura óptima en altas de pista.</p>
                  </div>

                </div>

                <button 
                  onClick={() => setIsModalOpen(true)}
                  className="w-full mt-6 py-4 bg-gradient-to-r from-[#FF3D00] to-[#FF8A00] text-white font-display text-xs font-bold rounded uppercase tracking-widest hover:brightness-110 active:scale-95 duration-150 shadow-lg cursor-pointer skew-box"
                >
                  <span className="inline-block -skew-x-[-8deg] skew-x-[8deg]">AGENDAR SERVICIO</span>
                </button>

              </section>

              {/* Quick test buttons */}
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => {
                    handleAutofillSpecs("invoice");
                    setActiveTab("garage");
                  }}
                  className="glass-panel p-5 rounded-xl border border-white/5 flex flex-col items-center text-center hover:bg-white/5 transition-all text-gray-300 group cursor-pointer"
                >
                  <div className="w-12 h-12 bg-white/5 rounded-full border border-white/10 flex items-center justify-center mb-3 group-hover:bg-[#ff5638] group-hover:border-transparent group-hover:text-black transition-colors">
                    <Cpu className="w-5 h-5 text-gray-300 group-hover:text-black" />
                  </div>
                  <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-white">Escaneo Docs</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleSendPrompt("Ejecuta un diagnóstico completo del sistema del motor y revisa parámetros.");
                  }}
                  className="glass-panel p-5 rounded-xl border border-white/5 flex flex-col items-center text-center hover:bg-white/5 transition-all text-gray-300 group cursor-pointer"
                >
                  <div className="w-12 h-12 bg-white/5 rounded-full border border-white/10 flex items-center justify-center mb-3 group-hover:bg-[#ff5638] group-hover:border-transparent group-hover:text-black transition-colors">
                    <AlertTriangle className="w-5 h-5 text-gray-300 group-hover:text-black" />
                  </div>
                  <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-white">Diagnóstico</span>
                </button>
              </div>

            </aside>

            {/* Chat Terminal representation */}
            <section className="lg:col-span-8 flex flex-col">
              
              <div className="glass-panel rounded-xl h-[600px] flex flex-col border border-white/10 relative overflow-hidden shadow-2xl">
                
                {/* terminal Top Header indicator block */}
                <div className="bg-[#0E0E0E] p-4 flex items-center justify-between border-b border-white/10 select-none">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#FF3D00] shadow-[0_0_8px_#FF3D00]" />
                      <div className="w-2.5 h-2.5 rounded-full bg-[#FF8A00]" />
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                    </div>
                    <span className="font-mono text-[9.5px] text-gray-400 uppercase tracking-widest font-black font-semibold">
                      SISTEMA AI COPILOTO: ACTIVO // MONOLITH_STG_2
                    </span>
                  </div>

                  <div className="font-mono text-[9px] text-[#FF3D00] bg-black px-2.5 py-1 rounded border border-white/5 uppercase font-bold tracking-widest">
                    LATENCY: 14MS
                  </div>
                </div>

                {/* Interactive chats logs canvas */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-black/10">
                  
                  {messages.map((m) => {
                    if (m.sender === "diagnosis" && m.diagnosticData) {
                      // Diagnostic UI panel (Error codes etc.)
                      return (
                        <div key={m.id} className="flex gap-4 max-w-[90%] md:max-w-[80%] animate-[fadeIn_0.2s_ease]">
                          <div className="w-8 h-8 rounded bg-[#FF3D00] text-white flex items-center justify-center shrink-0 shadow-[0_0_10px_rgba(255,61,0,0.4)]">
                            <Cpu className="w-4 h-4" />
                          </div>
                          
                          <div className="w-full bg-[#121212]/90 border border-white/10 rounded-r-xl rounded-bl-xl p-5 relative overflow-hidden">
                            
                            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                              <AlertTriangle className="w-16 h-16 text-[#FF3D00]" />
                            </div>

                            <p className="font-mono text-[#FF3D00] text-[10px] font-black uppercase tracking-widest">
                              [SISTEMA_COMPETICIÓN_DIAGNÓSTICO_RÁPIDO]
                            </p>

                            <div className="carbon-texture border border-white/10 rounded-lg p-4 mt-3 space-y-4">
                              
                              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                                <span className="font-mono text-xs text-[#FF8A00] font-black">
                                  CODIGO OBD-II: {m.diagnosticData.code}
                                </span>
                                <span className="px-2 py-0.5 bg-red-600/20 text-red-400 border border-red-500/20 font-mono text-[8px] font-bold rounded uppercase">
                                  {m.diagnosticData.criticality}
                                </span>
                              </div>

                              <p className="font-mono text-[11px] text-gray-200 leading-relaxed">
                                &quot;{m.diagnosticData.description}&quot;
                              </p>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 text-[10px] font-mono">
                                <div className="p-3 bg-black/30 border border-white/5 rounded">
                                  <p className="text-gray-400 font-bold uppercase mb-1">CAUSAS PROBABLES EN TRACK</p>
                                  <ul className="list-disc list-inside space-y-0.5 text-gray-200">
                                    {m.diagnosticData.causes.map((cause, idx) => (
                                      <li key={idx}>{cause}</li>
                                    ))}
                                  </ul>
                                </div>
                                <div className="p-3 bg-black/30 border border-white/5 rounded">
                                  <p className="text-gray-400 font-bold uppercase mb-1">RECOMENDACIÓN</p>
                                  <p className="text-[#FF8A00]">{m.diagnosticData.action}</p>
                                </div>
                              </div>

                            </div>

                            <p className="font-mono text-gray-400 text-[10px] mt-4">
                              ¿Deseas buscar fichas técnicas de bujías o bobinas en manuales para el MG 350s?
                            </p>
                          </div>
                        </div>
                      );
                    }

                    const isUser = m.sender === "user";

                    return (
                      <div 
                        key={m.id} 
                        className={`flex gap-3 max-w-[85%] ${isUser ? "ml-auto flex-row-reverse" : "mr-auto"} animate-[fadeIn_0.2s_ease]`}
                      >
                        {/* icon block */}
                        <div className={`w-8 h-8 rounded flex items-center justify-center shrink-0 border ${
                          isUser 
                            ? "bg-white/5 border-white/10 text-gray-300"
                            : "bg-[#FF3D00] border-transparent text-white shadow-[0_0_10px_rgba(255,61,0,0.3)]"
                        }`}>
                          {isUser ? <User className="w-4 h-4" /> : <Cpu className="w-4 h-4" />}
                        </div>

                        {/* Speech card block */}
                        <div className={`p-4 rounded-b-xl border font-mono text-xs ${
                          isUser
                            ? "bg-[#FF3D00]/5 border-[#FF3D00]/20 text-right rounded-tl-xl text-white"
                            : "bg-white/2 border-white/5 rounded-tr-xl text-gray-200"
                        }`}>
                          {/* Format prompt prefixes tags */}
                          <span className={`text-[9px] font-black block mb-1 uppercase tracking-wider ${
                            isUser ? "text-gray-400" : "text-[#FF3D00]"
                          }`}>
                            {isUser ? "[RACER_ONE]" : "[COPILOTO_MG]"} {m.timestamp}
                          </span>
                          <p className="leading-relaxed whitespace-pre-wrap">{m.text}</p>
                        </div>
                      </div>
                    );
                  })}

                  {/* typing loader overlay active state */}
                  {isAiTyping && (
                    <div className="flex gap-4 max-w-[80%]">
                      <div className="w-8 h-8 rounded bg-[#FF3D00] text-white flex items-center justify-center shrink-0 shadow-[0_0_10px_#FF3D00]">
                        <Cpu className="w-4 h-4 animate-spin" />
                      </div>
                      <div className="bg-[#121212]/90 p-4 border border-white/5 rounded-tr-xl rounded-b-xl text-xs font-mono text-gray-400 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#FF3D00] animate-ping" />
                        <span>ANALIZANDO SENSOR ECU...</span>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Input box */}
                <div className="p-5 border-t border-white/10 bg-[#0E0E0E]">
                  
                  <form 
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSendPrompt();
                    }}
                    className="relative"
                  >
                    <input
                      type="text"
                      value={promptInput}
                      onChange={(e) => setPromptInput(e.target.value)}
                      placeholder="Escribe un comando o consulta a la IA (p. ej. P0300, Aceite)..."
                      className="w-full bg-[#050505] border border-white/10 focus:border-[#FF3D00] focus:ring-1 focus:ring-[#FF3D00] rounded py-5 pl-6 pr-24 text-white placeholder:text-gray-600 font-mono text-xs outline-none transition-all"
                    />

                    <div className="absolute right-2.5 top-2.5 bottom-2.5 flex items-center gap-1">
                      <button 
                        type="button"
                        onClick={() => triggerToast("Función adjuntar log binario o screenshot de ECU activa.")}
                        className="p-2 text-gray-500 hover:text-white transition-colors hover:bg-white/5 rounded-lg"
                        title="Adjuntar Documento"
                      >
                        <Paperclip className="w-4.5 h-4.5" />
                      </button>
                      <button
                        type="submit"
                        className="bg-gradient-to-r from-[#FF3D00] to-[#FF8A00] text-white hover:brightness-110 font-bold p-3 px-5 rounded skew-box active:scale-95 transition-all outline-none cursor-pointer"
                      >
                        <Send className="w-4 h-4 fill-white -skew-x-[-8deg] skew-x-[8deg]" />
                      </button>
                    </div>

                  </form>

                  <div className="flex gap-4 mt-3">
                    <span className="text-[10px] text-gray-500 flex items-center gap-1.5 select-none font-mono">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                      AI ENGINE 4.0 ONLINE
                    </span>
                    <span className="text-[10px] text-gray-500 flex items-center gap-1 select-none font-mono">
                      MODE: TELEMETRÍA PREDICTIVA
                    </span>
                  </div>

                </div>

              </div>

            </section>

          </div>
        )}

        {/* TAB 4: METRICAS Y TELEMETRIA */}
        {activeTab === "metrics" && (
          <div className="space-y-6 animate-[fadeIn_0.3s_ease]">
            
            {/* Upper profile header info panel */}
            <div className="flex flex-col md:flex-row md:items-end justify-between pb-4 border-b border-white/5 gap-4">
              <div className="select-none">
                <span className="text-[#FF8A00] font-mono text-[9px] uppercase tracking-[0.3em] font-extrabold block">
                  SISTEMA MG 350s TELEMETRÍA DE COMPETICIÓN
                </span>
                <h2 className="font-display text-2xl md:text-4xl font-black text-white uppercase italic mt-1 leading-none tracking-tighter">
                  Métricas de Rendimiento Escalonado
                </h2>
              </div>

              <div className="flex items-center gap-2.5 px-4 py-2 bg-gradient-to-r from-black to-[#181818] rounded-xl border border-white/10 self-start">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-ping" />
                <span className="font-mono text-[10px] text-gray-300 font-bold tracking-widest uppercase">
                  ESTADO SATELITAL: EN LÍNEA
                </span>
              </div>
            </div>

            {/* Dashboard Telemetrys grid columns layout */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              
              {/* Core Tachometer Dial display */}
              <div className="md:col-span-6 lg:col-span-5">
                <Tachometer stats={telemetry} onUpdateStats={handleUpdateTelemetry} />
              </div>

              {/* Auxiliary telemetry grids block */}
              <div className="md:col-span-6 lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-6">
                
                {/* Temp Motor indicator card */}
                <div className="glass-panel rounded-xl p-6 flex flex-col justify-between border-l-4 border-[#FF8A00]">
                  <div className="flex justify-between items-start font-mono text-xs">
                    <span className="p-2.5 rounded bg-[#FF8A00]/10 border border-[#FF8A00]/15 text-[#FF8A00]">
                      <Flame className="w-5 h-5" />
                    </span>
                    <span className="text-gray-400 font-bold uppercase tracking-wider">TEMP. MOTOR DE CARRERA</span>
                  </div>
                  <div className="mt-6 select-none">
                    <h3 className="font-display text-3xl font-black text-white italic tracking-tighter uppercase">
                      {telemetry.tempMotor}°C
                    </h3>
                    <div className="w-full bg-white/5 h-2 mt-2.5 rounded-full overflow-hidden border border-white/5">
                      <div className="bg-[#FF8A00] h-full rounded-full shadow-[0_0_10px_rgba(255,138,0,0.5)]" style={{ width: "75%" }} />
                    </div>
                    <p className="font-mono text-[10px] text-green-400 uppercase tracking-wide mt-2 font-black">
                      Rango Óptimo Estándar (Trackday)
                    </p>
                  </div>
                </div>

                {/* Avg Fuel limits indicator card */}
                <div className="glass-panel rounded-xl p-6 flex flex-col justify-between border-l-4 border-[#FF3D00]">
                  <div className="flex justify-between items-start font-mono text-xs">
                    <span className="p-2.5 rounded bg-[#FF3D00]/10 border border-[#FF3D00]/15 text-[#FF3D00]">
                      <Sliders className="w-5 h-5 animate-spin" />
                    </span>
                    <span className="text-gray-400 font-bold uppercase tracking-wider">CONSUMO ESTIMADO PROMEDIO</span>
                  </div>
                  <div className="mt-6 select-none">
                    <h3 className="font-display text-3xl font-black text-white italic tracking-tighter uppercase">
                      {telemetry.consumoProm} <span className="font-mono text-xs text-gray-500 font-normal">L/100km</span>
                    </h3>
                    <div className="w-full bg-white/5 h-2 mt-2.5 rounded-full overflow-hidden border border-white/5">
                      <div className="bg-[#FF3D00] h-full rounded-full shadow-[0_0_10px_rgba(255,61,0,0.5)]" style={{ width: "45%" }} />
                    </div>
                    <p className="font-mono text-[10px] text-gray-400 uppercase mt-2">
                      EFICIENCIA DE PISTA NOMINAL
                    </p>
                  </div>
                </div>

                {/* Battery voltage tracker indicator card */}
                <div className="glass-panel rounded-xl p-6 flex flex-col justify-between border-l-4 border-gray-400">
                  <div className="flex justify-between items-start font-mono text-xs">
                    <span className="p-2.5 rounded bg-white/5 border border-white/10 text-gray-300">
                      <Zap className="w-5 h-5 fill-none" />
                    </span>
                    <span className="text-gray-400 font-bold uppercase tracking-wider">VOLTAJE BATERÍA DE LITIO</span>
                  </div>
                  <div className="mt-6 select-none">
                    <h3 className="font-headline text-3xl font-black text-white italic tracking-tighter">
                      {telemetry.voltajeBateria}V
                    </h3>
                    <div className="flex items-center gap-1.5 mt-3">
                      <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                      <span className="font-mono text-[10px] text-gray-300 font-bold uppercase">CARGA ALTERNADOR NOMINAL ACTIVA</span>
                    </div>
                  </div>
                </div>

                {/* Weekly historical performance mini bar graph */}
                <div className="glass-panel rounded-xl p-6 border border-white/10 flex flex-col justify-between">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-mono text-[10px] text-white font-black uppercase tracking-wider">HISTÓRICO SEMANAL VELOCIDADES</h4>
                    <Sliders className="w-4 h-4 text-gray-500" />
                  </div>
                  
                  {/* Dynamic interactive bars */}
                  <div className="flex items-end justify-between h-20 gap-1.5 font-display">
                    <div className="w-full bg-[#FF3D00]/20 hover:bg-[#FF3D00]/80 rounded h-[38%] transition-all duration-150 cursor-pointer" title="Lun: 120km/h" />
                    <div className="w-full bg-[#FF3D00]/20 hover:bg-[#FF3D00]/80 rounded h-[62%] transition-all duration-150 cursor-pointer" title="Mar: 140km/h" />
                    <div className="w-full bg-[#FF3D00]/20 hover:bg-[#FF3D00]/80 rounded h-[50%] transition-all duration-150 cursor-pointer" title="Mie: 130km/h" />
                    <div className="w-full bg-[#FF3D00]/20 hover:bg-[#FF3D00]/80 rounded h-[85%] transition-all duration-150 cursor-pointer" title="Jue: 155km/h" />
                    <div className="w-full bg-[#FF3D00]/20 hover:bg-[#FF3D00]/80 rounded h-[70%] transition-all duration-150 cursor-pointer" title="Vie: 145km/h" />
                    <div className="w-full bg-[#FF8A00]/40 hover:bg-[#FF8A00]/90 rounded h-[92%] transition-all duration-150 cursor-pointer" title="Sab: 160km/h" />
                    <div className="w-full bg-[#FF3D00] rounded h-[60%] border-t-2 border-white/20 shadow-[0_4px_15px_rgba(255,61,0,0.5)] transition-all duration-150 cursor-pointer" title="Hoy: Actual" />
                  </div>

                  <div className="flex justify-between mt-2 font-mono text-[9px] text-gray-500 font-bold">
                    <span>LUN</span><span>MAR</span><span>MIE</span><span>JUE</span><span>VIE</span><span>SAB</span><span className="text-[#FF3D00] font-black">HOY</span>
                  </div>
                </div>

              </div>
            </div>

            {/* Detailed diagnostics logs table list */}
            <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              <div className="lg:col-span-8 glass-panel rounded-xl overflow-hidden border border-white/10">
                
                <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-white/2 select-none">
                  <h3 className="font-display font-black text-white text-xs uppercase tracking-wider">
                    Registros de Sesión de Competición
                  </h3>
                  <button 
                    onClick={handleExportCSV}
                    className="text-[#FF3D00] hover:text-white font-mono text-[10px] font-bold uppercase flex items-center gap-1.5 cursor-pointer hover:underline"
                  >
                    Exportar Registros <Download className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="overflow-x-auto text-xs font-mono">
                  <table className="w-full text-left">
                    <thead className="bg-[#050505] text-gray-400 border-b border-white/5 uppercase text-[9px] font-black">
                      <tr>
                        <th className="px-6 py-4">TIMESTAMP SENSOR</th>
                        <th className="px-6 py-4">EVENTO SENSORIZADO</th>
                        <th className="px-6 py-4 text-right">VALOR REGISTRADO</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-gray-200">
                      <tr className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 text-gray-400">14:42:01</td>
                        <td className="px-6 py-4 font-bold">Pico de Presión de Turbo (ECU stage 2)</td>
                        <td className="px-6 py-4 text-right text-[#FF8A00] font-black">1.8 bar</td>
                      </tr>
                      <tr className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 text-gray-400">14:38:55</td>
                        <td className="px-6 py-4 font-bold">Temperatura de Pastillas de Freno (Del.)</td>
                        <td className="px-6 py-4 text-right text-[#FF3D00] font-black">340°C</td>
                      </tr>
                      <tr className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 text-gray-400">14:35:12</td>
                        <td className="px-6 py-4 font-bold">Cambio de Marcha en Curva (Downshift)</td>
                        <td className="px-6 py-4 text-right text-gray-300">3rd → 2nd</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

              </div>

              {/* turbocharger photo block banner card */}
              <div className="lg:col-span-4 glass-panel rounded-xl overflow-hidden group border border-white/10 relative min-h-[220px]">
                
                <div className="absolute inset-0 z-10 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/40 to-transparent p-6 flex flex-col justify-end">
                  <span className="font-mono text-[#FF3D00] text-[9px] uppercase tracking-widest font-black block mb-0.5">MG OPTIMIZACIÓN</span>
                  <h4 className="font-display font-black text-white uppercase text-lg italic tracking-tight leading-none mb-1">
                    Optimización Scuderia
                  </h4>
                  <p className="text-gray-300 text-xs mt-1 leading-relaxed">
                    Desbloquea el mapa de inyección especial Stage 2 para sacarle el máximo partido al turbocompresor en pista.
                  </p>
                  
                  <button 
                    onClick={() => {
                      triggerToast("Modelo: Mishimoto Twin-Scroll Turbo // Presión Máxima: 2.1 bar // combustible: 100 octanos");
                    }}
                    className="mt-4 bg-gradient-to-r from-[#FF3D00] to-[#FF8A00] text-white px-5 py-3 font-mono text-[9px] font-black uppercase tracking-wider rounded skew-box self-start hover:brightness-110 active:scale-95 duration-150 transition-all cursor-pointer shadow-lg"
                  >
                    <span className="inline-block -skew-x-[-8deg] skew-x-[8deg]">VER DETALLES TÉCNICOS</span>
                  </button>
                </div>

                <div className="absolute inset-0 bg-[#0C0C0C]/90 flex flex-col items-center justify-center p-4">
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:12px_12px]" />
                  {/* Sleek blueprint wireframe of the turbocharger turbine */}
                  <svg viewBox="0 0 100 100" className="w-24 h-24 text-white/5 group-hover:text-[#FF3D00]/20 group-hover:scale-110 group-hover:rotate-45 transition-all duration-1000 relative z-0" fill="none" stroke="currentColor" strokeWidth="1">
                    <circle cx="50" cy="50" r="30" strokeDasharray="3 3" />
                    <circle cx="50" cy="50" r="20" />
                    <circle cx="50" cy="50" r="10" className="stroke-[#FF3D00] animate-pulse" />
                    {/* Turbine vanes */}
                    <line x1="50" y1="20" x2="50" y2="80" />
                    <line x1="20" y1="50" x2="80" y2="50" />
                    <line x1="29" y1="29" x2="71" y2="71" />
                    <line x1="29" y1="71" x2="71" y2="29" />
                  </svg>
                </div>

              </div>

            </div>

          </div>
        )}

      </main>

      {/* Interactive Bottom Dock Navigation for Mobile layout */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 pb-6 pt-3 bg-[#0A0A0A]/95 backdrop-blur-xl border-t border-white/5 shadow-[0_-5px_30px_rgba(0,0,0,0.8)] rounded-t-xl select-none font-mono">
        
        {/* Garaje button */}
        <button
          onClick={() => setActiveTab("garage")}
          className={`flex flex-col items-center justify-center transition-all ${
            activeTab === "garage" ? "text-[#FF3D00] scale-110" : "text-gray-400 opacity-75"
          }`}
        >
          <Car className="w-5 h-5" />
          <span className="font-mono text-[9px] uppercase tracking-wider mt-1">Garaje</span>
        </button>

        {/* Servicio button */}
        <button
          onClick={() => setActiveTab("service")}
          className={`flex flex-col items-center justify-center transition-all ${
            activeTab === "service" ? "text-[#FF3D00] scale-110" : "text-gray-400 opacity-75"
          }`}
        >
          <Wrench className="w-5 h-5" />
          <span className="font-mono text-[9px] uppercase tracking-wider mt-1">Servicio</span>
        </button>

        {/* AI copilot button center custom colored */}
        <button
          onClick={() => setActiveTab("ai-assist")}
          className={`flex flex-col items-center justify-center transition-all ${
            activeTab === "ai-assist" ? "text-white bg-gradient-to-br from-[#FF3D00] to-[#FF8A00] p-2.5 rounded shadow-[0_0_15px_rgba(255,61,0,0.5)] scale-115 -translate-y-2.5 skew-box" : "text-gray-400 opacity-75"
          }`}
        >
          <Cpu className="w-5 h-5" />
          {activeTab !== "ai-assist" && <span className="font-mono text-[9px] uppercase tracking-wider mt-1">Copiloto</span>}
        </button>

        {/* Metricas button */}
        <button
          onClick={() => setActiveTab("metrics")}
          className={`flex flex-col items-center justify-center transition-all ${
            activeTab === "metrics" ? "text-[#FF3D00] scale-110" : "text-gray-400 opacity-75"
          }`}
        >
          <Zap className="w-5 h-5" />
          <span className="font-mono text-[9px] uppercase tracking-wider mt-1">Métricas</span>
        </button>

      </nav>

      {/* Appointment booking modal */}
      <MaintenanceModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAddRecord={handleAddRecord}
        currentKm={specs.ultimoCambioKm}
      />

    </div>
  );
}
