export interface VehicleSpecs {
  chassis: string;
  marca: string;
  propietario: string;
  estadoActivo: boolean;
  aceiteMotor: string;
  filtroAceite: string;
  transmision: 'Mecánica' | 'Automática' | 'DCT Performance';
  dimensionNeumaticos: string;
  iluminacionPrincipal: string;
  plumillaL: string;
  filtroAire: string;
  ultimoCambioKm: number;
  // === Datos del Manual (extraídos o ingresados por el usuario) ===
  aceiteCaja: string;        // Aceite de caja / transmisión
  bujias: string;            // Bujías (modelo, gap)
  fusibles: string;          // Fusibles (tabla resumen)
  refrigerante: string;      // Refrigerante / anticongelante
  tipoCombustible: string;   // Tipo de gasolina (octanaje)
  liquidoFrenos: string;     // Líquido de frenos
  correaDistribucion: string;// Correa de distribución
  tensionCorrea: string;     // Tensión de correa
  torqueTornillos: string;   // Torque de tornillos (cabeza, tapa, etc.)
  capacidadEstanque: string; // Capacidad del estanque
  peso: string;              // Peso en vacío
  dimensiones: string;       // Largo x Ancho x Alto
  manualPdfNombre: string;   // Nombre del archivo del manual subido
}

export interface ServiceRecord {
  id: string;
  name: string;
  cost: number;
  date: string;
  km: number;
  icon: string;
  colorType: 'primary' | 'secondary' | 'neutral'; // determines border indicators
}

// Tipos de documento del vehículo que se pueden guardar en PDF
export type DocumentoTipo = 'soap' | 'revision_tecnica' | 'licencia' | 'permiso_circulacion' | 'manual' | 'otro';

export interface DocumentoVehiculo {
  id: string;
  tipo: DocumentoTipo;
  nombre: string;          // etiqueta libre, ej. "SOAP 2026" o "Licencia Clase B"
  fechaEmision?: string;   // ISO yyyy-mm-dd, opcional
  fechaVencimiento?: string; // ISO yyyy-mm-dd, opcional (algunos documentos no vencen)
  notas?: string;
  archivoNombre: string;   // nombre original del PDF
  archivoTamano: number;   // bytes, solo para mostrar en la UI
  fechaSubida: string;     // ISO datetime de cuándo se subió
}
