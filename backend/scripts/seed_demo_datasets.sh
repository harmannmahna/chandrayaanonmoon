#!/usr/bin/env bash
# Seed demo optical pair into MinIO + create confirmed datasets for a project.
set -euo pipefail
API="${API:-http://127.0.0.1:8000}"
PROJECT_ID="${1:?usage: seed_demo_datasets.sh <project_id>}"
REF="${2:-backend/samples/demo_reference.png}"
SRC="${3:-backend/samples/demo_source.png}"

upload_one() {
  local file="$1" name="$2" status="$3"
  local size ctype
  size=$(wc -c < "$file" | tr -d ' ')
  ctype="image/png"
  init=$(curl -sS -X POST "$API/api/v1/datasets/uploads/init" \
    -H 'Content-Type: application/json' \
    -d "{\"project_id\":\"$PROJECT_ID\",\"filename\":\"$name\",\"content_type\":\"$ctype\",\"byte_size\":$size,\"kind\":\"optical\",\"data_status\":\"$status\"}")
  dataset_id=$(python3 -c 'import json,sys; print(json.load(sys.stdin)["dataset_id"])' <<<"$init")
  upload_url=$(python3 -c 'import json,sys; print(json.load(sys.stdin)["upload_url"])' <<<"$init")
  curl -sS -X PUT -H "Content-Type: $ctype" --data-binary @"$file" "$upload_url" >/dev/null
  curl -sS -X POST "$API/api/v1/datasets/uploads/confirm" \
    -H 'Content-Type: application/json' \
    -d "{\"dataset_id\":\"$dataset_id\"}"
  echo "$dataset_id"
}

echo "Uploading reference…"
REF_ID=$(upload_one "$REF" "demo_reference.png" "illustrative / sample demo imagery")
echo "Uploading source…"
SRC_ID=$(upload_one "$SRC" "demo_source.png" "illustrative / sample demo imagery")
echo "REF_ID=$REF_ID"
echo "SRC_ID=$SRC_ID"
