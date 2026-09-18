#!/bin/bash
# Builds Print58.app (with print58.sh inside it) and puts it in a disk image,
# plus the bare script, into public/downloads/ for the web app's download links.
# The .dmg opens to the app beside an Applications shortcut to drag it onto.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/public/downloads"
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
APP="$TMP/Print58.app"

osacompile -o "$APP" "$ROOT/mac/Print58.applescript"
cp "$ROOT/print58.sh" "$ROOT/mac/run.sh" "$APP/Contents/Resources/"
chmod +x "$APP/Contents/Resources/"*.sh
plutil -replace CFBundleIdentifier -string local.print58 "$APP/Contents/Info.plist"
# Ad-hoc signature: osacompile's is invalidated by the files added above.
codesign --force --deep -s - "$APP"

STAGE="$TMP/dmg"
mkdir -p "$STAGE"
mv "$APP" "$STAGE/"
ln -s /Applications "$STAGE/Applications"

mkdir -p "$OUT"
rm -f "$OUT/Print58.zip" "$OUT/Print58.dmg"
hdiutil create -quiet -volname "Print58" -srcfolder "$STAGE" -fs HFS+ -format UDZO -ov "$OUT/Print58.dmg"
cp "$ROOT/print58.sh" "$OUT/print58.sh"
echo "built $OUT/Print58.dmg and $OUT/print58.sh"
