#!/usr/bin/env bash
#
# Encodes the intro film into the delivery ladder the site expects.
#
#   bash scripts/encode-intro.sh <source-video>
#   npm run intro -- "/path/to/Fkrmedya_2.mp4"
#
# Writes into public/media/:
#   intro-desktop.mp4 / .webm   1920x1080  — width >= 1024 and a good link
#   intro-mobile.mp4  / .webm   1280x720   — narrow screens, Data Saver, 2g/3g
#   intro-poster.jpg            first frame, shown before playback starts
#
# Two decisions are worth knowing before changing anything here.
#
# AUDIO IS KEPT. The film ships with sound and the intro tries to start
# audible; browsers that refuse audible autoplay get a muted first play and a
# flagged "Sound on" control instead (src/animations/intro.js, _startFilm).
# AAC for MP4 and Opus for WebM, because those are what each container's
# baseline decoder is guaranteed to have.
#
# -movflags +faststart RELOCATES THE MOOV ATOM to the front of the MP4. Without
# it the browser must download the entire file before it knows how to play any
# of it; with it, playback starts on the first buffered seconds. On a 20 MB
# intro that is the difference between a film and a wait.
#
# CRF values were chosen by measuring this footage, not by habit: the busiest
# ten seconds (paint splashes, water, a rider at speed) were encoded across a
# CRF ladder and the knee was where quality stopped being visibly better.
# Re-measure if the film is replaced with materially different content.
#
# Requires ffmpeg with libx264 and libvpx-vp9 on PATH.

set -euo pipefail

SRC="${1:-}"
if [ -z "$SRC" ]; then
  echo "usage: bash scripts/encode-intro.sh <source-video>" >&2
  exit 1
fi
if [ ! -f "$SRC" ]; then
  echo "error: no such file: $SRC" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/public/media"
mkdir -p "$OUT"

# A network path is read many times over four passes; a local copy is faster
# and removes the chance of a stall corrupting an encode halfway through.
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cp "$SRC" "$TMP/source.mp4"
SRC="$TMP/source.mp4"

log() { printf '[intro] %s\n' "$*"; }

log "1/5  desktop 1920x1080 H.264"
ffmpeg -hide_banner -loglevel error -y -i "$SRC" \
  -c:v libx264 -crf 21 -preset slow -profile:v high -level 4.1 \
  -pix_fmt yuv420p -g 60 -c:a aac -b:a 160k -ac 2 -ar 48000 -movflags +faststart "$OUT/intro-desktop.mp4"

log "2/5  mobile 1280x720 H.264"
ffmpeg -hide_banner -loglevel error -y -i "$SRC" \
  -vf "scale=1280:720:flags=lanczos" \
  -c:v libx264 -crf 24 -preset slow -profile:v main -level 3.1 \
  -pix_fmt yuv420p -g 60 -c:a aac -b:a 128k -ac 2 -ar 48000 -movflags +faststart "$OUT/intro-mobile.mp4"

log "3/5  desktop 1920x1080 VP9"
ffmpeg -hide_banner -loglevel error -y -i "$SRC" \
  -c:v libvpx-vp9 -crf 32 -b:v 0 -row-mt 1 -tile-columns 2 -threads 8 \
  -deadline good -cpu-used 2 -g 60 -pix_fmt yuv420p   -c:a libopus -b:a 128k "$OUT/intro-desktop.webm"

log "4/5  mobile 1280x720 VP9"
ffmpeg -hide_banner -loglevel error -y -i "$SRC" \
  -vf "scale=1280:720:flags=lanczos" \
  -c:v libvpx-vp9 -crf 34 -b:v 0 -row-mt 1 -tile-columns 2 -threads 8 \
  -deadline good -cpu-used 2 -g 60 -pix_fmt yuv420p   -c:a libopus -b:a 96k "$OUT/intro-mobile.webm"

log "5/5  poster"
ffmpeg -hide_banner -loglevel error -y -ss 0.2 -i "$SRC" -frames:v 1 -q:v 7 "$OUT/intro-poster.jpg"

DUR="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT/intro-desktop.mp4" | cut -d. -f1)"

log "done — set siteData.intro.duration in src/data/site.js to ${DUR}"
ls -lh "$OUT" | awk 'NR>1 {printf "         %-24s %s\n", $9, $5}'
