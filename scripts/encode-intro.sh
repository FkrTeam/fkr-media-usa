#!/usr/bin/env bash
#
# Encodes the two intro films into the delivery ladder the site expects.
#
#   bash scripts/encode-intro.sh <landscape-source> <portrait-source>
#   npm run intro -- "/path/to/video1.mp4" "/path/to/video2.mp4"
#
# Writes into public/media/:
#   intro-desktop.mp4 / .webm   1920x1080 landscape — landscape viewports
#   intro-mobile.mp4  / .webm   900x1300  portrait  — portrait viewports
#   intro-poster.jpg            first frame of the landscape film
#   intro-poster-mobile.jpg     first frame of the portrait film
#
# THE TWO CUTS ARE DIFFERENT FILMS, not one film at two sizes. FKR supplied a
# landscape master and a separately framed portrait master, so the site picks
# by viewport orientation (src/utils/device.js, prefersPortraitFilm) rather
# than by bandwidth. Neither cut is downscaled: the portrait master is only
# 900 px wide, and a phone at 3x DPR would show every lost pixel.
#
# A few decisions worth knowing before changing anything here.
#
# AUDIO IS KEPT. The film ships with sound and the intro tries to start
# audible; browsers that refuse audible autoplay get a muted first play and a
# flagged "Sound on" control instead (src/animations/intro.js, _startFilm).
# AAC for MP4 and Opus for WebM, because those are what each container's
# baseline decoder is guaranteed to have.
#
# -movflags +faststart RELOCATES THE MOOV ATOM to the front of the MP4. Without
# it the browser must download the entire file before it knows how to play any
# of it; with it, playback starts on the first buffered seconds.
#
# QUALITY OVER BYTES, WITHIN REASON. The masters are ~10 Mb/s H.264 straight
# out of the edit. x264 at CRF 18 / preset slower is transparent against
# that source; anything lower only re-encodes the master's own compression
# noise more faithfully. VP9 runs two passes — in constant-quality mode the
# first pass gives the second a complexity map, which is worth 10-15% of the
# file at the same quality. Both keep a 2-second GOP so a seek or a stall
# recovers on the next keyframe rather than the next scene.
#
# Requires ffmpeg with libx264 and libvpx-vp9 on PATH.

set -euo pipefail

LAND="${1:-}"
PORT="${2:-}"
if [ -z "$LAND" ] || [ -z "$PORT" ]; then
  echo "usage: bash scripts/encode-intro.sh <landscape-source> <portrait-source>" >&2
  exit 1
fi
for f in "$LAND" "$PORT"; do
  if [ ! -f "$f" ]; then
    echo "error: no such file: $f" >&2
    exit 1
  fi
done

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/public/media"
mkdir -p "$OUT"

# A network path is read many times over the passes; a local copy is faster
# and removes the chance of a stall corrupting an encode halfway through.
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cp "$LAND" "$TMP/landscape.mp4"
cp "$PORT" "$TMP/portrait.mp4"
LAND="$TMP/landscape.mp4"
PORT="$TMP/portrait.mp4"

log() { printf '[intro] %s\n' "$*"; }

# Even dimensions are mandatory for yuv420p; the scale keeps the aspect and
# only touches a master whose size is not already what we want.
X264="-c:v libx264 -preset slower -profile:v high -pix_fmt yuv420p -g 60 -keyint_min 60 -sc_threshold 0"
VP9="-c:v libvpx-vp9 -b:v 0 -row-mt 1 -tile-columns 2 -threads 8 -g 60 -pix_fmt yuv420p"
AAC="-c:a aac -b:a 192k -ac 2 -ar 48000"
OPUS="-c:a libopus -b:a 128k -ac 2"

log "1/6  desktop 1920x1080 H.264"
ffmpeg -hide_banner -loglevel error -y -i "$LAND" \
  -vf "scale=1920:1080:flags=lanczos" \
  $X264 -crf 18 -level 4.1 $AAC -movflags +faststart "$OUT/intro-desktop.mp4"

log "2/6  mobile 900x1300 H.264"
ffmpeg -hide_banner -loglevel error -y -i "$PORT" \
  -vf "scale=900:1300:flags=lanczos" \
  $X264 -crf 18 -level 4.0 $AAC -movflags +faststart "$OUT/intro-mobile.mp4"

log "3/6  desktop 1920x1080 VP9 (two-pass)"
ffmpeg -hide_banner -loglevel error -y -i "$LAND" \
  -vf "scale=1920:1080:flags=lanczos" \
  $VP9 -crf 28 -deadline good -cpu-used 4 -pass 1 -passlogfile "$TMP/desktop" -an -f null /dev/null
ffmpeg -hide_banner -loglevel error -y -i "$LAND" \
  -vf "scale=1920:1080:flags=lanczos" \
  $VP9 -crf 28 -deadline good -cpu-used 1 -auto-alt-ref 1 -lag-in-frames 25 \
  -pass 2 -passlogfile "$TMP/desktop" $OPUS "$OUT/intro-desktop.webm"

log "4/6  mobile 900x1300 VP9 (two-pass)"
ffmpeg -hide_banner -loglevel error -y -i "$PORT" \
  -vf "scale=900:1300:flags=lanczos" \
  $VP9 -crf 28 -deadline good -cpu-used 4 -pass 1 -passlogfile "$TMP/mobile" -an -f null /dev/null
ffmpeg -hide_banner -loglevel error -y -i "$PORT" \
  -vf "scale=900:1300:flags=lanczos" \
  $VP9 -crf 28 -deadline good -cpu-used 1 -auto-alt-ref 1 -lag-in-frames 25 \
  -pass 2 -passlogfile "$TMP/mobile" $OPUS "$OUT/intro-mobile.webm"

log "5/6  desktop poster"
ffmpeg -hide_banner -loglevel error -y -ss 0.2 -i "$LAND" -frames:v 1 -q:v 3 "$OUT/intro-poster.jpg"

log "6/6  mobile poster"
ffmpeg -hide_banner -loglevel error -y -ss 0.2 -i "$PORT" -frames:v 1 -q:v 3 "$OUT/intro-poster-mobile.jpg"

DUR="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT/intro-desktop.mp4" | cut -d. -f1)"

log "done — set siteData.intro.duration in src/data/site.js to ${DUR}"
ls -lh "$OUT" | awk 'NR>1 {printf "         %-24s %s\n", $9, $5}'
