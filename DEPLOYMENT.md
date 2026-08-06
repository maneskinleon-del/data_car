# Despliegue en GitHub Pages — AutoData MG 350

La app se publica en GitHub Pages automáticamente con GitHub Actions. Esta guía cubre cómo habilitarlo (paso único) y cómo funciona el flujo.

**URL final:** `https://maneskinleon-del.github.io/data_car/`

---

## 1. Requisito: habilitar Pages en el repo (paso único)

El workflow ya existe (`.github/workflows/deploy.yml`) y el build pasa, pero GitHub Pages debe estar **habilitado en la configuración del repo** con la fuente correcta. Sin esto, el paso *Setup Pages* del workflow falla y la URL devuelve 404.

**Pasos:**

1. Ve a `https://github.com/maneskinleon-del/data_car/settings/pages`
2. En **Build and deployment** → **Source**, selecciona **GitHub Actions**
3. Guarda (Save)

Al guardarlo, el último push a `main` se despliega automáticamente. Para desplegar de inmediato sin esperar: **Actions → Deploy to GitHub Pages → Run workflow**.

## 2. Cómo funciona el flujo

`.github/workflows/deploy.yml` se dispara con:

- **`push` a `main`** (cada commit pusheado)
- **`workflow_dispatch`** (botón "Run workflow" en Actions)

**Jobs:**

```
build  (ubuntu-latest)
  ├── Checkout
  ├── Setup Node.js (v20, cache npm)
  ├── Install dependencies (npm ci)
  ├── Build (npm run build con VITE_BASE_PATH=/data_car/)
  ├── Setup Pages (configure-pages@v4)   ← falla si Pages no está habilitado
  └── Upload artifact (dist/ → upload-pages-artifact@v3)
        ↓
deploy (needs: build)
  └── Deploy to GitHub Pages (deploy-pages@v4)
```

Detalles clave:

- **`VITE_BASE_PATH=/data_car/`**: el base path de Vite se calcula en `vite.config.ts` — en producción usa `VITE_BASE_PATH` si existe, si no `/`. Este valor es obligatorio para que los assets resuelvan bajo `/data_car/`.
- **Permissions**: el workflow declara `pages: write` + `id-token: write` (requeridos por `configure-pages`/`deploy-pages`). No necesita tokens manuales.
- **Concurrency**: un deploy a la vez (`cancel-in-progress: false`) para no pisar publicaciones.
- **`npm ci`**: usa el `package-lock.json` del repo; si cambias dependencias, commitea el lockfile actualizado.

## 3. Troubleshooting

| Síntoma | Causa | Solución |
|---------|-------|----------|
| Paso *Setup Pages* falla en Actions | Pages no habilitado o fuente incorrecta | Settings → Pages → Source: **GitHub Actions** |
| `https://maneskinleon-del.github.io/data_car/` → 404 | Pages deshabilitado o deploy aún en curso | Habilitar (paso 1) y esperar el run; verificar en Actions |
| Deploy OK pero assets 404 (HTML carga, JS/CSS no) | `VITE_BASE_PATH` no aplicado | El workflow lo define; en local verifica con `vite preview` |
| Primer deploy no aparece | El build dura unos minutos | Revisar Actions → último run → jobs build+deploy en verde |

## 4. Verificación local previa al deploy

```bash
npm run build          # build de producción (base '/')
npm run preview        # sirve dist/ en http://localhost:4173
```

> Nota: localmente el base path es `/`, en GitHub Pages es `/data_car/`. El build de CI es el que aplica `VITE_BASE_PATH`, así que el entorno local solo valida contenido/estado, no rutas de Pages.

**Check rápido del seed embebido** (la base precargada va dentro del bundle JS):

```bash
grep -c 'mg350-base-preloaded' dist/assets/*.js   # → 1 (o más)
```
