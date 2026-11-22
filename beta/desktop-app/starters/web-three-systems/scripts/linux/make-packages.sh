#!/bin/sh
# Turns a packaged Linux app folder into a .deb and a portable .tar.gz.
# Started by scripts/package.ts, normally inside a Debian container, as root.
#
#   make-packages.sh <out-dir> <icons-dir> <scripts-dir>
#
# Environment: APP_DIR_NAME (folder under out-dir), PRODUCT_NAME, DESCRIPTION,
# COMPANY, LINUX_NAME, APP_ID, VERSION, ARCH (arm64 | x64), CATEGORIES, MIME_TYPES.
#
# The package tree is assembled on this machine's own filesystem, not in
# out-dir, because the sandbox helper must be owned by root with mode 4755 and
# a shared folder may not keep either.
set -eu
OUT=${1:?out dir}
ICONS=${2:?icons dir}
SCRIPTS=${3:?scripts dir}
: "${APP_DIR_NAME:?}" "${PRODUCT_NAME:?}" "${LINUX_NAME:?}" "${APP_ID:?}" "${VERSION:?}" "${ARCH:?}"
DESCRIPTION=${DESCRIPTION:-$PRODUCT_NAME}
COMPANY=${COMPANY:-$PRODUCT_NAME}
CATEGORIES=${CATEGORIES:-Utility;}
MIME_TYPES=${MIME_TYPES:-}
case "$ARCH" in arm64) DEB_ARCH=arm64 ;; x64) DEB_ARCH=amd64 ;; *) echo "unknown ARCH $ARCH" >&2; exit 2 ;; esac
[ -x "$OUT/$APP_DIR_NAME/$LINUX_NAME" ] || { echo "no packaged app at $OUT/$APP_DIR_NAME" >&2; exit 1; }
SIZES="16 24 32 48 64 128 256 512"

fill() { # template -> stdout
  sed -e "s|@PRODUCT_NAME@|$PRODUCT_NAME|g" -e "s|@DESCRIPTION@|$DESCRIPTION|g" -e "s|@COMPANY@|$COMPANY|g" \
      -e "s|@LINUX_NAME@|$LINUX_NAME|g" -e "s|@APP_ID@|$APP_ID|g" -e "s|@VERSION@|$VERSION|g" \
      -e "s|@DEB_ARCH@|$DEB_ARCH|g" -e "s|@CATEGORIES@|$CATEGORIES|g" -e "s|@EXEC@|$2|g" "$1"
}
desktop() { # exec path -> stdout
  fill "$SCRIPTS/app.desktop.in" "$1"
  if [ -n "$MIME_TYPES" ]; then echo "MimeType=$MIME_TYPES"; fi
}

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

# ---- .deb -----------------------------------------------------------------------
if ! command -v dpkg-deb >/dev/null 2>&1; then echo "dpkg-deb is needed" >&2; exit 1; fi
PKG="$WORK/deb"
APP="$PKG/opt/$LINUX_NAME"
mkdir -p "$APP" "$PKG/usr/bin" "$PKG/usr/share/applications" "$PKG/usr/share/doc/$LINUX_NAME" "$PKG/DEBIAN"
cp -a "$OUT/$APP_DIR_NAME/." "$APP/"
find "$APP" -type d -exec chmod 755 {} +
find "$APP" -type f -exec chmod u+rw,go+r,go-w {} +
chown -R 0:0 "$PKG"
# The Chromium sandbox helper: root-owned and setuid, so the sandbox works on
# kernels where an unprivileged process may not create a user namespace.
chmod 4755 "$APP/chrome-sandbox"
chmod 755 "$APP/$LINUX_NAME"; find "$APP"/resources/bin -type f ! -name manifest.json -exec chmod 755 {} +
fill "$SCRIPTS/apparmor-profile.in" "" > "$APP/resources/apparmor-profile"
ln -s "/opt/$LINUX_NAME/$LINUX_NAME" "$PKG/usr/bin/$LINUX_NAME"
desktop "/opt/$LINUX_NAME/$LINUX_NAME %U" > "$PKG/usr/share/applications/$APP_ID.desktop"
for s in $SIZES; do
  mkdir -p "$PKG/usr/share/icons/hicolor/${s}x${s}/apps"
  cp "$ICONS/${s}x${s}.png" "$PKG/usr/share/icons/hicolor/${s}x${s}/apps/$APP_ID.png"
done
cat > "$PKG/usr/share/doc/$LINUX_NAME/copyright" <<EOF
$PRODUCT_NAME $VERSION
Copyright $COMPANY

Third-party software in this package, with licence texts, build
configuration and where to get the source:
  /opt/$LINUX_NAME/resources/THIRD-PARTY-NOTICES.txt   (the bundled programs)
  /opt/$LINUX_NAME/LICENSE                             (Electron)
  /opt/$LINUX_NAME/LICENSES.chromium.html              (Chromium and its parts)
EOF
fill "$SCRIPTS/deb-control.in" "" > "$PKG/DEBIAN/control"
echo "Installed-Size: $(du -sk "$PKG/opt" "$PKG/usr" | awk '{s+=$1} END {print s}')" >> "$PKG/DEBIAN/control"
for script in postinst postrm; do
  fill "$SCRIPTS/deb-$script.in" "" > "$PKG/DEBIAN/$script"
  chmod 755 "$PKG/DEBIAN/$script"
done
find "$PKG" -name .DS_Store -delete
DEB="$OUT/${LINUX_NAME}_${VERSION}_${DEB_ARCH}.deb"
rm -f "$DEB"
dpkg-deb --root-owner-group -Zxz --build "$PKG" "$WORK/package.deb" >/dev/null
cp "$WORK/package.deb" "$DEB"
echo "deb: $DEB ($(wc -c < "$DEB" | tr -d ' ') bytes)"
dpkg-deb --info "$DEB" | sed -n '1,25p'
dpkg-deb --contents "$DEB" | grep -E 'chrome-sandbox|/usr/bin/|\.desktop|resources/bin/|NOTICES|apparmor' || true
if command -v desktop-file-validate >/dev/null 2>&1; then desktop-file-validate "$PKG/usr/share/applications/$APP_ID.desktop" && echo "desktop file: valid"; fi

# ---- portable .tar.gz ---------------------------------------------------------------
TOP="${LINUX_NAME}-${VERSION}-linux-${ARCH}"
PORT="$WORK/$TOP"
mkdir -p "$PORT/share/icons"
cp -a "$OUT/$APP_DIR_NAME/." "$PORT/"
chmod 755 "$PORT/$LINUX_NAME" "$PORT/chrome-sandbox"; find "$PORT"/resources/bin -type f ! -name manifest.json -exec chmod 755 {} +
desktop "@INSTALL_DIR@/$LINUX_NAME %U" > "$PORT/share/$APP_ID.desktop"
for s in $SIZES; do cp "$ICONS/${s}x${s}.png" "$PORT/share/icons/${s}x${s}.png"; done
fill "$SCRIPTS/portable-install.sh.in" "" > "$PORT/install-for-user.sh"
chmod 755 "$PORT/install-for-user.sh"
fill "$SCRIPTS/portable-README.txt.in" "" > "$PORT/README.txt"
find "$PORT" -name .DS_Store -delete
TAR="$OUT/$TOP.tar.gz"
rm -f "$TAR"
tar -C "$WORK" --owner=0 --group=0 --numeric-owner -czf "$WORK/portable.tar.gz" "$TOP"
cp "$WORK/portable.tar.gz" "$TAR"
echo "tar.gz: $TAR ($(wc -c < "$TAR" | tr -d ' ') bytes)"
