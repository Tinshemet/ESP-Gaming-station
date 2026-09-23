#!/usr/bin/env bash
# One-shot build+flash for Tinshemet's Gaming Cabinet.
#   bundle web -> clean compile (huge_app) -> upload -> verify.
# Usage:  ./flash-cabinet.sh            (auto: /dev/ttyUSB0)
#         ./flash-cabinet.sh /dev/ttyUSB1
set -u
export PATH="$HOME/.local/bin:$PATH"
ROOT="$(cd "$(dirname "$0")" && pwd)"
SKETCH="$ROOT/GamingCabinet"
FQBN="esp32:esp32:esp32:PartitionScheme=huge_app"

c_mag=$'\033[1;35m'; c_red=$'\033[1;31m'; c_yel=$'\033[1;33m'; c_grn=$'\033[1;32m'; c_off=$'\033[0m'
say(){ printf '\n%s== %s%s\n' "$c_mag" "$*" "$c_off"; }
die(){ printf '\n%sFLASH ABORTED:%s %s\n' "$c_red" "$c_off" "$*" >&2; exit 1; }

command -v arduino-cli >/dev/null 2>&1 || die "arduino-cli not on PATH"
[ -d "$SKETCH" ] || die "sketch folder not found: $SKETCH"

# port
PORT="${1:-/dev/ttyUSB0}"
[ -e "$PORT" ] || die "no serial port at $PORT — is the board plugged in?"
say "Target port: $PORT"
if [ ! -w "$PORT" ]; then
  say "Port not writable — trying: sudo chmod 666 $PORT"
  sudo chmod 666 "$PORT" || die "could not chmod $PORT (run:  sudo chmod 666 $PORT)"
fi

# 1) bundle the web app into the PROGMEM header
say "Bundling web app -> webassets.h"
bash "$ROOT/tools/bundle.sh" || die "bundle step failed"

# 2) clean compile
say "Compiling (--clean, huge_app) …"
arduino-cli compile --clean --fqbn "$FQBN" "$SKETCH" || die "compile failed — see errors above."

# 3) upload
say "Uploading to $PORT …"
LOG="$(mktemp)"
if ! arduino-cli upload -p "$PORT" --fqbn "$FQBN" "$SKETCH" 2>&1 | tee "$LOG"; then
  rm -f "$LOG"; die "upload failed."
fi

# 4) verify
if grep -qiE 'Wrote [0-9]+ bytes|Hash of data verified' "$LOG"; then
  printf '\n%sOK — Gaming Cabinet written to %s.%s\n' "$c_grn" "$PORT" "$c_off"
else
  printf '\n%sWARNING:%s upload finished but no "Wrote …" line seen — scroll up.\n' "$c_yel" "$c_off"
fi
rm -f "$LOG"
cat <<EOF

Next: power the board, join Wi-Fi "Free Games 🎮 Join Me" on your phone,
and the arcade should pop up (or open http://192.168.4.1).
EOF
