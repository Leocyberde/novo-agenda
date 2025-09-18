#!/bin/bash

# Script de build para o Render
echo "Iniciando processo de build..."

# Instalar dependências
echo "Instalando dependências..."
npm install

# Executar migrações do banco de dados
echo "Executando migrações do banco de dados..."
npm run migrate

# Build do projeto
echo "Fazendo build do projeto..."
npm run build

echo "Build concluído com sucesso!"

