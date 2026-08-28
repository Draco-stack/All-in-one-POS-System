#!/usr/bin/env bash
# ==============================================================================
# POS PostgreSQL Automated Docker Backup Script (backup.sh)
# ==============================================================================
# Description: Dumps and compresses live PostgreSQL DB from Docker container,
#              verifies integrity, and prunes backups older than RETENTION_DAYS.
# ==============================================================================

set -euo pipefail

# Configuration with environment fallbacks
CONTAINER_NAME="${CONTAINER_NAME:-pos_postgres_production}"
POSTGRES_USER="${POSTGRES_USER:-pos_user}"
POSTGRES_DB="${POSTGRES_DB:-pos_db_prod}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/pos_postgres}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"

# Formatting & Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

TIMESTAMP=$(date +"%Y%m%d_%H%M")
BACKUP_FILENAME="pos_backup_${TIMESTAMP}.sql.gz"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILENAME}"

log_info() {
    echo -e "[$(date +'%Y-%m-%d %H:%M:%S')] ${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "[$(date +'%Y-%m-%d %H:%M:%S')] ${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "[$(date +'%Y-%m-%d %H:%M:%S')] ${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "[$(date +'%Y-%m-%d %H:%M:%S')] ${RED}[ERROR]${NC} $1" >&2
}

# 1. Pre-flight Checks
log_info "Starting automated database backup pipeline..."

if ! command -v docker &> /dev/null; then
    log_error "Docker CLI is not installed or not in PATH."
    exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    log_error "PostgreSQL Docker container '${CONTAINER_NAME}' is not running!"
    exit 1
fi

# Ensure backup directory exists
mkdir -p "${BACKUP_DIR}"

# 2. Execute Database Backup & Compression
log_info "Creating compressed PostgreSQL dump for database '${POSTGRES_DB}'..."

if docker exec "${CONTAINER_NAME}" pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" \
    --clean \
    --if-exists \
    --no-owner \
    --no-privileges \
    | gzip -9 > "${BACKUP_PATH}"; then
    
    FILESIZE=$(du -h "${BACKUP_PATH}" | cut -f1)
    log_success "Backup completed successfully! Saved to: ${BACKUP_PATH} (${FILESIZE})"
else
    log_error "pg_dump execution failed!"
    rm -f "${BACKUP_PATH}"
    exit 1
fi

# 3. Verify Backup File Integrity
if [ ! -s "${BACKUP_PATH}" ]; then
    log_error "Generated backup file is empty!"
    rm -f "${BACKUP_PATH}"
    exit 1
fi

if ! gzip -t "${BACKUP_PATH}" &> /dev/null; then
    log_error "Backup gzip archive corrupted or invalid!"
    rm -f "${BACKUP_PATH}"
    exit 1
fi

log_success "Backup file integrity verified."

# 4. Retention Policy - Delete backups older than RETENTION_DAYS
log_info "Cleaning up backups older than ${RETENTION_DAYS} days in ${BACKUP_DIR}..."

DELETED_COUNT=0
while IFS= read -r file; do
    if [ -n "$file" ]; then
        log_warn "Removing expired backup: ${file}"
        rm -f "$file"
        DELETED_COUNT=$((DELETED_COUNT + 1))
    fi
done < <(find "${BACKUP_DIR}" -type f -name "pos_backup_*.sql.gz" -mtime +"${RETENTION_DAYS}")

log_info "Retention cleanup finished. Removed ${DELETED_COUNT} old backup file(s)."
log_success "Automated backup job complete."
