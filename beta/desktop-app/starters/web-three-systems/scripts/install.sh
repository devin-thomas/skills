#!/bin/sh
# Installs the packaged app the way a person would, on macOS or Linux.
#
#   scripts/install.sh                        macOS: copy the signed .app into an Applications folder
#   scripts/install.sh deb <file.deb>         Linux: install the package with apt (as root)
#   scripts/install.sh portable <file.tar.gz> Linux: unpack for this user and add the menu entry
#
# Environment:
#   INSTALL_TO   macOS: the Applications folder (default ~/Applications; /Applications also works)
#                Linux portable: the folder to unpack into (default ~/.local/opt)
#   EVIDENCE     where install-log.txt goes (default <project>/qa/evidence)
#   PACKAGE_ENV  the names file package.mjs wrote (default <project>/out/package.env)
#
# Nothing here needs administrator rights except the Linux package, which is
# how packages are installed. Windows has install.ps1.
set -eu
HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$HERE/.." && pwd)
EVIDENCE=${EVIDENCE:-$ROOT/qa/evidence}
PACKAGE_ENV=${PACKAGE_ENV:-$ROOT/out/package.env}
mkdir -p "$EVIDENCE"
LOG="$EVIDENCE/install-log.txt"
# shellcheck disable=SC1090
. "$PACKAGE_ENV"
say() { echo "$*" | tee -a "$LOG"; }
: > "$LOG"
say "install started $(date +%Y-%m-%dT%H:%M:%S%z) on $(uname -s) $(uname -m)"

case "$(uname -s)" in
  Darwin)
    SRC="$ROOT/out/$PRODUCT_NAME-darwin-$(uname -m | sed 's/x86_64/x64/')/$PRODUCT_NAME.app"
    [ -d "$SRC" ] || { say "INSTALL FAILED: no packaged app at $SRC. Run 'pnpm package:mac' first."; exit 1; }
    TO=${INSTALL_TO:-$HOME/Applications}
    APP="$TO/$PRODUCT_NAME.app"
    if ps -axo comm= | grep -F -q "$APP/Contents/MacOS/"; then say "INSTALL FAILED: $APP is running. Close it first (installed-check.sh quit)."; exit 1; fi
    mkdir -p "$TO"
    rm -rf "$APP"
    # ditto keeps the signature, the executable bits and the bundle's symbolic links.
    ditto "$SRC" "$APP"
    say "copied to $APP ($(du -sk "$APP" | cut -f1) kB)"
    if codesign --verify --deep --strict "$APP" 2>>"$LOG"; then say "signature verifies after the copy"; else say "INSTALL FAILED: the copy does not verify"; exit 1; fi
    for f in $HELPERS; do
      h="$APP/Contents/Resources/bin/darwin-$(uname -m | sed 's/x86_64/x64/')/$f"
      [ -x "$h" ] || { say "INSTALL FAILED: missing or not executable: $h"; exit 1; }
      say "helper: $h ($(wc -c < "$h" | tr -d ' ') bytes)"
    done
    [ -f "$APP/Contents/Resources/THIRD-PARTY-NOTICES.txt" ] || { say "INSTALL FAILED: no notices file"; exit 1; }
    say "notices: $APP/Contents/Resources/THIRD-PARTY-NOTICES.txt"
    ;;
  Linux)
    MODE=${1:-}
    FILE=${2:-}
    [ -f "$FILE" ] || { say "INSTALL FAILED: usage: install.sh deb <file.deb> | portable <file.tar.gz>"; exit 1; }
    case "$MODE" in
      deb)
        [ "$(id -u)" = 0 ] || { say "INSTALL FAILED: installing a package needs root (sudo scripts/install.sh deb $FILE)"; exit 1; }
        say "apt-get install $FILE"
        DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends "$(cd "$(dirname "$FILE")" && pwd)/$(basename "$FILE")" >>"$LOG" 2>&1 || { say "INSTALL FAILED: apt-get (see $LOG)"; exit 1; }
        say "$(dpkg -s "$LINUX_NAME" | grep -E '^(Status|Version|Architecture):' | tr '\n' ' ')"
        say "sandbox helper: $(ls -l "/opt/$LINUX_NAME/chrome-sandbox")"
        say "command: $(ls -l "/usr/bin/$LINUX_NAME")"
        say "desktop entry: /usr/share/applications/$APP_ID.desktop ($( [ -f "/usr/share/applications/$APP_ID.desktop" ] && echo present || echo MISSING))"
        ;;
      portable)
        TO=${INSTALL_TO:-$HOME/.local/opt}
        mkdir -p "$TO"
        tar -xzf "$FILE" -C "$TO"
        DIR="$TO/$(basename "$FILE" .tar.gz)"
        say "unpacked to $DIR"
        say "$("$DIR/install-for-user.sh")"
        say "sandbox helper: $(ls -l "$DIR/chrome-sandbox")"
        ;;
      *) say "INSTALL FAILED: unknown mode '$MODE'"; exit 1 ;;
    esac
    ;;
  *) say "INSTALL FAILED: use install.ps1 on Windows"; exit 1 ;;
esac
say "install finished OK"
