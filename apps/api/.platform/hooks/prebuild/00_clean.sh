#!/bin/bash
echo "[Pre-build] Wiping cached node_modules to fix corrupted dependencies..."
rm -rf /var/app/staging/node_modules
