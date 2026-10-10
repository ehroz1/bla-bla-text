#!/usr/bin/env bash
# Generates the synthetic media files used by tests/e2e.mjs (requires ffmpeg).
set -euo pipefail
out="${1:-tests/fixtures}"
mkdir -p "$out"
q=(-loglevel error -y)
ffmpeg "${q[@]}" -f lavfi -i "sine=frequency=440:duration=20" -ac 2 -ar 44100 "$out/short.wav"
ffmpeg "${q[@]}" -f lavfi -i "sine=frequency=300:duration=2400" -b:a 64k "$out/long.mp3"
ffmpeg "${q[@]}" -f lavfi -i testsrc=size=320x240:rate=25:duration=30 -f lavfi -i "sine=frequency=500:duration=30" \
  -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest "$out/clip.mp4"
ffmpeg "${q[@]}" -f lavfi -i testsrc=size=320x240:rate=25:duration=10 -f lavfi -i "sine=frequency=500:duration=10" \
  -c:v libvpx -c:a libopus -shortest "$out/clip.webm"
echo "Fixtures written to $out"
