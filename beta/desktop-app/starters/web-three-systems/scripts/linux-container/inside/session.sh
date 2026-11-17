#!/bin/bash
# Runs inside the container: brings up one display, then starts the real app
# once per variant and collects the evidence for each.
#
#   session.sh <x11|sway|weston> <out folder>
#
#   x11     Xvfb with the openbox window manager
#   sway    sway, headless, Xwayland off (a compositor that offers its own window frames)
#   weston  weston, headless (a compositor that leaves the frame to the app)
#
# Environment:
#   IDLE      seconds the "shipped" variant waits before memory is read (default 30; 300 judges the budget)
#   VARIANTS  which to run (default: all that apply to the session)
#
# Variants:
#   shipped          the app as it is, with the menu, file, full-screen and key steps
#   buttons-left     the desktop asks for window buttons on the left; the page must be told
#   frameless        the same window with frame: false added, to compare with "shipped"
#   no-session-type  Wayland only: WAYLAND_DISPLAY set but XDG_SESSION_TYPE missing; the app must end up on Wayland
set -u
export SESSION=$1
OUT=$2
IDLE=${IDLE:-30}
HERE=$(cd "$(dirname "$0")" && pwd)
PROJECT=$(cd "$HERE/../../.." && pwd)
mkdir -p "$OUT"

# A session bus, so the app's bus calls have something to talk to.
if [ -z "${DBUS_SESSION_BUS_ADDRESS:-}" ]; then exec dbus-run-session -- "$0" "$@"; fi

SIZE=1600x1000
case "$SESSION" in
  x11)
    Xvfb :99 -screen 0 ${SIZE}x24 -nolisten tcp >"$OUT/xvfb.log" 2>&1 &
    SERVER=$!
    for _ in $(seq 100); do [ -S /tmp/.X11-unix/X99 ] && break; sleep 0.1; done
    export DISPLAY=:99 XDG_SESSION_TYPE=x11
    unset WAYLAND_DISPLAY
    xsetroot -solid "#336699"
    openbox >"$OUT/openbox.log" 2>&1 &
    MANAGER=$!
    sleep 1
    ;;
  sway | weston)
    export XDG_RUNTIME_DIR=/tmp/xdg-$(id -u)
    rm -rf "$XDG_RUNTIME_DIR"; mkdir -p "$XDG_RUNTIME_DIR"; chmod 700 "$XDG_RUNTIME_DIR"
    unset DISPLAY
    if [ "$SESSION" = sway ]; then
      WLR_BACKENDS=headless WLR_RENDERER=pixman WLR_LIBINPUT_NO_DEVICES=1 sway -c "$HERE/sway.conf" >"$OUT/sway.log" 2>&1 &
    else
      weston --backend=headless-backend.so --use-pixman --width=${SIZE%x*} --height=${SIZE#*x} --debug --idle-time=0 >"$OUT/weston.log" 2>&1 &
    fi
    SERVER=$!
    MANAGER=
    SOCKET=
    for _ in $(seq 100); do
      SOCKET=$(ls "$XDG_RUNTIME_DIR" 2>/dev/null | grep -E '^wayland-[0-9]+$' | head -1)
      [ -n "$SOCKET" ] && break
      sleep 0.1
    done
    export WAYLAND_DISPLAY=$SOCKET XDG_SESSION_TYPE=wayland
    if [ "$SESSION" = sway ]; then export SWAYSOCK=$(ls "$XDG_RUNTIME_DIR"/sway-ipc.* | head -1); fi
    ;;
  *)
    echo "unknown session $SESSION"; exit 2
    ;;
esac
echo "session=$SESSION DISPLAY=${DISPLAY:-} WAYLAND_DISPLAY=${WAYLAND_DISPLAY:-} XDG_SESSION_TYPE=$XDG_SESSION_TYPE" | tee "$OUT/session.txt"

# One start of the app: name, idle seconds, steps, then options for the evidence script.
run() {
  local name=$1 idle=$2 steps=$3
  shift 3
  mkdir -p "$OUT/$name"
  node "$PROJECT/measure/shell-evidence.mjs" --out "$OUT/$name" --idle "$idle" --steps "$steps" --observe "$HERE/observe.sh" "$@" >"$OUT/$name/run.log" 2>&1
  local code=$?
  echo "$SESSION/$name $([ $code = 0 ] && echo passed || echo FAILED)" | tee -a "$OUT/results.txt"
  grep -E '^FAIL' "$OUT/$name/run.log" | sed 's/^/    /'
}

DEFAULT="shipped buttons-left frameless"
[ "$SESSION" = x11 ] || DEFAULT="$DEFAULT no-session-type"
rm -f "$OUT/results.txt"
for variant in ${VARIANTS:-$DEFAULT}; do
  case "$variant" in
    shipped)
      run shipped "$IDLE" menu,open-file,full-screen,keys
      ;;
    buttons-left)
      # GTK reads the button layout from here when no desktop settings service is running.
      mkdir -p "$HOME/.config/gtk-3.0" "$HOME/.config/gtk-4.0"
      printf '[Settings]\ngtk-decoration-layout=close,minimize,maximize:\n' | tee "$HOME/.config/gtk-3.0/settings.ini" >"$HOME/.config/gtk-4.0/settings.ini"
      run buttons-left 5 close-reopen --expect-buttons left
      rm -f "$HOME/.config/gtk-3.0/settings.ini" "$HOME/.config/gtk-4.0/settings.ini"
      ;;
    frameless)
      run frameless 5 "" -- '--qa-window-options={"frame":false}'
      ;;
    no-session-type)
      # A session that sets WAYLAND_DISPLAY but not XDG_SESSION_TYPE, as a compositor started
      # from a console does. Electron would choose X11 and, with no X server, not start; the
      # app notices and starts itself again on Wayland (electron/platform.cjs). Each launch
      # here hands over to a second process, so this variant waits instead of watching one.
      (
        unset XDG_SESSION_TYPE
        dir=$OUT/no-session-type
        data=$(mktemp -d)
        electron=$PROJECT/node_modules/electron/dist/electron
        mkdir -p "$dir"
        "$electron" "$PROJECT" --no-activate "--data-dir=$data" >"$dir/app.log" 2>&1 &
        sleep 8
        # Requests go through the app's control channel (electron/control.cjs), never a second instance.
        node "$PROJECT/scripts/control.cjs" --data-dir "$data" -- "--diagnostics=$dir/diagnostics.json" >/dev/null 2>&1
        sleep 4
        OBSERVE_OUT=$dir OBSERVE_NAME=window APP_PID=$(grep -m1 -o '"pid": [0-9]*' "$dir/diagnostics.json" | grep -o '[0-9]*$') "$HERE/observe.sh"
        node "$PROJECT/scripts/control.cjs" --data-dir "$data" -- --quit >/dev/null 2>&1
        sleep 4
        rm -rf "$data"
        if grep -q '"type": "wayland"' "$dir/diagnostics.json" 2>/dev/null && grep -q '"visible": true' "$dir/diagnostics.json"; then
          echo "$SESSION/no-session-type passed" | tee -a "$OUT/results.txt"
        else
          echo "$SESSION/no-session-type FAILED" | tee -a "$OUT/results.txt"
          head -5 "$dir/app.log" | sed 's/^/    /'
        fi
      )
      ;;
  esac
done

[ -n "$MANAGER" ] && kill "$MANAGER"
kill "$SERVER"
! grep -q FAILED "$OUT/results.txt"
