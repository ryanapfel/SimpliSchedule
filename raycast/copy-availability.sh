#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Copy Availability
# @raycast.mode silent
# @raycast.packageName Scheduling

# Optional parameters:
# @raycast.icon 📅
# @raycast.argument1 { "type": "text", "placeholder": "days (default 5)", "optional": true }
# @raycast.argument2 { "type": "text", "placeholder": "booking link slug (optional)", "optional": true }
# @raycast.argument3 { "type": "text", "placeholder": "timezone (optional)", "optional": true }

# Documentation:
# @raycast.description Copies pasteable availability text to the clipboard; time blocks link to your booking page.
# @raycast.author scheduling

# Config lives in ~/.config/scheduling/env:
#   SCHEDULING_URL=https://your-host
#   SCHEDULING_API_KEY=sched_...
#   SCHEDULING_EVENT_TYPE=intro          # optional default slug
#   SCHEDULING_TZ=America/Los_Angeles    # optional default timezone

set -euo pipefail
CONFIG="${HOME}/.config/scheduling/env"
if [[ ! -f "$CONFIG" ]]; then
  echo "Missing $CONFIG"
  exit 1
fi
# shellcheck disable=SC1090
source "$CONFIG"

DAYS="${1:-5}"
EVENT_TYPE="${2:-${SCHEDULING_EVENT_TYPE:-}}"
TZ_NAME="${3:-${SCHEDULING_TZ:-}}"

QUERY="days=${DAYS}"
[[ -n "$EVENT_TYPE" ]] && QUERY="${QUERY}&eventType=${EVENT_TYPE}"
[[ -n "$TZ_NAME" ]] && QUERY="${QUERY}&tz=${TZ_NAME}"

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
fetch() {
  curl -fsS -H "Authorization: Bearer ${SCHEDULING_API_KEY}" \
    "${SCHEDULING_URL%/}/api/availability/text?${QUERY}$1" || {
    echo "Request failed — check SCHEDULING_URL / SCHEDULING_API_KEY"
    exit 1
  }
}
fetch "" > "$TMP/text.txt"
fetch "&format=html" > "$TMP/text.html"

# Plain text plus HTML on the pasteboard: rich-text targets (Mail, Gmail, Notion) get each time
# block as a link to the booking page; everything else gets the plain text.
osascript - "$TMP/text.txt" "$TMP/text.html" 2>/dev/null <<'EOT'
on run argv
  set textData to read POSIX file (item 1 of argv) as «class utf8»
  set htmlData to read POSIX file (item 2 of argv) as «class HTML»
  set the clipboard to {«class utf8»:textData, «class HTML»:htmlData}
end run
EOT
echo "Availability copied"
