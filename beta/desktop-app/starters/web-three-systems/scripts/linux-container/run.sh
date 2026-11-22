#!/bin/bash
# One command, on a Mac with Docker: build this project for arm64
# Linux in a container, start the real app under X11 and under Wayland, and
# leave the evidence in a folder.
#
#   scripts/linux-container/run.sh [--out <folder>] [--idle <seconds>] [--sessions "x11 sway weston"]
#                                  [--variants "<names>"] [--keep-image]
#
#   --out       where the evidence goes (default: measure/out/shell/linux in the project)
#   --idle      seconds the app sits idle before memory is read (default 30; 300 judges the budget)
#   --sessions  which displays to run (default: all three)
#   --variants  which variants to run in each (default: all that apply; see inside/session.sh).
#               An app adds its own variants there, such as a run of the real page against the
#               real tool (build 2's measure/final.mjs)
#   --keep-image  keep the built image for the next run; otherwise it is removed by its id
#
# For each session and variant the folder gets: summary.json (the checks),
# diagnostics*.json (the app's own description), memory.json, page.png (the
# page), display-*.png (the whole display, with the window's buttons and
# frame), what the window manager or compositor reported, and sandbox-*.txt.
#
# The Chromium sandbox stays on. Docker's default seccomp profile blocks the
# user namespaces that sandbox is made of, so the containers run with
# --security-opt seccomp=unconfined. Nothing else is relaxed: no --no-sandbox,
# no extra capabilities, not privileged, and the app runs as an ordinary user.
#
# Containers are removed as each run ends (--rm). Nothing is pruned.
set -eu
HERE=$(cd "$(dirname "$0")" && pwd)
PROJECT=$(cd "$HERE/../.." && pwd)
OUT=$PROJECT/measure/out/shell/linux
IDLE=30
SESSIONS="x11 sway weston"
VARIANTS=
KEEP=0
while [ $# -gt 0 ]; do
  case "$1" in
    --out) OUT=$2; shift 2 ;;
    --idle) IDLE=$2; shift 2 ;;
    --sessions) SESSIONS=$2; shift 2 ;;
    --variants) VARIANTS=$2; shift 2 ;;
    --keep-image) KEEP=1; shift ;;
    *) echo "unknown option $1" >&2; exit 2 ;;
  esac
done
mkdir -p "$OUT"
OUT=$(cd "$OUT" && pwd)

TAG=starter-shell-linux:$(git -C "$PROJECT" rev-parse --short HEAD 2>/dev/null || echo local)
echo "building $TAG (log: $OUT/build.log)"
nice -n 10 docker build --platform linux/arm64 -f "$HERE/Dockerfile" -t "$TAG" "$PROJECT" >"$OUT/build.log" 2>&1 || { tail -30 "$OUT/build.log"; exit 1; }
IMAGE=$(docker image inspect --format '{{.Id}}' "$TAG")
echo "image $IMAGE"

failed=0
for session in $SESSIONS; do
  rm -rf "${OUT:?}/$session"
  # Long enough for every variant, then the container is stopped whatever happened inside.
  limit=$((IDLE + 600))
  nice -n 10 docker run --rm --name "starter-shell-$session-$$" --platform linux/arm64 --shm-size=1g \
    --security-opt seccomp=unconfined \
    -e IDLE="$IDLE" -e VARIANTS="$VARIANTS" \
    -v "$OUT":/out "$TAG" \
    timeout "$limit" scripts/linux-container/inside/session.sh "$session" "/out/$session" || failed=1
done

if [ "$KEEP" = 0 ]; then
  docker image rm "$IMAGE" >/dev/null && echo "removed image $IMAGE"
fi
echo
cat "$OUT"/*/results.txt 2>/dev/null
[ "$failed" = 0 ] && echo "passed: $OUT" || { echo "FAILED: $OUT"; exit 1; }
