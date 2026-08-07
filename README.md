# AutoData MG 350

App 100% local (sin backend, sin IA, sin servicios externos) para llevar el **MG 350** (1.5 VTi, plataforma SAIC AP11):

- **Ficha técnica** del vehículo (aceite, filtros, neumáticos, iluminación, etc.)
- **Base Técnica V2** (pestaña *Manual*): especificaciones extraídas del manual de taller real con trazabilidad por página y estados verificados (✓ extraído / ⚪ no encontrado / ⚠️ no publicado)
- **Catálogo de repuestos**: referencias OEM y aftermarket con nivel de verificación, para comprar con confianza — cada referencia tiene botones para **copiarla o buscarla directo en el buscador**
- **Fusibles** (pestaña *Manual*): leyenda completa del **manual del propietario** — caja del capó (EF10-EF20) y caja de la cabina (F01-F31) con amperaje, función y **código de colores por amperaje**, ubicación física de cada caja, buscador por circuito y cruce con el manual de taller (F05 airbag, F12 luz interior, F21 limpiaparabrisas, ventilador EF13) — con advertencias de seguridad para reemplazos en ruta
- **Historial de mantenciones** con costo, fecha y kilometraje, editable y eliminable (con confirmación) desde la propia lista
- **Planificador de mantenimiento** (pestaña *Servicio*): odómetro actual editable, km desde el último servicio y plan por tipo (aceite, mayor, alineación, eléctrica, otro) con intervalos configurables y alertas visuales (✓ al día / 🟠 próximo / 🔴 vencido)
- **Respaldo local del historial**: exportar mantenciones como JSON o CSV (Excel) e importarlas de vuelta — la app sigue siendo 100% local, pero ya no dependes del navegador para no perder el registro
- **Documentos en PDF**: SOAP, Revisión Técnica, Licencia de Conducir, Permiso de Circulación u otros, con fecha de vencimiento y alertas de estado (vigente / por vencer / vencido)

Todo se guarda en el navegador: la ficha técnica y las mantenciones en `localStorage`, y los PDFs en `IndexedDB`. Nada se sube a internet ni pasa por ningún servidor.

---

## Base Técnica V2 (pestaña *Manual*)

El corazón de la app es el **pipeline V2 de extracción por layout**: en lugar de buscar texto plano (que genera falsos positivos en manuales), el extractor usa las **coordenadas x/y** de cada fragmento del PDF para distinguir tablas de párrafos, ubicar títulos de sección y validar los valores encontrados.

**Estados de cada dato:**

| Estado | Significado |
|--------|-------------|
| ✓ **Extraído** | Valor encontrado en el manual con página, sección y confianza |
| ⚪ **No encontrado** | El manual no menciona el dato |
| ⚠️ **No publicado** | El manual de taller no publica el dato (referencia de compra → la da el catálogo) |

**Cobertura actual (contra el manual real):** 18 componentes en 9 sistemas, 24 valores extraídos, 9 no publicados — métrica *decision-ready*: cuántos datos sirven para decidir una compra sin conflicto.

### Regla de oro: nada de datos inventados

Todo valor en la app proviene de una de estas fuentes verificables:

1. **Manual de taller real** (con página y confianza — trazabilidad completa)
2. **Catálogo de repuestos** con compatibilidad explícita (vehículo/motor) en fuentes europeas (Autodoc/TecDoc/Brembo, etc.)
3. **Confirmación del dueño** (pieza instalada y medida físicamente, fuente `user`)

Cuando un dato no cumple estas fuentes, queda como **candidata ⚠️** (visible pero con advertencia de verificar antes de comprar), nunca se inventa.

## Catálogo de repuestos

Referencias externas al manual (Fase 2), conectadas a cada componente. Cada pieza muestra:

- **OEM** (SAIC original) o referencia instalada por el dueño
- **Equivalencias aftermarket** con marcas y números de parte
- **Estado**: ✓ VERIFICADO (compatibilidad explícita) o ⚠️ SIN VERIFICAR (candidata)
- **Aplica a**: vehículos/motores compatibles según la fuente
- **Nota**: contexto de compra (ej. variantes de espesor, hilo de rosca crítico)

**Estado actual del catálogo (11 entradas):**

