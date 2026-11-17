#!/bin/sh
# Checks the installed app on macOS or Linux through files, never through input
# events. Windows has installed-check.ps1; the steps mean the same there.
#
#   scripts/installed-check.sh <step>
#
#   list      what is installed: files, helpers, notices, and on macOS the signature of the
#             bundle and of every helper; on Linux the package, sandbox helper, desktop entry, icons
#   helpers   run every bundled helper from its installed location, started by the installed
#             app's own executable with PATH emptied (installed-helpers.cjs)
#   launch    start the app from its real launcher: `open` on the bundle (macOS), the command
#             line in the installed desktop entry (Linux)
#   collect   ask the running app (through its control channel, never a second launch) for its
#             diagnostics and a picture of its window, and report
#             where it runs from and what it says about its tool
#   memory    memory over the running app's processes, by this system's definition of private
#             memory: `footprint` on macOS, Anonymous + Swap from smaps_rollup on Linux
#   quit      ask the running app to close
#   uninstall remove the installed copy (never the data folder)
#
# Environment:
#   INSTALL_TO     macOS: the Applications folder used by install.sh (default ~/Applications)
#                  Linux portable: the folder it was unpacked into (default ~/.local/opt)
#   KIND           Linux: deb (default) or portable
#   DATA_DIR       keep the app's data here; required by collect and quit, which find the running
#                  app's control channel through control.json there
#   NO_ACTIVATE=1  launch without taking focus (the app then serves its control channel)
#   EMPTY_PATH=1   launch with PATH emptied, to prove nothing is looked up there
#   LAUNCH_EXTRA   launch only: more arguments, separated by spaces, for example
#                  "--remote-debugging-port=9333 --mute-audio" so a script can drive the
#                  page with input events through the DevTools protocol, silently (build 2: measure/final.mjs);
#                  --control makes an app launched without NO_ACTIVATE serve its control channel
#   EVIDENCE       where installed-<step>.txt and the other result files go (default qa/evidence)
#
# On macOS keep DATA_DIR and EVIDENCE on the internal disk. An app started by
# `open` that touches a removable or network volume waits for a privacy prompt
# that nobody is there to answer, and stops at its first file call.
#   PACKAGE_ENV    the names file package.mjs wrote (default out/package.env)
set -u
STEP=${1:-list}
HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$HERE/.." && pwd)
EVIDENCE=${EVIDENCE:-$ROOT/qa/evidence}
PACKAGE_ENV=${PACKAGE_ENV:-$ROOT/out/package.env}
mkdir -p "$EVIDENCE"
# shellcheck disable=SC1090
. "$PACKAGE_ENV"
OUT="$EVIDENCE/installed-$STEP.txt"
: > "$OUT"
say() { echo "$*" | tee -a "$OUT"; }
OS=$(uname -s)
ARCH=$(uname -m | sed -e 's/x86_64/x64/' -e 's/aarch64/arm64/')
KIND=${KIND:-deb}
say "step $STEP at $(date +%Y-%m-%dT%H:%M:%S%z) on $OS $ARCH"

if [ "$OS" = Darwin ]; then
  APP="${INSTALL_TO:-$HOME/Applications}/$PRODUCT_NAME.app"
  APPROOT="$APP"
  BIN="$APP/Contents/MacOS/$EXE_NAME"
  RES="$APP/Contents/Resources"
  TARGET="darwin-$ARCH"
else
  if [ "$KIND" = portable ]; then APPROOT="${INSTALL_TO:-$HOME/.local/opt}/$LINUX_NAME-$VERSION-linux-$ARCH"; else APPROOT="/opt/$LINUX_NAME"; fi
  BIN="$APPROOT/$LINUX_NAME"
  RES="$APPROOT/resources"
  TARGET="linux-$ARCH"
fi

