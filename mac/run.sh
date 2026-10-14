#!/bin/bash
# Launcher inside Print58.app.  An app gets PATH=/usr/bin:/bin and no terminal,
# so find what print58.sh needs, pick the printer, then hand over with
# PRINT58_GUI=1 so the tear-off pause asks with a dialog.  PDFs go to
# print58.sh, images to printimg58.sh (which prepares them, then hands over to
# print58.sh itself).
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

command -v gs >/dev/null || { echo "Ghostscript is not installed. In Terminal run:  brew install ghostscript" >&2; exit 1; }

PDFS=() IMAGES=()
for f in "$@"; do
  case "$(printf %s "$f" | tr A-Z a-z)" in *.pdf) PDFS+=("$f") ;; *) IMAGES+=("$f") ;; esac
done

# The first python3 that can import Pillow (and numpy, for images); the bare
# PATH one often can't.
MODS=PIL; [ ${#IMAGES[@]} -gt 0 ] && MODS="PIL, numpy"
PY=""
for c in "$HOME/.pyenv/shims/python3" /opt/homebrew/bin/python3 /usr/local/bin/python3 /usr/bin/python3; do
  if [ -x "$c" ] && "$c" -c "import $MODS" 2>/dev/null; then PY="$c"; break; fi
done
[ -n "$PY" ] || { echo "Python 3 with Pillow${IMAGES:+ and numpy} was not found. In Terminal run:  python3 -m pip install --user Pillow${IMAGES:+ numpy}" >&2; exit 1; }
BIN=$(mktemp -d); trap 'rm -rf "$BIN"' EXIT
ln -s "$PY" "$BIN/python3"
export PATH="$BIN:$PATH"

# Printer: remembered choice, else SRS583, else ask once from what CUPS has.
PRINTER=$(defaults read local.print58 printer 2>/dev/null || echo SRS583)
if ! lpstat -p "$PRINTER" >/dev/null 2>&1; then
  LIST=$(lpstat -p 2>/dev/null | awk '/^printer /{ printf "%s\"%s\"", (n++ ? ", " : ""), $2 }')
  [ -n "$LIST" ] || { echo "No printers are set up on this Mac. Add the 58mm printer in System Settings > Printers & Scanners first." >&2; exit 1; }
  PRINTER=$(osascript -e "set r to choose from list {$LIST} with title \"Print58\" with prompt \"Which printer is the 58mm thermal printer?\"" -e 'if r is false then return ""' -e 'item 1 of r' 2>/dev/null)
  [ -n "$PRINTER" ] || exit 0
  defaults write local.print58 printer "$PRINTER"
fi

export PRINT58_GUI=1
if [ ${#PDFS[@]} -gt 0 ]; then
  /bin/bash "$HERE/print58.sh" -p "$PRINTER" "${PDFS[@]}" || exit $?
fi
if [ ${#IMAGES[@]} -gt 0 ]; then
  /bin/bash "$HERE/printimg58.sh" -p "$PRINTER" "${IMAGES[@]}" || exit $?
fi
