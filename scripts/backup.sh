#!/bin/bash
# ============================================================
# SGI Bodega Pro — Script de Respaldo Automático Diario
# ============================================================
#
# Este script exporta los datos de todas las tablas principales
# desde Supabase y los guarda en archivos JSON con la fecha del día.
#
# USO:
#   chmod +x backup.sh
#   ./backup.sh
#
# PROGRAMAR EJECUCIÓN DIARIA (crontab):
#   crontab -e
#   Agregar la línea: 0 23 * * * /ruta/a/sgi-bodega-pro/scripts/backup.sh
#   (Se ejecutará todos los días a las 23:00)
#
# REQUISITOS:
#   - curl instalado (viene por defecto en macOS/Linux)
#   - Variables de entorno configuradas en el archivo .env.local
#
# ============================================================

# Directorio del proyecto
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Cargar variables de entorno
if [ -f "$PROJECT_DIR/.env.local" ]; then
  export $(grep -v '^#' "$PROJECT_DIR/.env.local" | xargs)
else
  echo "❌ No se encontró .env.local en $PROJECT_DIR"
  exit 1
fi

SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL"
SERVICE_KEY="$SUPABASE_SERVICE_ROLE_KEY"

if [ -z "$SUPABASE_URL" ] || [ -z "$SERVICE_KEY" ]; then
  echo "❌ Faltan variables SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY"
  exit 1
fi

# Crear directorio de respaldos
BACKUP_DIR="$PROJECT_DIR/backups/$(date +%Y-%m-%d)"
mkdir -p "$BACKUP_DIR"

echo "📦 Iniciando respaldo: $(date '+%Y-%m-%d %H:%M:%S')"
echo "📂 Guardando en: $BACKUP_DIR"

# Tablas a respaldar
TABLES=(
  "profiles"
  "workers"
  "categories"
  "products"
  "vales"
  "vale_items"
  "epp_records"
  "tool_assignments"
  "stock_movements"
  "receptions"
  "reception_items"
)

SUCCESS=0
FAILED=0

for TABLE in "${TABLES[@]}"; do
  echo -n "  ⬇ $TABLE... "
  
  HTTP_CODE=$(curl -s -o "$BACKUP_DIR/$TABLE.json" -w "%{http_code}" \
    "$SUPABASE_URL/rest/v1/$TABLE?select=*" \
    -H "apikey: $SERVICE_KEY" \
    -H "Authorization: Bearer $SERVICE_KEY" \
    -H "Accept: application/json")

  if [ "$HTTP_CODE" = "200" ]; then
    ROWS=$(python3 -c "import json; data=json.load(open('$BACKUP_DIR/$TABLE.json')); print(len(data))" 2>/dev/null || echo "?")
    echo "✅ ($ROWS registros)"
    SUCCESS=$((SUCCESS + 1))
  else
    echo "❌ HTTP $HTTP_CODE"
    FAILED=$((FAILED + 1))
  fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Éxito: $SUCCESS tablas"
[ "$FAILED" -gt 0 ] && echo "❌ Fallidas: $FAILED tablas"
echo "📂 Respaldo guardado en: $BACKUP_DIR"
echo "📅 Fecha: $(date '+%Y-%m-%d %H:%M:%S')"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Limpiar respaldos mayores a 30 días
CLEANED=$(find "$PROJECT_DIR/backups" -maxdepth 1 -type d -mtime +30 -exec rm -rf {} \; -print | wc -l)
if [ "$CLEANED" -gt 0 ]; then
  echo "🧹 Se limpiaron $CLEANED respaldos antiguos (>30 días)"
fi

echo "✔ Respaldo completado."
