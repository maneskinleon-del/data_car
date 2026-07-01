#!/bin/bash

# 1. Crear el README y el .gitignore
echo "# $1" > README.md
echo "node_modules/" > .gitignore
echo ".env" >> .gitignore
echo "dist/" >> .gitignore

# 2. Inicializar Git y configurar remoto
git init
git branch -M main
git remote add origin $2

# 3. Preparar el entorno de Node
npm init -y

# 4. Primer commit
git add .
git commit -m "Setup inicial del proyecto"
git push -u origin main

echo "¡Proyecto $1 creado y subido a GitHub exitosamente!"