# The arguments every call to the installed app carries.
common() {
  if [ -n "${DATA_DIR:-}" ]; then printf '%s\n' "--data-dir=$DATA_DIR"; fi
  if [ "${NO_ACTIVATE:-}" = 1 ]; then printf '%s\n' "--no-activate"; fi
}
# Process ids of the app: every process whose program file is inside the installed app.
pids() {
  if [ "$OS" = Darwin ]; then
    ps -axwwo pid=,comm= | while read -r p c; do case "$c" in "$APPROOT"/*) echo "$p" ;; esac; done
  else
    for d in /proc/[0-9]*; do
      e=$(readlink "$d/exe" 2>/dev/null) || continue
      case "$e" in "$APPROOT"/*) echo "${d#/proc/}" ;; esac
    done
  fi
}
count() { pids | wc -l | tr -d ' '; }
# The installed app acting as Node, for the checks written in JavaScript. No window opens.
as_node() { ELECTRON_RUN_AS_NODE=1 "$BIN" "$@"; }
# Hands a command to the running app through its control channel (electron/control.cjs),
# sent by scripts/control.cjs run by the installed app acting as Node: no window, and no
# second instance of the app, which on Windows could hand the app the foreground. The app
# serves the channel because the launch step started it with --no-activate (or --control),
# and it is found through control.json in DATA_DIR, which is therefore required here.
ask() {
  if [ -z "${DATA_DIR:-}" ]; then say "FAILED: set DATA_DIR to the data folder the launch step used"; return 1; fi
  if as_node "$HERE/control.cjs" --data-dir "$DATA_DIR" --wait 20 -- "$@" >>"$OUT" 2>&1; then return 0; fi
  say "FAILED: the running app did not carry out $* (see the reply above)"
  return 1
}

case "$STEP" in
  list)
    [ -e "$BIN" ] || { say "FAILED: nothing installed at $APPROOT"; exit 1; }
    say "installed at: $APPROOT ($(du -sk "$APPROOT" | cut -f1) kB)"
    say "executable: $(ls -l "$BIN")"
    for f in $HELPERS manifest.json; do say "helper: $(ls -l "$RES/bin/$TARGET/$f" 2>&1)"; done
    say "notices: $(ls -l "$RES/THIRD-PARTY-NOTICES.txt" 2>&1)"
    if [ "$OS" = Darwin ]; then
      say "bundle id: $(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$APP/Contents/Info.plist"), version $(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$APP/Contents/Info.plist"), minimum macOS $(/usr/libexec/PlistBuddy -c 'Print :LSMinimumSystemVersion' "$APP/Contents/Info.plist")"
      if codesign --verify --deep --strict "$APP" >>"$OUT" 2>&1; then say "codesign --verify --deep --strict: passes"; else say "FAILED: codesign --verify --deep --strict"; fi
      for f in "$APP" $(for h in $HELPERS; do printf '%s ' "$RES/bin/$TARGET/$h"; done); do
        info=$(codesign -dv "$f" 2>&1)
        say "signature of ${f#"$APP"/}: $(echo "$info" | grep -E '^(Signature|TeamIdentifier)=' | tr '\n' ' ')$(echo "$info" | grep -o 'flags=[^ ]*')"
        case "$info" in *runtime*) ;; *) say "FAILED: ${f#"$APP"/} lacks the hardened runtime flag" ;; esac
      done
      say "entitlements of the app: $(codesign -d --entitlements - "$APP" 2>/dev/null | grep -o 'com\.apple[a-z.-]*' | tr '\n' ' ')"
      for h in $HELPERS; do say "entitlements of $h: $(codesign -d --entitlements - "$RES/bin/$TARGET/$h" 2>/dev/null | grep -o 'com\.apple[a-z.-]*' | tr '\n' ' ')(none expected)"; done
      say "Gatekeeper (spctl --assess --type execute): $(spctl --assess --type execute -v "$APP" 2>&1 | tr '\n' ' ')"
      say "quarantine mark: $(xattr -p com.apple.quarantine "$APP" 2>/dev/null || echo none)"
    else
      if [ "$KIND" = deb ]; then
        say "package: $(dpkg -s "$LINUX_NAME" 2>&1 | grep -E '^(Status|Version|Architecture):' | tr '\n' ' ')"
        say "command: $(ls -l "/usr/bin/$LINUX_NAME" 2>&1)"
        ENTRY="/usr/share/applications/$APP_ID.desktop"
        ICONS=/usr/share/icons/hicolor
        say "AppArmor profile carried: $(ls -l "$RES/apparmor-profile" 2>&1)"
        say "AppArmor profile installed: $( [ -f "/etc/apparmor.d/$LINUX_NAME" ] && echo yes || echo "no (AppArmor is not active here, or its parser does not accept the profile)")"
      else
        ENTRY="${XDG_DATA_HOME:-$HOME/.local/share}/applications/$APP_ID.desktop"
        ICONS="${XDG_DATA_HOME:-$HOME/.local/share}/icons/hicolor"
      fi
      S=$(ls -ln "$APPROOT/chrome-sandbox" 2>&1)
      say "sandbox helper: $S"
      if [ "$KIND" = deb ]; then case "$S" in "-rwsr-xr-x"*" 0 0 "*) say "sandbox helper is root-owned with mode 4755" ;; *) say "FAILED: the sandbox helper must be root-owned with mode 4755" ;; esac; fi
      say "desktop entry: $ENTRY"
      sed 's/^/  /' "$ENTRY" 2>&1 | tee -a "$OUT"
      if command -v desktop-file-validate >/dev/null 2>&1; then if desktop-file-validate "$ENTRY" >>"$OUT" 2>&1; then say "desktop-file-validate: passes"; else say "FAILED: desktop-file-validate"; fi; fi
      say "icons: $(ls "$ICONS"/*/apps/"$APP_ID".png 2>/dev/null | wc -l | tr -d ' ') sizes of $APP_ID.png under $ICONS"
      MISSING=$(ldd "$BIN" 2>/dev/null | grep 'not found' || true)
      if [ -z "$MISSING" ]; then say "shared libraries: all found"; else say "FAILED: missing shared libraries: $MISSING"; fi
      say "desktop name in the packaged app: $(grep -a -o '"desktopName": *"[^"]*"' "$RES/app.asar" | head -1)"
    fi
    ;;
  helpers)
    rm -f "$EVIDENCE/installed-helpers.json"
    as_node "$HERE/installed-helpers.cjs" --out "$EVIDENCE/installed-helpers.json" 2>&1 | tee -a "$OUT"
    [ -f "$EVIDENCE/installed-helpers.json" ] || say "FAILED: the installed app did not run the check. If its RunAsNode fuse is off: node scripts/installed-helpers.cjs --resources \"$RES\""
    ;;
  launch)
    if [ "$(count)" != 0 ]; then say "FAILED: the app is already running from $APPROOT"; exit 1; fi
    if [ "$OS" = Darwin ]; then
      set -- -g "$APP"
      if [ "${EMPTY_PATH:-}" = 1 ]; then set -- "$@" --env PATH=; fi
      IFS='
