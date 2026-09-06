#!/usr/bin/env bash
# LunaMatch backend — requires Python 3.11
set -euo pipefail
cd "$(dirname "$0")"
if [[ ! -x .venv/bin/python ]]; then
  python3.11 -m venv .venv
  .venv/bin/pip install -U pip
  .venv/bin/pip install -r requirements.txt
fi
echo "Using $(.venv/bin/python --version)"
exec .venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 "$@"
