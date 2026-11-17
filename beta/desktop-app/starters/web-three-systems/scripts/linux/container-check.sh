#!/bin/sh
# Installs one Linux package form in a clean container and runs the installed
# check on it under a virtual display. Run as root inside the container:
#
#   docker run --rm --platform linux/arm64 --shm-size=1g --security-opt seccomp=unconfined \
#     -v "$PWD/out":/out:ro -v "$PWD/scripts":/scripts:ro -v "$PWD/qa/evidence/linux":/evidence \
#     debian:bookworm-slim sh /scripts/linux/container-check.sh deb
#
#   container-check.sh deb        install the .deb with apt, launch from its desktop entry
#   container-check.sh portable   unpack the .tar.gz as an ordinary user, add the menu entry, launch from it
#   container-check.sh deb light  install, then only what needs no display (files and helpers);
#                                 for an emulated x64 container
#
# The Chromium sandbox needs more than a default container allows: with
# --security-opt seccomp=unconfined it uses a user namespace, with
# --cap-add SYS_ADMIN the setuid helper, and with neither the app stops at
# start (which is recorded, not hidden: the app is never given --no-sandbox).
set -u
KIND=${1:-deb}
MODE=${2:-full}
export DEBIAN_FRONTEND=noninteractive
# shellcheck disable=SC1091
. /out/package.env
DEB_ARCH=$(dpkg --print-architecture)
ARCH=$(echo "$DEB_ARCH" | sed 's/amd64/x64/')
export EVIDENCE=/evidence PACKAGE_ENV=/out/package.env KIND
mkdir -p "$EVIDENCE" && chmod 777 "$EVIDENCE"
echo "== $(. /etc/os-release && echo "$PRETTY_NAME") $DEB_ARCH, kernel $(uname -r), $KIND, $MODE"

apt-get update -qq >/dev/null 2>&1
apt-get install -y -qq --no-install-recommends xvfb xauth dbus-x11 desktop-file-utils x11-utils procps >/dev/null 2>&1 || { echo "FAILED: could not install the test tools"; exit 1; }
useradd -m -s /bin/sh tester

if [ "$KIND" = deb ]; then
  sh /scripts/install.sh deb "/out/${LINUX_NAME}_${VERSION}_${DEB_ARCH}.deb" || { tail -20 "$EVIDENCE/install-log.txt"; exit 1; }
else
  # A portable build declares no dependencies; a desktop system has these already.
  # The package's own list, taking the first alternative this system has.
  sed -n 's/^Depends: //p' /scripts/linux/deb-control.in | tr ',' '\n' | while read -r group; do
    for alt in $(echo "$group" | tr '|' ' '); do
      if apt-get install -y -qq --no-install-recommends "$alt" >/dev/null 2>&1; then break; fi
    done
  done
  su tester -c "EVIDENCE=$EVIDENCE PACKAGE_ENV=$PACKAGE_ENV sh /scripts/install.sh portable /out/${LINUX_NAME}-${VERSION}-linux-${ARCH}.tar.gz" || exit 1
fi

# The AppArmor profile only matters on a real Ubuntu kernel, which a container
# does not have. What can be checked here is whether this distribution's
# AppArmor parser accepts the profile, which decides whether the package's
# postinst would install it. Set CHECK_APPARMOR=1 to install the parser for that.
if [ "$KIND" = deb ] && [ "${CHECK_APPARMOR:-}" = 1 ]; then
  apt-get install -y -qq --no-install-recommends apparmor >/dev/null 2>&1
  if command -v apparmor_parser >/dev/null 2>&1; then
    if apparmor_parser --skip-kernel-load --debug "/opt/$LINUX_NAME/resources/apparmor-profile" >/dev/null 2>"$EVIDENCE/apparmor-parser.txt"; then
      echo "AppArmor: $(apparmor_parser --version | head -1) accepts the bundled profile; postinst would install it on a system with AppArmor on"
    else
      echo "AppArmor: $(apparmor_parser --version | head -1) does not accept the bundled profile ($(grep -v "Cache read/write disabled" "$EVIDENCE/apparmor-parser.txt" | head -1)); postinst skips it"
    fi
  fi
  echo "AppArmor in this kernel: $( [ -d /sys/kernel/security/apparmor ] && echo on || echo 'not available (a container shares the host kernel)'); unprivileged user namespace restriction: $(cat /proc/sys/kernel/apparmor_restrict_unprivileged_userns 2>/dev/null || echo 'no such setting here')"
fi

if [ "$MODE" = light ]; then
  su tester -c "EVIDENCE=$EVIDENCE PACKAGE_ENV=$PACKAGE_ENV KIND=$KIND sh /scripts/installed-check.sh list; EVIDENCE=$EVIDENCE PACKAGE_ENV=$PACKAGE_ENV KIND=$KIND sh /scripts/installed-check.sh helpers"
  exit 0
fi

cat > /tmp/session.sh <<EOF
export HOME=/home/tester DISPLAY=:99 EVIDENCE=$EVIDENCE PACKAGE_ENV=$PACKAGE_ENV KIND=$KIND DATA_DIR=/home/tester/app-data EMPTY_PATH=1 LAUNCH_EXTRA=--control
export XDG_RUNTIME_DIR=/tmp/xdg-tester; mkdir -p \$XDG_RUNTIME_DIR; chmod 700 \$XDG_RUNTIME_DIR
Xvfb :99 -screen 0 1280x800x24 -nolisten tcp >/dev/null 2>&1 &
XVFB=\$!
sleep 1
dbus-run-session -- sh -c '
  sh /scripts/installed-check.sh list
  sh /scripts/installed-check.sh helpers
  if sh /scripts/installed-check.sh launch; then
    echo "window on the display: \$(xwininfo -root -tree 2>/dev/null | grep -i -E "\"$PRODUCT_NAME\"|$APP_ID" | head -2 | tr -s " ")"
    sh /scripts/installed-check.sh collect
    sleep 20
    sh /scripts/installed-check.sh memory
    sh /scripts/installed-check.sh quit
  fi'
kill \$XVFB
EOF
chmod 755 /tmp/session.sh
su tester -c "sh /tmp/session.sh"

if [ "$KIND" = deb ]; then sh /scripts/installed-check.sh uninstall; else su tester -c "EVIDENCE=$EVIDENCE PACKAGE_ENV=$PACKAGE_ENV KIND=portable sh /scripts/installed-check.sh uninstall"; fi
