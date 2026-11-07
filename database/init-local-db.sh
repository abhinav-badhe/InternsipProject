#!/bin/bash
set -e

echo "=========================================================="
echo "Initializing FreshCart Local PostgreSQL Schemas & Seeds..."
echo "=========================================================="

MIGRATIONS_DIR="/docker-entrypoint-initdb.d/database/service-migrations"

SERVICES=(
  "catalog-service"
  "pricing-service"
  "inventory-service"
  "order-service"
  "payment-service"
  "identity-service"
  "fulfillment-service"
  "invoice-service"
  "analytics-service"
  "notification-service"
  "whatsapp-adapter"
)

for SERVICE in "${SERVICES[@]}"; do
  DIR="${MIGRATIONS_DIR}/${SERVICE}"
  if [ -d "$DIR" ]; then
    echo "Applying migrations for: $SERVICE"
    for SQL_FILE in $(ls "$DIR"/*.sql 2>/dev/null | sort); do
      if [ -f "$SQL_FILE" ]; then
        echo "  -> Executing: $(basename "$SQL_FILE")"
        psql -v ON_ERROR_STOP=0 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f "$SQL_FILE" || true
      fi
    done
  fi
done

echo "=========================================================="
echo "FreshCart Local PostgreSQL Database Initialized Successfully!"
echo "=========================================================="

