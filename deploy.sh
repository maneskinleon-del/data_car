#!/bin/bash
# Script seguro: solo sube archivos fuente, NO .env ni secrets
git add src/ package.json tsconfig.json vite.config.ts index.html README.md metadata.json
git commit -m "Deploy: $(date)"
git push origin main
echo "¡Código subido con éxito!"
