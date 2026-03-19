#!/bin/bash
set -e

echo "[Pre-deploy] Installing ALL dependencies (including devDependencies)..."
cd /var/app/staging
npm install --include=dev

echo "[Pre-deploy] Building TypeScript..."
npx tsc

echo "[Pre-deploy] Generating Prisma client..."
npx prisma generate

echo "[Pre-deploy] Pruning devDependencies..."
npm prune --omit=dev

echo "[Pre-deploy] Build complete!"