| Componente | Verificadas ✓ | Candidatas ⚠️ |
|------------|--------------|---------------|
| Filtro de aceite | 2 (OEM + UJ-1797 dueño) | — |
| Filtro de aire | 2 (1 equivalencia MANN C 2774 / MAHLE LX 719 / BOSCH + 1 instalada por el dueño) | 2 (STP, SAIC) |
| Plumillas delanteras | 2 (conductor/pasajero) | — |
| Plumilla trasera | — | 1 |
| Foco delantero | 1 | — |
| Filtro de polen | — | 1 |
| Bujías | 1 (NGK PFR6Y) | — |
| Neumáticos | 1 (205/55 R16 · 2,1 bar) | — |
| Batería | — | 1 (DIN L1) |
| Pastillas delanteras | 1 (OEM 10026870 + TRW/Ferodo/Brembo/Delphi) | 1 (BOSCH) |
| Pastillas traseras | 1 (OEM 10030811 + Ferodo FDB1083 con cruce documentado) | 3 (Brembo/TRW/Delphi 15 mm · Brembo/TRW 17 mm · BOSCH) |

## Base precargada embebida (sin PDF)

La app incluye `src/data/mg350Base.json` (~40 KB), un **seed generado desde el manual real**: la base técnica completa + catálogo, empaquetados y embebidos en el bundle.

**Consecuencia:** cualquier dispositivo (teléfono, PC, otro navegador) carga la **misma información del MG 350 al instante**, sin necesitar el PDF de 28 MB. Al abrir la pestaña *Manual* sin subir nada, la app muestra el panel *"Base técnica precargada MG 350 · SIN PDF"*.

Si además quieres re-extraer con trazabilidad completa (página por página de TU manual), sigue estando disponible el flujo normal: **Subir Manual PDF → Construir Base Técnica**.

### Regenerar el seed

```bash
# Desde la raíz del proyecto (data_car)
./node_modules/.bin/esbuild scripts/build-base-json.mjs \
  --bundle --platform=node --format=esm --outfile=.build-base.mjs \
  --external:pdfjs-dist
node .build-base.mjs
rm -f .build-base.mjs
```

- Usa el manual en `/home/mangonz/Descargas/mg350-manual-final.pdf` (o la variable `MG350_PDF`)
- Sobrescribe `src/data/mg350Base.json` → el próximo `npm run build` la embebe
- Es reproducible: ejecuta el mismo pipeline V2 + catálogo que usa la app

## Stack

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS v4 + Lucide React
- **PDF**: pdf.js (`pdfjs-dist`) con worker empaquetado localmente (sin CDN → funciona offline)
- **Almacenamiento**: `localStorage` (specs, historial) + `IndexedDB` (documentos PDF)
- **Test**: regresión V2 (`tests/regressionV2.ts`, corre con esbuild + pdf.js contra el manual real)

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
| `npm run lint` | Type-check sin emitir (`tsc --noEmit`) |
| `scripts/build-base-json.mjs` | Regenera `src/data/mg350Base.json` desde el manual real |

## Regresión V2

`tests/regressionV2.ts` valida el pipeline contra el manual real (24 expectativas): valores extraídos (aceite 5W/40, bujías NGK PFR6Y, neumáticos 205/55 R16 · 2,1 bar...), estados (no publicado, no encontrado), catálogo conectado y coherencia del seed precargado (su cobertura debe ser idéntica a la extracción real).

```bash
./node_modules/.bin/esbuild tests/regressionV2.ts \
  --bundle --platform=node --format=esm --outfile=.r.mjs \
  --external:pdfjs-dist && node .r.mjs && rm -f .r.mjs
```

## Despliegue (GitHub Pages)

La app se publica automáticamente con GitHub Actions al pushear a `main`. Ver **`DEPLOYMENT.md`** para la guía completa (cómo habilitar Pages en el repo y el flujo del workflow).

## Notas

- Los PDFs quedan guardados solo en el navegador donde los subiste. Si limpias los datos del sitio o cambias de navegador/dispositivo, se pierden — no hay respaldo en la nube (excepto la base técnica, que se regenera sola desde el seed).
- El máximo por archivo PDF es 50MB.
