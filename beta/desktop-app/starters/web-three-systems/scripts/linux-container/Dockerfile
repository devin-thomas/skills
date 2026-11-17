# The app on arm64 Linux, for the checks in scripts/linux-container/run.sh.
# Built from the recipe proven in research report 10: Debian 12, GTK 3, Xvfb
# with openbox for X11, sway and weston (both headless) for Wayland.
# Build context is the project root: run.sh passes it.
FROM node:24-bookworm-slim
ENV DEBIAN_FRONTEND=noninteractive

# Libraries Electron loads, a display server and window manager for each
# protocol, screenshot tools for each (import, grim, weston-screenshooter),
# a session bus, and fonts so text is not drawn as boxes.
RUN apt-get update && apt-get install -y --no-install-recommends \
      libgtk-3-0 libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libgbm1 \
      libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libasound2 libpango-1.0-0 \
      libcairo2 libx11-xcb1 libxshmfence1 libgl1-mesa-dri libegl1 libgles2 \
      xvfb xauth x11-utils x11-xserver-utils openbox imagemagick \
      weston sway grim \
      dbus dbus-x11 \
      fontconfig fonts-inter fonts-noto-core \
      ca-certificates procps \
 && rm -rf /var/lib/apt/lists/* \
 && npm install --global --no-audit --no-fund pnpm@11.9.0

# Chromium refuses to run as root with its sandbox on, and the sandbox stays on here.
RUN useradd --create-home --shell /bin/bash app
USER app
WORKDIR /home/app/project

# Dependencies first, so a change to the app's own files does not reinstall them.
# Electron 42 and later do not download their binary on install; electron:install does.
COPY --chown=app:app package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile && pnpm electron:install

COPY --chown=app:app . .
RUN pnpm build
