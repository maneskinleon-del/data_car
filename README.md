# Scuderia Data — MG 350s Telemetría

Dashboard de telemetría de alto rendimiento para el MG 350s con diagnóstico asistido por IA (Google Gemini). Incluye chat con asistente de competición, autocompletado de fichas técnicas, y visualización de métricas de pista.

## Stack

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS v4 + Lucide React
- **Backend**: Express + Vite middleware (dev) / static (prod)
- **AI**: Google Gen AI SDK (`gemini-2.0-flash`)

## Setup

```bash
npm install
# Copiar .env.example a .env y configurar GEMINI_API_KEY
npm run dev
```

## Variables de Entorno

| Variable | Descripción |
|----------|-------------|
| `GEMINI_API_KEY` | API Key de Google Gemini (opcional; sin ella funciona en modo simulación) |
| `APP_URL` | URL de hosting para callbacks/self-references |
| `NODE_ENV` | `production` para modo estático; omite para modo dev |

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Arranca servidor en modo desarrollo con Vite HMR |
| `npm run build` | Build de frontend + bundle del servidor para producción |
| `npm start` | Sirve el build en producción |
| `npm run lint` | Type-check sin emitir |