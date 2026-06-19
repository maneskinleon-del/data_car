#!/bin/bash
# Script para subir todo automáticamente
git add .
git commit -m "Auto-commit: $(date)"
git push origin main
echo "¡Tu código ha sido subido con éxito!"

