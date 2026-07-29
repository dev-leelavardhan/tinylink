#!/bin/sh
set -e

# Migrations are applied by the dedicated one-shot `migrate` service
# (see docker-compose.prod.yml), not on every app/worker startup.
echo "Starting application (role: ${SERVICE_ROLE:-all})..."
exec node dist/main.js
