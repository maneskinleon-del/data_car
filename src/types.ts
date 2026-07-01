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
  alfombra: string;
  filtroAire: string;
  ultimoCambioKm: number;
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
export type DocumentoTipo = 'soap' | 'revision_tecnica' | 'licencia' | 'permiso_circulacion' | 'otro';

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
