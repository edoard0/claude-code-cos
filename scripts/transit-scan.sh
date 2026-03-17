#!/bin/bash
# COS Layer 1: Calendar Transit Scanner
# Runs overnight via LaunchAgent. Scans tomorrow's calendar for physical events,
# calculates public transit times, and creates buffer blocks.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SPEC="$SCRIPT_DIR/../specs/transit-scan.md"
LOG_DIR="$SCRIPT_DIR/../logs"
LOG_FILE="$LOG_DIR/transit-scan-$(date +%Y-%m-%d).log"

mkdir -p "$LOG_DIR"

echo "[$(date)] Starting transit scan" >> "$LOG_FILE"

claude -p "$(cat "$SPEC")" \
  --allowedTools "Bash" \
  --dangerously-skip-permissions \
  --model claude-sonnet-4-6 \
  --max-budget-usd 3.00 \
  >> "$LOG_FILE" 2>&1

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  echo "[$(date)] Transit scan completed successfully" >> "$LOG_FILE"
else
  echo "[$(date)] Transit scan failed with exit code $EXIT_CODE" >> "$LOG_FILE"
fi

exit $EXIT_CODE
