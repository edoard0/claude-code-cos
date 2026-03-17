#!/bin/bash
# COS Layer 2: Daily Inbox Scan
# Runs overnight via LaunchAgent. Scans yesterday's email, classifies by priority,
# creates reply drafts for P1/P2, and writes a digest to ~/claudeCOS/digests/.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SPEC="$SCRIPT_DIR/../specs/inbox-scan.md"
LOG_DIR="$SCRIPT_DIR/../logs"
LOG_FILE="$LOG_DIR/inbox-scan-$(date +%Y-%m-%d).log"

mkdir -p "$LOG_DIR"
mkdir -p "$HOME/.config/cos"
mkdir -p "$SCRIPT_DIR/../digests"

echo "[$(date)] Starting inbox scan" >> "$LOG_FILE"

claude -p "$(cat "$SPEC")" \
  --allowedTools "Bash,Read,Write" \
  --dangerously-skip-permissions \
  --model claude-sonnet-4-6 \
  --max-budget-usd 2.00 \
  >> "$LOG_FILE" 2>&1

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  echo "[$(date)] Inbox scan completed successfully" >> "$LOG_FILE"
else
  echo "[$(date)] Inbox scan failed with exit code $EXIT_CODE" >> "$LOG_FILE"
fi

exit $EXIT_CODE
