#!/usr/bin/env bash
#
# Seed test-logs index with sample documents.
#
# Usage:
#   bash scripts/seed-data.sh          # seed all running instances
#   bash scripts/seed-data.sh v8       # seed only Kibana v8
#   bash scripts/seed-data.sh v9       # seed only Kibana v9
#   bash scripts/seed-data.sh opensearch  # seed only OpenSearch

set -euo pipefail

PROFILE="${1:-all}"

seed() {
  local url="$1"
  local label="$2"

  echo "Seeding $label at $url ..."

  # Delete index if it already exists (ignore errors)
  curl -sf -X DELETE "$url/test-logs" > /dev/null 2>&1 || true

  # Create index with a simple mapping
  curl -sf -X PUT "$url/test-logs" -H 'Content-Type: application/json' -d '{
    "mappings": {
      "properties": {
        "@timestamp":  { "type": "date" },
        "level":       { "type": "keyword" },
        "message":     { "type": "text" },
        "service":     { "type": "keyword" },
        "host":        { "type": "keyword" },
        "status_code": { "type": "integer" },
        "duration_ms": { "type": "integer" },
        "trace_id":    { "type": "keyword" }
      }
    }
  }' > /dev/null

  # Bulk-insert sample documents
  local now
  now=$(date -u +%s)

  local bulk=""
  local levels=("info" "warn" "error" "debug")
  local services=("api-gateway" "auth-service" "user-service" "payment-service")
  local hosts=("host-01" "host-02" "host-03")
  local messages=(
    "Request processed successfully"
    "Connection timeout reached"
    "User authentication failed"
    "Cache miss for key session_abc"
    "Database query took too long"
    "Rate limit exceeded for client"
    "Health check passed"
    "TLS handshake completed"
    "Retry attempt 2 of 3"
    "Response sent to client"
    "Starting background job"
    "Memory usage above threshold"
    "Configuration reloaded"
    "New connection from 10.0.0.5"
    "Shutting down gracefully"
    "Index rotation completed"
    "Disk usage at 78 percent"
    "Upstream returned 502"
    "JWT token expired"
    "Batch processing complete"
  )

  for i in $(seq 0 19); do
    local ts=$(( now - i * 60 ))
    local ts_iso
    ts_iso=$(date -u -r "$ts" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -d "@$ts" +%Y-%m-%dT%H:%M:%SZ)
    local level="${levels[$((i % 4))]}"
    local service="${services[$((i % 4))]}"
    local host="${hosts[$((i % 3))]}"
    local msg="${messages[$i]}"
    local status=$(( 200 + (i % 5) * 100 ))
    local duration=$(( 10 + i * 15 ))
    local trace="trace-$(printf '%04d' $i)"

    bulk+='{"index":{"_index":"test-logs"}}
'
    bulk+="{\"@timestamp\":\"$ts_iso\",\"level\":\"$level\",\"message\":\"$msg\",\"service\":\"$service\",\"host\":\"$host\",\"status_code\":$status,\"duration_ms\":$duration,\"trace_id\":\"$trace\"}"$'\n'
  done

  curl -sf -X POST "$url/_bulk" -H 'Content-Type: application/x-ndjson' -d "$bulk" > /dev/null

  echo "  -> Seeded 20 documents into $label"
}

if [[ "$PROFILE" == "all" || "$PROFILE" == "v8" ]]; then
  seed "http://localhost:19200" "Elasticsearch v8"
fi

if [[ "$PROFILE" == "all" || "$PROFILE" == "v9" ]]; then
  seed "http://localhost:29200" "Elasticsearch v9"
fi

if [[ "$PROFILE" == "all" || "$PROFILE" == "opensearch" ]]; then
  seed "http://localhost:39200" "OpenSearch"
fi

echo "Done!"
