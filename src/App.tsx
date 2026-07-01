import React, { useState, useEffect } from "react";
import {
  Layers,
  CheckCircle,
  Car,
  Wrench,
  FileText,
  User,
} from "lucide-react";

import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import SpecForm from "./components/SpecForm";
import HistoryList from "./components/HistoryList";
import MaintenanceModal from "./components/MaintenanceModal";
import DocumentsTab from "./components/DocumentsTab";

import { VehicleSpecs, ServiceRecord } from "./types";

export default function App() {
  const [activeTab, setActiveTab] = useState<string>("garage");
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 1. Core Vehicle Specs State (persistido en localStorage)
  const [specs, setSpecs] = useState<VehicleSpecs>(() => {
    const saved = localStorage.getItem("mg350_specs");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return {
      chassis: "#8829-XP",
      marca: "MG 350",
      propietario: "Mangonz",
      estadoActivo: true,
      aceiteMotor: "",
      filtroAceite: "",
      transmision: "Mecánica",
      dimensionNeumaticos: "",
      iluminacionPrincipal: "",
      plumillaL: "",
      alfombra: "",
      filtroAire: "",
      ultimoCambioKm: 0,
    };
  });

  useEffect(() => {
    localStorage.setItem("mg350_specs", JSON.stringify(specs));
  }, [specs]);

  // 2. Service Records con persistencia en LocalStorage
  const [records, setRecords] = useState<ServiceRecord[]>(() => {
    const saved = localStorage.getItem("mg350_services");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem("mg350_services", JSON.stringify(records));
  }, [records]);

  const triggerToast = (text: string) => {
    setToastMessage(text);
    setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

  // Helper para agregar registros de mantenimiento
  const handleAddRecord = (newRecord: ServiceRecord) => {
    setRecords([newRecord, ...records]);
    if (newRecord.km > specs.ultimoCambioKm) {
      setSpecs((prev) => ({
        ...prev,
        ultimoCambioKm: newRecord.km,
      }));
    }
    triggerToast(`"${newRecord.name.toUpperCase()}" REGISTRADO CON ÉXITO.`);
  };

  // Guardado manual de la ficha técnica
  const [isSavingSpecs, setIsSavingSpecs] = useState(false);
  const handleSaveSpecs = () => {
    setIsSavingSpecs(true);
    setTimeout(() => {
      setIsSavingSpecs(false);
      triggerToast("FICHA TÉCNICA GUARDADA.");
    }, 500);
  };

  return (
    <div className="bg-[#0A0A0A] min-h-screen relative text-[#F0F0F0] pb-24 md:pb-8">

      {/* Header */}
      <Header
        onMenuToggle={() => setIsSidebarOpen(true)}
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />

      {/* Sidebar */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onTabChange={(tab) => setActiveTab(tab)}
      />

      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-28 left-1/2 -translate-x-1/2 z-[90] bg-[#0A0A0A] border border-[#FF3D00]/40 shadow-[0_10px_40px_rgba(255,61,0,0.25)] px-5 py-3 rounded-xl flex items-center gap-3 font-mono text-[10px] uppercase tracking-widest text-white animate-[fadeIn_0.2s_ease]">
          <CheckCircle className="w-4 h-4 text-[#FF3D00]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main content */}
      <main className="pt-24 px-4 md:px-8 max-w-7xl mx-auto">

        {/* TAB 1: GARAJE / FICHA DEL VEHÍCULO */}
        {activeTab === "garage" && (
          <div className="space-y-8 animate-[fadeIn_0.3s_ease]">

            <div className="glass-panel carbon-texture p-6 md:p-8 rounded-xl flex flex-col md:flex-row items-center gap-6 md:gap-8 border-l-4 border-[#FF3D00] relative overflow-hidden">
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-gradient-to-br from-[#FF3D00]/10 to-transparent rounded-full blur-xl pointer-events-none" />

              <div className="flex-grow text-center md:text-left select-none z-10 w-full">
                <div className="inline-flex items-center space-x-2 text-[#FF3D00] font-mono text-[9px] uppercase tracking-[0.3em] font-extrabold mb-1">
                  <span className="w-5 h-[1px] bg-[#FF3D00]"></span>
                  <span>GARAJE</span>
                </div>

                <input
                  type="text"
                  value={specs.marca}
                  onChange={(e) => setSpecs((prev) => ({ ...prev, marca: e.target.value }))}
                  placeholder="Marca y modelo"
                  className="bg-transparent border-none outline-none focus:bg-white/5 focus:rounded-lg px-1 -mx-1 font-display text-4xl md:text-5xl font-black text-white leading-none tracking-tighter mt-1 mb-4 uppercase w-full md:w-auto"
                />

                <div className="flex flex-wrap justify-center md:justify-start gap-3 items-center">
                  <span className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#FF3D00] text-white font-mono text-[10px] font-extrabold rounded-sm skew-box shadow-[0_4px_15px_rgba(255,61,0,0.3)]">
                    <Layers className="w-3.5 h-3.5 shrink-0" />
                    CHASIS:
                    <input
                      type="text"
                      value={specs.chassis}
                      onChange={(e) => setSpecs((prev) => ({ ...prev, chassis: e.target.value }))}
                      className="bg-transparent border-none outline-none focus:bg-black/20 focus:rounded px-1 -mx-1 font-mono text-[10px] font-extrabold text-white w-24"
                    />
                  </span>
                  <span className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white/5 border border-white/10 text-white font-mono text-[10px] font-extrabold rounded-sm skew-box">
                    <User className="w-3.5 h-3.5 shrink-0 text-[#FF8A00]" />
                    <input
                      type="text"
                      value={specs.propietario}
                      onChange={(e) => setSpecs((prev) => ({ ...prev, propietario: e.target.value }))}
                      placeholder="Propietario"
                      className="bg-transparent border-none outline-none focus:bg-black/20 focus:rounded px-1 -mx-1 font-mono text-[10px] font-extrabold text-white w-28"
                    />
                  </span>
                </div>
                <p className="font-mono text-[10px] text-white/50 mt-6 uppercase tracking-[0.25em] font-black">
                  FICHA TÉCNICA
                </p>
              </div>
            </div>

            <SpecForm
              specs={specs}
              onUpdateSpecs={(updated) => setSpecs((prev) => ({ ...prev, ...updated }))}
              onSave={handleSaveSpecs}
              isSaving={isSavingSpecs}
            />
          </div>
        )}

        {/* TAB 2: SERVICIO / MANTENCIONES */}
        {activeTab === "service" && (
          <div className="space-y-6 animate-[fadeIn_0.3s_ease]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="font-display font-black text-white text-xl uppercase tracking-wider">Mantenciones</h2>
              <button
                onClick={() => setIsModalOpen(true)}
                className="bg-gradient-to-r from-[#FF3D00] to-[#FF8A00] hover:brightness-110 text-white font-display text-sm font-bold px-6 py-3 flex items-center justify-center gap-2 transition-transform active:scale-[0.98] cursor-pointer shadow-[0_6px_20px_rgba(255,61,0,0.3)] rounded-xl uppercase tracking-tighter"
              >
                + Registrar mantención
              </button>
            </div>
            <HistoryList records={records} />
          </div>
        )}

        {/* TAB 3: DOCUMENTOS (SOAP, Revisión Técnica, Licencia...) */}
        {activeTab === "documents" && <DocumentsTab triggerToast={triggerToast} />}

      </main>

      {/* Bottom Dock Navigation (mobile) */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 pb-6 pt-3 bg-[#0A0A0A]/95 backdrop-blur-xl border-t border-white/5 shadow-[0_-5px_30px_rgba(0,0,0,0.8)] rounded-t-xl select-none font-mono">
        {(["garage", "service", "documents"] as const).map((tab) => {
          const labels: Record<string, string> = { garage: "Garaje", service: "Servicio", documents: "Docs" };
          const Icon = { garage: Car, service: Wrench, documents: FileText }[tab];
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex flex-col items-center justify-center transition-all ${
                activeTab === tab ? "text-[#FF3D00] scale-110" : "text-gray-400 opacity-75"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="font-mono text-[9px] uppercase tracking-wider mt-1">{labels[tab]}</span>
            </button>
          );
        })}
      </nav>

      {/* Modal de mantención */}
      <MaintenanceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAddRecord={handleAddRecord}
        currentKm={specs.ultimoCambioKm}
      />

    </div>
  );
}
