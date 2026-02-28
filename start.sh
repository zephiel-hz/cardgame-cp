#!/bin/bash
# Railway startup script
# Handles database migrations and cleanup before starting the app

set -e

echo "[Railway] Starting app initialization..."
echo "[Railway] NODE_ENV: $NODE_ENV"
echo "[Railway] Database: ${DATABASE_URL:0:30}..."

# Run database migrations
echo "[Railway] Running database migrations..."
npm run db:push || {
  echo "[Railway] ⚠️  Database migration failed (might already be migrated)"
  # Don't exit, continue with app start
}

echo "[Railway] ✓ Initialization complete"
echo "[Railway] Starting app at $(date)"

# Start the app
exec node dist/index.cjs