'
      # shellcheck disable=SC2046
      set -- "$@" --args $(common)
      unset IFS
      # shellcheck disable=SC2086
      set -- "$@" ${LAUNCH_EXTRA:-}
      say "open $*"
      open "$@" 2>&1 | tee -a "$OUT"
    else
      if [ "$KIND" = deb ]; then ENTRY="/usr/share/applications/$APP_ID.desktop"; else ENTRY="${XDG_DATA_HOME:-$HOME/.local/share}/applications/$APP_ID.desktop"; fi
      # What a launcher does with a desktop entry: take Exec and drop the field codes.
      EXEC=$(sed -n 's/^Exec=//p' "$ENTRY" | head -1 | sed 's/ *%[fFuUdDnNickvm]//g')
      say "desktop entry $ENTRY: Exec=$EXEC"
      if [ "${EMPTY_PATH:-}" = 1 ]; then LAUNCH_PATH=; else LAUNCH_PATH=$PATH; fi
      IFS='
'
      # shellcheck disable=SC2046
      set -- $(common)
      unset IFS
      # shellcheck disable=SC2086
      set -- "$@" ${LAUNCH_EXTRA:-}
      # A launcher starts the program with the session's environment; this is the
      # same with everything unrelated removed. Absolute paths throughout.
      # shellcheck disable=SC2086
      /usr/bin/env -i HOME="$HOME" USER="${USER:-}" DISPLAY="${DISPLAY:-}" WAYLAND_DISPLAY="${WAYLAND_DISPLAY:-}" \
        XDG_SESSION_TYPE="${XDG_SESSION_TYPE:-}" XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-}" DBUS_SESSION_BUS_ADDRESS="${DBUS_SESSION_BUS_ADDRESS:-}" \
        PATH="$LAUNCH_PATH" /usr/bin/setsid $EXEC "$@" >"$EVIDENCE/app.log" 2>&1 &
    fi
    n=0
    while [ "$(count)" = 0 ] && [ $n -lt 30 ]; do sleep 0.5; n=$((n + 1)); done
    sleep 5
    say "processes running from $APPROOT: $(count)"
    if [ "$(count)" = 0 ]; then say "FAILED: the app is not running"; [ -f "$EVIDENCE/app.log" ] && tail -5 "$EVIDENCE/app.log" | tee -a "$OUT"; exit 1; fi
    if [ "$OS" = Linux ]; then
      MAIN=$(pids | sort -n | head -1)
      say "PATH of the app's main process: '$(tr '\0' '\n' < "/proc/$MAIN/environ" | sed -n 's/^PATH=//p')'"
      # The renderer is sandboxed when it runs under seccomp filter mode (2).
      for p in $(pids); do
        if tr '\0' ' ' < "/proc/$p/cmdline" | grep -q -- '--type=renderer'; then say "renderer $p: Seccomp $(sed -n 's/^Seccomp:[[:space:]]*//p' "/proc/$p/status"), $(tr '\0' ' ' < "/proc/$p/cmdline" | grep -o -- '--no-sandbox' || echo 'no --no-sandbox switch')"; fi
      done
    else
      MAIN=$(pids | sort -n | head -1)
      say "PATH of the app's main process: '$(ps eww -o command= -p "$MAIN" | tr ' ' '\n' | sed -n 's/^PATH=//p' | head -1)'"
      say "frontmost app: $(lsappinfo info -only name "$(lsappinfo front)" 2>/dev/null | tr -d '\n')"
    fi
    ;;
  collect)
    if [ "$(count)" = 0 ]; then say "FAILED: the app is not running from $APPROOT. Run the launch step first."; exit 1; fi
    rm -f "$EVIDENCE/installed-diagnostics.json" "$EVIDENCE/installed-window.png"
    ask "--diagnostics=$EVIDENCE/installed-diagnostics.json" "--capture=$EVIDENCE/installed-window.png"
    sleep 1
    if [ -f "$EVIDENCE/installed-diagnostics.json" ]; then
      as_node "$HERE/installed-diagnostics.cjs" "$EVIDENCE/installed-diagnostics.json" "$APPROOT" 2>&1 | tee -a "$OUT"
    else
      say "FAILED: the running app wrote no diagnostics. Is it running with the same data folder?"
    fi
    say "window picture: $(ls -l "$EVIDENCE/installed-window.png" 2>&1)"
    ;;
  memory)
    P=$(pids | tr '\n' ' ')
    [ -n "$P" ] || { say "FAILED: the app is not running from $APPROOT"; exit 1; }
    if [ "$OS" = Darwin ]; then
      # shellcheck disable=SC2086
      footprint $P > "$EVIDENCE/installed-footprint.txt" 2>&1
      grep -E '^(Summary Footprint|[A-Za-z].*\[[0-9]+\].*Footprint)' "$EVIDENCE/installed-footprint.txt" | tee -a "$OUT"
      MB=$(sed -n 's/^Summary Footprint:[[:space:]]*\([0-9.]*\) \([KMG]\)B.*/\1 \2/p' "$EVIDENCE/installed-footprint.txt" | awk '{ if ($2=="G") print $1*1024; else if ($2=="K") print $1/1024; else print $1 }')
      [ -n "$MB" ] || MB=$(grep -E 'Footprint: *[0-9.]+ [KMG]B' "$EVIDENCE/installed-footprint.txt" | sed 's/.*Footprint: *\([0-9.]*\) \([KMG]\)B.*/\1 \2/' | awk '{ if ($2=="G") s+=$1*1024; else if ($2=="K") s+=$1/1024; else s+=$1 } END { print s }')
      HOW="footprint, summed over"
    else
      KB=0
      for p in $P; do
        k=$(awk '/^(Anonymous|Swap):/ { s += $2 } END { print s + 0 }' "/proc/$p/smaps_rollup" 2>/dev/null || echo 0)
        say "  pid $p: $k kB ($(tr '\0' ' ' < "/proc/$p/cmdline" | grep -o -- '--type=[a-z-]*' || echo main))"
        KB=$((KB + k))
      done
      MB=$((KB / 1024))
      HOW="Anonymous + Swap from smaps_rollup, summed over"
    fi
    say "memory: $MB MB ($HOW $(echo "$P" | wc -w | tr -d ' ') processes); budget ${BUDGET_MB:-300} MB, ceiling ${CEILING_MB:-680} MB"
    awk -v m="$MB" -v b="${BUDGET_MB:-300}" -v c="${CEILING_MB:-680}" 'BEGIN { if (m > c) print "FAILED: over the ceiling"; else if (m > b) print "over budget: record the reason in docs/DECISIONS.md or bring it down"; else print "within budget" }' | tee -a "$OUT"
    ;;
  quit)
    if [ "$(count)" = 0 ]; then say "the app is not running; nothing to close"; else
      ask --quit
      n=0
      while [ "$(count)" != 0 ] && [ $n -lt 30 ]; do sleep 0.5; n=$((n + 1)); done
      say "processes still running from $APPROOT: $(count)"
    fi
    ;;
  uninstall)
    if [ "$(count)" != 0 ]; then say "FAILED: the app is running. Run the quit step first."; exit 1; fi
    if [ "$OS" = Darwin ]; then
      case "$APP" in */"$PRODUCT_NAME".app) rm -rf "$APP"; say "removed $APP" ;; *) say "FAILED: refusing to remove $APP" ;; esac
    elif [ "$KIND" = deb ]; then
      DEBIAN_FRONTEND=noninteractive apt-get remove -y "$LINUX_NAME" >>"$OUT" 2>&1 && say "removed the package $LINUX_NAME"
      say "left behind under /opt/$LINUX_NAME: $(ls "/opt/$LINUX_NAME" 2>/dev/null | wc -l | tr -d ' ') entries; profile: $( [ -f "/etc/apparmor.d/$LINUX_NAME" ] && echo still there || echo gone)"
    else
      "$APPROOT/install-for-user.sh" --remove | tee -a "$OUT"
      case "$APPROOT" in */"$LINUX_NAME-$VERSION-linux-$ARCH") rm -rf "$APPROOT"; say "removed $APPROOT" ;; *) say "FAILED: refusing to remove $APPROOT" ;; esac
    fi
    ;;
  *) say "unknown step '$STEP'" ;;
esac
say done
