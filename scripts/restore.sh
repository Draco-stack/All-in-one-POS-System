#!/usr/bin/env bash
# ==============================================================================
# POS PostgreSQL Emergency Disaster Recovery Script (restore.sh)
# ==============================================================================
# Description: Restores PostgreSQL database from a compressed .sql.gz archive.
# Usage:       ./restore.sh /path/to/pos_backup_YYYYMMDD_HHMM.sql.gz
# ==============================================================================

set -euo pipefail

# Configuration with environment fallbacks
CONTAINER_NAME="${CONTAINER_NAME:-pos_postgres_production}"
POSTGRES_USER="${POSTGRES_USER:-pos_user}"
POSTGRES_DB="${POSTGRES_DB:-pos_db_prod}"

# Formatting & Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

log_info() {
    echo -e "[$(date +'%Y-%m-%d %H:%M:%S')] ${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "[$(date +'%Y-%m-%d %H:%M:%S')] ${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "[$(date +'%Y-%m-%d %H:%M:%S')] ${RED}[ERROR]${NC} $1" >&2
}

# 1. Argument & File Validation
if [ "$#" -ne 1 ]; then
    log_error "Usage: $0 <path_to_backup_file.sql.gz>"
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "${BACKUP_FILE}" ]; then
    log_error "Backup file '${BACKUP_FILE}' does not exist!"
    exit 1
fi

if ! gzip -t "${BACKUP_FILE}" &> /dev/null; then
    log_error "Backup file '${BACKUP_FILE}' is not a valid gzipped archive!"
    exit 1
fi

# 2. Container Health Check
if ! command -v docker &> /dev/null; then
    log_error "Docker CLI is not installed or not in PATH."
    exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    log_error "PostgreSQL Docker container '${CONTAINER_NAME}' is not running!"
    exit 1
fi

# 3. Explicit Disaster Recovery Confirmation Warning
echo -e "\n${RED}${BOLD}=======================================================================${NC}"
echo -e "${RED}${BOLD}                       CRITICAL SAFETY WARNING                         ${NC}"
echo -e "${RED}${BOLD}=======================================================================${NC}"
echo -e "${YELLOW}You are about to execute an EMERGENCY DATABASE RESTORATION.${NC}"
echo -e "Target Container : ${BOLD}${CONTAINER_NAME}${NC}"
echo -e "Target Database  : ${BOLD}${POSTGRES_DB}${NC}"
echo -e "Restore Source   : ${BOLD}${BACKUP_FILE}${NC}"
echo -e "${RED}${BOLD}THIS ACTION WILL OVERWRITE AND COMPLETELY ERASE ALL CURRENT DATA!${NC}"
echo -e "${RED}${BOLD}=======================================================================${NC}\n"

read -p "Are you sure you want to proceed? Type 'YES' in capital letters to confirm: " CONFIRMATION

if [ "${CONFIRMATION}" != "YES" ]; then
    echo -e "\n${YELLOW}Restoration aborted by user. No changes were made.${NC}"
    exit 0
fi

log_info "Confirmation received. Initializing disaster recovery restore..."

# 4. Terminate Existing Active Connections
log_info "Terminating active connections to database '${POSTGRES_DB}'..."
docker exec -i "${CONTAINER_NAME}" psql -U "${POSTGRES_USER}" -d postgres -c \
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${POSTGRES_DB}' AND pid <> pg_backend_pid();" > /dev/null 2>&1 || true

# 5. Drop and Recreate Schema
log_info "Resetting public schema in database '${POSTGRES_DB}'..."
docker exec -i "${CONTAINER_NAME}" psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -c \
    "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO ${POSTGRES_USER};" > /dev/null

# 6. Apply Compressed SQL Backup
log_info "Restoring database from '${BACKUP_FILE}'..."

if gunzip -c "${BACKUP_FILE}" | docker exec -i "${CONTAINER_NAME}" psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" > /dev/null; then
    log_success "Database restoration completed successfully!"
else
    log_error "Database restoration encountered errors!"
    exit 1
fi

# 7. Post-Restore Verification
log_info "Verifying database status..."
TABLE_COUNT=$(docker exec -i "${CONTAINER_NAME}" psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';")
TABLE_COUNT=$(echo "${TABLE_COUNT}" | xargs)

log_success "Disaster Recovery complete. ${TABLE_COUNT} table(s) present in database '${POSTGRES_DB}'."
