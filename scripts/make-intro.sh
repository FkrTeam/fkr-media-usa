#!/usr/bin/env bash
#
# Generates the 40-second placeholder intro film for FKR Media USA.
#
# The film is procedural: a neutral graphite atmosphere, a flowing "signal
# field" in FKR red (the same visual idea the WebGL hero continues), a warm
# highlight pass on the crests, a film grade and typographic title cards.
# Replace public/media/intro-* with the real brand film.
#
# Requires ffmpeg on PATH.
#   bash scripts/make-intro.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/public/media"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$OUT"

DUR=40
FPS=24

# drawtext needs a real font file; copy one in so the filter can use a
# relative path (Windows drive letters are painful to escape inside filters).
FONT_SRC="${FKR_INTRO_FONT:-/c/Windows/Fonts/bahnschrift.ttf}"
if [ ! -f "$FONT_SRC" ]; then
  FONT_SRC="$(ls /c/Windows/Fonts/segoeui.ttf /usr/share/fonts/**/*.ttf 2>/dev/null | head -1)"
fi
cp "$FONT_SRC" "$TMP/title.ttf"

# ---- Signal field ---------------------------------------------------------
# Six travelling waves at different phases, summed and clamped. Rendered at
# quarter resolution then upscaled — the softness is the point.
wave() { # $1 y-offset  $2 amplitude  $3 wavelength  $4 speed  $5 phase  $6 sigma
  echo "exp(-pow((Y-(H/2+$1+$2*sin(X/$3+T*$4+$5)+($2/2.4)*sin(X/($3/2.6)-T*($4*0.7))))/$6,2))"
}
FIELD="min(1,("
FIELD="$FIELD 0.62*$(wave -96 14 47 0.44 0.0 3.2)"
FIELD="$FIELD + 0.55*$(wave -57 19 61 -0.31 1.7 3.6)"
FIELD="$FIELD + 0.72*$(wave -18 12 38 0.57 3.1 2.8)"
FIELD="$FIELD + 0.72*$(wave  18 16 53 -0.49 4.4 3.0)"
FIELD="$FIELD + 0.55*$(wave  57 21 44 0.36 5.6 3.6)"
FIELD="$FIELD + 0.62*$(wave  96 13 67 -0.27 2.2 3.2)"
FIELD="$FIELD ))"

# ---- Title cards ----------------------------------------------------------
# Letter-spacing is faked with spaces; drawtext has no tracking control.
card() { # $1 text  $2 size  $3 y  $4 in  $5 hold  $6 out
  local a="if(lt(t,$4),0,if(lt(t,$4+1.1),(t-$4)/1.1,if(lt(t,$5),1,if(lt(t,$5+$6),($5+$6-t)/$6,0))))"
  echo "drawtext=fontfile=title.ttf:text='$1':fontcolor=0xF4F2EF:fontsize=$2:x=(w-text_w)/2:y=$3:alpha='$a'"
}

TITLES="$(card 'F K R   M E D I A   U S A' 40 '(h-text_h)/2' 1.6 6.0 1.2)"
TITLES="$TITLES,$(card 'S T R A T E G Y' 78 '(h-text_h)/2' 8.4 13.0 1.1)"
TITLES="$TITLES,$(card 'C R E A T I V I T Y' 78 '(h-text_h)/2' 14.6 19.2 1.1)"
TITLES="$TITLES,$(card 'T E C H N O L O G Y' 78 '(h-text_h)/2' 20.8 25.4 1.1)"
TITLES="$TITLES,$(card 'D I G I T A L   E X P E R I E N C E S' 56 '(h/2)-70' 27.2 33.0 1.2)"
TITLES="$TITLES,$(card 'B U I L T   T O   M O V E   B R A N D S   F O R W A R D' 34 '(h/2)+20' 28.0 33.0 1.2)"
TITLES="$TITLES,$(card 'F K R   M E D I A   U S A' 64 '(h-text_h)/2' 35.0 39.2 0.8)"

echo "→ rendering master (${DUR}s @ ${FPS}fps, 1920x1080)"
cd "$TMP"

ffmpeg -hide_banner -loglevel error -y \
  -f lavfi -i "gradients=s=1920x1080:c0=0x141414:c1=0x050505:c2=0x3A1512:c3=0x0C0C0C:x0=180:y0=80:x1=1740:y1=1000:nb_colors=4:seed=11:speed=0.006:d=$DUR:r=$FPS" \
  -f lavfi -i "color=c=black:s=480x270:r=$FPS:d=$DUR" \
  -filter_complex "\
    [0:v]format=gbrp,gblur=sigma=70,eq=brightness=-0.06:saturation=1.15,format=gbrp[atmos]; \
    [1:v]format=gray,geq=lum='255*($FIELD)',split=2[g1][g2]; \
    [g1]format=gbrp,colorchannelmixer=rr=0.93:gg=0.28:bb=0.24,scale=1920:1080:flags=bicubic,split=2[fld][blm]; \
    [g2]format=gbrp,curves=all='0/0 0.74/0 1/1',colorchannelmixer=rr=1.0:gg=0.89:bb=0.875,scale=1920:1080:flags=bicubic,gblur=sigma=5[warm]; \
    [blm]gblur=sigma=34,eq=brightness=0.02,format=gbrp[bloom]; \
    [atmos][fld]blend=all_mode=screen:all_opacity=0.58[s1]; \
    [s1][bloom]blend=all_mode=screen:all_opacity=0.38[s2]; \
    [s2][warm]blend=all_mode=screen:all_opacity=0.55[s3]; \
    [s3]curves=preset=increase_contrast,vignette=PI/4.2,$TITLES,\
noise=alls=7:allf=t+u,fade=t=in:st=0:d=1.8,format=yuv420p[v]" \
  -map "[v]" -t $DUR -r $FPS \
  -c:v libx264 -preset veryfast -crf 14 -pix_fmt yuv420p master.mp4

echo "→ encoding delivery variants"

# Desktop MP4 (H.264 — universal)
ffmpeg -hide_banner -loglevel error -y -i master.mp4 \
  -c:v libx264 -preset slow -crf 27 -pix_fmt yuv420p -profile:v high -movflags +faststart -an \
  "$OUT/intro-desktop.mp4"

# Desktop WebM (VP9 — smaller where supported)
ffmpeg -hide_banner -loglevel error -y -i master.mp4 \
  -c:v libvpx-vp9 -crf 38 -b:v 0 -row-mt 1 -cpu-used 4 -deadline good -pix_fmt yuv420p -an \
  "$OUT/intro-desktop.webm"

# Mobile variants — never ship the desktop file to a phone
ffmpeg -hide_banner -loglevel error -y -i master.mp4 -vf "scale=960:540" \
  -c:v libx264 -preset slow -crf 30 -pix_fmt yuv420p -profile:v high -movflags +faststart -an \
  "$OUT/intro-mobile.mp4"

ffmpeg -hide_banner -loglevel error -y -i master.mp4 -vf "scale=960:540" \
  -c:v libvpx-vp9 -crf 42 -b:v 0 -row-mt 1 -cpu-used 5 -deadline good -pix_fmt yuv420p -an \
  "$OUT/intro-mobile.webm"

# Poster frame — replaces the vector placeholder with a real first frame
ffmpeg -hide_banner -loglevel error -y -ss 3 -i master.mp4 -frames:v 1 -q:v 6 \
  "$OUT/intro-poster.jpg"

echo "→ done"
ls -la "$OUT"
