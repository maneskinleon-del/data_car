# AutoData MG 350

App 100% local (sin backend, sin IA, sin servicios externos) para llevar:

- **Ficha técnica** del vehículo (aceite, filtros, neumáticos, iluminación, etc.)
- **Historial de mantenciones** con costo, fecha y kilometraje
- **Documentos en PDF**: SOAP, Revisión Técnica, Licencia de Conducir, Permiso de Circulación u otros, con fecha de vencimiento y alertas de estado (vigente / por vencer / vencido)

Todo se guarda en el navegador: la ficha técnica y las mantenciones en `localStorage`, y los PDFs en `IndexedDB`. Nada se sube a internet ni pasa por ningún servidor.

## Stack

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS v4 + Lucide React
- **Almacenamiento**: `localStorage` (specs, historial) + `IndexedDB` (documentos PDF), ambos en el navegador del usuario

## Setup

```bash
npm install
npm run dev
```

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo con Vite HMR |
| `npm run build` | Build de producción (carpeta `dist/`) |
| `npm run preview` | Sirve el build de producción localmente |
| `npm run lint` | Type-check sin emitir |

## Notas

- Los PDFs quedan guardados solo en el navegador donde los subiste. Si limpias los datos del sitio o cambias de navegador/dispositivo, se pierden — no hay respaldo en la nube.
- El máximo por archivo es 20MB.
