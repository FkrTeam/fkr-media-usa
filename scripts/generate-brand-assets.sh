#!/usr/bin/env bash
#
# Derives the favicon, apple-touch icon and Open Graph card from the supplied
# FKR MEDIA USA logo artwork.
#
# Nothing here recolours or redraws the logo. The master PNG is composited
# unchanged onto brand-correct grounds:
#   - the FKR mark (red on transparent) sits on near-black
#   - the full lockup, whose MEDIA wordmark is black, sits on a warm
#     off-white plate so it stays readable
#
# Requires ffmpeg on PATH.
#   bash scripts/generate-brand-assets.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BRAND="$ROOT/public/brand"
OUT_IMG="$ROOT/public/images"
MASTER="$BRAND/fkr-media-usa-logo.png"
MARK="$BRAND/fkr-mark.png"

VOID="0x050505"
PAPER="0xF4F2EF"

mkdir -p "$OUT_IMG"

if [ ! -f "$MASTER" ]; then
  echo "Missing $MASTER — supply the logo artwork first." >&2
  exit 1
fi

# ---- FKR mark: crop the red mark out of the master lockup -----------------
# Bounds measured from the artwork's alpha channel: the mark occupies
# x 0-841, y 34-333; the full-height divider bar starts at x 890.
echo "→ mark"
ffmpeg -hide_banner -loglevel error -y -i "$MASTER" -vf "crop=842:300:0:34" "$MARK"

# ---- Favicon: mark letterboxed on the logo's own black -------------------
echo "→ favicon"
ffmpeg -hide_banner -loglevel error -y \
  -f lavfi -i "color=c=$VOID:s=512x512" -i "$MARK" \
  -filter_complex "[1:v]scale=416:-1[m];[0:v][m]overlay=(W-w)/2:(H-h)/2:format=auto,format=rgb24" \
  -frames:v 1 "$ROOT/public/favicon.png"

ffmpeg -hide_banner -loglevel error -y -i "$ROOT/public/favicon.png" -vf "scale=180:180" \
  "$ROOT/public/apple-touch-icon.png"

# ---- Open Graph card ------------------------------------------------------
# Black card, one soft ember at the top, and the full lockup presented on a
# warm off-white plate — the same treatment the site footer uses.
echo "→ og card"
ffmpeg -hide_banner -loglevel error -y \
  -f lavfi -i "color=c=$VOID:s=1200x630" \
  -f lavfi -i "color=c=0xEE473D:s=1200x630" \
  -f lavfi -i "color=c=$PAPER:s=660x196" \
  -i "$MASTER" \
  -filter_complex "\
    [1:v]format=gray,geq=lum='255*exp(-(pow((X-600)/620,2)+pow((Y+60)/340,2)))',format=gbrp,\
colorchannelmixer=rr=0.93:gg=0.28:bb=0.24,gblur=sigma=60[ember]; \
    [0:v]format=gbrp[bg]; \
    [bg][ember]blend=all_mode=screen:all_opacity=0.30[base]; \
    [3:v]scale=560:-1[logo]; \
    [2:v][logo]overlay=(W-w)/2:(H-h)/2[plate]; \
    [base][plate]overlay=(W-w)/2:(H-h)/2,format=yuv420p[v]" \
  -map "[v]" -frames:v 1 -q:v 3 "$OUT_IMG/og.jpg"

# The old vector OG source is superseded by the composited card.
rm -f "$OUT_IMG/og.svg"

echo "→ done"
ls -la "$BRAND" "$ROOT/public/favicon.png" "$ROOT/public/apple-touch-icon.png" "$OUT_IMG/og.jpg"
