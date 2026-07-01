import React, { useEffect, useState, useRef } from "react";
import { FileText, Upload, Trash2, Eye, AlertTriangle, CheckCircle2, Clock, ShieldQuestion } from "lucide-react";
import { DocumentoTipo, DocumentoVehiculo } from "../types";
import { guardarDocumento, listarDocumentos, obtenerArchivo, eliminarDocumento } from "../lib/db";

const TIPO_LABEL: Record<DocumentoTipo, string> = {
  soap: "SOAP (Seguro Obligatorio)",
  revision_tecnica: "Revisión Técnica",
  licencia: "Licencia de Conducir",
  permiso_circulacion: "Permiso de Circulación",
  otro: "Otro documento",
};

const MAX_BYTES = 20 * 1024 * 1024; // 20MB, generoso para un PDF escaneado

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function estadoVencimiento(fechaVencimiento?: string): { label: string; className: string; icon: React.ReactNode } {
  if (!fechaVencimiento) {
    return { label: "SIN VENCIMIENTO", className: "text-white/40 border-white/10", icon: <ShieldQuestion className="w-3.5 h-3.5" /> };
  }
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const venc = new Date(fechaVencimiento + "T00:00:00");
  const diffDias = Math.round((venc.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDias < 0) {
    return { label: `VENCIDO HACE ${Math.abs(diffDias)}D`, className: "text-red-400 border-red-400/30 bg-red-400/5", icon: <AlertTriangle className="w-3.5 h-3.5" /> };
  }
  if (diffDias <= 30) {
    return { label: `VENCE EN ${diffDias}D`, className: "text-[#FF8A00] border-[#FF8A00]/30 bg-[#FF8A00]/5", icon: <Clock className="w-3.5 h-3.5" /> };
  }
  return { label: "VIGENTE", className: "text-emerald-400 border-emerald-400/30 bg-emerald-400/5", icon: <CheckCircle2 className="w-3.5 h-3.5" /> };
}

export default function DocumentsTab({ triggerToast }: { triggerToast: (msg: string) => void }) {
  const [documentos, setDocumentos] = useState<DocumentoVehiculo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tipo, setTipo] = useState<DocumentoTipo>("soap");
  const [nombre, setNombre] = useState("");
  const [fechaEmision, setFechaEmision] = useState("");
  const [fechaVencimiento, setFechaVencimiento] = useState("");
  const [notas, setNotas] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const cargar = async () => {
    setLoading(true);
    try {
      const docs = await listarDocumentos();
      setDocumentos(docs);
    } catch (e) {
      console.error(e);
      triggerToast("No se pudo leer la base de datos local de documentos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const resetForm = () => {
    setTipo("soap");
    setNombre("");
    setFechaEmision("");
    setFechaVencimiento("");
    setNotas("");
    setArchivo(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      triggerToast("Solo se aceptan archivos PDF.");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_BYTES) {
      triggerToast(`El archivo pesa ${formatBytes(file.size)}, el máximo local es ${formatBytes(MAX_BYTES)}.`);
      e.target.value = "";
      return;
    }
    setArchivo(file);
    if (!nombre) setNombre(file.name.replace(/\.pdf$/i, ""));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!archivo) {
      triggerToast("Selecciona un archivo PDF primero.");
      return;
    }
    setSaving(true);
    try {
      const meta: DocumentoVehiculo = {
        id: Math.random().toString(36).substring(2, 10),
        tipo,
        nombre: nombre || TIPO_LABEL[tipo],
        fechaEmision: fechaEmision || undefined,
        fechaVencimiento: fechaVencimiento || undefined,
        notas: notas || undefined,
        archivoNombre: archivo.name,
        archivoTamano: archivo.size,
        fechaSubida: new Date().toISOString(),
      };
      await guardarDocumento(meta, archivo);
      await cargar();
      resetForm();
      setShowForm(false);
      triggerToast(`"${meta.nombre}" GUARDADO LOCALMENTE.`);
    } catch (err) {
      console.error(err);
      triggerToast("No se pudo guardar el documento.");
    } finally {
      setSaving(false);
    }
  };

  const handleVer = async (doc: DocumentoVehiculo) => {
    try {
      const blob = await obtenerArchivo(doc.id);
      if (!blob) {
        triggerToast("No se encontró el archivo guardado.");
        return;
      }
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      // liberar el objeto luego de un rato, dando tiempo a que la pestaña cargue el PDF
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      console.error(err);
      triggerToast("No se pudo abrir el documento.");
    }
  };

  const handleEliminar = async (doc: DocumentoVehiculo) => {
    if (!confirm(`¿Eliminar "${doc.nombre}"? Esta acción no se puede deshacer.`)) return;
    try {
      await eliminarDocumento(doc.id);
      await cargar();
      triggerToast(`"${doc.nombre}" ELIMINADO.`);
    } catch (err) {
      console.error(err);
      triggerToast("No se pudo eliminar el documento.");
    }
  };

  return (
    <div className="space-y-6 select-none">

      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display font-black text-white text-xl uppercase tracking-wider">Documentos del Vehículo</h2>
          <p className="font-mono text-[10px] text-white/40 mt-1 uppercase tracking-widest">
            Guardados localmente en este navegador. Nada se sube a internet.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="bg-gradient-to-r from-[#FF3D00] to-[#FF8A00] hover:brightness-110 text-white font-display text-sm font-bold px-6 py-3 flex items-center justify-center gap-2 transition-transform active:scale-[0.98] cursor-pointer shadow-[0_6px_20px_rgba(255,61,0,0.3)] rounded-xl uppercase tracking-tighter"
        >
          <Upload className="w-4 h-4" />
          {showForm ? "Cerrar" : "Subir PDF"}
        </button>
      </div>

      {/* Formulario de carga */}
      {showForm && (
        <form onSubmit={handleSubmit} className="glass-panel p-6 rounded-xl border border-white/10 space-y-4 font-mono text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-white/50 uppercase font-bold tracking-widest text-[9px] mb-2">Tipo de documento</label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as DocumentoTipo)}
                className="w-full input-field p-3 text-white rounded bg-black border border-white/10 outline-none text-xs cursor-pointer"
              >
                {(Object.keys(TIPO_LABEL) as DocumentoTipo[]).map((t) => (
                  <option key={t} value={t}>{TIPO_LABEL[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-white/50 uppercase font-bold tracking-widest text-[9px] mb-2">Etiqueta / nombre</label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder={TIPO_LABEL[tipo]}
                className="w-full input-field p-3 text-white rounded bg-black border border-white/10 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-white/50 uppercase font-bold tracking-widest text-[9px] mb-2">Fecha de emisión (opcional)</label>
              <input
                type="date"
                value={fechaEmision}
                onChange={(e) => setFechaEmision(e.target.value)}
                className="w-full input-field p-3 text-white rounded bg-black border border-white/10 outline-none cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-white/50 uppercase font-bold tracking-widest text-[9px] mb-2">Fecha de vencimiento (opcional)</label>
              <input
                type="date"
                value={fechaVencimiento}
                onChange={(e) => setFechaVencimiento(e.target.value)}
                className="w-full input-field p-3 text-white rounded bg-black border border-white/10 outline-none cursor-pointer"
              />
            </div>
          </div>

          <div>
            <label className="block text-white/50 uppercase font-bold tracking-widest text-[9px] mb-2">Notas (opcional)</label>
            <input
              type="text"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="p. ej. Compañía aseguradora, N° de folio, etc."
              className="w-full input-field p-3 text-white rounded bg-black border border-white/10 outline-none"
            />
          </div>

          <div>
            <label className="block text-white/50 uppercase font-bold tracking-widest text-[9px] mb-2">Archivo PDF</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              required
              className="w-full text-white/70 text-[11px] file:mr-4 file:py-2.5 file:px-4 file:rounded file:border-0 file:font-mono file:font-bold file:uppercase file:text-[9px] file:tracking-widest file:bg-white/10 file:text-white hover:file:bg-white/15 file:cursor-pointer cursor-pointer"
            />
            {archivo && (
              <p className="text-white/40 text-[10px] mt-2">{archivo.name} · {formatBytes(archivo.size)}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3.5 bg-gradient-to-r from-[#FF3D00] to-[#FF8A00] text-white font-bold rounded transition-transform active:scale-[0.98] duration-100 uppercase tracking-widest text-[10px] shadow-[0_4px_20px_rgba(255,61,0,0.3)] disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar documento"}
          </button>
        </form>
      )}

      {/* Lista de documentos */}
      {loading ? (
        <div className="text-center py-12 text-white/30 font-mono text-xs uppercase">Cargando...</div>
      ) : documentos.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-white/10 rounded-lg">
          <FileText className="w-8 h-8 text-white/20 mx-auto mb-2" />
          <p className="font-mono text-xs text-white/40 uppercase">Aún no has subido documentos.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {documentos.map((doc) => {
            const estado = estadoVencimiento(doc.fechaVencimiento);
            return (
              <div key={doc.id} className="glass-panel p-5 rounded-xl border border-white/10 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded bg-[#0A0A0A] border border-white/10 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5 text-[#FF3D00]" />
                    </div>
                    <div className="min-w-0">
                      <h5 className="font-display font-bold text-xs text-white tracking-widest truncate">{doc.nombre}</h5>
                      <p className="font-mono text-[9px] text-white/40 mt-1 uppercase tracking-wider">{TIPO_LABEL[doc.tipo]}</p>
                    </div>
                  </div>
                  <span className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded border text-[8px] font-mono font-bold uppercase tracking-widest ${estado.className}`}>
                    {estado.icon}
                    {estado.label}
                  </span>
                </div>

                <div className="font-mono text-[9px] text-white/40 uppercase tracking-wider space-y-0.5">
                  {doc.fechaEmision && <p>Emitido: {doc.fechaEmision}</p>}
                  {doc.fechaVencimiento && <p>Vence: {doc.fechaVencimiento}</p>}
                  {doc.notas && <p className="text-white/50 normal-case tracking-normal">{doc.notas}</p>}
                  <p>{doc.archivoNombre} · {formatBytes(doc.archivoTamano)}</p>
                </div>

                <div className="flex gap-2 pt-2 border-t border-white/10">
                  <button
                    onClick={() => handleVer(doc)}
                    className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-white font-mono text-[9px] font-bold uppercase tracking-widest rounded flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" /> Ver PDF
                  </button>
                  <button
                    onClick={() => handleEliminar(doc)}
                    className="py-2 px-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-mono text-[9px] font-bold uppercase tracking-widest rounded flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
