#!/bin/bash
# Runs inside the container while the app is up (measure/shell-evidence.ts
# calls it through --observe). Records what only the display side can show:
# a picture of the whole display, so the window's buttons, frame and shadow are
# in it; what the window manager or compositor knows about the window; and
# whether each of the app's processes is sandboxed.
#
# From the environment: OBSERVE_OUT (folder), OBSERVE_NAME (which moment),
# APP_PID (the app's main process), SESSION (x11, sway or weston).
set -u
out=$OBSERVE_OUT
name=$OBSERVE_NAME

case "$SESSION" in
  x11)
    import -display "$DISPLAY" -window root "$out/display-$name.png"
    {
      echo "# root window"
      xprop -root _NET_ACTIVE_WINDOW _NET_CLIENT_LIST _NET_SUPPORTING_WM_CHECK 2>&1
      for id in $(xprop -root _NET_CLIENT_LIST 2>/dev/null | sed 's/^.*# //; s/,//g'); do
        echo "# window $id"
        xprop -id "$id" WM_CLASS _NET_WM_NAME _NET_WM_PID _NET_WM_STATE _MOTIF_WM_HINTS _GTK_FRAME_EXTENTS _NET_FRAME_EXTENTS 2>&1
        xwininfo -id "$id" 2>&1 | grep -E 'Absolute|Width|Height|Map State'
      done
    } >"$out/x11-windows-$name.txt"
    ;;
  sway)
    grim "$out/display-$name.png"
    swaymsg -t get_tree >"$out/sway-tree-$name.json"
    ;;
  weston)
    # weston-screenshooter needs weston --debug and writes wayland-screenshot-<time>.png where it runs.
    (cd "$out" && weston-screenshooter && mv wayland-screenshot-*.png "display-$name.png")
    ;;
esac

# One line per process of the app: its kind, its seccomp mode (2 means a filter
# is installed), its user namespace, and whether it was started with the sandbox off.
{
  echo "main $APP_PID userns=$(readlink /proc/$APP_PID/ns/user)"
  for dir in /proc/[0-9]*; do
    pid=${dir#/proc/}
    cmd=$(tr '\0' ' ' <"$dir/cmdline" 2>/dev/null) || continue
    case "$cmd" in *"/electron/dist/electron"*) ;; *) continue ;; esac
    kind=$(echo "$cmd" | grep -o -E -- '--type=[a-z-]+' | head -1)
    off=$(echo "$cmd" | grep -o -E -- '--no-sandbox|--no-zygote-sandbox|--disable-gpu-sandbox' | tr '\n' ' ')
    echo "$pid ${kind:---type=browser} seccomp=$(awk '/^Seccomp:/ { print $2 }' "$dir/status" 2>/dev/null) userns=$(readlink "$dir/ns/user" 2>/dev/null) pidns=$(readlink "$dir/ns/pid" 2>/dev/null) ${off:+sandbox-off:$off}"
  done
} >"$out/sandbox-$name.txt"
