export interface VehicleSpecs {
  chassis: string;
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

export interface MaintenanceStatus {
  vidaAceite: number; // percentage
  desgastePastillas: number; // percentage
  presionNeumaticos: number; // percentage
  presionCritica: boolean;
  kmRestantes: number;
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

export interface ChatMessage {
  id: string;
  sender: 'user' | 'system' | 'diagnosis';
  text: string;
  timestamp: string;
  diagnosticData?: {
    code: string;
    criticality: 'Informativo' | 'Advertencia' | 'Crítico';
    description: string;
    causes: string[];
    action: string;
  };
}

export interface TelemetryStats {
  rpm: number;
  maxRpm: number;
  picoRpm: number;
  marcha: number;
  velocidad: number;
  fuerzaG: number;
  tempMotor: number;
  consumoProm: number;
  voltajeBateria: number;
}
